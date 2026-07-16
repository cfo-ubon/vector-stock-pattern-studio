# Design Workbench — Phase 3 (+ Phase 6 addendum below)

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

---

## Phase 6 addendum: the Design Workbench becomes the central workspace

Phase 6 restructures the Phase 3 shell into a dockable multi-panel
workspace and integrates every engine already built in the intervening
phases (Trend Library, Marketplace Intelligence, Collection Engine,
Prompt Factory, Cluster Composition/Overlap Engine) into one place — no
new business logic, no duplicated intelligence engines. Every new
component is wiring/presentation over an existing, already-tested module.

### New architecture pieces

- **`workbench/workspaceSettings.ts`** — one serializable object
  (`WorkspaceSettings`: theme, sidebar widths, hidden panels, active tab
  per sidebar) is now the single source of truth for layout state,
  persisted to `localStorage` under `vsp-workbench-settings` (superseding
  the old standalone `vsp-workbench-theme` key) and exportable/importable
  as real JSON (Section 10).
- **`components/workbench/ResizeHandle.tsx`** — real pointer-drag (+
  arrow-key) resize for both sidebars, clamped via
  `clampSidebarWidth` (220–560px).
- **`components/workbench/PanelVisibilityBar.tsx`** — one row of toggle
  chips covering all 11 dockable panels; hiding a panel removes it from
  its sidebar's tab strip, with automatic fallback to another visible tab
  if the hidden one was active.
- **`workbench/globalSearch.ts`** + **`components/workbench/GlobalSearchBar.tsx`**
  — Section 9's search across Projects, Collections, Motifs, Trend Packs,
  and Marketplace Profiles, reading straight from each's existing
  registry/state (nothing re-indexed). Picking a Project/Collection
  result switches to that Project; picking a Trend Pack applies it to the
  current spec.

### New panels (Sections 2, 5, 6, 7)

- **`ProjectExplorer.tsx`** — browses Projects → their Collections/Assets,
  Trend Packs, and Marketplace Profiles in one tree. Trend Packs are real
  HTML5 drag targets: dragging one onto the drop zone applies it via the
  same `applyTrendPackToSpec` flow the Import/Export bar already used.
  Favorites are shown as a read-only ★ inline indicator (reusing
  `FavoritesPanel`'s own state) rather than a second toggle UI.
- **`MarketplacePanel.tsx`** — the first real UI consumer of
  `metadata/readinessScore.ts` and `trend/seoHintEngine.ts` (both built in
  Phase 5 but never wired into a component until now): Readiness Score,
  Validation, SEO Hints, Filename Hints, Submission Checklist, and
  Contributor Links for the current spec.
- **`PromptPanel.tsx`** — the Prompt Factory promoted out of Live
  Preview's old "Prompt" tab into its own dockable panel, unchanged
  template logic (`trend/promptTemplates.ts`), supporting all 7
  registered platforms.
- **`QualityPanel.tsx`** — all 6 named quality dimensions (Composition,
  Hierarchy, **Overlap** [new field, reads the real
  `CompositionMetrics.overlapQuality` from the Overlap Engine], Negative
  Space, Rhythm, Commercial Readiness) plus `buildQualityRecommendations`
  — a new, real, threshold-based (score < 60) rule engine in
  `trend/designSpecQuality.ts` that turns weak dimensions into actionable
  advice text, not just a number.

### Design Inspector extensions (Section 3)

`PropertyInspector.tsx` gained Hierarchy (picks a real
`HIERARCHY_PRESETS` entry, with an honest "— custom —" state when the
current value matches no preset), Flow, and Rhythm controls, plus a
read-only "Cluster archetypes in play" info line — the Cluster
Composition Engine has no spec field to bind an editable control to
(archetype selection happens inside the layout's own RNG), so this
surfaces the real candidate pool instead of fabricating a fake dropdown.

### Live Preview extensions (Section 4)

A new **Pattern Repeat** tab renders a real 3×3 tiled SVG
(`export/svgExporter.ts`'s existing `buildTiledSvg`) as a seamlessness
check, computed only when that tab is open. The inline quality summary on
the Composition tab now points to the standalone Quality Panel for full
scoring instead of duplicating it.

### Import/Export completion (Section 10)

`workbench/workbenchImportExport.ts` gained: Export Workspace Settings /
Import Workspace Settings (round-trips `WorkspaceSettings` JSON), Export
Collection Specification JSON (self-contained — builds the Collection
this spec/seed would generate via `designSpecCollection.ts`, then its
spec via `collectionPlan.ts`), and Export/Import Marketplace Profile.
**Honest scope note**: `marketplaces/index.ts`'s `MARKETPLACE_DATA` is a
static array built from the 6 committed JSON files at build time — an
imported profile is validated against the real schema and shown with any
issues, but cannot be registered into the live app without a rebuild, so
the import is validate-and-inspect only, not a live registration.

### Performance (Section 11)

The four Phase-6-only panels (Project Explorer, Marketplace, Prompt,
Quality) are `React.lazy`-loaded — their modules and every engine they
import aren't fetched until a designer opens that tab. Project Explorer
paginates its Projects and Trend Packs lists (20 at a time, "Load more").

### Scope decisions

- **"Dockable"** is scoped to real resizable-width + hide/restore within
  two fixed sidebar zones, not a full floating/rearrangeable docking
  system — documented in `DesignWorkbench.tsx`'s own header comment.
- **Cluster Settings** stays read-only (see above) rather than a fake
  editable control.
- **Drag-and-drop** is scoped to the one real, data-backed interaction
  (Trend Pack → apply), not an invented reordering feature with no
  backing model.

### New tests

`workspaceSettings.test.ts` (16), `globalSearch.test.ts` (8),
`designSpecQuality.test.ts` additions (5, covering `overlap` and
`buildQualityRecommendations`), plus component tests for
`ResizeHandle`, `PanelVisibilityBar`, `QualityPanel`, `MarketplacePanel`,
`PromptPanel`, `ProjectExplorer`, `GlobalSearchBar`, `ImportExportBar`,
extended `PropertyInspector.test.tsx` (Hierarchy/Flow/Rhythm/Cluster
info), a new `LivePreviewPanel.test.tsx`, extended
`workbenchImportExport.test.ts`, and an updated `DesignWorkbench.test.tsx`
for the new required props and renamed Inspector tab label.
