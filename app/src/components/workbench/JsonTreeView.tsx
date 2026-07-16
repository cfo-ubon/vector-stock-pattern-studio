import { useMemo, useState } from 'react';
import { collectSearchRevealPaths } from '../../workbench/jsonTreeUtils';

// Design Spec Panel (Section 2) — Tree View, with Search (highlights +
// auto-reveals matches) and Collapse/Expand All (Section 11's "Context
// menus" bullet: every node has a small always-keyboard-reachable "⋮"
// button, not just a mouse-only right-click handler). `collectContainerPaths`/
// `collectSearchRevealPaths` (the "expand all"/search-match logic) live in
// workbench/jsonTreeUtils.ts — this file only renders.

interface Props {
  label: string;
  value: unknown;
  search: string;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
  path?: string;
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}

function ContextMenuButton({ path, value }: { path: string; value: unknown }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="json-tree-menu" onClick={(e) => e.stopPropagation()}>
      <button type="button" className="json-tree-menu-trigger" aria-label={`Actions for ${path}`} aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        ⋮
      </button>
      {open && (
        <div className="json-tree-menu-popup" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              void copyText(path);
              setOpen(false);
            }}
          >
            Copy path
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              void copyText(typeof value === 'string' ? value : JSON.stringify(value, null, 2));
              setOpen(false);
            }}
          >
            Copy value
          </button>
        </div>
      )}
    </span>
  );
}

function highlight(text: string, search: string) {
  const query = search.trim();
  if (!query) return text;
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark className="json-tree-highlight">{text.slice(index, index + query.length)}</mark>
      {text.slice(index + query.length)}
    </>
  );
}

export function JsonTreeView({ label, value, search, expandedPaths, onToggle, path = '$' }: Props) {
  const revealPaths = useMemo(() => collectSearchRevealPaths(value, search), [value, search]);
  return <JsonTreeNode label={label} value={value} depth={0} path={path} search={search} expandedPaths={expandedPaths} onToggle={onToggle} revealPaths={revealPaths} />;
}

function JsonTreeNode({
  label,
  value,
  depth,
  path,
  search,
  expandedPaths,
  onToggle,
  revealPaths,
}: {
  label: string;
  value: unknown;
  depth: number;
  path: string;
  search: string;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
  revealPaths: Set<string>;
}) {
  if (value === null || typeof value !== 'object') {
    const text = JSON.stringify(value);
    return (
      <div className="json-tree-leaf" style={{ paddingLeft: depth * 14 }} data-testid={`tree-leaf-${path}`}>
        <span className="json-tree-key">{highlight(label, search)}:</span> <span className="json-tree-value">{highlight(text, search)}</span>
        <ContextMenuButton path={path} value={value} />
      </div>
    );
  }
  const entries = Array.isArray(value) ? value.map((v, i) => [String(i), v] as const) : Object.entries(value);
  const open = expandedPaths.has(path) || revealPaths.has(path);
  return (
    <div className="json-tree-branch" style={{ paddingLeft: depth * 14 }}>
      <button
        type="button"
        className="json-tree-toggle"
        onClick={() => onToggle(path)}
        aria-expanded={open}
        aria-label={`${open ? 'Collapse' : 'Expand'} ${label}`}
      >
        {open ? '▾' : '▸'} {highlight(label, search)} {Array.isArray(value) ? `[${entries.length}]` : '{...}'}
      </button>
      <ContextMenuButton path={path} value={value} />
      {open &&
        entries.map(([k, v]) => (
          <JsonTreeNode
            key={k}
            label={k}
            value={v}
            depth={depth + 1}
            path={Array.isArray(value) ? `${path}[${k}]` : `${path}.${k}`}
            search={search}
            expandedPaths={expandedPaths}
            onToggle={onToggle}
            revealPaths={revealPaths}
          />
        ))}
    </div>
  );
}
