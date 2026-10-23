# Undertone end-to-end review — 22 October 2026

Work was performed on Spencer-PC1 (WSL), in a separate clone and task worktrees. The design baseline is `energy-orbit-lab` at `b2eeac0c9b3526a494a53c503d779d0894c337bb`, rather than main's older interface. The selected wordmark, scene palettes and audio assets are preserved. The owner subsequently requested a smaller logo, an icon-and-label dock and a sharper, larger Energy Orbit; those changes are now included. On 23 October the owner accepted the reviewed design and approved final closeout with automatic live publishing. The temporary lab-root rewrite is removed so production opens the full app at `/`; device/listening/contrast coverage limits below still apply.

## Changes and evidence

| Before | After | Why |
| --- | --- | --- |
| At 390×844, dock content was 917px wide inside a 368px content area; Music, Color, output and Tune were off-screen | Four-column phone grid; content width equals 368px | Later desktop grid minima no longer override phone layout |
| Desktop dock minimums exceeded common laptop widths and showed excessive detail | Eight icon-and-label actions in an 850px maximum dock; current selections and volume live in their popovers | Follows the owner’s compact-control direction, with 44px desktop / 46px phone targets |
| Picker bottoms guessed a fixed dock height and overlapped it | Clearance measured from the dock; scrollable height bounded by the visual viewport | Works with portrait, short landscape and keyboard/panned viewport coordinates |
| 568×320 phone landscape left too little room above a four-row dock | Two-row six-column compact landscape dock | Frequency information and every control remain reachable |
| Arrow navigation referenced nonexistent `$$$` | Correct helper and immediate keyboard tab selection | Settings are usable without a pointer |
| Returning to the current tab could allow an old outgoing animation to win | Every selection cancels and invalidates earlier transitions | Rapid A→B→A remains consistent; covered by five tests |
| Reduced motion hid the breathing ring but kept its frame loop alive | Stop the loop and show “Breathe at your own pace” | Stillness includes background work, not just CSS |
| Small labels, a wrapping timer, long saved names, touch hover and input zoom risks | 11px secondary-control floor, stable transport sizes, wrapping names, capability-gated hover, 16px phone inputs and safe-area treatment | Preserve hierarchy while improving legibility and mobile behavior |
| E2E installed a global browser CLI and used shared fixed output/session names | Task-local install or explicit existing binary; configurable session/output | Repeatable checks without replacing global applications |

**Motion verdict:** the changed tab interaction is interruptible, uses transform/opacity, completes in 280ms, and is immediate for arrow-key selection. Reduced motion stops breathing animation work. No new feel-breaking motion issue was found by independent review. Existing ambient scene and dock-reveal timing is retained. Orbit uses the shared motion clock; hardware Chrome verified that motion zero stops submitted frames and animation time. Enabling motion zero or OS reduced motion also completes an in-flight scene fade immediately, preventing a frozen partial transition. Shader appearance was accepted by the owner for release on 23 October.

## Screenshots

The initial-pass screenshots below are local Chromium fallback renders; the later hardware Chrome evidence is linked separately. They are not physical-phone evidence or evidence of a published deployment. Scene time may differ between images.

| Surface | Before | After |
| --- | --- | --- |
| 390px phone | [Before](screenshots/before-phone.png) | [After](screenshots/after-phone.png) |
| Phone picker | [Before](screenshots/before-phone-picker.png) | [After](screenshots/after-phone-picker.png) |
| 1440px desktop | [Before](screenshots/before-desktop.png) | [After](screenshots/after-desktop.png) |
| 568×320 landscape | Earlier four-row geometry was unusable | [Compact dock](screenshots/after-landscape.png) |

[Scene/palette/settings contact sheet](screenshots/surface-contact-sheet.png). Individual scene and palette captures, browser logs, audio outputs and raw axe data remain under the ignored task-local `artifacts/review-1022/` folder.

## Verification

Passed locally with Node 24.22.1 and pnpm 12.5.1:

