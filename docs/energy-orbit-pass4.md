# Energy Orbit pass four — supplied refinement

Baseline: pass three, commit b77d92d. Applied `orbit-pass4.patch` unchanged from the user-supplied ZIP. Both modified WGSL files byte-match the proposed shader files. Only gpu/orbit.wgsl, gpu/orbit-bright.wgsl and the rebuilt generated bundle change runtime output. Renderer, bridge, palettes, app clock, fallback, integration, blur/post shaders and seven-pass architecture remain unchanged. The global threshold remains0.62 and knee0.22 (onset0.40).

## Verification

All four `pnpm exec vgpu check ... --require-validation` checks passed through `pnpm check:orbit`. `pnpm build:orbit`, `pnpm render:orbit`, and `pnpm test` passed;51 tests, zero failures. Actual Node pixels were read and the static frame inspected before browser capture. Same-input determinism passed; time0→25 mean RGB difference4.02636/255, visible fraction8.4621%, highlight fraction0.6047%.

## Violet probe

Same seed604, Ocean palette, brightness80, energy0, scene720×480 and bloom480×320 as pass three. Same violet classification: b>1.1r, r>1.15g, peak>0.01. The hybrid brightness calculation was updated to match the supplied pass-four extractor exactly: max(Rec.709 luminance, peak*(0.58+0.12*saturation)). Scene qualification additionally requires brightness>0.40. Bloom count means final blurred bloom pixels satisfying the same violet hue/peak test; bloom is not incorrectly thresholded a second time.

| Scene time | Violet scene pixels | Maximum violet hybrid brightness | Violet scene pixels above0.40 | Violet bloom pixels |
|---|---:|---:|---:|---:|
|0|332|0.122284|0|0|
|5|0|0 (none classified)|0|0|
|10|0|0 (none classified)|0|0|
|25|2622|0.203328|0|0|

Maximum across these samples: **0.2033276367**. Qualifying scene pixels: **0**. Qualifying bloom pixels: **0**. The intended violet bloom criterion is not met in these samples. This defined diagnostic does not establish every frame or every perceptually purple color. Probe code and output are retained in artifacts/pass4-pixel-probe.mjs and artifacts/pass4-pixel-evidence.txt.

## Comparable headed capture

artifacts/energy-orbit-pass4-ocean.mp4:12.1667 seconds,1440×1100, Ocean,Energy Orbit,seed604,movement40,brightness80,audio paused. Same settings as pass three.365 encoded frames at30fps but only54 distinct Chrome captures (~4.4/sec). Software SwiftShader; not a hardware smoothness benchmark. The existing app delta clamp can slow scene-time progression at low rendering cadence. No clock changes or accelerated-time injection were used.

Screenshot: artifacts/energy-orbit-pass4-ocean.png. Four sampled recording frames: artifacts/energy-orbit-pass4-contact.png. The fresh generated bundle was explicitly loaded into the isolated test-browser cache to avoid stale assets; application service-worker source was not changed.

## Visual assessment

- Rosette convergence is reduced: staggered folds read as an asymmetric crossing composition instead of a central star. Some crossing remains, as expected for overlapping membranes.
- The dominant folds are broader and supporting folds quieter. They still resemble layered luminous bands more than the references' broad translucent spherical fabric.
- Crossing interference is reduced; strands are coarser and less visually dense. This desktop sample does not prove all mobile/DPR cases.
- Cyan/blue remain dominant. Indigo/violet participate subtly but color separation is not materially strong enough to call the Aurora goal achieved.
- Local light and shape drift are present without rigid whole-body rotation in the short capture.

## Source-level explanations confirmed by independent read-only review

1. Projected depth cancels: sheet_z=sphere_z*waveform, followed by normalized_z=sheet_z/max(sphere_z,0.001). For almost all interior pixels, sphere_z cancels. The separate edge fade remains, but front/back weighting is still largely the waveform, rather than varying with spherical depth.
2. Violet emission is multiply gated (ridge, travel, zone and front twice), and co-located with cyan ridge light. Even ideal masks and a pure-secondary sheet yield combined ridge-plus-violet RGB approximately(0.698,0.973,2.302) before exposure: bright but blue/cyan under the probe's violet classifier. The rendered scene has HDR peaks, but the violet-classified subset does not cross the knee.

The supplied pass is retained unchanged as the tested refinement. Further work should preserve the membrane implementation and address depth cancellation and local violet hue/radiance, without lowering the global bloom threshold or changing another scene.
