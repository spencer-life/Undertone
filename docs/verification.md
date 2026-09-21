# Verification log

This file records checks against the locally revised source, not the existing
Netlify production deployment.

## Baseline and scope

- Read the supplied handoff with authenticated `gws drive files get`.
- Compared the newest local ZIP's HTML against the public production HTML;
  differences were Netlify hosting metadata and its injected HUD only.
- Inspected the Figma desktop proposal and scene concept board in the browser.
- Read React Bits Silk/Orb source and MCP guidance; no component code bundled.

## Automated checks

`pnpm run check` checks syntax for all production JavaScript.
`pnpm test` checks audio continuity, signal bounds, noise transition behavior,
transport lifecycle, offline asset coverage, scoped cache cleanup, missing-module
behavior, deterministic scene seeds, DPR caps, reduced motion, hidden pages and
blackout rendering.

The audio sample tests run 65 seconds across the former 10/13-second loop periods
and the reported 15-second interval. This establishes elimination of that code
path and tests continuous output; it does not prove the original observed
half-second dip had only one cause on every physical device.

The real browser harness uses Chromium OfflineAudioContext at 48 kHz. It renders
the complete production graph, including music, textures, reverb, delay, beats,
compressor and output gain. It tests Focus defaults and all layers at maximum,
then checks 320/360 Hz separation for the 40 Hz headphone setting and 340 Hz ±40 Hz
amplitude-modulation sidebands for speakers.

## Browser checks

- Inspected Living contours, Silk drift, Energy orbit, and Wet glass visually.
- Checked Noir and Deep ocean palettes.
- Verified the 390 × 844 layout: no horizontal overflow; play, timer, output mode,
  and volume remain inside the scene. Observed stage bounds x=16..374 and all
  visible dock controls within those bounds.
- Entered TV mode with F and moved focus using Right; Escape exits.

## Final signal renders

Chromium, 48 kHz, actual production AudioWorklet graph:

| Render | Peak | RMS | Result |
| --- | ---: | ---: | --- |
| Generated Focus defaults | 0.01983 | 0.00461 | No sustained gap; stereo |
| Generated layers at maximum | 0.20221 | 0.05528 | No sustained gap; stereo |
| Broken Glimmers FLAC + maximum live layers | 0.32134 | 0.07375 | Stereo, below clipping |
| Safe Space FLAC + maximum live layers | 0.26430 | 0.05804 | Stereo, below clipping |

Generated renders ran 32 seconds and FLAC renders 40 seconds. Headphone carriers
were isolated at L320/R360 Hz with worst cross-channel amplitude ratio 2.02e-7.
Speaker channels were identical with the expected 340 Hz carrier and 300/380 Hz
sidebands. These are signal measurements, not a subjective listening assessment.


## Limits

No subjective audio comparison with the SoundCloud reference was possible. The
metadata was inspected, but the track was not heard. Signal tests are not a
substitute for a headphone listening review or a professional master. Physical
Safari/iOS PWA, Android, smart TV, Bluetooth, background OS suspension, device
volume and acoustic behavior were not validated on those devices. The two-minute
native scheduling horizon for generated music tolerates ordinary timer throttling;
indefinite main-thread freezing can exhaust its scheduled events. Recorded FLAC
loops and live tones run natively without a JavaScript scheduling horizon.

## Final build checks

- `pnpm run check`: passed. `pnpm test`: **19 passed**, zero failures.
- Final read-only review found no remaining material issues in the cancellation
  and cache fixes. Regressions cover A→B→A selection, damaged-cache recovery, and
  real-browser-style detachment of decode input buffers.
- Fresh localhost origin: both starter tracks decoded, played, switched, and
  displayed “saved for offline listening.” Generated/library switching and
  separate headphone/frequency controls behaved correctly.
- Disabled browser networking, reloaded the app shell, and started cached Broken
  Glimmers successfully. The page showed Offline and active Pause controls.
  Restored normal networking afterward. No console errors or warnings observed.
- Final 390 × 844 check: document width and scroll width both 390; stage x=16..374;
  full-width sound drawer and track controls fit without horizontal overflow.
  Restored the normal viewport afterward.
- Saved a Noir / Wet glass / 40 Hz headphone mix and verified it survived reload.
  Verified timer selection and pause/resume UI. Final preview is stopped, online,
  with no timer.

The release ZIP includes unchanged artist FLAC files, attribution, runtime files,
icons, and the future-track guide. It excludes tests, local handoffs and development
metadata. Production has not been redeployed.

## v0.3 follow-up

- Orb now rotates its field and ring inclinations; geometry regression verifies
  visible change over five scene seconds while still/reduced-motion tests remain.
