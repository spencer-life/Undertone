# Audio-quality handoff review

Checked 2026-09-21 against `audio.js`, `audio-worklet.js`, and `app.js`.

## What the current code actually delivers

The repository still has no music recordings or asset loader. Its music layer is
procedural oscillators: chord voices, filtered partials, bells, reverb and a
small delay. Therefore it cannot honestly be described as “real lo-fi music,”
lossless music playback, or a professionally mastered production yet. It does
provide an independent live binaural layer and independent music/texture/beat
controls.

Noise, rain and ocean are generated continuously by one persistent
`AudioWorkletProcessor`; the fallback is persistent `ScriptProcessorNode` state.
There is no finite 10–13 second texture buffer being restarted. The scheduler
pre-renders many seconds of oscillator voices against `AudioContext.currentTime`,
which gives useful protection against timer clamping, but procedural scheduling
is still composition rather than authored track playback.

The binaural route is structurally correct: two mono oscillators feed a
two-input `ChannelMergerNode`, then a dedicated gain. Music and textures enter
the normal stereo graph separately. Headphone routing remains a user choice;
the browser cannot reliably infer headphones versus speakers. The UI correctly
labels speaker mode as a non-binaural pulse.

## Highest-priority architecture decision

Do not add FLAC merely to the current oscillator graph. To satisfy the new
music requirement, introduce an optional authored-stem path:

1. Keep the current procedural score as the no-asset fallback.
2. Load a complete FLAC file (or a browser-compatible alternate) into an
   `AudioBuffer` with `fetch()` and `decodeAudioData()`.
3. Send the decoded buffer through a dedicated `musicAsset` gain bus into the
   existing music/master chain, while keeping the binaural merger on its own
   path.
4. Create a fresh `AudioBufferSourceNode` for each play; set `loop=true` only
   for an intentionally loopable asset. For non-seamless material, use two
   scheduled sources and short equal-power gain crossfades.
5. Keep music level and beat level as separate gain parameters and ramp them
   with `AudioParam` automation.

Do not claim “bit-perfect” after decode. `decodeAudioData()` resamples decoded
content to the `AudioContext` sample rate, and the browser/OS/output device may
perform additional conversion. The current constructor correctly leaves sample
rate selection to the output device and requests `latencyHint: 'playback'`; the
browser is allowed to ignore the hint.

## Format recommendation

FLAC is a reasonable preferred source for new assets because it is lossless and
open. It is not sufficient as the only delivery format without runtime testing:
browser/container support varies. Check `audio/flac` support with
`HTMLMediaElement.canPlayType()` for a media fallback, or catch
`decodeAudioData()` failure and provide a compatible alternate. Keep an
uncompressed master/archive outside the web bundle if asset size is a concern.

Future tracks should live under a dedicated repository asset directory (none
exists in the current tree); establish one such as `undertone/audio/` only when
the asset loader is added, and keep a small manifest containing URL, duration,
loop points, and intended source sample rate. Do not put a large asset into
procedural code or encode it as a data URL.

## Validation and remaining limitations

- Existing unit tests validate persistent texture generation, noise transitions,
  channel tests, play/pause lifecycle, and timer behavior. They do not verify
  perceptual quality, frequency response, FLAC decode across browsers, or the
  actual DAC path.
- A real authored track requires a browser/integration test on each target
  browser, including the chosen FLAC fallback behavior and a long-run seam test.
- The compressor is on the shared input path, so independent routing is
  preserved as channel separation but the beat and music share final dynamics.
  If strict beat transparency is required, place the beat after music
  compression and use a separate final safety limiter.
- Mobile autoplay/interruption behavior remains platform dependent. Resume the
  context from a user gesture and handle `AudioContext.state` changes.

## Primary references

- [Web Audio API 1.1](https://www.w3.org/TR/webaudio/)
- [decodeAudioData()](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData)
- [AudioContext constructor, sample rate and latencyHint](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/AudioContext)
- [AudioBufferSourceNode loopStart](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/loopStart)
- [ChannelMergerNode in the Web Audio specification](https://www.w3.org/TR/webaudio/#ChannelMergerNode)
- [MDN Web audio codec guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Audio_codecs)
- [MDN FLAC/container support](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Containers)
- [AudioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet)



Implementation follow-through: the library path is now being integrated; see `music-library.md` for final conventions and signal routing. The synthesis-only statements above describe the engine at review time.
