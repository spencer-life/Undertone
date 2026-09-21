# Energy Orbit review handoff — 2026-09-21

## Scope and current status
Keep the existing vgpu 0.5.0 / WebGPU implementation and refine Energy Orbit only. Do not migrate Living Contours, Silk Drift, or Wet Glass. No framework rewrite, audio changes, deployment, or new theme UI is requested.

This archive freezes the SECOND refinement source pass and its rebuilt browser bundle. It is a focused source review package, NOT the complete runnable Undertone application. Audio modules, music assets, icons, and unrelated tests are intentionally omitted. Full integration files are included unchanged where they contain the actual scene boundary; do not treat their unrelated functions as requested edit scope.

The infrastructure works: lazy opt-in GPU surface, shared application animation clock, deterministic seed, brightness/theme controls, reduced-motion/hidden/blackout handling, capped DPR, fallback to Canvas, teardown and BFCache recovery. The current pipeline adds actual HDR selective bloom. No image textures or supplied reference screenshots are embedded in the renderer.

## Exact file map
### Authoritative visual source — edit these first
- `gpu/orbit.wgsl`: procedural form, warped sheet coordinates, filament masks, front/rear attenuation, atmospheric body, moving highlights, structural arcs and motes. Outputs HDR radiance.
- `gpu/palettes.js`: semantic HDR palette values; Ocean now includes blue/indigo/violet/cyan.
- `gpu/orbit-bright.wgsl`: luminance threshold 0.62 with soft knee 0.22; extracts bloom energy.
- `gpu/orbit-blur.wgsl`: separable nine-tap Gaussian blur.
- `gpu/orbit-post.wgsl`: combines sharp HDR scene and bloom, tone mapping, display curve and vignette.
- `gpu/orbit.js`: `createOrbitRenderer`, device/surface setup, uniforms, targets, prewarm, resizing, seven-pass frame submission, error handling/disposal.
- `gpu/package.json`: ESM boundary.

### Actual application integration — preserve these contracts
- `orbit-bridge.js`: lazy imports the built renderer for `?renderer=webgpu` and scene `orbit`; owns overlay canvas and fallback lifecycle.
- `visuals.js`: `UndertoneVisuals` is the single RAF owner; passes time/seed/theme/brightness/energy/size to the bridge. Also contains the existing Canvas scenes and UI theme table because this is the exact source file.
- `app.js`: application settings, `new UndertoneVisuals(...)`, reseeding, theme/scene controls and persistence. Audio implementation dependencies are omitted.
- `index.html`: actual canvas, overlay controls, script loading order.
- `styles.css`, `layout.css`: stage dimensions, canvas stacking, controls and responsive layout.
- `sw.js`: versioned offline asset cache, currently undertone-v12. Stale cached bundles can hide shader changes.