- Ocean-only production output at 48 kHz: RMS 0.01159, peak 0.06929.
- Four FLAC + max-live-layer renders passed: peaks 0.32170 (Broken Glimmers),
  0.59500 (Echoes of Yesterday), 0.20007 (Pale Season), 0.27985 (Safe Space).
- Native-browser auto-mix harness (muted, short stereo WAV fixtures) passed
  A→B→A transitions, context suspend/pause/resume, and disabling rotation.
- Source files for Echoes of Yesterday and Pale Season were downloaded unchanged
  from artist uploads; ffprobe verified 24-bit, 48 kHz, two channels.

- Final syntax checks and **41 automated tests passed**. Focused review findings
  about preserving newer auto-mix edits and optional registration failure were
  fixed and covered by regressions.
- Codex in-app browser discovered all five top-level imperative WebMCP tools.
  Invoked each tool successfully: getter, scene, sound, preset and music.
  Music selection while playing awaited actual FLAC decode/transition and
  returned matching current track; the visible dock and controls agreed.
- No Chrome LLM-eval CLI or cross-browser WebMCP compatibility test was run.
  The deterministic test suite and actual in-app-browser invocations are the
  evidence for this consumer, not a guarantee for every browser.

## Energy Orbit single-pass experiment — 2026-09-21

The official project skill is installed in `.agents/skills/vgpu/SKILL.md` and the
vgpu 0.5.0 CLI is pinned through mise. CLI-bundled docs and CLI-pulled examples
are the reference for this prototype. See `docs/energy-orbit-webgpu.md` for the
commands, measurements, support limits, and live dashboard URL.

- `pnpm check`: passed, including the optional renderer and bridge.
- `pnpm exec vgpu check gpu/orbit.wgsl --require-validation`: passed; validation
  was attempted on a real software adapter, with zero diagnostics.
- `node scripts/render-orbit.mjs`: deterministic identical-input frames and
  nonzero time-dependent pixel change passed on llvmpipe.
- The full existing suite plus the first GPU bridge tests passed (50 tests).
  After the final integration fixes, all 17 focused bridge/visual/PWA tests
  passed, including one additional failed-submission case.
- Headed Agent Browser/SwiftShader visibly rendered the procedural orbit, and
  the current document reports `renderer=webgpu`, `orbitStatus=ready`.
- Reduced-motion submission count stayed fixed; high-DPI resize, a 320px portrait
  viewport, actual BFCache cleanup/recovery, and Canvas fallback in the in-app
  browser were checked. WebMCP `set_scene` continued working.
- Software browser cadence was approximately 12.1 fps for the single-pass GPU
  prototype versus 4.3 fps for the existing Canvas baseline. These are short,
  environment-specific software measurements, not hardware GPU benchmarks.

The experiment is opt-in at `?renderer=webgpu`. No other scenes are migrated.
At that milestone, bloom and further material/palette refinement were deferred. The earlier release
ZIP and published site have not been updated with this experiment.

## Energy Orbit refinement review snapshot

The second material/geometry pass and seven-pass HDR bloom chain are frozen for external review. All four shaders validate, the bundle is synchronized, the Node full-chain check passes, and the headed browser visibly renders. See `energy-orbit-review-handoff.md` for exact evidence and remaining visual issues. New bloom-chain mobile/resize acceptance remains pending.

## Energy Orbit experimental third refinement

The supplied patch was applied unchanged and matched the proposed WGSL bytes. All four device-backed shader checks, build, actual-pixel render check, and51 tests passed. A12.17-second Ocean headed recording was captured and inspected. See `energy-orbit-pass3.md` for the six-criterion assessment and measured limitations, including unsolved violet bloom.

## Energy Orbit supplied pass four

Applied supplied shaders byte-for-byte, validated all four WGSL files, rebuilt, rendered actual pixels and passed51 tests. Captured12.17-second Ocean recording at the same settings. Violet probe still fails the target: maximum0.203328,zero qualifying scene pixels,zero violet bloom pixels across times0/5/10/25. See `energy-orbit-pass4.md` for definitions, visuals and depth/emission findings.

## Energy Orbit supplied pass five

Supplied shader applied byte-for-byte; all four shader checks, build, actual-pixel render and51 tests pass. Same-settings12.17-second Ocean recording inspected. Violet peak hybrid brightness2.183066; at time0,7245 scene pixels qualify above0.40 and4534 final bloom pixels qualify by the existing violet hue/peak test. Full time0/5/10/25 results and depth/visual limits: `energy-orbit-pass5.md`.
