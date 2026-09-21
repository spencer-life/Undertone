# Canvas scenes

Living Contours remains `tides`; Silk Drift remains `dunes`; Wet Glass remains `rain`. Energy Orbit's approved WebGPU renderer, bridge, shaders and fallback are unchanged. No rendering dependency was added.

The existing renderers were inspected before implementation: nested contours, open silk ribbons, and cached wet-glass background/bead sprites. Only contour geometry/lighting was refined. Existing rain PRNG ordering and the Silk Drift/Wet Glass drawing functions remain intact.

## Shared Canvas contract

`UndertoneVisuals.canvasContract(settings)` updates one reusable `canvasFrame` object:

- `time`: existing scene clock plus seed offset, in scene seconds; frozen by the shared clock for motion0 or OS reduced motion.
- `viewport`: reusable logical width/height and effective DPR (existing cap1.5).
- `seed`: existing persisted variation seed.
- `palette`: reference to the existing `UT_THEMES` theme object, not another theme system.
- `motion`: normalized0–1; the existing clock owns speed modulation.
- `brightness`: normalized0–1; the existing common compositing overlay owns brightness.
- `reducedMotion`: current OS media-query preference.

The legacy render dispatch passes the same time, viewport and art palette to all Canvas scenes. The common vignette is now cached by dimensions/DPR with unchanged gradient stops. The shared clock still owns30/20FPS, visibility/blackout pauses, transitions, and reduced motion.

## Living Contours

64 contours on narrow viewports,88 otherwise, with160 segments per closed path. A seeded smooth field makes broad asymmetric lobes and saddles. Slowly drifting deformation uses several distinct periods without rotation. Many fine subdued lines establish depth; only six selected elevations receive localized color/glow.

Cached typed coordinate buffers and angular samples are reused. Gradients/colors are rebuilt only on size/DPR/theme/seed change. One reusable half-resolution Canvas holds selective glow; the full scene is never blurred. Mutable immediate paths avoid allocating a new Path2D for every continuously deforming contour on every frame.

Deep Ocean's optional `contourAccents` live in `UT_THEMES.ocean`: cyan, electric blue and violet. Other palettes derive accents from their existing art colors. Theme controls and IDs are unchanged.

## WebMCP

`set_scene` now accepts an optional seed1–9999; the ordinary app change/reseed path performs its existing integer rounding, persistence and visible seed-label update. The state tool returns the seed. No new parallel state store or tool was created.

Native live invocation succeeded in headed Chrome149 via Agent Browser. That browser exposes the pre-migration `navigator.modelContext`; a **test-only** init script aliases it to `document.modelContext` for this run. Production code continues to use the current document API. The alias is in ignored `artifacts/contours/webmcp-149.init.js`, not shipped. The desktop browser initially retained old cached code. Its fresh-origin preview at http://localhost:4191/ subsequently loaded correctly; native desktop WebMCP selected tides/Ocean/seed604 and the updated renderer was visually inspected there as well.

## Verification and review artifacts

`pnpm check` and all54 tests pass, including deterministic seed/time geometry, narrow/wide finite coordinates, buffer/canvas reuse, zero-alpha composition, shared contract and WebMCP seed validation. Existing GPU/reduced-motion/visibility/lifecycle tests remain green. Read-only implementation review found no material issues.

Browser: WebMCP selected tides/Ocean/seed604/motion40/brightness80 and seed605. Motion0 yielded identical canvas pixels across700ms; OS reduced-motion emulation also yielded identical pixels across700ms. Browser error log empty. Screenshot and motion clip are retained under `artifacts/contours/pass1.png` and `pass1.mp4`. These are visual evidence, not hardware performance benchmarks.

The service-worker shell advances tov15 for the changed scripts. This is the first Living Contours pass for user review. Silk Drift and Wet Glass have not been refined.

## Motion correction

The first recording was not reviewed temporally before delivery. It had changing pixels but perceptually inadequate deformation. Increased the contour field's slow oscillation rates and deformation amplitudes while leaving the shared clock and reduced-motion gating unchanged. A geometry regression check now requires more than5px RMS coordinate displacement over five default-speed wall-clock seconds at the test size. All54 tests pass; the updated targeted visual tests also pass. Inspected decoded frames at0,5,10seconds in `artifacts/contours/motion-fix.mp4`: the left cyan saddle and central/upper contour elevations visibly shift. This is temporal frame inspection, not a claim of real-time video playback review. Service-worker shell advances tov16.

## Completion pass — Silk Drift and Wet Glass

The earlier sections record the contour-only milestones. Silk Drift now has broad layered translucent sheets and fine supporting curves. Wet Glass layers cached distant lights, moving distant rain, a cached foreground plate of refracting beads, and moving droplets with cached trails. Typed buffers, gradients and offscreen resources are reused; gradients are not allocated per frame after warmup. IDs, themes, controls, shared time and reduced motion remain intact. Energy Orbit is unchanged.

`pnpm check` and all 58 tests pass. Browser WebMCP selected Ocean / seed 604 / motion 40 / brightness 80. Over 4.5 seconds, 16.91% of Silk pixels and 0.45% of Wet Glass pixels changed by more than 3 channel levels. Wet Glass movement is localized to rain/droplets. Both scenes freeze at motion zero and with OS reduced motion. Current-page error capture remained empty through those checks and narrow high-DPI resizing. Independent review found no material issues.

Artifacts are in `artifacts/canvas-final/`. Recording frames at 2, 7, 30 and 34 seconds were inspected temporally; this is not a claim of real-time video playback or a hardware performance benchmark.

The desktop preview had retained older contour code via its service worker. The new `pnpm preview` server sends no-store responses and injects the existing development-preview flag to disable service-worker registration. Production offline behavior remains enabled; shell cache is v17. A fresh origin, http://localhost:4192/, was opened in the desktop browser and native WebMCP successfully selected Wet Glass there.
