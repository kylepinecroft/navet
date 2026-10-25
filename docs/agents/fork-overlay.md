# Fork overlay

This checkout is `kylepinecroft/navet`, a fork of [`navet-app/navet`](https://github.com/navet-app/navet).

- **Last synced:** upstream `v0.19.1`
- **Remote:** `upstream` → `https://github.com/navet-app/navet.git`

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

Merge an upstream **tag** onto a `sync/upstream-<version>` branch from current `main`. Never rebase published `main`. Take upstream release-managed files (`package.json`, `CHANGELOG.md`, add-on manifests). Keep-both locale and store-type conflicts first. On seam files, take upstream structure and re-insert overlay call sites. Run the tests listed here, evaluate the eager JavaScript budget under **Fork-only budgets**, then update **Last synced**.

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

## Pending overlap

Not a keep/toss decision. The greeting-name half of **Greeting name and display overrides** collides with upstream `v0.19.1`. The settings control was not re-inserted into Dashboard or Interaction settings, and the overlay module was not deleted. Entity display names stay. Choose keep, toss, or a subset before treating this sync as finished.

1. **Overlay feature.** Greeting name and display overrides. The greeting half stores `headerGreetingName` and uses it as the name inside the automatic header greeting (`Good morning, {name}`), with sanitize-on-change and normalize-on-blur. The same module also stores per-entity display names.
2. **Upstream change.** `v0.19.0` / `v0.19.1`. Header title settings (auto greeting, custom text, clock) moved from `settings-dashboard-section.tsx` to `settings-interaction-section.tsx`. The side-panel greeting card in `packages/app/src/features/dashboard/companion/dashboard-companion.tsx` (`CompanionGreeting`) shows card text, otherwise header custom text, otherwise the time-of-day greeting with the provider user's first name.
3. **Why it matches.** Same user-facing job (what the greeting says and whom it addresses) and the same dashboard settings seam, now rewritten. The side panel reads `headerTitleMode` and `headerCustomText` and ignores `headerGreetingName`, so the two greeting identities diverge. `headerGreetingName` does not reuse upstream's setting keys, but it competes with them.
4. **What each side still does.** The overlay still has a name-only override that keeps the time-of-day greeting, plus per-entity display names and blur-normalization. Upstream still has the header mode switch (greeting, custom text, or clock), full custom title text, and a side-panel greeting card with its own text. Upstream has no per-entity display-name overrides.
5. **Options.** Keep the greeting-name overlay and wire it into the header and side panel. Toss the greeting-name overlay and use upstream header title plus the side-panel card. Keep the entity display-name subset and toss only the greeting name.
6. **Recommendation.** Keep the entity display-name subset and toss the greeting-name setting so upstream owns greeting presentation. Waiting on that choice.

## Overlap decisions

- **2026-10-04 — Dashboard-local room names.** Upstream `v0.17.6` already renames rooms with `renameRoomWorkspaceRoomV2` and `RoomWorkspaceNameMode` in `packages/app/src/features/dashboard/rooms/room-workspace-v2.ts`. Decision: toss the overlay and use upstream only. Deleted `resetRoomWorkspaceRoomNameV2`, `packages/app/src/features/dashboard/rooms/components/room-bar-customize-dialog.tsx`, the room-bar customize control in `room-nav.tsx`, and locale keys `dashboard.roomsWorkspace.useOriginalName` and `dashboard.roomNav.customizeRooms*`.

## Features

### Snap-to-grid for sectioned cards

Sectioned Home cards snap to an explicit layout when `placementLayouts` exist; otherwise use upstream `gridPlacements`.

- **Owned:** `packages/app/src/features/dashboard/utils/card-placement.ts`
- **Seams:** `home-dashboard-overview-*.tsx`, `home-dashboard-section-row-renderer.tsx`, `use-home-grid-runtime.ts`, `use-home-dashboard-layout.ts`, `use-dashboard-drag-state.ts`, `card-size.ts` (`getCardSizeGridSpan` must coexist with upstream `getDashboardCardGridSpan`)
- **Tests:** `packages/app/src/features/dashboard/utils/__tests__/card-placement.test.ts`, `home-dashboard-overview-grid.test.tsx`

### Per-dashboard summary bar scope

Each dashboard can use a global or local summary bar.

- **Owned:** `packages/app/src/features/dashboard/dashboards/dashboard-summary-scope.ts`
- **Seams:** `dashboard-collection.ts`, `dashboard-collection-store.ts`, `dashboard-section-router.tsx`, `settings-dashboard-section.tsx`, `settings-search-items.ts`, Home overview energy summary gating, locale `settings.dashboard.summaryBarScope.*`
- **Tests:** `dashboard-summary-scope.test.ts`, `dashboard-collection.test.ts`, `settings-dashboard-section.test.tsx`

### Greeting name and display overrides

Custom header greeting and per-entity display names.

- **Owned:** `packages/app/src/utils/display-overrides.ts`
- **Seams:** `settings-store.ts` (`UserSettings` lives here), `stores/selectors.ts`, `settings-dashboard-section.tsx` (greeting control not re-homed in the `v0.19.1` sync; see Pending overlap), `use-header-controller.ts`, `use-devices.ts`, `security-camera-dashboard-model.ts`, `security-section.tsx`, `card-dialog.tsx`, `settings-profile-scope.ts`
- **Tests:** `display-overrides.test.ts`, `settings-store.test.ts`, `settings-dashboard-section.test.tsx`, `use-header-controller.test.tsx`

### Dropdown ghost-click and menu animation

Menus must not steal the click that opened them or fly in from off-screen.

- **Owned:** none (woven into shared menu surfaces)
- **Seams:** `packages/app/src/components/ui/dropdown-menu.tsx`, `room-nav.tsx`, `dashboard-switcher.tsx`, `dashboard-manager.tsx`
- **Tests:** `dashboard-switcher.test.tsx`

### Spaces while typing on normalized text fields

Keep the raw value on change; normalize on blur (and in persistence), not on every keystroke.

- **Owned:** sanitize vs normalize split in `display-overrides.ts`
- **Seams:** `settings-dashboard-section.tsx` greeting field (paused with the pending greeting overlap), `settings-store.ts`
- **Tests:** `display-overrides.test.ts`, `settings-store.test.ts`

### Repository GHCR publishing

Publish container images to `ghcr.io/<repository owner>/...` with `GITHUB_TOKEN`. A merge to `main` builds the multi-arch standalone image and moves the `dev` tag.

- **Intent:** The registry namespace and login user are the lowercased repository owner. `navet-app/navet` publishes to `ghcr.io/navet-app`; this fork publishes to `ghcr.io/kylepinecroft`. HACS sync, Home Assistant add-on metadata, and hosted Cloudflare preview checks run only for `navet-app` or `awesomestvi`.
- **Owned:** `scripts/release-ghcr-namespace.mjs`
- **Seams:** `.github/workflows/release-image.yml`, `dev-tag-release.yml`, `release.yml`, `release-runtime.yml`, `ci.yml`; `scripts/release-dev-channels.mjs`, `release-prebuilt-runtime.mjs`, `release-channels.mjs`, `release-evidence.mjs`, `release-preflight.mjs`, `release-promotion.mjs`, `create-dev-release.mjs`, `pages-gate.mjs`
- **Tests:** `scripts/release-ghcr-namespace.test.mjs`, `scripts/release-promotion.test.mjs`, `scripts/create-dev-release.test.mjs`, `scripts/dev-tag-release-workflow.test.mjs`
- **Verify:** Dispatch Prepare Navet Dev Publish from `main`. A main-backed run pushes `ghcr.io/kylepinecroft/navet:dev` for linux/amd64 and linux/arm64. On sync, keep the repository-owner namespace, `GITHUB_TOKEN` login, and the upstream-only skips in these seams. The published-runtime job must run on this repository's `main` and `navet-dev-*` tags. Do not pin that job to `navet-app/navet`; a skipped runtime job also skips the dev alias move.

## Fork-only budgets

### Eager JavaScript

Upstream `v0.19.1` raised `MAX_TOTAL_EAGER_JS_BYTES` from `800 * 1024` to `820 * 1024`. Measured eager JavaScript at this sync: upstream `v0.19.1` 807.7 KB, this fork 810.6 KB. The 820 KB cap is about 12 KB above upstream's measurement, which covers the fork's extra ~3 KB. The temporary fork override was removed. `scripts/check-bundle-budget.mjs` uses upstream's limit.

On the next sync, compare upstream's cap with upstream's measured eager JavaScript again:

- If the cap still leaves about 3 KB above upstream's measured eager JavaScript, keep using upstream's limit.
- If it does not leave that room, add a fork override above the measured fork size.

- **Owned:** none while the override is deleted
- **Tests:** `pnpm build`, then `pnpm check:bundle-budget`

## Shared mechanical seams

These files pick up overlay keys on every upstream sync. Resolve as keep-both; do not drop overlay keys to make the merge look clean.

- `packages/app/src/i18n/messages/*.ts`
- `packages/app/src/stores/settings-store.ts`, `types.ts`, `selectors.ts`
