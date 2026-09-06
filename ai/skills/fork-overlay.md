# Fork Overlay

Read this file before adding fork-only product behavior or merging upstream Navet
(`awesomestvi/navet`) into this checkout. The inventory is
[`docs/agents/fork-overlay.md`](../../docs/agents/fork-overlay.md).

## Core Rules

- overlay work is behavior, settings, persistence, or UX that upstream does not have
- put overlay logic in a dedicated module plus tests; touch upstream files only at a thin call site
- update `docs/agents/fork-overlay.md` in the same change (owned files, seam files, tests)
- during an upstream sync, compare each overlay row to the incoming changelog and conflicted seams **before** resolving those seams
- if upstream added something similar or matching, stop and flag keep vs toss; do not keep-both or delete the overlay path until the user decides
- record the decision under **Overlap decisions** in the overlay doc

## Overlap Bar

Flag product similarity, not "both files changed." Same user-facing job, colliding keys, or a seam rewrite that implements the overlay behavior counts. Use the flag template in the overlay doc.

## Routing

Also read:

- `.cursor/rules/fork-overlay.mdc`
- `.cursor/rules/upstream-sync.mdc`
