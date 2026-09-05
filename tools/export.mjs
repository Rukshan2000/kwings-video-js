#!/usr/bin/env node
/**
 * Offline, frame-accurate video exporter.
 *
 * Instead of screen-recording the tab (dropped frames, VBR mush, whatever the
 * compositor felt like doing), this drives the film's own deterministic
 * timeline: it seeks to an exact timestamp, waits for the paint, grabs the
 * frame, and repeats. Rendering can take as long as it likes — the output is
 * always a perfect constant-frame-rate master.
 *
 *   node tools/export.mjs [reel.html] [options]
 *
 *   --fps 60            frame rate of the master           (default 60)
 *   --scale 1           supersample factor, 2 = render 2x then downscale
 *   --crf 14            x264 quality, lower = bigger/better (default 14)
 *   --preset slow       x264 preset                        (default slow)
 *   --from 0 --to 12    render a range only (seconds) — quick previews
 *   --out path.mp4      output file
 *   --no-audio          skip the audio mux
 *   --prores            also write a ProRes 422 HQ editing master
 *   --headful           show the browser (debugging)
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

/* ---------------- args ---------------- */
const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf('--' + name);
  return i > -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const flag = (name) => argv.includes('--' + name);

const target = argv.find((a) => !a.startsWith('--') && a.endsWith('.html')) || 'kwings/reel.html';
const FPS = Number(opt('fps', 60));
const SCALE = Number(opt('scale', 1));
const CRF = opt('crf', '14');
const PRESET = opt('preset', 'slow');
const FROM = Number(opt('from', 0));
const TO = opt('to', null);
const WITH_AUDIO = !flag('no-audio');

if (!existsSync(join(ROOT, target))) {
  console.error(`✗ no such file: ${target}`);
  process.exit(1);
}

/* ---------------- chrome ---------------- */
function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ].filter(Boolean);
  const cache = join(process.env.HOME || '', '.cache/puppeteer/chrome');
  if (existsSync(cache)) {
    for (const dir of readdirSorted(cache)) {
      candidates.push(join(cache, dir, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'));
      candidates.push(join(cache, dir, 'chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'));
    }
  }
  return candidates.find((p) => existsSync(p));
}
function readdirSorted(dir) {
  return readdirSync(dir).sort().reverse();
}

/* ---------------- a real static server (file:// blocks module + audio) ---- */
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.mp3': 'audio/mpeg', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary',
  '.json': 'application/json', '.md': 'text/plain',
};
function serve() {
  return new Promise((ok) => {
    const server = createServer((req, res) => {
      const path = join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!path.startsWith(ROOT) || !existsSync(path) || statSync(path).isDirectory()) {
        res.writeHead(404).end('not found');
        return;
      }
      res.writeHead(200, {
        'content-type': MIME[extname(path).toLowerCase()] || 'application/octet-stream',
        'accept-ranges': 'bytes',
      });
      res.end(readFileSync(path));
    });
    server.listen(0, '127.0.0.1', () => ok(server));
  });
}

const JSON_OUT = flag('json');
const emit = (o) => { if (JSON_OUT) process.stdout.write(JSON.stringify(o) + '\n'); };

const bar = (done, total, extra = '') => {
  if (JSON_OUT) return;
  const pct = done / total;
  const w = 28, filled = Math.round(pct * w);
  process.stdout.write(
    `\r  [${'█'.repeat(filled)}${'·'.repeat(w - filled)}] ${(pct * 100).toFixed(1)}%  ${done}/${total}  ${extra}   `
  );
};

/* ---------------- main ---------------- */
const chrome = findChrome();
if (!chrome) {
  console.error('✗ no Chrome found. Install Google Chrome, or set CHROME_PATH.');
  process.exit(1);
}

const server = await serve();
const port = server.address().port;
const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: !flag('headful'),
  args: [
    '--autoplay-policy=no-user-gesture-required',
    '--force-device-scale-factor=' + SCALE,
    '--hide-scrollbars',
    '--mute-audio',
    // real GPU rasterisation for the WebGL robot, and no throttling of a
    // page we are stepping by hand
    '--enable-gpu-rasterization',
    '--use-angle=metal',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--force-color-profile=srgb',
    '--disable-lcd-text',
  ],
});