### Build, runtime and verification
- `scripts/build-orbit.mjs`: bundles GPU modules and WGSL text with esbuild.
- `scripts/render-orbit.mjs`: Node software-GPU rendering of the complete seven-pass chain, determinism/motion/highlight assertions, PPM outputs.
- `vendor/energy-orbit.js`: generated browser bundle, synchronized with this source. Do not edit it directly.
- `vendor/LICENSE.vgpu`: dependency license.
- `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `mise.toml`, `mise.lock`: exact tool/dependency versions and setup.
- `tests/orbit-bridge.test.js`, `tests/visuals.test.js`: lifecycle and existing clock invariants.
- `.agents/skills/vgpu/SKILL.md`: official tooling guidance; use installed vgpu bundled docs as the API authority.
- `MANIFEST.json`: byte sizes and SHA-256 hashes of the exact included source files.

## Rendering pipeline
Existing app RAF -> UndertoneOrbitBridge.draw -> createOrbitRenderer.draw -> one `frame(gpu, callback)` submission:
1. Procedural scene -> full-resolution rgba16float target.
2. Bright extraction -> reduced-resolution HDR bloom target A (height <=320).
3–6. Horizontal/vertical blur pairs, radii 1 and 2.25, ping-pong A/B.
7. Sharp scene + bloom (strength 0.64), tone map and vignette -> canvas surface.
Targets follow resize. The bridge disposes the renderer when leaving Energy Orbit or on failure. No second animation loop is introduced.

## Where we are visually
The first working prototype was dark, uniformly teal elliptical wires. The current source adds six independently warped/drifting sheets, differing contour scales, projected depth shading, localized traveling hot spots, two subdued structural arcs, a translucent body, spatial color variation, and selective bloom. The second refinement widened bands, increased veil/body, reduced exterior loops and strengthened violet.

After freezing this snapshot, the rebuilt bundle was loaded and visibly inspected in headed Chromium: `data-renderer=webgpu`, `orbitStatus=ready`. The second pass is more luminous and more fabric-like than the first, but it is NOT visually approved and does not yet match the references.

## What is still wrong
1. The composition still reads as overlapping ribbons around a dark central hole, rather than a cohesive translucent, irregular spherical volume.
2. Several contours still read as elliptical/annular bands. Deformation changes them, but does not fully break the shared projected-ring appearance.
3. Fine contours show dotted/moire-like sampling in the browser. Their frequency/width needs screen-space antialiasing and careful contrast, not indiscriminate blur.
4. Depth is a shader lighting approximation; these are implicit 2D projected fields, not a 3D strand mesh with true occlusion. Front/rear contrast helps, but crossings can still look flat.
5. Color is richer, but the reference has more intentional cyan, electric-blue and violet regions and brighter concentrated luminous folds.
6. The body still lacks the reference's broad, smooth translucent fabric surfaces. Stronger veil alone risks a colored ring rather than solving geometry.
7. Bloom is implemented and selective, but the strongest highlights and their spatial distribution still need art direction. Increasing global exposure/glow is not a sufficient fix.
8. Independent motion exists; long-duration naturalness and mobile aliasing/performance have not yet been accepted. Do not claim there is no visible loop on the basis of a short capture.

## Where we need to be
Match the supplied Deep Ocean and Aurora screenshots: a coherent softly irregular orb, overlapping translucent folded sheets, crisp fine strands subordinate to a few luminous structural curves, spatial front/back separation, localized slowly moving highlights, cyan/teal/electric-blue/indigo/violet variation, and a near-black surrounding stage. Keep the center readable without creating an obvious empty donut. Retain independent slow motion, reduced-motion behavior and deterministic seed variation.

Ask the reviewing chat for concrete changes to the source files above, preferably complete replacement WGSL files or a unified diff. Keep the public renderer/bridge API and existing app clock. Explain geometric and lighting changes rather than proposing another architecture rewrite. Return the changed source, not only the minified bundle.

## Verification and limits
- All four shaders passed official device-backed `vgpu check --require-validation` after pass two.
- Bundle rebuilt from frozen pass-two source.
- Full seven-pass Node render after pass two: deterministic identical-input frames; time 0 ->25 mean RGB change 3.1764/255; 15.84% of pixels exceed 50/255 in at least one channel; 1.26% exceed150/255. These are visibility checks, not visual-quality scores.
- Existing full application suite: 51 passing tests. This suite does not judge shader aesthetics.
- Independent review found no material target-binding, ping-pong, resize or cleanup issues. New bloom-chain browser resize/mobile checks remain pending.
- Headed Chromium uses software SwiftShader; Node uses llvmpipe. Hardware GPU performance is unmeasured. Earlier single-pass FPS numbers do not describe the new seven-pass renderer.
- Codex in-app browser currently cannot acquire a WebGPU adapter. It shows Canvas fallback. The headed GPU browser is streamed at http://localhost:4848; direct local app URL is http://127.0.0.1:4180/?renderer=webgpu.

## Reproduction in the original project
Use `pnpm install --frozen-lockfile`, `pnpm check:orbit`, `pnpm build:orbit`, `pnpm render:orbit`. Official docs: `pnpm exec vgpu docs find <topic>` and `pnpm exec vgpu docs cat <page>`. No manual GitHub example fetching is needed.

This focused archive can rebuild the GPU bundle and contains the Node render check, but cannot run the full application or all package test/check scripts without the deliberately excluded app dependencies. Apply returned edits back into the original project. Rebuild the generated bundle and ensure the local service worker serves fresh assets before judging the changes.
