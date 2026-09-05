#!/usr/bin/env node
/**
 * Studio server — serves the reels and renders them on request.
 *
 * The browser cannot run ffmpeg, so the in-page "Export MP4" button posts to
 * this server, which runs the real offline exporter (tools/export.mjs) and
 * streams progress back over SSE. When it finishes, the page downloads the file.
 *
 *   npm run studio        →  http://127.0.0.1:5173/kwings/reel.html
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env.PORT || 5173);
const EXPORTS = join(ROOT, 'exports');
mkdirSync(EXPORTS, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.mov': 'video/quicktime',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.json': 'application/json',
  '.md': 'text/plain; charset=utf-8',
};

/** one render at a time — two headless Chromes fighting for the GPU helps nobody */
let job = null;   // { proc, target, clients:Set, log:[], state, result }

function broadcast(evt) {
  if (!job) return;
  job.log.push(evt);
  const line = `data: ${JSON.stringify(evt)}\n\n`;
  for (const res of job.clients) { try { res.write(line); } catch {} }
}

function startJob(opts) {
  const args = ['tools/export.mjs', opts.target, '--json',
    '--fps', String(opts.fps || 60),
    '--crf', String(opts.crf || 14),
    '--preset', opts.preset || 'slow'];
  if (opts.scale && Number(opts.scale) !== 1) args.push('--scale', String(opts.scale));
  if (opts.from != null) args.push('--from', String(opts.from));
  if (opts.to != null) args.push('--to', String(opts.to));
  if (opts.prores) args.push('--prores');

  const proc = spawn(process.execPath, args, { cwd: ROOT });
  job = { proc, target: opts.target, clients: new Set(), log: [], state: 'running', result: null };

  let buf = '';
  proc.stdout.on('data', (d) => {
    buf += d;
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const l of lines) {
      if (!l.trim()) continue;
      let evt; try { evt = JSON.parse(l); } catch { continue; }
      if (evt.type === 'done') {
        job.state = 'done';
        job.result = { name: evt.name, url: '/exports/' + encodeURIComponent(evt.name), bytes: evt.bytes };
        evt.url = job.result.url;
      }
      if (evt.type === 'error') job.state = 'error';
      broadcast(evt);
    }
  });
  let stderr = '';
  proc.stderr.on('data', (d) => { stderr += d; });
  proc.on('close', (code) => {
    if (job && job.state === 'running') {
      job.state = code === 0 ? 'done' : 'error';
      broadcast({ type: code === 0 ? 'done' : 'error', message: stderr.trim().split('\n').slice(-3).join(' ') || ('exporter exited ' + code) });
    }
    for (const res of job.clients) { try { res.end(); } catch {} }
    job.clients.clear();
    job.proc = null;
  });
  return job;
}

/* the reels are often opened from another dev server (VS Code Live Server, …),
   so the API and the finished files have to be reachable cross-origin */
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
};

function json(res, code, body) {
  res.writeHead(code, { 'content-type': 'application/json', ...CORS });
  res.end(JSON.stringify(body));
}

createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const path = decodeURIComponent(url.pathname);

  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }

  /* ---- API ---- */
  if (path === '/api/health') return json(res, 200, { studio: true, busy: !!(job && job.proc) });

  if (path === '/api/export' && req.method === 'POST') {
    if (job && job.proc) return json(res, 409, { error: 'a render is already running' });
    let body = '';
    req.on('data', (d) => (body += d));
    req.on('end', () => {
      let opts = {};
      try { opts = JSON.parse(body || '{}'); } catch {}
      const target = String(opts.target || '').replace(/^\/+/, '');
      if (!/^[\w./-]+\.html$/.test(target) || !existsSync(join(ROOT, target))) {
        return json(res, 400, { error: 'bad target' });
      }
      startJob({ ...opts, target });
      json(res, 202, { started: true });
    });
    return;
  }

  if (path === '/api/cancel' && req.method === 'POST') {
    if (job && job.proc) { job.state = 'cancelled'; job.proc.kill('SIGTERM'); }
    return json(res, 200, { cancelled: true });
  }

  if (path === '/api/progress') {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
      ...CORS,
    });
    if (!job) { res.write(`data: ${JSON.stringify({ type: 'idle' })}\n\n`); return res.end(); }
    for (const evt of job.log) res.write(`data: ${JSON.stringify(evt)}\n\n`);   // replay
    if (!job.proc) return res.end();
    job.clients.add(res);
    req.on('close', () => job && job.clients.delete(res));
    return;
  }

  /* ---- static ---- */
  const file = join(ROOT, path === '/' ? 'index.html' : path);
  if (!file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
    return;
  }
  const size = statSync(file).size;
  const type = MIME[extname(file).toLowerCase()] || 'application/octet-stream';
  const headers = { 'content-type': type, 'accept-ranges': 'bytes', 'cache-control': 'no-store', ...CORS };
  if (path.startsWith('/exports/')) headers['content-disposition'] = `attachment; filename="${basename(file)}"`;

  /* range requests, so <audio> and <video> can seek */
  const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Number(range[2]) : size - 1;
    res.writeHead(206, { ...headers, 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': end - start + 1 });
    createReadStream(file, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { ...headers, 'content-length': size });
  createReadStream(file).pipe(res);
}).listen(PORT, '127.0.0.1', () => {
  console.log(`\n  studio ready\n`);
  console.log(`  kwings   http://127.0.0.1:${PORT}/kwings/reel.html`);
  console.log(`  invogen  http://127.0.0.1:${PORT}/invogen/reel.html`);
  console.log(`\n  Hit "Export MP4" in the page — it renders offline, frame by frame.\n`);
});