let exitCode = 0;
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.warn('\n  page error:', e.message));

  const url = `http://127.0.0.1:${port}/${target}?paused&cinema&t=0`;
  console.log(`\n▶ ${target}`);
  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  await page.evaluate(() => new Promise((r) => setTimeout(r, 1500)));  // let CDN scripts (anime, three) boot

  const film = await page.evaluate(() => {
    if (!window.__film) return null;
    return { DUR: window.__film.DUR, W: window.__film.W, H: window.__film.H, name: window.__film.name, audio: window.__film.audio };
  });
  if (!film) throw new Error('this page has no window.__film export hook');

  await page.setViewport({ width: film.W, height: film.H, deviceScaleFactor: SCALE });

  // wait for late assets: fonts, the .glb robot, images
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForFunction(() => window.__film.ready(), { timeout: 60000 }).catch(() => {
    console.warn('\n  ⚠ 3D/asset readiness timed out — rendering anyway');
  });
  await page.evaluate(() => window.__film.prepare());
  await new Promise((r) => setTimeout(r, 600));   // let the cinema layout settle

  const stage = await page.$('#stage');
  const start = FROM;
  const end = TO !== null ? Number(TO) : film.DUR;
  const total = Math.max(1, Math.round((end - start) * FPS));

  mkdirSync(join(ROOT, 'exports'), { recursive: true });
  const suffix = TO !== null || FROM ? `-${start}s-${end}s` : '';
  const out = resolve(ROOT, opt('out', `exports/${film.name}${suffix}.mp4`));
  mkdirSync(dirname(out), { recursive: true });

  const audioPath = film.audio && WITH_AUDIO
    ? resolve(dirname(join(ROOT, target)), film.audio)
    : null;
  const hasAudio = audioPath && existsSync(audioPath);
  if (WITH_AUDIO && !hasAudio) console.warn(`  ⚠ audio not found, exporting silent`);

  /* ffmpeg: PNG frames in on stdin, H.264 High yuv420p out — CFR, no drops */
  const vf = [
    SCALE !== 1 ? `scale=${film.W}:${film.H}:flags=lanczos` : null,
    'format=yuv420p',
  ].filter(Boolean).join(',');

  const args = ['-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'image2pipe', '-vcodec', 'png', '-framerate', String(FPS), '-i', 'pipe:0'];
  if (hasAudio) args.push('-ss', String(start), '-i', audioPath);
  args.push(
    '-map', '0:v:0', ...(hasAudio ? ['-map', '1:a:0', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000'] : []),
    '-c:v', 'libx264', '-preset', PRESET, '-crf', CRF,
    '-profile:v', 'high', '-level', '4.2', '-pix_fmt', 'yuv420p',
    '-vf', vf, '-r', String(FPS), '-g', String(FPS * 2),
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-movflags', '+faststart', '-shortest', out
  );

  const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
  const ffDone = new Promise((ok, no) => {
    ff.on('close', (c) => (c === 0 ? ok() : no(new Error('ffmpeg exited ' + c))));
    ff.on('error', no);
  });

  emit({ type: 'start', frames: total, fps: FPS, w: film.W, h: film.H, dur: end - start, out });
  if (!JSON_OUT) console.log(`  ${film.W}×${film.H} @ ${FPS}fps · ${(end - start).toFixed(2)}s · ${total} frames · crf ${CRF}${SCALE !== 1 ? ` · ${SCALE}× supersampled` : ''}`);
  const t0 = Date.now();

  for (let i = 0; i < total; i++) {
    const t = start + i / FPS;
    await page.evaluate((tt) => {
      window.__film.seek(tt);
      // settle the frame: one composited paint before we grab it
      return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }, t);
    const buf = await stage.screenshot({ type: 'png', optimizeForSpeed: true, captureBeyondViewport: false });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));

    if (i % 10 === 0 || i === total - 1) {
      const el = (Date.now() - t0) / 1000;
      const eta = el / (i + 1) * (total - i - 1);
      bar(i + 1, total, `${((i + 1) / el).toFixed(1)} fps · eta ${Math.round(eta)}s`);
      emit({ type: 'progress', frame: i + 1, frames: total, eta: Math.round(eta), rate: +((i + 1) / el).toFixed(1) });
    }
  }
  ff.stdin.end();
  await ffDone;

  const mb = (statSync(out).size / 1048576).toFixed(1);
  emit({ type: 'encoding' });
  if (!JSON_OUT) console.log(`\n✓ ${basename(out)}  ${mb} MB  (${((Date.now() - t0) / 1000).toFixed(0)}s)\n  ${out}`);
  emit({ type: 'done', out, name: basename(out), bytes: statSync(out).size });

  if (flag('prores')) {
    const master = out.replace(/\.mp4$/, '.mov');
    console.log('  transcoding ProRes 422 HQ master…');
    await new Promise((ok, no) => {
      const p = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', out,
        '-c:v', 'prores_ks', '-profile:v', '3', '-pix_fmt', 'yuv422p10le',
        '-c:a', 'pcm_s16le', master], { stdio: 'inherit' });
      p.on('close', (c) => (c === 0 ? ok() : no(new Error('ffmpeg exited ' + c))));
    });
    console.log(`✓ ${basename(master)}  ${(statSync(master).size / 1048576).toFixed(1)} MB`);
  }
} catch (err) {
  emit({ type: 'error', message: err.message });
  if (!JSON_OUT) console.error('\n✗', err.message);
  else process.stderr.write(err.stack + '\n');
  exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
process.exit(exitCode);
