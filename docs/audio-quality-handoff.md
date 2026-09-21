# Undertone — Lossless Lo‑Fi + Binaural Audio

I want to upgrade Undertone’s audio system for the best practical audio quality for its actual intended experience: **real lo-fi music as the main music layer, with binaural beats generated underneath it**.

Please inspect the current repo and existing audio implementation first, then make the changes that fit the codebase cleanly. Preserve the existing product behavior and UI unless something needs to change for the audio upgrade.

## What I want

- The lo-fi layer should use genuinely high-quality/lossless source audio where practical. **FLAC is my preferred source format** for new music assets.
- The binaural beat should **not** be baked into the music file. Generate the left/right tones live with the **Web Audio API** so the binaural parameters can remain independent from the music.
- Keep the lo-fi music in true stereo and keep the binaural left/right tones correctly isolated by channel.
- I want independent control over music level and binaural-beat level.
- Playback and parameter changes should sound polished: no obvious clicks, pops, abrupt cuts, or accidental duplicate playback.
- Do not force 96 kHz/192 kHz just to claim “hi-res.” Prefer the browser/output device’s normal sample rate unless inspection of the existing implementation gives a real reason to do otherwise.
- Do not claim the final browser-to-DAC path is “bit-perfect.” The browser/OS/output device can still affect the final signal. The goal is for **our application’s source and processing path to avoid unnecessary lossy compression or degradation**.

A simple example of the binaural behavior we discussed was 200 Hz in one ear and 210 Hz in the other for a 10 Hz difference. That is only an example, not a required preset or fixed implementation.

## Implementation preference already decided

For ordinary binaural synthesis, native Web Audio nodes are preferred over adding complexity for its own sake. **AudioWorklet is not a requirement.** Use it only if, after inspecting the app, there is a real need for custom sample-level DSP or behavior that standard Web Audio nodes do not handle cleanly.

Please choose the actual integration, lifecycle, loading, looping, crossfading, gain staging, and React/state structure based on the live codebase rather than assuming the earlier conceptual sketch is the repo’s architecture.

## References discussed

These are worth checking while implementing or validating the approach:

- Web Audio API specification: https://www.w3.org/TR/webaudio/
- MDN `AudioContext`: https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/AudioContext
- MDN `AudioBuffer`: https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer
- MDN `AudioWorkletNode`: https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletNode
- MDN audio codec guide: https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Audio_codecs

## What I want back after the implementation

Give me a concise explanation of:

- what the previous audio path was;
- what changed;
- how the final music + binaural signal path works;
- which parts are genuinely lossless and where the browser/OS can still alter the signal;
- how left/right binaural routing is handled;
- what format I should use for future lo-fi tracks;
- exactly where and how I should add future tracks based on the repo’s actual conventions;
- any meaningful remaining limitations or follow-up improvements.

Also verify the implementation in the repo using the project’s existing validation/test/build workflow and report anything that could not be verified.
