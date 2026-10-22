# Undertone end-to-end review — 22 October 2026

Work was performed on Spencer-PC1 (WSL), in a separate clone and task worktrees. The design baseline is `energy-orbit-lab` at `b2eeac0c9b3526a494a53c503d779d0894c337bb`, rather than main's older interface. The approved graphite player modules, selected wordmark, scene palettes, audio assets, and lab-root rewrite are preserved. This is implementation review, not new visual acceptance or release approval.

## Changes and evidence

| Before | After | Why |
| --- | --- | --- |
| At 390×844, dock content was 917px wide inside a 368px content area; Music, Color, output and Tune were off-screen | Four-column phone grid; content width equals 368px | Later desktop grid minima no longer override phone layout |
| Desktop dock minimums exceeded common laptop widths | Content-based compact layout through 1599px; generous modules on wider desktops | All controls remain in their shell without abandoning the approved design |
| Picker bottoms guessed a fixed dock height and overlapped it | Clearance measured from the dock; scrollable height bounded by the visual viewport | Works with portrait, short landscape and keyboard/panned viewport coordinates |
| 568×320 phone landscape left too little room above a four-row dock | Two-row six-column compact landscape dock | Frequency information and every control remain reachable |
| Arrow navigation referenced nonexistent `$$$` | Correct helper and immediate keyboard tab selection | Settings are usable without a pointer |
| Returning to the current tab could allow an old outgoing animation to win | Every selection cancels and invalidates earlier transitions | Rapid A→B→A remains consistent; covered by five tests |
| Reduced motion hid the breathing ring but kept its frame loop alive | Stop the loop and show “Breathe at your own pace” | Stillness includes background work, not just CSS |
| Small labels, a wrapping timer, long saved names, touch hover and input zoom risks | 11px secondary-control floor, stable transport sizes, wrapping names, capability-gated hover, 16px phone inputs and safe-area treatment | Preserve hierarchy while improving legibility and mobile behavior |
| E2E installed a global browser CLI and used shared fixed output/session names | Task-local install or explicit existing binary; configurable session/output | Repeatable checks without replacing global applications |

**Motion verdict:** the changed tab interaction is interruptible, uses transform/opacity, completes in 280ms, and is immediate for arrow-key selection. Reduced motion stops breathing animation work. No new feel-breaking motion issue was found by independent review. Existing ambient scene and dock-reveal timing is retained; shader appearance still needs the owner's acceptance.

## Screenshots

All UI screenshots are local Chromium renders. They are not physical-phone evidence or evidence of a published deployment. Scene time may differ between images.

| Surface | Before | After |
| --- | --- | --- |
| 390px phone | [Before](screenshots/before-phone.png) | [After](screenshots/after-phone.png) |
| Phone picker | [Before](screenshots/before-phone-picker.png) | [After](screenshots/after-phone-picker.png) |
| 1440px desktop | [Before](screenshots/before-desktop.png) | [After](screenshots/after-desktop.png) |
| 568×320 landscape | Earlier four-row geometry was unusable | [Compact dock](screenshots/after-landscape.png) |

[Scene/palette/settings contact sheet](screenshots/surface-contact-sheet.png). Individual scene and palette captures, browser logs, audio outputs and raw axe data remain under the ignored task-local `artifacts/review-1022/` folder.

## Verification

Passed locally with Node 24.22.1 and pnpm 12.5.1:

- Frozen locked dependency install; production JavaScript syntax checks; build into `dist`; test command; 86 individual Node tests, including nine new tab/layout regressions. Node's `--test` summary groups files in this environment; each test file was also run directly to obtain the individual count.
- 13 viewport audits: 320×568, 568×320, 844×390, 390×844, 430×932, 834×1194, 1024×1366, 1194×834, 1101×700, 1280×720, 1366×768, 1440×900 and 1728×900. No document/dock/picker overflow, picker/dock overlap or hero/dock overlap.
- Real Chromium keyboard tabs, rapid selection, presets, output routing, timer countdown/pause/resume, breathing and reduced-motion behavior. Native-mobile CSS refinements were followed by another complete passing run.
- Ten axe WCAG-tag audits: main, all six pickers, Tune, Sessions and About. **Zero reported violations; eight surfaces retain an incomplete contrast check.** This is not an unconditional WCAG-AA certification. Translucent/scene-backed text needs manual contrast acceptance.
- UI selections for all five scenes and nine palettes, all four local FLAC tracks, generated composition switching, standard layout, saved mixes, non-Latin/long names, invalid backup rejection, failed local music request and generated-music recovery. Expected network-failure logging was isolated from the clean normal-flow console.
- Actual Chromium OfflineAudioContext production-graph renders: headphone carriers L320/R360 Hz, leakage 2.02e-7; identical speaker channels with expected modulation; FLAC/full-mix peaks below clipping. Native auto-mix used muted synthetic WAVs and passed A→B→A, pause/resume and disable. These are signal and lifecycle tests, not a headphone listening assessment.
- All nine WGSL checks and deterministic seven-pass Node GPU renders using llvmpipe. Motion pixel difference was approximately 8.89 at the existing 720×480 render settings. **No hardware GPU was available.** Headless WebGPU screenshot capture timed out; headed capture could not start its display. Browser WebGPU and physical-device visual/performance acceptance remain unavailable in this pass.
- `actionlint`, `shellcheck`, JSON/output-path validation and `git diff --check`.