- Frozen locked dependency install; production JavaScript syntax checks; build into `dist`; test command; 89 individual Node tests, including tab/layout, dynamic playback-label and mid-transition stillness regressions. Node's `--test` summary groups files in this environment; each test file was also run directly to obtain the individual count.
- 13 viewport audits: 320×568, 568×320, 844×390, 390×844, 430×932, 834×1194, 1024×1366, 1194×834, 1101×700, 1280×720, 1366×768, 1440×900 and 1728×900. No document/dock/picker overflow, picker/dock overlap or hero/dock overlap.
- Real Chromium keyboard tabs, rapid selection, presets, output routing, timer countdown/pause/resume, breathing and reduced-motion behavior. Native-mobile CSS refinements were followed by another complete passing run.
- Ten axe WCAG-tag audits: main, all six pickers, Tune, Sessions and About. **Zero reported violations; eight surfaces retain an incomplete contrast check.** This is not an unconditional WCAG-AA certification. Translucent/scene-backed text needs manual contrast acceptance.
- UI selections for all five scenes and nine palettes, all four local FLAC tracks, generated composition switching, standard layout, saved mixes, non-Latin/long names, invalid backup rejection, failed local music request and generated-music recovery. Expected network-failure logging was isolated from the clean normal-flow console.
- Actual Chromium OfflineAudioContext production-graph renders: headphone carriers L320/R360 Hz, leakage 2.02e-7; identical speaker channels with expected modulation; FLAC/full-mix peaks below clipping. Native auto-mix used muted synthetic WAVs and passed A→B→A, pause/resume and disable. These are signal and lifecycle tests, not a headphone listening assessment.
- All nine WGSL device checks and deterministic seven-pass Node GPU renders using llvmpipe. The revised Orbit has a mean motion pixel difference of 19.46 at 720×480. A real HDR surface probe compares a known grazing ray against a 1536-step reference: production error 0.000541; deliberately disabling crossing subdivisions raises error to 2.598, detecting the regression.
- Real Windows Chrome 155 on the NVIDIA Blackwell adapter (non-fallback): desktop and phone-emulation renders, agent-browser recordings, muted actual playback, Play/Pause labels, timer selection/countdown, Orbit still mode, Event Horizon startup/stillness and resource teardown on return to Orbit passed. The mid-transition stillness check requires a positive submitted frame before observing stable counters. The scene submitted approximately 28.2 frames/s against its 30fps cap during a six-second recording. This is submission cadence, not measured GPU completion or physical-display FPS. Initial WSL/headless browser capture was unavailable; hardware Chrome resolved that coverage gap.
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
- A verified full-history Git bundle, source diff and copies of the two untracked scanner files and orphaned documentation were saved at `/home/mlpc/dev/keta/2026-10-22/task/preserved-local-work/`. The bundle is a local recovery artifact. Text copies of the two scanner files and the original local-vs-main patch are also archived in this report’s `preserved-local/` directory so the source evidence is included in the pushed review. Existing checkouts, worktrees and uncommitted files were not reset or removed.
- The revised Orbit source and generated `vendor/energy-orbit.js` are committed together. The preview command rebuilds this bundle before serving, preventing the stale checked-in renderer from masking source changes. The service-worker cache is bumped to v50. The revised scene supersedes the sampled volume candidate and still needs visual acceptance.

## Hosting and closeout boundary

