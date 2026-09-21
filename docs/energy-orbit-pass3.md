# Energy Orbit — experimental third refinement

Applied the user-supplied `orbit.patch` from `undertone-energy-orbit-shader-pass.zip` without visual modification. Only patch path headers were normalized to this repository. Both applied shader files were byte-compared against the ZIP's proposed WGSL files and matched exactly. Renderer API, bridge, seven-pass architecture, app clock and palettes are unchanged. The browser bundle was rebuilt and the offline shell cache advanced to v13.

## Required validation
All four requested `pnpm exec vgpu check ... --require-validation` commands passed. `pnpm build:orbit`, `pnpm render:orbit`, and `pnpm test` passed (51 tests).

Node actual pixels at 720×480, seed604, Ocean, brightness80: identical-input determinism passed; time0→25 mean RGB difference7.26193/255; visible-pixel fraction11.02%; highlight fraction1.78%. Static output was inspected before opening the browser.

## Headed recording
`artifacts/energy-orbit-pass3-ocean.mp4`: 12.1667 seconds,1440×1100,Ocean,Energy Orbit,seed604,movement40,brightness80. Requested encoding30fps;60 distinct Chrome captures across365 encoded frames (~4.9 distinct frames/sec). Software SwiftShader, not hardware performance. Existing app delta-time clamping can slow scene-time progression when rendering this slowly. No accelerated shader time was injected.

The task-local display and preview server had stopped between turns; both were restored. The fresh headed browser visibly rendered the patch. Current screenshot and sampled recording contact sheet are in `artifacts/energy-orbit-pass3-ocean.png` and `artifacts/energy-orbit-pass3-contact.png`.

## Six visual judgments
1. Center occupied: yes, crossing membranes now pass through the center; the annular hole is removed. Overlay text remains readable.
2. Folded translucent fabric: directionally better. Paths are bowed crossing sheets rather than ellipses, but the whole composition still resembles a woven star/rosette inside an outlined sphere. It does not yet achieve the references' broad wrapping fabric volume.
3. Dotted/moire strands: materially reduced at the recorded desktop size. Continuous bands replace dotted contours. Dense crossings still produce woven interference; mobile/high-DPI appearance is not established by this recording.
4. Distinct color regions: partial. Cyan fronts and blue/indigo rear sheets are visible. Violet remains subdued and insufficiently distinct compared with the Aurora reference.
5. Moving localized highlights: yes, the recorded frames show migrating seam/fold light and gentle local deformation without rigid whole-body rotation. The short software-rendered clip does not establish long-duration looping behavior or hardware smoothness.
6. Violet bloom: not convincingly solved. The hybrid extractor allows saturated colors to qualify, but actual violet radiance in sampled frames remains too low. Do not infer successful violet bloom solely from the extraction formula.

## Rendered HDR diagnostic
A temporary pixel probe (`artifacts/pass3-pixel-probe.mjs`, output `pass3-pixel-evidence.txt`) reads the actual rgba16float scene and final blurred bloom at scene times0,5,10,25. Half-float readback was decoded from raw bytes. Operational violet test: b>1.1r, r>1.15g, peak>0.01. At time25,3174 scene pixels met it; maximum hybrid brightness was0.34488, below the soft-knee onset0.40. No sampled bloom pixels met that violet test. This is a defined diagnostic, not a universal perceptual color classifier, and covers these samples only.

## Direction
Keep the membrane basis. The next tuning targets are stronger folded-volume composition, less star-like convergence, finer subordinate strands, and local violet radiance that actually qualifies for bloom without turning all hot regions cyan. Preserve this exact patch as the experiment baseline; no additional shader tuning was mixed into this result.
