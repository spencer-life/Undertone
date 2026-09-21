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