[Machine-readable responsive/accessibility summary](qa-summary.json). The summary captures the first complete 13-size passing matrix; later native-mobile refinements were verified with the same matrix.

## Worst-case data

The developer-only [saved-mix fixture page](../../tests/saved-mixes-browser.html) renders the real app through its normal local-storage boundary, with Demo data / Worst case / Empty / One / 12 mixes. Use a fresh preview port. It is excluded from the production allowlist and refuses hosted, non-preview contexts.

| Severity | Field / case | Outcome / fix |
| --- | --- | --- |
| Broken | Narrow dock and long module labels | Fixed with bounded grid tracks and nonshrinking transport controls in `layout.css` |
| Fragile | Long unbroken or non-Latin saved names | Names wrap inside a shrinking text column; actions retain their space |
| Held up | Empty, one and maximum 12 mixes; HTML-like names | Existing empty copy, limit enforcement and textContent rendering are preserved |

RTL product localization, 200% physical browser zoom, Safari touch gestures, actual software keyboards, notches, installation, Bluetooth, TV remotes and locked-screen audio were not validated on hardware. These remain manual checks, not passing claims.

## Local work preservation

- Linux checkout `/home/mlpc/dev/playground/undertone`: unchanged staged/unstaged state; two untracked Secretlint files retained. Their scanner duplicates the existing security baseline and their push-plus-PR triggers contradict the current PR-only policy, so they were not silently enabled.
- Local commit `d878949` supplies useful reproducible vgpu locks and was cherry-picked into this review. Its original history is preserved. The older local Node patch `57ac703` drops six platform records; the better #17 patch was incorporated instead, retaining all seven platforms.
- Windows main and both registered Copilot worktrees were clean at `54633dd`. The orphaned `spencer-life-bookish-carnival` folder contains all 88 tracked files; only `docs/ci.md` differs, exactly matching the already-remote `spencer-life-ci-pr-only` correction. Its cleanup marker was left alone. The correction is reconciled with the richer feature-branch documentation and current main's PR-only triggers.
- A verified full-history Git bundle, source diff and copies of the two untracked scanner files and orphaned documentation were saved at `/home/mlpc/dev/keta/2026-10-22/task/preserved-local-work/`. This is a local recovery artifact, not a cloud backup. Existing checkouts, worktrees and uncommitted files were not reset or removed.
- Building the held source regenerates an older tracked Orbit bundle and creates the Event horizon bundle. Those generated outputs were kept as local build evidence rather than committing a shader appearance change as part of a UI fix. Production builds already generate them. The existing volume-pass acceptance remains open.

## Hosting and closeout boundary

The source-only [Vercel output fix, PR #18](https://github.com/spencer-life/Undertone/pull/18), starts from main and sets `buildCommand: pnpm build` and `outputDirectory: dist`. It contains no held design commits or lab-root rewrite. Its Vercel preview and Core/Security/vGPU/Visual checks passed. The lab branch already has a dist configuration plus an intentional `/labs/energy-orbit/` root rewrite; it was not overwritten.

At inspection, Vercel's two main/production attempts were ERROR. Netlify's existing Git integration points at main with `stop_builds=false` and publishes `54633dd`. No hosting settings or connection were changed. Merging main would therefore publish production automatically. The owner authorized closeout but retained a no-production-deploy boundary, so main merges remain blocked pending that specific decision. Do not disconnect Netlify until the intended Vercel production app is verified.

PR #16 and #17 remain independently useful maintenance changes; their patches are also reconciled into this candidate. PR #14's unique design history is retained, including its separate design acceptance rationale. Nothing here lifts that hold. No force push, merge, production deployment, paid API call or Windows application/setting change was performed.
