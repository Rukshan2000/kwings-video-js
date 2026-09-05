/**
 * Studio export UI.
 *
 * When the page is served by `npm run studio`, this takes over the "Export MP4"
 * button and hands the render to the offline exporter running on the server —
 * exact frames, constant frame rate, real x264, original audio. Served any other
 * way (file://, a plain static host) it stays out of the way and the page keeps
 * its built-in tab-recording fallback.
 */
(function () {
  'use strict';
  var btn = document.getElementById('rec');
  if (!btn || !window.__film) return;

  fetch('/api/health').then(function (r) { return r.ok ? r.json() : null; })
    .then(function (h) { if (h && h.studio) install(); })
    .catch(function () { /* not the studio server — leave the page alone */ });

  function install() {
    var css = document.createElement('style');
    css.textContent = [
      '.xp-back{position:fixed;inset:0;background:rgba(16,18,22,.55);backdrop-filter:blur(6px);',
      'display:grid;place-items:center;z-index:9999;opacity:0;transition:opacity .18s ease}',
      '.xp-back.on{opacity:1}',
      '.xp{width:min(460px,92vw);background:#fff;color:#14161a;border-radius:16px;padding:22px 22px 18px;',
      'box-shadow:0 24px 70px rgba(0,0,0,.3);font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;',
      'transform:translateY(8px) scale(.98);transition:transform .18s ease}',
      '.xp-back.on .xp{transform:none}',
      '.xp h3{margin:0 0 2px;font-size:17px;letter-spacing:-.01em}',
      '.xp .sub{margin:0 0 16px;color:#6b7280;font-size:12.5px}',
      '.xp label{display:block;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;',
      'color:#6b7280;margin:0 0 6px}',
      '.xp .opts{display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px;margin-bottom:15px}',
      '.xp .opt{border:1px solid #e3e6ea;background:#fff;color:#14161a;border-radius:10px;padding:9px 8px;cursor:pointer;',
      'text-align:left;font:inherit;transition:border-color .12s,background .12s}',
      '.xp .opt:hover{border-color:#c7ccd3}',
      '.xp .opt.sel{border-color:#14161a;background:#14161a;color:#fff}',
      '.xp .opt b{display:block;font-size:13px;font-weight:600}',
      '.xp .opt span{font-size:10.5px;opacity:.65}',
      '.xp .row{display:flex;align-items:center;gap:8px;margin-bottom:15px;font-size:12.5px;color:#4b5563}',
      '.xp .row input{width:64px;padding:5px 7px;border:1px solid #e3e6ea;border-radius:7px;font:inherit;',
      'color:#14161a;background:#fff}',
      '.xp .row input[type=checkbox]{accent-color:#14161a}',
      '.xp .bar{height:7px;border-radius:99px;background:#eef0f3;overflow:hidden;margin:4px 0 9px}',
      '.xp .bar i{display:block;height:100%;width:0;border-radius:99px;background:#14161a;transition:width .2s ease}',
      '.xp .stat{display:flex;justify-content:space-between;font-size:12px;color:#6b7280;margin-bottom:14px}',
      '.xp .stat b{color:#14161a;font-weight:600}',
      '.xp .acts{display:flex;gap:8px;justify-content:flex-end}',
      '.xp button.go{background:#14161a;color:#fff;border:0;border-radius:9px;padding:9px 17px;font:inherit;',
      'font-weight:600;cursor:pointer}',
      '.xp button.go:disabled{opacity:.45;cursor:default}',
      '.xp button.gh{background:#fff;color:#4b5563;border:1px solid #e3e6ea;border-radius:9px;padding:9px 15px;',
      'font:inherit;cursor:pointer}',
      '.xp .err{color:#c0392b;font-size:12.5px;margin-bottom:12px;display:none}',
      '.xp .hide{display:none}',
    ].join('');
    document.head.appendChild(css);

    var QUALITY = {
      draft: { label: 'Draft', note: '30fps · fast', fps: 30, crf: 20, preset: 'veryfast', scale: 1 },
      final: { label: 'Final', note: '60fps · CRF 14', fps: 60, crf: 14, preset: 'slow', scale: 1 },
      ultra: { label: 'Ultra', note: '2× · CRF 10', fps: 60, crf: 10, preset: 'slow', scale: 2 },
    };
    var quality = 'final', ranged = false, es = null, running = false;

    var back = document.createElement('div');
    back.className = 'xp-back';
    back.innerHTML =
      '<div class="xp" role="dialog" aria-label="Export video">' +
        '<h3>Export video</h3>' +
        '<p class="sub">Rendered offline, frame by frame — every frame exact, no dropped frames.</p>' +
        '<div class="setup">' +
          '<label>Quality</label><div class="opts" id="xpq"></div>' +
          '<div class="row"><label style="margin:0"><input type="checkbox" id="xpr" style="width:auto"> Range</label>' +
            '<input id="xpa" type="number" min="0" step="0.5" value="0" disabled> to ' +
            '<input id="xpb" type="number" min="0" step="0.5" disabled> s</div>' +
        '</div>' +
        '<div class="prog hide">' +
          '<div class="bar"><i id="xpf"></i></div>' +
          '<div class="stat"><span id="xps">Starting…</span><span id="xpe"></span></div>' +
        '</div>' +
        '<p class="err" id="xperr"></p>' +
        '<div class="acts">' +
          '<button class="gh" id="xpc">Cancel</button>' +
          '<button class="go" id="xpgo">Render</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(back);

    var q = back.querySelector('#xpq'), setup = back.querySelector('.setup'),
        prog = back.querySelector('.prog'), fill = back.querySelector('#xpf'),
        stat = back.querySelector('#xps'), eta = back.querySelector('#xpe'),
        err = back.querySelector('#xperr'), go = back.querySelector('#xpgo'),
        cancel = back.querySelector('#xpc'), rng = back.querySelector('#xpr'),
        a = back.querySelector('#xpa'), b = back.querySelector('#xpb');

    b.value = window.__film.DUR.toFixed(1);
    b.max = a.max = window.__film.DUR;

    Object.keys(QUALITY).forEach(function (k) {
      var o = document.createElement('button');
      o.className = 'opt' + (k === quality ? ' sel' : '');
      o.innerHTML = '<b>' + QUALITY[k].label + '</b><span>' + QUALITY[k].note + '</span>';
      o.onclick = function () {
        quality = k;
        q.querySelectorAll('.opt').forEach(function (e, i) { e.classList.toggle('sel', Object.keys(QUALITY)[i] === k); });
      };
      q.appendChild(o);
    });
    rng.onchange = function () { ranged = rng.checked; a.disabled = b.disabled = !ranged; };

    function open() { back.classList.add('on'); }
    function close() {
      back.classList.remove('on');
      setTimeout(function () { if (!running) reset(); }, 200);
    }
    function reset() {
      setup.classList.remove('hide'); prog.classList.add('hide');
      err.style.display = 'none'; go.disabled = false; go.textContent = 'Render';
      cancel.textContent = 'Cancel'; fill.style.width = '0'; eta.textContent = '';
    }
    function fail(msg) {
      running = false; err.textContent = msg; err.style.display = 'block';
      go.disabled = false; go.textContent = 'Retry'; btn.textContent = 'Export MP4'; btn.classList.remove('on');
    }

    go.onclick = function () {
      if (running) return;
      var Q = QUALITY[quality];
      var body = {
        target: location.pathname.replace(/^\//, ''),
        fps: Q.fps, crf: Q.crf, preset: Q.preset, scale: Q.scale,
      };
      if (ranged) { body.from = Number(a.value) || 0; body.to = Number(b.value) || window.__film.DUR; }

      running = true; go.disabled = true; go.textContent = 'Rendering…';
      setup.classList.add('hide'); prog.classList.remove('hide');
      err.style.display = 'none'; stat.textContent = 'Starting Chrome…'; cancel.textContent = 'Stop';
      btn.classList.add('on'); btn.textContent = 'Rendering…';

      fetch('/api/export', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      }).then(function (r) {
        if (!r.ok) return r.json().then(function (j) { throw new Error(j.error || 'server refused'); });
        listen();
      }).catch(function (e) { fail(e.message); });
    };

    function listen() {
      if (es) es.close();
      es = new EventSource('/api/progress');
      es.onmessage = function (m) {
        var e = JSON.parse(m.data);
        if (e.type === 'start') {
          stat.textContent = e.w + '×' + e.h + ' · ' + e.fps + 'fps · ' + e.frames + ' frames';
        } else if (e.type === 'progress') {
          var pct = e.frame / e.frames;
          fill.style.width = (pct * 100) + '%';
          stat.textContent = 'Frame ' + e.frame + ' / ' + e.frames + '  ·  ' + e.rate + ' fps';
          eta.textContent = e.eta > 90 ? Math.round(e.eta / 60) + ' min left' : e.eta + 's left';
          btn.textContent = 'Rendering ' + Math.round(pct * 100) + '%';
        } else if (e.type === 'encoding') {
          fill.style.width = '100%'; stat.textContent = 'Encoding…'; eta.textContent = '';
        } else if (e.type === 'done') {
          running = false; es.close();
          fill.style.width = '100%';
          stat.textContent = e.name + '  ·  ' + (e.bytes / 1048576).toFixed(1) + ' MB';
          eta.textContent = 'done';
          go.disabled = false; go.textContent = 'Render again';
          cancel.textContent = 'Close';
          btn.textContent = 'Export MP4'; btn.classList.remove('on');
          var link = document.createElement('a');
          link.href = e.url; link.download = e.name;
          document.body.appendChild(link); link.click(); link.remove();
        } else if (e.type === 'error') {
          es.close(); fail(e.message || 'the render failed');
        }
      };
      es.onerror = function () { if (running) { es.close(); fail('lost contact with the studio server'); } };
    }

    cancel.onclick = function () {
      if (running) {
        fetch('/api/cancel', { method: 'POST' }).catch(function () {});
        running = false; if (es) es.close();
        btn.textContent = 'Export MP4'; btn.classList.remove('on');
        reset();
      }
      close();
    };
    back.onclick = function (e) { if (e.target === back) close(); };
    document.addEventListener('keydown', function (e) {
      if (e.code === 'Escape' && back.classList.contains('on')) { e.stopPropagation(); close(); }
    }, true);

    /* take the button over: drop the page's tab-recording listener */
    var fresh = btn.cloneNode(true);
    fresh.title = 'Renders the film offline, frame by frame, at full quality';
    btn.parentNode.replaceChild(fresh, btn);
    btn = fresh;
    btn.addEventListener('click', open);
  }
})();
