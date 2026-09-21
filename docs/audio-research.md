# Audio research decisions

Date checked: 2026-09-21. This note describes the current lightweight Web Audio
engine and the limits of what can be claimed about its sound.

## Procedural path (retained as an optional fallback)

- `audio-worklet.js` keeps noise, rain and ocean state inside one persistent
  `AudioWorkletProcessor`. This avoids finite-buffer restarts and the periodic
  level dip caused by a source that fades out at each 10–13 second boundary.
- The fallback uses persistent `ScriptProcessorNode` generators. It is a
  compatibility path only; `ScriptProcessorNode` is deprecated and can be
  affected by main-thread load. The worklet path is preferred.
- Music is procedural oscillator composition: scored chord cycles, filtered
  layered partials, bells, reverb, and a master dynamics compressor. It is
  useful ambient composition, but it is not equivalent to a verified,
  professionally recorded/mastered production.
- The binaural path is explicit left/right oscillator separation. The speaker
  path is a low-rate room pulse. Digital gain values are intentionally not
  labeled as dB SPL because device output levels are unknown.

## Production recommendation

The no-build procedural fallback is appropriate for a small PWA: it has
no asset fetches, starts after a user gesture, and can run indefinitely. The later user handoff explicitly requested authored lo-fi music. That path is
now implemented with original stereo FLAC sources; see `music-library.md`.
Native looping uses an artist-supplied loop or a prepared tail/head overlap, and
track changes use scheduled gain crossfades. Keep procedural
noise in the worklet, since a random texture should not be a short repeated
recording. A mastered stem can improve arrangement and timbral realism, but
increases download size, licensing/asset maintenance, and mobile memory use.

Never restart layers from `setInterval`; schedule from `AudioContext.currentTime`.
Use `AudioParam` ramps for every layer or master transition to avoid clicks.

## Headphones, speakers and mobile

`PannerNode` HRTF is spatialization, not a binaural beat. Ordinary web APIs do
not reliably identify whether the output is headphones or speakers, so the
headphone/speaker choice should remain user-controlled. Binaural beats should
be optional and very quiet; speakers can sum or partially cancel phase-based
left/right tones.

Create/resume the context from the play gesture. Handle `statechange`, including
Safari's `interrupted` state after backgrounding or screen lock. Background
execution and uninterrupted PWA playback remain browser/OS dependent.

## Primary references

- [Web Audio API 1.1 specification](https://www.w3.org/TR/webaudio/)
- [AudioBufferSourceNode loopStart](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/loopStart)
- [AudioParam automation](https://www.w3.org/TR/webaudio/#AudioParam)
- [AudioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet)
- [Web Audio best practices and autoplay](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices)
- [BaseAudioContext state/interruption](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/state)
- [PannerNode panning model](https://developer.mozilla.org/en-US/docs/Web/API/PannerNode/panningModel)
- [AudioContext latencyHint/baseLatency](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/AudioContext)

## Reference track limitation

The supplied SoundCloud URL resolved to “Dancing Thing” by VisionV in the
“Flow State” playlist (released 14 April 2023). Browser inspection exposed page
metadata, but did not provide an audibly verifiable listening path in this
research session. No sonic or production claim about that track is made here.
