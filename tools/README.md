# Offline video exporter

`tools/export.mjs` renders the reels to a broadcast-grade MP4 **without screen
recording**. It drives each film's own deterministic timeline: seek to an exact
timestamp → wait for the paint → capture the frame → repeat. Rendering runs
slower than real time, and that is the point — every frame is exact, the frame
rate is perfectly constant, and nothing depends on the machine keeping up.

| | Chrome tab capture | This exporter |
|---|---|---|
| Frame timing | whatever the compositor managed | exact CFR, no drops |
| Resolution | viewport, cropped and rescaled | native 1080×1920 |
| Encoding | MediaRecorder VBR | x264 CRF 14, High@4.2, yuv420p |
| Audio | re-recorded from the tab | original mp3, muxed at 320k AAC |
| Repeatable | no | bit-identical every run |

## The Export button (studio mode)

```bash
npm install       # once
npm run studio    # http://127.0.0.1:5173/kwings/reel.html
```

Open a reel from that address and its **Export MP4** button opens a render panel:
pick Draft / Final / Ultra, optionally a time range, hit Render. The page hands
the job to the offline exporter on the server, shows live progress (frame count,
render rate, ETA — mirrored on the button itself), and downloads the finished
file when it lands. Stop cancels mid-render.

| Preset | Settings | Use |
|---|---|---|
| Draft | 30fps, CRF 20, veryfast | checking a change |
| Final | 60fps, CRF 14, slow | the delivery master |
| Ultra | 60fps, CRF 10, 2× supersampled | thin type and 3D edges, ~4× slower |

Served any other way (`file://`, a static host) the button silently keeps the
page's original tab-recording fallback, so nothing breaks when the reel is
shared as plain HTML.

## Use from the CLI

```bash
npm install                 # once
npm run export:kwings       # exports/kwings-media-promo.mp4
npm run export:invogen      # exports/invogen-promo.mp4
```

Or drive it directly:

```bash
node tools/export.mjs kwings/reel.html [options]
```

| Option | Default | What it does |
|---|---|---|
| `--fps 60` | 60 | master frame rate |
| `--crf 14` | 14 | x264 quality; lower = larger and cleaner (10–18 sensible) |
| `--preset slow` | slow | x264 preset (`veryfast` for quick checks) |
| `--scale 2` | 1 | supersample: render at 2× and Lanczos-downscale — softer aliasing on thin type and 3D edges, ~4× slower |
| `--from 6 --to 8` | whole film | render a range only, for quick previews |
| `--out path.mp4` | `exports/<name>.mp4` | output path |
| `--prores` | off | also write a ProRes 422 HQ `.mov` editing master |
| `--no-audio` | off | skip the audio mux |
| `--headful` | off | show the browser, for debugging |

A short range render is the fast way to check a change:

```bash
node tools/export.mjs kwings/reel.html --from 12 --to 16 --preset veryfast
```

The server runs one job at a time and streams progress over SSE
(`POST /api/export`, `GET /api/progress`, `POST /api/cancel`). It is bound to
127.0.0.1 and is a local dev tool — don't expose it.

## How a reel plugs in

Each reel exposes one hook near the bottom of its script:

```js
window.__film = {
  DUR, W, H, name, audio,   // length, frame size, output name, audio file
  ready(),                  // true once late assets (fonts, .glb) have landed
  prepare(),                // pause the clock, enter cinema layout
  seek(t)                   // render exactly time t — no rAF, no audio clock
};
```

Anything deterministic in `t` exports correctly. The exporter serves the project
over a local HTTP server (so `file://` restrictions on audio and the `.glb`
don't apply) and screenshots the `#stage` element, so no browser chrome, timeline
UI, or page background ever reaches the file.

**Caveat:** CSS `@keyframes` animations run on the wall clock, not on `t`, so
they will not be in sync frame to frame. Neither reel uses one inside the stage
(only the record-button pulse in the UI chrome, which is never captured) — keep
new motion on the anime.js timeline and the export stays exact.
