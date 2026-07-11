# Design Workbench — Phase 3

Developer documentation for the Design Workbench: the primary workspace
where a designer builds, reviews, edits, validates, previews, saves, and
exports a Design Specification without hand-editing JSON.

**This phase consumes the existing Design Intelligence Engine (`trend/*`)
and the Design Intelligence Core (`schemas/`, `validators/`, `services/`,
built in an earlier phase) — it does not duplicate their logic or modify
SVG generation.** Every computation the Workbench needs (building a spec,
validating it, rendering a real preview tile, generating SEO copy) is a
direct call into one of those existing modules; the components in this
directory are wiring and presentation only.

## Contents

1. [Architecture](#architecture)
2. [Folder structure](#folder-structure)
3. [Component reference](#component-reference)
4. [Developer guide](#developer-guide)
5. [Performance notes](#performance-notes)
6. [Accessibility notes](#accessibility-notes)

## Architecture

```
                     ┌───────────────────────────┐
                     │   components/workbench/     │  React UI (this doc)
                     │   DesignWorkbench.tsx        │  owns state, wires
                     │   Trend/Spec/Inspector/...   │  everything below
                     └──────────────┬────────────┘
                                    │ calls
      ┌─────────────────────────────┼─────────────────────────────┐
      │                             │                              │
┌─────▼──────┐            ┌─────────▼─────────┐         ┌──────────▼─────────┐
│  workbench/  │            │      trend/         │         │  validators/ +      │
│ (pure logic) │            │ (Design Intelligence │         │  services/           │
│              │            │  Engine — unmodified) │         │  (Design Intelligence│
│ history      │            │                       │         │   Core — unmodified) │
│ validation   │            │ designIntelligence.ts │         │                      │
│ favorites    │            │ designSpecValidation  │         │ validateDesignSpec-  │
│ importExport │            │ designSpecToParams    │         │  ificationData       │
│ jsonDiff     │            │ designSpecSeo         │         │ validateDesignSpec-  │
│ trendPack    │            │ promptTemplates       │         │  ificationRelation-  │
│              │            │ designSpecQuality     │         │  ships               │
│              │            │ designSpecCollection  │         │ colorRoleService,    │
│              │            │ trendPacks            │         │  styleDnaService, …  │
└──────────────┘            └───────────────────────┘         └──────────────────────┘
```

`components/workbench/` (React, DOM-dependent) and `workbench/` (plain
TypeScript, no React/DOM — testable without rendering anything) are
deliberately separate, mirroring the split this codebase already uses
between `trend/` (logic) and `components/*.tsx` (presentation). Nothing in
`workbench/` imports React; nothing in `components/workbench/` computes a
Design Specification field's value without going through `workbench/`,
`trend/`, or `services/`.

## Folder structure

```
app/src/
  workbench/                          Pure logic (no React), one concern per file
    workbenchHistory.ts                Undo/redo/snapshot/compare/restore reducer
    workbenchValidation.ts             Merges 3 existing validators into one
                                        categorized result (errors/warnings/
                                        suggestions/missing/duplicate/marketplace)
    workbenchFavorites.ts              localStorage favorites store
    workbenchImportExport.ts           File download/upload glue over existing
                                        parse/export functions
    workbenchTrendPack.ts              Applies an imported Trend Pack's fields
                                        onto an existing spec
    jsonDiff.ts                        Generic deep-diff (History's "Compare")
    jsonTreeUtils.ts                   Tree View's collapse/expand/search helpers
    *.test.ts

  components/workbench/                React UI
    DesignWorkbench.tsx                 Top-level shell — owns all state, wires
                                         every section together
    TrendStudioForm.tsx                 Section 1: Keyword Bundle + Trend Pack picker
    DesignSpecPanel.tsx                 Section 2: Tree/Code/Inspector views + search
    JsonTreeView.tsx                    Tree View rendering (search highlight,
                                         collapse/expand, context menu)
    PropertyInspector.tsx               Section 3: editable property forms
    ValidationPanel.tsx                 Section 4: categorized issue display
    LivePreviewPanel.tsx                Section 5: 8 preview tabs + action buttons
                                         (Apply to Editor, Run Quality Loop,
                                         Generate Collection, Download Package)
    HistoryPanel.tsx                    Section 6: Undo/Redo/Snapshot/Compare UI
    FavoritesPanel.tsx                  Section 8: star toggles + Motif Collections
    ImportExportBar.tsx                 Section 9: file import/export buttons
    workbench.css                       Layout, tabs, light/dark theme
    *.test.tsx
```

Project Integration (Section 7) lives in the existing Project system
(`project/projectTypes.ts`'s new `ProjectDesignSpecEntry`/
`ProjectDesignSpecVersion`, `project/projectManager.ts`'s
`addDesignSpecToProject`/`addDesignSpecVersion`/etc.) rather than under
`workbench/`, since a Design Spec's home is the Project, not the Workbench
UI — the Workbench just calls those functions.

## Component reference

| Component | Brief section | Reads | Writes |
| --- | --- | --- | --- |
| `TrendStudioForm` | 1 | — | `KeywordBundle` state (controlled form) |
| `DesignSpecPanel` | 2 | `spec` | Code View edits (via `parseDesignSpecificationJson`) |
| `JsonTreeView` | 2 | `spec` | — (read-only + copy-path/copy-value) |
| `PropertyInspector` | 3 | `spec` + `services/*` option lists | patched `spec` |
| `ValidationPanel` | 4 | `spec` (via `workbenchValidation.ts`) | — |
| `LivePreviewPanel` | 5 | `spec` (via `trend/*`) | triggers `onApplyToEditor`/`onGenerateCollection`/`onDownloadPackage` |
| `HistoryPanel` | 6 | `HistoryState<T>` | undo/redo/snapshot/restore actions |
| `FavoritesPanel` | 8 | `WorkbenchFavorites` | toggle/save/remove actions |
| `ImportExportBar` | 9 | `spec` / selected Trend Pack | file downloads, parsed imports |

## Developer guide

### Adding a new editable field to Property Inspector

1. Add a `Field`/control in `PropertyInspector.tsx` reading `spec.<field>`.
2. On change, call `onUpdateSpec({ ...spec, <field>: newValue })` (or use
   the existing `update(patch)` helper).
3. If the field has real-world constraints (must match a real id, must be
   compatible with another field), do **not** add that check here —
   that's what the Validation Panel is for. Property Inspector only
   builds a patched spec; `workbenchValidation.ts` (which already calls
   `validateDesignSpecificationRelationships`) reports whether the result
   is valid.

### Adding a new Live Preview tab

Add an entry to `LivePreviewPanel.tsx`'s `TABS` array and a matching
`{tab === 'yourTab' && (...)}` block. Compute its data with a `useMemo`
keyed on whatever it depends on (`spec`, `seed`, a locally-selected
option) — this is what keeps switching tabs cheap (Section 10).

### Extending the Validation Panel

Don't add a new validator here — call an existing one. If you need a
genuinely new check with no existing validator, add it to
`workbench/workbenchValidation.ts`'s `findMissingValueIssues`/
`findDuplicateValueIssues`/`findSuggestions` (the three functions that are
allowed to contain new logic, since nothing else in the codebase already
does duplicate/missing-value/suggestion detection).

### History / Undo-Redo

`workbench/workbenchHistory.ts` is generic (`HistoryState<T>`) and has no
Design Specification-specific code — `HistoryPanel.tsx` is generic too
(`HistoryPanel<T>`). Any future panel needing undo/redo/snapshot for a
different value type can reuse both without modification.

## Performance notes

- The Trend Pack/Marketplace/Style DNA/Motif Grammar/Palette libraries
  this milestone reads from (via `services/*`) are small (4/6/15/15/18
  entries) — no virtualization was needed or added for those lists.
- The Design Spec JSON Tree View **does** need to scale to an arbitrarily
  deep/wide document: it starts with only the root expanded (not
  "expand everything"), and search-driven auto-reveal only expands the
  ancestor chain of an actual match, not the whole tree.
- `LivePreviewPanel`'s 8 tabs each compute via `useMemo` keyed on their
  actual dependencies, so switching tabs never recomputes a tab you
  haven't opened, and editing one field only recomputes memos that
  actually depend on it.
- The heaviest single computation (`buildTileFromDesignSpec`, real SVG
  generation) runs once per `spec`/`seed` change and is shared between the
  Composition tab and the SEO/Filename tabs (`tile` is computed once,
  reused) rather than rebuilt per tab.

## Accessibility notes

- Every tab strip uses `role="tablist"`/`role="tab"`/`aria-selected`.
- The Tree View's expand/collapse buttons have real `aria-label`s
  ("Expand nested" / "Collapse nested"), not just an icon-in-text-content
  accessible name.
- The Tree View's per-node actions (copy path/copy value) are reachable
  via a visible, focusable button — not only a mouse-only right-click
  handler.
- Focus rings are enforced app-wide inside `.design-workbench` via
  `:focus-visible` (not `:focus`, so mouse clicks don't show a ring).
- The layout is a single responsive CSS Grid that collapses to one column
  under 1100px, tested down to a 420px mobile viewport.
- Light/dark theme is a real toggle (not just "the app is always dark"),
  respecting `prefers-color-scheme` on first load and persisting the
  user's explicit choice.