The source-only [Vercel output fix, PR #18](https://github.com/spencer-life/Undertone/pull/18), starts from main and sets `buildCommand: pnpm build` and `outputDirectory: dist`. It contains no held design commits or lab-root rewrite. Its Vercel preview and Core/Security/vGPU/Visual checks passed. The lab branch already has a dist configuration plus an intentional `/labs/energy-orbit/` root rewrite; it was not overwritten.

At inspection, Vercel's two main/production attempts were ERROR. Netlify's existing Git integration points at main with `stop_builds=false` and publishes `54633dd`. No hosting settings or connection were changed. Merging main would therefore publish production automatically. The owner authorized closeout but retained a no-production-deploy boundary, so main merges remain blocked pending that specific decision. Do not disconnect Netlify until the intended Vercel production app is verified.

PR #16 and #17 remain independently useful maintenance changes; their patches are also reconciled into this candidate. PR #14's unique design history is retained, including its separate design acceptance rationale. Nothing here lifts that hold. No force push, merge, production deployment, paid API call or Windows application/setting change was performed.


## Owner-directed visual refinement — 23 October

Energy Orbit now uses three finite, twisted ribbons with real negative space, depth-sorted transmission, resolved surface intersections and analytic edge filtering. This removes the sampled-density blur. The orb is roughly 30% larger in diameter; sparse stationary particles and three low-contrast magnetic trails extend the composition across the screen. Bloom is reduced from 0.74 to 0.36. Narrow reflected light and Fresnel response clarify curvature without blurring the filaments. The wordmark is 110–120px on desktop and 96px on phones.

The dock uses eight short actions: Sound, Music, Timer, Play/Pause, Scene, Color, Output and Tune. Selected values remain in accessible names and popover detail; Output contains the labeled master-volume control. The active timer retains its countdown. A final 13-size E2E run passed with the compact dock, alongside all ten axe surfaces and the keyboard/timer/reduced-motion flows. Resize screenshots are captured after transitions settle.

| Hardware Chrome evidence | Link |
| --- | --- |
| Previous sampled-volume scene, 1440×900 | [Before](screenshots/chrome-before-desktop.png) |
| Focused, expanded Orbit and compact dock, 1440×900 | [After](screenshots/chrome-after-desktop.png) |
| 390×844 phone emulation | [After](screenshots/chrome-after-phone.png) |
| Desktop Output volume / active timer | [Output](screenshots/chrome-output-desktop.png), [Timer](screenshots/chrome-timer-desktop.png) |
| Phone Output volume / active timer | [Output](screenshots/chrome-output-phone.png), [Timer](screenshots/chrome-timer-phone.png) |
| Agent-browser recordings | [Desktop](recordings/chrome-desktop.webm), [Phone](recordings/chrome-phone.webm) |
| Browser assertions and frame submission observation | [JSON](chrome-hardware-qa.json) |

These are installed Windows Chrome renders using the actual hardware adapter. Phone evidence is viewport emulation, not a physical phone. Audio was muted during browser playback checks; live-service and headphone listening acceptance are not claimed. Chrome was launched in a separate task profile with process-local occlusion throttling disabled so the desktop app covering its window would not invalidate recordings. A bounded per-tab Chrome focus-emulation override was also used for the lifecycle check and restored afterward. No Windows settings were changed.

### Official vgpu comparison

Opened and rendered the actual official examples in hardware Chrome, rather than judging their code or gallery thumbnails:

- [Glass Sculpture](https://vgpu.sh/examples/glass-sculpture), Noir rig: crisp surfaces, narrow studio reflections and Fresnel make shape readable. Undertone adopts compatible reflection cues and true surface hits in its own shader.
- [Particle Orbit](https://vgpu.sh/examples/particle-orbit): surrounding trails and a spatial particle field make the composition feel wider than its center. Undertone uses restrained stationary particles and faint magnetic trails; the demo’s CRT scanlines, grain and chromatic effects were not appropriate for this calm listening UI.
- [Anti-Aliasing](https://vgpu.sh/examples/anti-aliasing): compared FXAA and Off on the actual thin-line example. Full-frame FXAA can soften fine ribbons; Undertone instead resolves intersections, filters grazing edges and fades undersampled filaments. No unmeasured supersampling cost was added.
- [Optimized Black Hole](https://vgpu.sh/examples/optimized-black-hole): its broad accretion field and strong central form informed Orbit’s larger framing and wider surroundings. The scenes retain distinct identities.

The reference examples were inspected at registry revision `af8ab2106af8d33b5f10e60b588a0ae5fb0b02de761800e82b85bf82726a3bc4`. No vgpu dependency upgrade or additional GPU feature was required. Reference tabs remain available in the task Chrome window. Captures: [Glass Noir](screenshots/official-glass-noir.png), [Particle Orbit](screenshots/official-particle-orbit.png), [FXAA](screenshots/official-aa-fxaa.png), [Black Hole](screenshots/official-black-hole.png).

### GPU CI follow-up

The previous PR #19 GPU job (run 39871028418) was cancelled at its 15-minute job limit. Shader validation, Node pixel checks and build passed first. System package setup consumed about 13 minutes 27 seconds; browser capture reached Orbit and its pickers but did not complete Event Horizon/still-mode validation. This was incomplete coverage, not a passing GPU check or a proven shader failure.

The harness now installs only missing Vulkan/Mesa/display packages, avoids upgrading already-installed Mesa, uses task-local agent-browser, bounds package/browser waits, emits named stage diagnostics and refuses to overwrite prior evidence. The next PR run must pass; these source changes do not retroactively turn the cancelled run green.

The first revised run (39877442294) completed dependency setup quickly but hit the 20-second browser-doctor cap before emitting its collected diagnostic. Cold preflight now has a separate 120-second budget; normal browser calls remain capped at 20 seconds and scene readiness at 90 seconds. Core, Security, E2E and Vercel passed on that revision.

Run 39877738795 completed the preflight diagnostic and identified the actual missing prerequisite: the runner had a Vulkan loader but no system Mesa ICD. Node vgpu succeeded via its portable driver; Chrome’s documented WebGPU preset still requires system Mesa. The package-presence check now includes `libvulkan1` and `mesa-vulkan-drivers`, installing absent packages without upgrading already-installed ones. Doctor failures also print the collected diagnostic in the CI log.

Run 39878144423 installed the missing Mesa driver in seconds, passed browser preflight and reached Orbit readiness, then timed out taking the first screenshot while the CPU renderer was animating. The CI browser now uses the app’s Eco mode and pauses its scene clock while each screenshot is taken, restoring motion between captures. This is quiescent software-adapter screenshot coverage; the full-resolution NVIDIA recordings remain the browser motion evidence. The named screenshot deadline remains enforced.

Run 39878460195 hit the 180-second package-index refresh deadline before exercising quiescent capture; the earlier run installed the same missing Mesa package in seconds. The harness now first installs missing packages from the hosted image’s existing indexes, refreshing only after an install failure, with bounded network timeouts and one retry. The screenshot adjustment remains pending actual CI execution.


## CI efficiency follow-up

All app checks, Security and Vercel passed on `e716cb5`, including the repaired GPU run [39879032014](https://github.com/spencer-life/Undertone/actions/runs/39879032014). The owner then requested an efficiency audit. App jobs are consolidated behind one tested change selector; Security still runs on every PR. Docs-only PRs skip app runners, shader-only PRs run Core/GPU, and UI/toolchain/unknown changes keep full coverage. Manual runs always execute the full suite, and selection failure cannot produce a green Core check. Existing job names and PR-only triggers are preserved.

Visual QA drops six responsive screenshots duplicated by the asserted E2E matrix, retains 30 scene/theme/motion captures, builds once through mise, and caches its pinned browser binary. E2E/GPU evidence excludes installed QA dependencies. Eight CI-scope tests include a real Git merge fixture proving cumulative changes and renamed/deleted runtime files cannot be hidden by a docs-only last commit. Full app verification is intentionally retained on this PR because it changes both runtime and CI routing. See [CI scope and commands](../ci.md).
