# Fork overlay

This checkout is `kylepinecroft/navet`, a fork of [`awesomestvi/navet`](https://github.com/awesomestvi/navet).

- **Last synced:** upstream `v0.15.8` (PR #3)
- **Remote:** `upstream` → `https://github.com/awesomestvi/navet.git`

Keep this file current. It is the routing list for new fork features and for upstream merges. Do not turn it into a design doc or a hunk-by-hunk patch archive.

## New overlay feature

Product behavior, settings, persistence, or UX that upstream Navet does not have is overlay work.

1. Put logic in a dedicated module plus tests.
2. Touch upstream files only at a thin call site. Prefer wrapping the upstream result.
3. Add locale keys with a stable prefix. Do not add a second helper that overlaps an upstream name.
4. Add a row below in the same change: intent, owned files, seam files, tests.
5. If the change should live upstream instead, do not add it here.
6. If upstream already has something that does the same job, flag the overlap and wait. Do not add a second implementation.

## Upstream sync

Merge an upstream **tag** onto a `sync/upstream-<version>` branch from current `main`. Never rebase published `main`. Take upstream release-managed files (`package.json`, `CHANGELOG.md`, add-on manifests). Keep-both locale and store-type conflicts first. On seam files, take upstream structure and re-insert overlay call sites. Run the tests listed here, then update **Last synced**.

## Overlap with upstream

If upstream added something that does the same job as an overlay feature, or is close enough that keeping both would duplicate UX, settings, or persistence, **stop**. Do not keep-both that seam and do not delete the overlay path until the user chooses keep vs toss.

Flag when any of these is true:

- Same user-facing job, even if names differ (grid snap vs another layout system, room rename vs display names, greeting vs profile name, summary-bar scope vs another Home filter).
- Same or colliding settings keys, dashboard-collection fields, or locale prefixes.
- Upstream rewrite of a listed seam that now implements the overlay behavior differently.
- Upstream changelog, PR, or new module that matches an overlay row's intent.

Do not treat "both sides touched `settings-dashboard-section.tsx`" alone as overlap. That is a mechanical seam. Overlap is product similarity.

### Flag format

For each suspected overlap, report all of:

1. **Overlay feature** and the job it does.
2. **Upstream change** (tag, changelog line, files).
3. **Why it matches** (same job / same keys / competing seam behavior).
4. **What overlay still does that upstream does not**, and the reverse.
5. **Options:** keep overlay, toss overlay and use upstream, or keep a listed subset.
6. **Recommendation** (one sentence), then wait.

Record the decision under **Overlap decisions** in the same sync.

## Overlap decisions

None yet. Add a dated row after each keep-vs-toss choice: overlay feature, upstream counterpart, decision, and what was deleted or kept.

## Features

### Snap-to-grid for sectioned cards

Sectioned Home cards snap to an explicit layout when `placementLayouts` exist; otherwise use upstream `gridPlacements`.

- **Owned:** `packages/app/src/features/dashboard/utils/card-placement.ts`
- **Seams:** `home-dashboard-overview-*.tsx`, `home-dashboard-section-row-renderer.tsx`, `use-home-grid-runtime.ts`, `use-home-dashboard-layout.ts`, `use-dashboard-drag-state.ts`, `card-size.ts` (`getCardSizeGridSpan` must coexist with upstream `getDashboardCardGridSpan`)
- **Tests:** `packages/app/src/features/dashboard/utils/__tests__/card-placement.test.ts`, `home-dashboard-overview-grid.test.tsx`

### Dashboard-local room names

Room renames stay on the dashboard workspace (`nameMode: 'custom'`), with a reset to the provider name.

- **Owned:** `packages/app/src/features/dashboard/rooms/components/room-bar-customize-dialog.tsx`; `resetRoomWorkspaceRoomNameV2` / `nameMode` in `room-workspace-v2.ts`
- **Seams:** `room-workspace-panels.tsx`, `use-room-workspace-controller.ts`, `room-order-dialog.tsx`, locale `dashboard.roomsWorkspace.useOriginalName`
- **Tests:** `room-workspace-v2.test.ts`, `use-room-workspace-controller.test.tsx`

### Per-dashboard summary bar scope

Each dashboard can use a global or local summary bar.

- **Owned:** `packages/app/src/features/dashboard/dashboards/dashboard-summary-scope.ts`
- **Seams:** `dashboard-collection.ts`, `dashboard-collection-store.ts`, `dashboard-section-router.tsx`, `settings-dashboard-section.tsx`, `settings-search-items.ts`, Home overview energy summary gating, locale `settings.dashboard.summaryBarScope.*`
- **Tests:** `dashboard-summary-scope.test.ts`, `dashboard-collection.test.ts`, `settings-dashboard-section.test.tsx`

### Greeting name and display overrides

Custom header greeting and per-entity display names.

- **Owned:** `packages/app/src/utils/display-overrides.ts`
- **Seams:** `settings-store.ts`, `stores/types.ts`, `stores/selectors.ts`, `settings-dashboard-section.tsx`, `use-header-controller.ts`, `use-devices.ts`, `security-camera-dashboard-model.ts`, `security-section.tsx`, `card-dialog.tsx`, `settings-profile-scope.ts`
- **Tests:** `display-overrides.test.ts`, `settings-store.test.ts`, `settings-dashboard-section.test.tsx`, `use-header-controller.test.tsx`

### Dropdown ghost-click and menu animation

Menus must not steal the click that opened them or fly in from off-screen.

- **Owned:** none (woven into shared menu surfaces)
- **Seams:** `packages/app/src/components/ui/dropdown-menu.tsx`, `room-nav.tsx`, `dashboard-switcher.tsx`, `dashboard-manager.tsx`
- **Tests:** `dashboard-switcher.test.tsx`

### Spaces while typing on normalized text fields

Keep the raw value on change; normalize on blur (and in persistence), not on every keystroke.

- **Owned:** sanitize vs normalize split in `display-overrides.ts`
- **Seams:** `settings-dashboard-section.tsx` greeting field, `settings-store.ts`
- **Tests:** `display-overrides.test.ts`, `settings-store.test.ts`

### Vite allowed hosts for reverse-proxied `pnpm dev`

Vite blocks unknown `Host` headers. Extra hosts come from `NAVET_DEV_ALLOWED_HOSTS`; this fork does not bake in a hostname.

- **Owned:** `scripts/vite-dev-allowed-hosts.ts`
- **Seams:** `apps/standalone/vite.config.ts`
- **Tests:** `packages/app/src/utils/__tests__/vite-dev-allowed-hosts.test.ts`

## Shared mechanical seams

These files pick up overlay keys on every upstream sync. Resolve as keep-both; do not drop overlay keys to make the merge look clean.

- `packages/app/src/i18n/messages/*.ts`
- `packages/app/src/stores/settings-store.ts`, `types.ts`, `selectors.ts`
