# InvoGen audio

`../../assets/invogen/mix.mp3` — what the film plays. Voiceover + music bed, ducked, 47.8s.

## Why the music is generated, not downloaded

This is a commercial advertisement. Almost every "free music" track carries a licence
condition — attribution in the description, no-ads clauses, or a per-project sync licence —
and a track pulled off a site with unclear terms is a claim waiting to happen on Meta or
YouTube. The bed here is synthesised from scratch by `make-bed.py`, so Kwings Media owns it
outright. No attribution, no claim, no expiry.

## Rebuilding the mix

```sh
python3 audio/make-bed.py                     # writes bed.wav (47.8s)

ffmpeg -y -i bed.wav -i assets/invogen/vo.mp3 -filter_complex "
 [1:a]aformat=channel_layouts=stereo,aresample=44100,highpass=f=85,
      acompressor=threshold=0.12:ratio=3:attack=8:release=180:makeup=1.6[vo];
 [vo]asplit=2[vo1][sc];
 [0:a]volume=0.62[b];
 [b][sc]sidechaincompress=threshold=0.02:ratio=14:attack=8:release=380:makeup=1[bed];
 [vo1][bed]amix=inputs=2:duration=longest:normalize=0,
  alimiter=limit=0.95,loudnorm=I=-14:TP=-1.5:LRA=11[out]" \
 -map "[out]" -c:a libmp3lame -b:a 192k assets/invogen/mix.mp3
```

## What's in the bed

- **Pad** — Am / F / C / G, two bars each at 100 BPM (9.6s cycle, ~5 cycles). Detuned sines
  with a slow attack and a 0.13 Hz tremolo so it never sits still.
- **Sub pulse** on the beat, felt rather than heard.
- **Offbeat arp**, soft triangle plucks, panned alternately.
- **Riser** 41.9 → 42.7s with the filter opening, landing on a low impact at **42.66s** — the
  exact frame the dark CTA scene cuts in.
- **Two functional ticks** at 30.9s (signature completes) and 32.6s (one-click convert).
- 1.6s fade in, 2.6s fade out, so a looping feed post never clips the first word.

## Mix decisions

- VO high-passed at 85 Hz and lightly compressed (3:1) so it stays in front.
- Bed sidechained off the VO: **~17 dB down under speech, up ~6 dB in the gaps**. The music
  breathes between lines instead of fighting the words.
- Mastered to **−14 LUFS / −1.5 dBTP** — Meta and YouTube's target, so nothing gets
  turned down on upload.

## If you'd rather license a real track

Sources that are genuinely safe for a paid ad: **Artlist**, **Epidemic Sound**, **Musicbed**
(subscription, covers ads), or **Pixabay Music** (no attribution required, but read the track's
own terms). Drop the file in as `bed.wav`, re-run the ffmpeg command above, and the ducking,
levels and CTA timing all still apply.
