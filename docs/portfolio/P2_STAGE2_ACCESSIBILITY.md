# Portfolio Manager P2 Stage 2 — Accessibility

## Tooling

No automated accessibility-testing library (axe, jest-axe, vitest-axe, or
similar) exists anywhere in this repository's `package.json`/`devDependencies`,
in the vanilla-JS site or the `/app` React app. Stage 2 did not add one —
per the architecture lock's "no new dependency unless already used or
documented critical need," and per Section 21/25's general instruction
against introducing new tooling this stage does not require. This report
is therefore a structural/manual review, not automated-tool output — the
brief's "report critical/serious/moderate/minor findings" is answered
below from that review, not from a generated axe report.

## Checklist and findings

| Requirement | Status | Where |
|---|---|---|
| Semantic buttons for every action | Pass | every new interactive element is a native `<button type="button">` (or `type="submit"` for the create-collection form) — no clickable `<div>`/`<span>` anywhere in the new Stage 2 components |
| Visible focus state | Pass | reuses the app's existing `:focus-visible` outline rules already defined in `portfolio.css` for `.portfolio-thumb`/`.portfolio-dropzone`; new classes (`.collection-card`, `.btn--small` tab buttons) inherit the same global `.btn`/`.portfolio-thumb` focus styling — no custom `outline: none` introduced anywhere |
| Form labels | Pass | `CreateCollectionDialog` (`<label htmlFor>` for name/description), `CollectionDetailPanel` (`aria-label` on the name input and cover `<select>`), `PortfolioThumbnail`'s new multi-select checkbox (`aria-label="เลือก {name} สำหรับการดำเนินการหลายรายการ"`), `CollectionDetailPanel`'s member checkboxes (`aria-label="เลือก {name}"`) |
| Dialog titles/descriptions | Pass | `CreateCollectionDialog` and `CollectionAssignmentDialog` both set `role="dialog"`, `aria-modal="true"`, and a descriptive `aria-label` (matching the existing `PortfolioImportPanel`/`PortfolioHealthCheckPanel` convention) |
| Focus trap | Partial — same as existing P1 modals | Neither this app's existing modal system (`PortfolioImportPanel`, `PortfolioHealthCheckPanel`) nor the new Stage 2 dialogs implement a JS focus trap; this is an existing, repo-wide convention, not a Stage-2-introduced regression. Flagged as a **moderate** pre-existing gap, not fixed in this stage (out of scope — fixing it would mean changing the shared modal pattern, affecting P1 dialogs too) |
| Escape handling | Pass (new dialogs) | `CreateCollectionDialog` and `CollectionAssignmentDialog` both close on `Escape` via an `onKeyDown` handler on the backdrop, matching what a focus-trapped dialog would need at minimum |
| Enter/Space activation | Pass | native `<button>`/`<input type="checkbox">`/`<select>` elements — Enter/Space activation is the browser default, no custom key handling required or added |
| Keyboard navigation | Pass | every new interactive control is a standard focusable native element in normal tab order; no custom `tabIndex` manipulation |
| Accessible selected state | Pass | `CollectionCard` and the multi-select checkboxes both expose state via `aria-pressed`/native `checked`, not color alone |
| Status messages via aria-live or equivalent | Pass | `CollectionAssignmentDialog`'s result summary uses `role="status" aria-live="polite"`; `CollectionIntegrityPanel`'s repair-result message uses the same; form errors use `role="alert"` |
| Color not the only status indicator | Pass | archived/warning badges always carry text ("เก็บถาวร", "⚠ ตรวจสอบข้อมูล"), never color-only; the archive-confirm vs delete-confirm panels are distinguished by full sentence content, not just color (Section 8) |
| Meaningful alt text for covers/thumbnails | Pass (with one deliberate exception) | `CollectionCard`'s cover `<img>` uses `alt=""` (decorative — the collection name is already rendered as adjacent text, so a redundant `alt` would be noise for screen readers, matching WCAG's "purely decorative when adjacent text already conveys the same information" guidance); `PortfolioThumbnail`'s existing `alt={asset.displayName}` convention is unchanged |

## Summary

**0 critical, 0 serious, 1 moderate (pre-existing, not Stage-2-introduced), 0 minor.**

The one moderate finding (no JS focus trap in the shared modal pattern)
predates Stage 2 — `PortfolioImportPanel.tsx` and
`PortfolioHealthCheckPanel.tsx` have the same gap today. Stage 2's two new
dialogs (`CreateCollectionDialog`, `CollectionAssignmentDialog`) match
that existing pattern exactly rather than diverging from it in either
direction; fixing the underlying modal shell is out of this stage's scope
since it would touch P1 code unrelated to Collections.

Meets the brief's target of 0 critical / 0 serious findings.
