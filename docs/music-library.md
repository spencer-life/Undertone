# Music library and signal path

## What changed

The original app made its music entirely from oscillators and bells through a
shared low-pass filter and reverb. Noise and rain/ocean used finite generated
buffers faded to zero at their 10/13-second boundaries. There were no recorded
tracks and no lossless-source music loader.

The default music source is now an authored stereo FLAC library. The procedural
score remains an explicit **Generated music** option. The live binaural tones
remain native OscillatorNodes, separate from the music; AudioWorklet is used only
for the custom continuous noise/rain/ocean DSP.

## Signal path

- FLAC file → browser decode to stereo floating-point AudioBuffer → native looping
  source → per-track crossfade → independent Music level → shared output dynamics
  and master/session/transport gains → device.
- Generated music → musical filters, stereo placement, reverb/delay → output bus.
  This path is muted when a library track is active.
- Left sine at `carrier − hz/2` and right sine at `carrier + hz/2` → separate inputs
  of a two-channel merger → headphone route gain → Beat level → output bus.
  These tones never pass through music reverb, delay, or spatial panning.
- Speaker mode uses a single amplitude-modulated tone sent equally to both
  channels. It is explicitly not binaural.

Music and live beats have independent gains. Library music bypasses the generated
music's high-pass, low-pass, reverb and delay; common output dynamics remain to
manage headroom when listeners combine layers. Pause suspends the one shared
AudioContext, preserving track position and session time. End Session stops the
track so a new session restarts it. Native looping does not rely on a JavaScript
timer. Track changes load before replacing the active source, then crossfade.

## Lossless source versus output

The distributed music files are the artist-supplied FLAC files, without lossy
transcoding. FLAC preserves the samples encoded into it. All four starter files are
24-bit, 48 kHz, stereo; these are verified encoding properties, not a claim about
the artist's entire production history.

`decodeAudioData()` decodes and resamples to the AudioContext's sample rate. The
app requests the browser/device's normal rate, not forced 96/192 kHz. Volume,
loop crossfades, mixing, dynamics, browser conversion, OS processing, Bluetooth
codecs and the DAC/output path can change the signal. **Playback is not claimed
to be bit-perfect.** Lossless encoding also does not make a poor musical source
better; composition, production and the listening system still matter.

## Add a future track

1. Obtain an actual stereo FLAC master with distribution rights. Export FLAC
   directly from the original WAV/AIFF or music session; converting MP3/AAC to
   FLAC cannot restore lost information. Original WAV is also decodable, but FLAC
   is preferred for smaller lossless downloads. Keep the original native sample
   rate; 44.1 or 48 kHz is practical. Avoid artificial upsampling.
2. Place it at `assets/music/your-track-v1.flac`. Use a new filename for a new
   master so the offline music cache cannot serve an older file under the same URL.
3. Add an entry to `music-library.js`:

   ```js
   'your-track': {
     id: 'your-track', title: 'Your track', artist: 'Artist',
     url: './assets/music/your-track-v1.flac',
     loop: 'crossfade', crossfadeSeconds: 2,
     license: 'CC BY 4.0',
     licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
     sourceUrl: 'https://artist.example/the-original-release',
     description: 'A short, accurate description · original stereo FLAC'
   }
   ```

   Use `loop: 'seamless'` only for a deliberately loopable source. Crossfade mode
   overlaps the configured duration of the original tail/head once in memory.
   Broken Glimmers uses eight seconds to cover its quiet outro. It shortens the
   repeat by that overlap and changes those samples; the source file stays intact.
4. Add the artist, source, license and modification notice to
   `assets/music/ATTRIBUTION.md`. The app displays source/license links as well.
5. Increment `CACHE` in `sw.js` to update the library manifest/app shell. Music is
   cached on demand after a successful load, separately from the small app shell.
6. Run `pnpm run check`, `pnpm test`, and the browser audio harness. Check the
   track change, repeat seam and musical balance by listening on headphones.
   Repackage the runtime files including the full `assets/music` folder.

The player accepts two-channel sources only, caps downloaded file size at 80 MiB
and decoded PCM at 128 MiB, and retains only the current/transitioning track.
Decoded PCM memory is larger than the compressed file: seconds × sample rate ×
2 channels × 4 bytes. Browser memory pressure can still limit long tracks,
especially during a crossfade. A streamed MediaElement path may be useful for a
future long-form library, with different gapless-looping tradeoffs.

## Starter credits

See [full attribution](../assets/music/ATTRIBUTION.md). Broken Glimmers is the
main lo-fi selection. Safe Space is a more ambient alternative. The source pages
and local file hashes are retained with the project.

## Automatic library rotation

Enable **Auto mix** in Sound to rotate through the registered library.
The next track starts loading near the current loop's end and enters with an
eight-second crossfade. If loading is late or unavailable, the current native
loop continues. Pausing also pauses the audio clock used by the rotation.
A **Next track** button makes an immediate manual selection with a short fade.
New catalog entries join the rotation automatically. This is a crossfaded
playlist, not tempo/key matching or stem-based DJ mixing. Browser suspension
can delay track changes; it does not turn the native loop into a silent gap.

The library now contains Broken Glimmers, Echoes of Yesterday, Pale Season,
and the ambient companion Safe Space. All four are original artist-supplied
24-bit / 48 kHz stereo FLAC; licenses and hashes are in `assets/music`.
