# TaskManager Design System 7 Updates

## Goal

Implement the TaskManager design-system handoff as production UI changes while
preserving the product navigation model and existing data contracts.

The task workspace receives seven system-level updates:

1. Workspace toolbar collapse and compact summary bar.
2. Kanban columns with fixed headers and independent body scrolling.
3. Gantt timeline date area that spans the available width without trailing gaps.
4. A shared subtask disclosure component.
5. Compact filter token chips with popover editing.
6. Multi-rule sort builder.
7. Relationship-aware Admin pages.

## Admin Navigation Rule

Admin must stay section based. The intended flow is:

`/admin` home -> section list page -> item create/edit page.

Examples:

- `/admin/fields` lists fields.
- `/admin/fields/new` creates a field.
- `/admin/fields/[id]` edits a field.
- `/admin/issue-types` lists issue types.
- `/admin/issue-types/new` creates an issue type.
- `/admin/issue-types/[id]` edits an issue type.

The design handoff's "workbench" concept should be interpreted as clearer
relationship visibility inside the existing section pages, not as one combined
Admin surface.

## Product Behavior

- Toolbar collapse is a workspace-level state. The expanded state shows quick
  create and full controls. The collapsed state keeps the title, visible count,
  active filter count, active sort count, and view tabs available in one line.
- Filter chips render as compact tokens. Each token shows field and value
  summary; operator and value editing live in a popover.
- Sorting uses ordered rules. The first rule is primary; later rules break ties.
  No sort rules means the existing default order is preserved.
- Subtask disclosure is one shared component for list-like views. It shows
  collapsed state, done/total count, and progress.
- Kanban columns maintain visible headers while each column body scrolls.
- Gantt timeline header and body rows share the same equal-width grid definition.

## Border-Light List Pattern

Lists across the service should prefer a Linear-like border-light pattern:

- Repeated list rows do not use full border boxes by default.
- Containers and rows rely on spacing, type hierarchy, hover/active background,
  and minimal dividers instead of nested cards.
- Mobile rows reserve space for content and touch targets first: primary actions
  keep icon + label, row titles are larger, and low-priority metadata is
  compressed or hidden behind overflow summaries.
- Borders remain appropriate for forms, modals, dangerous actions, and table
  structures that require explicit column separation.

The implementation scope now covers the task workspace/list, shared `DataTable`,
surfaces should default to border-light containers and rely on hover/selected
backgrounds before adding row dividers.

## Full Audit Pass 0.47.5

The 0.47.5 full audit pass extends the original workspace-focused handoff into
shared UI foundations:

- `Modal` is the default modal shell. Create/edit/delete flows should use it
  directly or through `ConfirmDialog`; drawers and detail panels keep their
  purpose-built shells.
- `StateBlock` is the default lightweight loading/empty/error surface when a
  screen only needs a message and optional action.
- `task-icons.tsx` is the shared source for sort, drag, close, toast state,
- Shared primitives should use text/color tokens. Avoid user-facing
  `text-[Npx]`, CSS `font-size: Npx`, and raw red/blue/amber/purple/sky/rose/
  green/gray Tailwind palette classes in `src`.
  document emoji through CSS pseudo-content.
- `scripts/check-design-system-drift.mjs` runs in `npm run lint` after i18n and
  blocks font-token, raw-palette, visible-glyph, and hand-built dialog overlay
  regressions.
- App pages keep global top/side `main` padding while desktop bottom padding is
  removed. Calendar month surfaces keep their full-height grid/cell sizing and
  avoid page scroll plus hidden empty-state whitespace below the month grid.

## Implementation Notes

- No database migration is required.
- Existing REST APIs remain the source of truth for fields, field schemas,
  statuses, status schemas, and issue types.
- The current full audit release is `0.47.5`.
- The implementation must update tests that assert source-level layout hooks and
  design token availability.
