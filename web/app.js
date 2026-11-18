// Algorithms Labs showcase: lab panels, SVG charts and drawings, and the two runtimes.
// Python labs call window.pyRun (bridge.py, PyScript), which runs the lab scripts
// themselves (showcase.py). JavaScript labs fetch their own file from ../scripts/ and
// run it with a captured console.

const REPO = 'https://github.com/Andrew1407/Algorithms';
const SRC = `${REPO}/blob/main`;
const $ = (s, root = document) => root.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (v, d = 4) => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return String(v);
  const a = Math.abs(v);
  if (a !== 0 && (a >= 1e6 || a < 1e-3)) return v.toExponential(2);
  return String(+v.toFixed(d));
};
const range = (n, f = (i) => i) => Array.from({ length: n }, (_, i) => f(i));
const pause = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
const stat = (value, label, cls = '') => `<div class="stat ${cls}"><b>${value}</b><span>${label}</span></div>`;
const list = (a) => `[${a.join(', ')}]`;
const pyList = (a) => `[${a.map((v) => (typeof v === 'string' ? `'${v}'` : v)).join(', ')}]`;
const sortedNum = (a) => [...a].sort((x, y) => x - y);

// ---------------------------------------------------------------- runtimes --
let pyReady = false;
const pyWaiters = [];
window.addEventListener('py-ready', () => {
  pyReady = true;
  document.querySelectorAll('.py-status').forEach((el) => el.remove());
  pyWaiters.splice(0).forEach((f) => f());
});
const whenPy = () => (pyReady ? Promise.resolve() : new Promise((r) => pyWaiters.push(r)));

async function runPy(name, params) {
  await whenPy();
  await pause();
  const res = JSON.parse(window.pyRun(name, JSON.stringify(params)));
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

// A console.log stand-in that prints arrays and objects roughly the way Node does.
function inspect(v, top = true) {
  if (typeof v === 'string') return top ? v : `'${v}'`;
  if (Array.isArray(v)) {
    if (!v.length) return '[]';
    const parts = v.map((x) => inspect(x, false));
    return v.some(Array.isArray) ? `[\n${parts.map((p) => `  ${p}`).join(',\n')}\n]` : `[ ${parts.join(', ')} ]`;
  }
  if (v && typeof v === 'object') return `{ ${Object.entries(v).map(([k, x]) => `${k}: ${inspect(x, false)}`).join(', ')} }`;
  return String(v);
}

const sources = new Map();
const fetchText = (path) => {
  if (!sources.has(path)) sources.set(path, fetch(path).then((r) => { if (!r.ok) throw new Error(`Couldn't load ${path} (${r.status})`); return r.text(); }));
  return sources.get(path);
};

// Run a lab's own JS file. `patches` replace its sample-data lines with the form's values,
// `ret` names the script's top-level bindings to hand back to the page.
async function runJs(path, patches, ret) {
  const src = await fetchText(path);
  let code = src;
  for (const [re, line] of patches) {
    if (!re.test(code)) throw new Error(`Couldn't find ${re} in ${path}`);
    code = code.replace(re, line);
  }
  const out = [];
  const log = (...args) => out.push(args.map((a) => inspect(a)).join(' '));
  const console = { log, info: log, warn: log, error: log };
  await pause();
  const value = new Function('console', `${code}\n;return (${ret});`)(console);
  // drop the vertical tabs the lab prints as spacers
  return { value, output: out.join('\n').replace(/\v/g, '') };
}

// ------------------------------------------------------------------ charts --
const charts = new Map();
let chartSeq = 0;

function niceStep(span, count) {
  const raw = span / Math.max(1, count);
  const p = 10 ** Math.floor(Math.log10(raw || 1));
  const m = raw / p;
  return (m >= 5 ? 10 : m >= 2 ? 5 : m >= 1 ? 2 : 1) * p;
}
function ticks(min, max, count) {
  if (min === max) { min -= 1; max += 1; }
  const step = niceStep(max - min, count);
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const out = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(+v.toPrecision(12));
  return { lo, hi, ticks: out };
}

/** spec: { title, x, y, series: [{ name, xs, ys, color, labels? }], height, dots, scatter, vline, kind: 'bar' with cats } */
function chart(spec) {
  const id = `c${++chartSeq}`;
  charts.set(id, spec);
  const keys = spec.series.length > 1 || spec.vline
    ? `<span class="keys">${spec.series.map((s) => `<span><i style="background:var(${s.color})${spec.scatter ? ';width:8px;height:8px;border-radius:50%;vertical-align:0' : ''}"></i>${esc(s.name)}</span>`).join('')}${spec.vline ? `<span><i style="background:var(--muted)"></i>${esc(spec.vline.label)}</span>` : ''}</span>` : '';
  return `<figure class="chart" data-chart="${id}" data-copyable data-title="${esc(spec.title)}"><figcaption><span>${esc(spec.title)}</span>${keys}${actions('png', 'csv')}</figcaption><div class="plot"></div></figure>`;
}

function drawCharts(root = document) {
  root.querySelectorAll('figure.chart').forEach((fig) => {
    const spec = charts.get(fig.dataset.chart);
    const plot = $('.plot', fig);
    if (!spec || !plot.offsetParent) return;
    (spec.kind === 'bar' ? drawBarChart : drawChart)(plot, spec);
  });
}
let resizeTimer;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => drawCharts(), 120); });

function placeTip(tip, rect, left, W, top) {
  tip.hidden = false;
  const tw = tip.offsetWidth;
  tip.style.left = `${left + 12 + tw > rect.width ? Math.max(0, left - tw - 12) : left + 12}px`;
  tip.style.top = `${top}px`;
}

function drawChart(plot, spec) {
  const W = Math.max(260, plot.clientWidth), H = spec.height || 230;
  const M = { l: 58, r: 14, t: 8, b: 38 };
  const all = spec.series.flatMap((s) => s.xs.map((x, i) => [x, s.ys[i]])).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (spec.vline) all.push([spec.vline.x, all.length ? all[0][1] : 0]);
  if (!all.length) { plot.innerHTML = '<p class="hint">No data.</p>'; return; }
  const xr = ticks(Math.min(...all.map((p) => p[0])), Math.max(...all.map((p) => p[0])), Math.max(3, Math.floor((W - M.l) / 90)));
  const yr = ticks(Math.min(...all.map((p) => p[1]), spec.y0 ?? Infinity), Math.max(...all.map((p) => p[1])), 5);
  const x0 = spec.tightX === false ? xr.lo : Math.min(...all.map((p) => p[0])), x1 = spec.tightX === false ? xr.hi : Math.max(...all.map((p) => p[0]));
  const X = (v) => M.l + ((v - x0) / (x1 - x0 || 1)) * (W - M.l - M.r);
  const Y = (v) => H - M.b - ((v - yr.lo) / (yr.hi - yr.lo || 1)) * (H - M.t - M.b);
  const xt = xr.ticks.filter((v) => v >= x0 - 1e-9 && v <= x1 + 1e-9 && (!spec.intX || Number.isInteger(v)));
  const grid = yr.ticks.map((v) => `<line x1="${M.l}" x2="${W - M.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--grid)"/><text x="${M.l - 8}" y="${Y(v)}" text-anchor="end" dominant-baseline="middle">${fmt(v, 6)}</text>`).join('')
    + xt.map((v) => `<line x1="${X(v)}" x2="${X(v)}" y1="${H - M.b}" y2="${H - M.b + 4}" stroke="var(--muted)"/><text x="${X(v)}" y="${H - M.b + 16}" text-anchor="middle">${fmt(v, 6)}</text>`).join('');
  const axes = `<line x1="${M.l}" x2="${W - M.r}" y1="${H - M.b}" y2="${H - M.b}" stroke="var(--line)"/>`
    + (yr.lo < 0 && yr.hi > 0 ? `<line x1="${M.l}" x2="${W - M.r}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--muted)" stroke-opacity=".45"/>` : '')
    + (spec.vline ? `<line x1="${X(spec.vline.x)}" x2="${X(spec.vline.x)}" y1="${M.t}" y2="${H - M.b}" stroke="var(--muted)" stroke-dasharray="5 4"/>` : '')
    + `<text x="${(M.l + W - M.r) / 2}" y="${H - 4}" text-anchor="middle">${esc(spec.x)}</text>`
    + `<text transform="translate(12 ${(M.t + H - M.b) / 2}) rotate(-90)" text-anchor="middle">${esc(spec.y)}</text>`;
  const lines = spec.series.map((s) => {
    const dots = spec.scatter || spec.dots || s.xs.length <= 30 ? s.xs.map((x, i) => `<circle cx="${X(x)}" cy="${Y(s.ys[i])}" r="${s.r || (spec.scatter ? 3.4 : 2.6)}" fill="var(${s.color})" ${spec.scatter ? 'fill-opacity=".8"' : ''}/>`).join('') : '';
    if (spec.scatter) return dots;
    const pts = s.xs.map((x, i) => `${X(x).toFixed(1)},${Y(s.ys[i]).toFixed(1)}`).join(' ');
    return `<polyline points="${pts}" fill="none" stroke="var(${s.color})" stroke-width="${s.width || 1.8}" stroke-linejoin="round" ${s.dash ? 'stroke-dasharray="5 4"' : ''}/>${dots}`;
  }).join('');
  plot.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="${esc(spec.title)}">${grid}${axes}${lines}<line class="cross" y1="${M.t}" y2="${H - M.b}" stroke="var(--muted)" stroke-dasharray="3 3" visibility="hidden"/><g class="marks"></g></svg><div class="tip" hidden></div>`;

  const svg = $('svg', plot), tip = $('.tip', plot), cross = $('.cross', svg), marks = $('.marks', svg);
  const hide = () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); marks.innerHTML = ''; };
  const at = (e) => { const rect = svg.getBoundingClientRect(); return { rect, px: ((e.clientX - rect.left) / rect.width) * W, py: ((e.clientY - rect.top) / rect.height) * H }; };
  let move;
  if (spec.scatter) {
    // hover: the nearest point in 2D
    move = (e) => {
      const { rect, px, py } = at(e);
      let best = null;
      spec.series.forEach((s) => s.xs.forEach((x, i) => {
        const d = (X(x) - px) ** 2 + (Y(s.ys[i]) - py) ** 2;
        if (!best || d < best.d) best = { d, s, i };
      }));
      if (!best || best.d > 900) return hide();
      const { s, i } = best;
      marks.innerHTML = `<circle cx="${X(s.xs[i])}" cy="${Y(s.ys[i])}" r="6" fill="none" stroke="var(${s.color})" stroke-width="2"/>`;
      tip.innerHTML = `${s.labels ? `<div>${esc(s.labels[i])}</div>` : ''}<div class="tx"><i style="background:var(${s.color})"></i>${esc(s.name)}</div><div>${esc(spec.x)}: ${fmt(s.xs[i])} · ${esc(spec.y)}: ${fmt(s.ys[i])}</div>`;
      placeTip(tip, rect, (X(s.xs[i]) / W) * rect.width, W, M.t);
    };
  } else {
    const nearest = (xs, v) => {
      let lo = 0, hi = xs.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] < v) lo = m; else hi = m; }
      return Math.abs(xs[lo] - v) <= Math.abs(xs[hi] - v) ? lo : hi;
    };
    move = (e) => {
      const { rect, px } = at(e);
      if (px < M.l - 6 || px > W - M.r + 6) return hide();
      const v = x0 + ((px - M.l) / (W - M.l - M.r)) * (x1 - x0);
      const hits = spec.series.map((s) => { const i = nearest(s.xs, v); return { s, i, x: s.xs[i], y: s.ys[i] }; });
      const hx = X(hits[0].x);
      cross.setAttribute('x1', hx); cross.setAttribute('x2', hx); cross.setAttribute('visibility', 'visible');
      marks.innerHTML = hits.map((h) => `<circle cx="${X(h.x)}" cy="${Y(h.y)}" r="4" fill="var(--panel)" stroke="var(${h.s.color})" stroke-width="2"/>`).join('');
      tip.innerHTML = `<div class="tx">${esc(spec.x)} = ${fmt(hits[0].x, 6)}</div>` + hits.map((h) => `<div><i style="background:var(${h.s.color})"></i>${esc(h.s.name || spec.y)}: ${h.s.labels ? esc(h.s.labels[h.i]) : fmt(h.y, 6)}</div>`).join('');
      placeTip(tip, rect, (hx / W) * rect.width, W, M.t);
    };
  }
  svg.addEventListener('pointermove', move);
  svg.addEventListener('pointerdown', move);
  svg.addEventListener('pointerleave', hide);
}

// Grouped bars: spec.cats are the groups, each series contributes one bar per group.
function drawBarChart(plot, spec) {
  const W = Math.max(260, plot.clientWidth), H = spec.height || 230;
  const M = { l: 58, r: 14, t: 8, b: 38 };
  const all = spec.series.flatMap((s) => s.ys);
  const yr = ticks(Math.min(0, ...all), Math.max(...all), 5);
  const nc = spec.cats.length, ns = spec.series.length;
  const gw = (W - M.l - M.r) / nc, bw = Math.min(34, (gw * 0.78) / ns);
  const Y = (v) => H - M.b - ((v - yr.lo) / (yr.hi - yr.lo || 1)) * (H - M.t - M.b);
  const grid = yr.ticks.map((v) => `<line x1="${M.l}" x2="${W - M.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--grid)"/><text x="${M.l - 8}" y="${Y(v)}" text-anchor="end" dominant-baseline="middle">${fmt(v, 6)}</text>`).join('');
  const every = Math.ceil(nc / Math.max(1, Math.floor((W - M.l) / 54)));
  const cats = spec.cats.map((c, i) => (i % every ? '' : `<text x="${M.l + gw * (i + 0.5)}" y="${H - M.b + 16}" text-anchor="middle">${esc(c)}</text>`)).join('');
  const bars = spec.series.map((s, si) => s.ys.map((v, ci) => {
    const x = M.l + gw * (ci + 0.5) - (ns * bw) / 2 + si * bw;
    const y = Math.min(Y(v), Y(0)), h = Math.max(1, Math.abs(Y(v) - Y(0)));
    return `<rect x="${x + 1}" y="${y}" width="${bw - 2}" height="${h}" rx="2" fill="var(${s.color})"/>`;
  }).join('')).join('');
  const axes = `<line x1="${M.l}" x2="${W - M.r}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--line)"/>`
    + `<text x="${(M.l + W - M.r) / 2}" y="${H - 4}" text-anchor="middle">${esc(spec.x)}</text>`
    + `<text transform="translate(12 ${(M.t + H - M.b) / 2}) rotate(-90)" text-anchor="middle">${esc(spec.y)}</text>`;
  plot.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="${esc(spec.title)}">${grid}${bars}${axes}${cats}<rect class="band" y="${M.t}" height="${H - M.t - M.b}" fill="var(--muted)" fill-opacity=".08" visibility="hidden"/></svg><div class="tip" hidden></div>`;
  const svg = $('svg', plot), tip = $('.tip', plot), band = $('.band', svg);
  const hide = () => { tip.hidden = true; band.setAttribute('visibility', 'hidden'); };
  const move = (e) => {
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const ci = Math.floor((px - M.l) / gw);
    if (ci < 0 || ci >= nc) return hide();
    band.setAttribute('x', M.l + gw * ci); band.setAttribute('width', gw); band.setAttribute('visibility', 'visible');
    tip.innerHTML = `<div class="tx">${esc(spec.cats[ci])}</div>` + spec.series.map((s) => `<div><i style="background:var(${s.color})"></i>${esc(s.name)}: ${fmt(s.ys[ci])}</div>`).join('');
    placeTip(tip, rect, ((M.l + gw * (ci + 1)) / W) * rect.width - 12, W, M.t);
  };
  svg.addEventListener('pointermove', move);
  svg.addEventListener('pointerdown', move);
  svg.addEventListener('pointerleave', hide);
}

// ---------------------------------------------------------------- players --
// A step-by-step replay: frames are drawn one at a time, with a slider and play button.
const players = new Map();
let playerSeq = 0;
function player(title, frames, draw, caption, legend = '') {
  const id = `p${++playerSeq}`;
  players.set(id, { frames, draw, caption, k: 0, timer: null });
  return `<div class="player box" data-copyable data-title="${esc(title)}" data-player="${id}">
    <div class="copy-head"><span class="sub-h">${esc(title)}</span>${actions('png')}</div>
    <div class="cap"></div><div class="plot drawing"></div>
    <div class="ctrl"><button type="button" class="mini" data-step="first" title="First step">|&lt;</button><button type="button" class="mini" data-step="prev" title="Previous step">&lt;</button><button type="button" class="mini" data-step="play">Play</button><button type="button" class="mini" data-step="next" title="Next step">&gt;</button><button type="button" class="mini" data-step="last" title="Last step">&gt;|</button>
    <input type="range" min="0" max="${frames.length - 1}" value="0" aria-label="Step"><span class="muted pos" style="font-size:12px;font-variant-numeric:tabular-nums"></span></div>
    ${legend ? `<div class="legend">${legend}</div>` : ''}</div>`;
}
function bindPlayers(root) {
  root.querySelectorAll('[data-player]').forEach((el) => {
    const p = players.get(el.dataset.player);
    if (!p || p.bound) return;
    p.bound = true;
    const slider = $('input[type=range]', el), playBtn = $('[data-step=play]', el);
    const plot = $('.plot', el);
    const show = (k) => {
      p.k = Math.max(0, Math.min(p.frames.length - 1, k));
      slider.value = p.k;
      plot.innerHTML = p.draw(p.frames[p.k], Math.max(280, plot.clientWidth));
      $('.cap', el).innerHTML = p.caption(p.frames[p.k], p.k);
      $('.pos', el).textContent = `${p.k + 1} / ${p.frames.length}`;
    };
    const stop = () => { clearInterval(p.timer); p.timer = null; playBtn.textContent = 'Play'; };
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-step]');
      if (!b) return;
      const s = b.dataset.step;
      if (s === 'play') {
        if (p.timer) return stop();
        if (p.k >= p.frames.length - 1) show(0);
        playBtn.textContent = 'Pause';
        const delay = Math.max(40, Math.min(450, 9000 / p.frames.length));
        p.timer = setInterval(() => { if (!el.isConnected || p.k >= p.frames.length - 1) stop(); else show(p.k + 1); }, delay);
        return;
      }
      stop();
      show({ first: 0, prev: p.k - 1, next: p.k + 1, last: p.frames.length - 1 }[s]);
    });
    slider.addEventListener('input', () => { stop(); show(+slider.value); });
    p.redraw = () => { if (el.isConnected && plot.clientWidth) show(p.k); };
    show(0);
  });
}
window.addEventListener('resize', () => { clearTimeout(players.timer); players.timer = setTimeout(() => players.forEach((p) => p.redraw?.()), 120); });

// Bars for one array state. marks: index -> colour token; base(i, v) picks the default colour.
function barsSvg(values, marks = {}, base = () => '--c1', opts = {}) {
  const n = values.length, W = opts.width || 640, H = opts.height || Math.round(Math.min(240, Math.max(170, W * 0.3))), pad = 6, top = 18, bottom = n <= 32 ? 22 : 6;
  const max = Math.max(0, ...values), min = Math.min(0, ...values);
  const bw = (W - pad * 2) / Math.max(1, n);
  const Y = (v) => top + ((max - v) / (max - min || 1)) * (H - top - bottom);
  const bars = values.map((v, i) => {
    const x = pad + i * bw, y = Math.min(Y(v), Y(0)), h = Math.max(1.5, Math.abs(Y(v) - Y(0)));
    const c = marks[i] || base(i, v), hot = marks[i] !== undefined;
    return `<rect x="${x + bw * 0.1}" y="${y}" width="${bw * 0.8}" height="${h}" rx="${Math.min(4, bw * 0.12)}" fill="var(${c})" fill-opacity="${hot ? 1 : 0.55}"/>`
      + (n <= 32 ? `<text x="${x + bw / 2}" y="${v >= 0 ? y - 4 : y + h + 12}" text-anchor="middle" class="sub" style="${hot ? 'fill:var(--ink);font-weight:700' : ''}">${v}</text>` : '')
      + (n <= 32 ? `<text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle" class="sub">${i}</text>` : '');
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label || 'Array as bars')}"><line x1="${pad}" x2="${W - pad}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--line)"/>${bars}</svg>`;
}
const key = (c, text) => `<span><span class="sw" style="background:var(${c})"></span>${text}</span>`;

// ------------------------------------------------------------- lab panels --
const listField = (key, label, value) => ({ key, label, value, type: 'list', wide: 'wide2' });
const parseList = (s) => String(s).split(/[\s,;]+/).filter(Boolean).map(Number);
const consoleBox = (text, title = 'Lab output') => `<div class="box" data-copyable data-title="${esc(title)}"><div class="copy-head"><h2>${esc(title)}</h2></div><pre class="console">${esc(text.replace(/\s+$/, ''))}</pre></div>`;
const LAB_ARRAY = '30, 19, 9, 15, 55, 24, 3, 78, 46, 41';

const LABS = [
  {
    id: 'lab1', tab: '1', name: 'Insertion sort (odd/even)', lang: 'py', extra: 'hs', src: `${SRC}/scripts/1-lab.py`,
    intro: 'An insertion sort that splits by parity: each new even number is inserted among the evens at the front in ascending order, each odd one among the odds behind them in descending order. The script prints the array after every iteration; a Haskell port of the same sort sits next to it.',
    fields: [listField('array', 'Array A', LAB_ARRAY)],
    examples: [LAB_ARRAY, '8, 3, 6, 1, 4, 7, 2, 5', '12, 4, 18, 2, 7, 9, 1', '21, 95, 13, 43'],
    check: (p) => { const a = parseList(p.array); return a.length < 2 || a.length > 40 || a.some((v) => !Number.isInteger(v)) ? 'A needs 2 to 40 integers.' : null; },
    run: async (p) => ({ py: await runPy('lab1', { array: parseList(p.array) }), hs: await fetchText('../scripts/haskell/1-lab.hs') }),
    render: (d, p) => lab1View(d.py, d.hs, parseList(p.array)),
  },
  {
    id: 'lab2', tab: '2', name: 'Inversions', lang: 'py', src: `${SRC}/scripts/2-lab.py`,
    intro: 'Each user ranks the movies with a random permutation. The script reads the numbers of users and movies and a user to compare with from stdin, maps every other user\'s ranking onto that user\'s order, and counts inversions with a merge sort. Fewer inversions means more similar taste. Here the form feeds stdin and the seed fixes the random rankings.',
    fields: [
      { key: 'users', label: 'Users (stdin)', value: 5, min: 2, max: 12 },
      { key: 'movies', label: 'Movies (stdin)', value: 6, min: 2, max: 12 },
      { key: 'user', label: 'Compare with user', value: 1, min: 1, max: 12 },
      { key: 'seed', label: 'Random seed', value: 7, min: 0, max: 99999 },
    ],
    check: (p) => (p.user > p.users ? 'The user to compare with must be one of the users.' : null),
    run: (p) => runPy('lab2', p),
    render: (d, p) => lab2View(d, p),
  },
  {
    id: 'lab3', tab: '3', name: 'Quick sort pivots', lang: 'py', src: `${SRC}/scripts/3-lab.py`,
    intro: 'Three quick sorts over the same array: by the middle, the last and the first element. Each counts its swaps in <code>swap_counter</code>, which the script prints as "comparisons". The page passes the sorts a list that records every comparison and write, so each step replays as bars, and the actual comparisons are counted alongside.',
    fields: [listField('array', 'Array A', LAB_ARRAY), { key: 'sweep_max', label: 'Sweep: max size', value: 60, min: 5, max: 100 }, { key: 'seed', label: 'Sweep seed', value: 1, min: 0, max: 99999 }],
    examples: [LAB_ARRAY, '5, 4, 3, 2, 1, 0', '1, 2, 3, 4, 5, 6, 7, 8', '31, 5, 16, 72, 99, 68, 65, 1, 84, 29'],
    hint: 'The sweep sorts random arrays of 5, 10, … up to the max size with each strategy and plots the counters. The last and first pivots give equal counts, so the first-pivot line is dashed.',
    check: (p) => { const a = parseList(p.array); return a.length < 2 || a.length > 40 || a.some((v) => !Number.isInteger(v)) ? 'A needs 2 to 40 integers.' : null; },
    run: (p) => runPy('lab3', { array: parseList(p.array), sweep_max: p.sweep_max, seed: p.seed }),
    render: (d) => lab3View(d),
  },
  {
    id: 'lab4', tab: '4', name: 'Pyramid and medians', lang: 'py', src: `${SRC}/scripts/4-lab.py`,
    intro: 'Grows the array one element at a time and prints each prefix as a row of a pyramid. For every prefix it records the median: the middle element for an odd length, the two middle elements for an even one. The prefix is not sorted first, so these are positional middles, which the chart sets against the sorted-prefix median.',
    fields: [listField('array', 'Array A', LAB_ARRAY)],
    examples: [LAB_ARRAY, '1, 2, 3, 4, 5, 6, 7, 8, 9', '5, 15, 1, 3, 8, 7, 9, 10, 6, 11, 4'],
    check: (p) => { const a = parseList(p.array); return a.length < 1 || a.length > 30 || a.some((v) => !Number.isInteger(v)) ? 'A needs 1 to 30 integers.' : null; },
    run: (p) => runPy('lab4', { array: parseList(p.array) }),
    render: (d) => lab4View(d),
  },
  {
    id: 'lab5', tab: '5', name: 'Hash tables', lang: 'js', src: `${SRC}/scripts/5-lab.js`,
    intro: 'Finds pairs of elements that add up to S with two tables. Table 1 is a matrix of every pair\'s sum, scanned from the four corners inward; table 2 is a "bit vector" of <code>i|u|sum</code> strings for i &lt; u. The page fetches the lab\'s own file and runs it with its <code>const S</code> and <code>const A</code> lines set from the form.',
    fields: [{ key: 'S', label: 'Sum S', value: 2, min: -1000, max: 1000 }, listField('A', 'Array A', '2, 1, 3, 4, 2, 0, -3, 5')],
    check: (p) => { const a = parseList(p.A); return a.length < 2 || a.length > 14 || a.some((v) => !Number.isInteger(v)) ? 'A needs 2 to 14 integers.' : null; },
    run: (p) => runJs('../scripts/5-lab.js', [[/const S = [^;]*;/, `const S = ${p.S};`], [/const A = \[[^\]]*\];/, `const A = [${parseList(p.A).join(', ')}];`]], '{ S, A, h1, h2 }'),
    render: (d) => lab5View(d),
  },
  {
    id: 'lab6', tab: '6', name: 'Binary search tree', lang: 'js', src: `${SRC}/scripts/6-lab.js`,
    intro: 'Builds a binary search tree (smaller or equal values go left), records the root-to-node path of every vertex, and prints every downward run of two or more vertices on those paths whose values add up to S. The page runs the lab\'s file with its <code>S</code>, root and vertex list from the form; the lab then adds 1 and 10 itself.',
    fields: [{ key: 'S', label: 'Sum S', value: 19, min: -1000, max: 1000 }, { key: 'root', label: 'Root vertex', value: 8, min: -1000, max: 1000 }, listField('vertices', 'Vertices', '9, 6, 5, 7, 8, 3, 2, 5, 3')],
    examples: ['8', '17', '19', '27'],
    examplesKey: 'S',
    check: (p) => { const a = parseList(p.vertices); return a.length > 30 || a.some((v) => !Number.isInteger(v)) ? 'Vertices needs up to 30 integers.' : null; },
    run: (p) => runJs('../scripts/6-lab.js', [[/let S = [^;]*;/, `let S = ${p.S};`], [/const main_vertex = [^;]*;/, `const main_vertex = ${p.root};`], [/const vertices_list = \[[^\]]*\];/, `const vertices_list = [${parseList(p.vertices).join(', ')}];`]], '{ tree, S }'),
    render: (d) => lab6View(d),
  },
  {
    id: 'lab7', tab: '7', name: 'Travelling salesman', lang: 'py', src: `${SRC}/scripts/7-lab.py`,
    intro: 'Two complete graphs with random edge weights 5–30. <code>short_way</code> builds candidate routes through every vertex: the identity order and its reverse, plus each of them with one pair of vertices swapped, and keeps the lightest. It\'s a quick heuristic, not an exhaustive search, so the page also finds the true shortest route for comparison.',
    fields: [{ key: 'seed', label: 'Random seed', value: 3, min: 0, max: 99999 }, { key: 'n1', label: 'Graph 1 vertices', value: 5, min: 3, max: 9 }, { key: 'n2', label: 'Graph 2 vertices', value: 7, min: 3, max: 9 }],
    hint: 'The exhaustive check runs for up to 8 vertices.',
    run: (p) => runPy('lab7', p),
    render: (d) => lab7View(d),
  },
  {
    id: 'lab8', tab: '8', name: 'Knapsack', lang: 'py', src: `${SRC}/scripts/8-lab.py`,
    intro: 'Picks the set of goods with the highest total price that fits the backpack. The lab doesn\'t use a DP table: it lists every set of goods, sums each set\'s weight and price, and keeps the best one within capacity (on a tie, the later set).',
    fields: [{ key: 'capacity', label: 'MAX_WEIGHT', value: 26, min: 1, max: 1000 }, { key: 'items', label: 'Goods (title:weight:price)', value: 'a:4:10, b:6:4, c:8:10, d:7:7, e:10:6, f:3:1, g:5:9, h:2:5', type: 'list', wide: 'wide2' }],
    hint: 'Up to 10 goods: the lab\'s set listing grows quickly (10 goods take about a second here).',
    check: (p) => {
      const items = parseItems(p.items);
      if (!items) return 'Write goods as title:weight:price, separated by commas.';
      if (items.length < 2 || items.length > 10) return 'Use 2 to 10 goods.';
      if (new Set(items.map((i) => i[0])).size !== items.length) return 'Give each good a different title.';
      return null;
    },
    run: (p) => runPy('lab8', { capacity: p.capacity, items: parseItems(p.items) }),
    render: (d, p) => lab8View(d, p),
  },
];

function parseItems(s) {
  const items = String(s).split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean).map((x) => x.split(/\s*:\s*/));
  if (items.some((x) => x.length !== 3 || !x[0] || !/^-?\d+$/.test(x[1]) || !/^-?\d+$/.test(x[2]))) return null;
  return items.map(([t, w, p]) => [t, +w, +p]);
}

// ------------------------------------------------------------ custom views --
function lab1View(d, hs, input) {
  const frames = [{ array: input, iteration: 0, value: null }, ...d.steps];
  const base = (i, v) => (v % 2 ? '--c2' : '--c1');
  const draw = (f, width) => {
    const at = f.value === null ? -1 : f.array.indexOf(f.value);
    return barsSvg(f.array, at >= 0 ? { [at]: '--c7' } : {}, base, { label: 'Array after the iteration', width });
  };
  const cap = (f) => (f.value === null ? `<span class="muted">Input array</span> ${list(f.array)}` : `<span class="muted">Iteration ${f.iteration}: placed</span> ${f.value} <span class="muted">→</span> ${list(f.array)}`);
  const legend = key('--c1', 'even') + key('--c2', 'odd') + key('--c7', 'value placed in this iteration');
  return `<div class="stats">${stat(d.steps.length, 'iterations printed')}${stat(list(d.result), 'sorted array')}</div>
    ${player('Insertion sort, step by step', frames, draw, cap, legend)}
    <div class="two-col" style="margin-top:16px">${consoleBox(d.output)}
      <div class="box" data-copyable data-title="Haskell port"><div class="copy-head"><h2><span class="lang hs" style="vertical-align:1px">Haskell</span> Port <small>· <a href="${SRC}/scripts/haskell/1-lab.hs" target="_blank" rel="noopener">scripts/haskell/1-lab.hs</a></small></h2></div>
        <p class="note">Shown as source only: there's no lightweight way to run GHC-compiled Haskell in the browser. It sorts the same way, popping each element and inserting it among the evens (ascending) or the odds (descending), and for the lab's array its <code>main</code> prints the same result: <code>[24,30,46,78,55,41,19,15,9,3]</code>.</p>
        <pre class="code">${esc(hs.replace(/\s+$/, ''))}</pre></div></div>`;
}

function lab2View(d, p) {
  const users = Object.keys(d.ratings).map(Number);
  const others = users.filter((u) => u !== p.user);
  const best = d.ranking[0];
  const cols = range(p.movies, (i) => `<th class="num">m${i + 1}</th>`).join('');
  const rows = users.map((u) => `<tr class="${u === p.user ? 'sel' : ''}"><td>User ${u}${u === p.user ? ' <span class="muted">(compared with)</span>' : ''}</td>${d.ratings[u].map((v) => `<td class="num">${v}</td>`).join('')}</tr>`).join('');
  const order = d.ranking.map((r) => r.user);
  const diagram = (u, hi = null) => {
    const P = d.priorities[u], m = P.length, W = Math.max(320, m * 56), H = 170, step = (W - 60) / Math.max(1, m - 1);
    const X = (i) => 30 + i * step, top = 40, bot = 130;
    const inv = new Set(d.pairs[u].flat());
    const lines = P.map((r, i) => {
      const hot = hi && hi.includes(i);
      return `<line x1="${X(i)}" y1="${top}" x2="${X(r - 1)}" y2="${bot}" stroke="var(${hot ? '--c5' : inv.has(i) ? '--c2' : '--c3'})" stroke-width="${hot ? 3.5 : 2}" stroke-linecap="round" ${hi && !hot ? 'stroke-opacity=".35"' : ''}/>`;
    }).join('');
    const nodes = range(m, (i) => `<circle cx="${X(i)}" cy="${top}" r="12" fill="var(--py-soft)" stroke="var(--py)" stroke-width="1.6"/><text x="${X(i)}" y="${top}" text-anchor="middle" dominant-baseline="central">${i + 1}</text>`
      + `<circle cx="${X(i)}" cy="${bot}" r="12" fill="var(--js-soft)" stroke="var(--js)" stroke-width="1.6"/><text x="${X(i)}" y="${bot}" text-anchor="middle" dominant-baseline="central">${i + 1}</text>`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" style="max-width:${W}px" role="img" aria-label="Rank pairs"><text x="4" y="14" class="sub">user ${p.user}'s rank</text><text x="4" y="${H - 6}" class="sub">user ${u}'s rank of the same movie</text>${lines}${nodes}</svg>`;
  };
  const tabs = others.map((u, i) => `<button class="tab" data-u="${u}" aria-selected="${i === 0}">User ${u}</button>`).join('');
  lab2View.state = { d, p, diagram };
  return `<div class="stats">${stat(best ? `User ${best.user}` : '—', `closest to user ${p.user}`)}${stat(best ? best.inversions : '—', 'its inversions')}${stat(others.length, 'users compared')}</div>
    <div class="two-col"><div class="box" data-copyable><div class="copy-head"><h2>Rankings <small>· D[user][i] is the rank given to movie i + 1</small></h2>${actions('table')}</div><div class="table-wrap"><table><thead><tr><th>User</th>${cols}</tr></thead><tbody>${rows}</tbody></table></div></div>
      ${chart({ kind: 'bar', title: `Inversions against user ${p.user}`, x: 'user, in the lab\'s order', y: 'inversions', cats: order.map((u) => `User ${u}`), series: [{ name: 'inversions', ys: d.ranking.map((r) => r.inversions), color: '--c1' }] })}</div>
    <div class="box" data-copyable data-title="Inversion pairs" id="pairs-box" style="margin-top:16px"><div class="copy-head"><h2>Pairs view <small>· each line joins user ${p.user}'s rank of a movie to the other user's rank of it; every crossing is one inversion</small></h2>${actions('png')}</div>
      <div class="tabs" id="pairs-tabs">${tabs}</div><div class="plot drawing" id="pairs-plot" style="overflow-x:auto"></div>
      <div class="legend">${key('--c3', 'movie in no inversion')}${key('--c2', 'movie in an inversion')}${key('--c5', 'selected pair')}</div>
      <p class="sub-h" style="margin-top:12px" id="pairs-count"></p><div class="chips" id="pairs-chips"></div></div>
    <div style="margin-top:16px">${consoleBox(d.output)}</div>`;
}
function bindLab2(out) {
  const { d, p, diagram } = lab2View.state;
  const plot = $('#pairs-plot', out), chips = $('#pairs-chips', out), count = $('#pairs-count', out);
  const tabs = out.querySelectorAll('#pairs-tabs .tab');
  const show = (u) => {
    tabs.forEach((t) => t.setAttribute('aria-selected', t.dataset.u === String(u)));
    plot.innerHTML = diagram(u);
    const P = d.priorities[u];
    count.textContent = `${d.pairs[u].length} inverted pairs for user ${u} (by user ${p.user}'s ranks)`;
    chips.innerHTML = d.pairs[u].map(([i, j]) => `<button type="button" class="chip" data-i="${i}" data-j="${j}" title="user ${p.user} ranks them ${i + 1} < ${j + 1}, user ${u} ranks them ${P[i]} > ${P[j]}">${i + 1}·${j + 1}</button>`).join('') || '<span class="muted">None: the same order.</span>';
    chips.querySelectorAll('.chip').forEach((c) => c.onclick = () => {
      const on = c.getAttribute('aria-pressed') !== 'true';
      chips.querySelectorAll('.chip').forEach((x) => x.setAttribute('aria-pressed', 'false'));
      c.setAttribute('aria-pressed', on);
      plot.innerHTML = diagram(u, on ? [+c.dataset.i, +c.dataset.j] : null);
    });
  };
  tabs.forEach((t) => t.onclick = () => show(+t.dataset.u));
  if (tabs.length) show(+tabs[0].dataset.u);
}

const PIVOTS = [['middle', 'Middle pivot', '--c1'], ['last', 'Last pivot', '--c3'], ['first', 'First pivot', '--c2']];
function lab3View(d) {
  const input = d.runs.middle.frames[0].a;
  const cards = PIVOTS.map(([k, name, c]) => {
    const r = d.runs[k];
    return `<div class="panel" style="margin:0;padding:14px"><h2 style="margin-bottom:8px"><span class="sw" style="background:var(${c})"></span>${name}</h2><div class="stats" style="margin:0;grid-template-columns:repeat(3,1fr)">${stat(r.swaps, 'swaps (lab\'s "comparisons")')}${stat(r.comparisons, 'comparisons')}${stat(r.writes, 'writes')}</div></div>`;
  }).join('');
  const legend = key('--c2', 'compared') + key('--c3', 'written') + key('--c1', 'other elements');
  const players = PIVOTS.map(([k, name], i) => {
    const r = d.runs[k];
    const draw = (f, width) => {
      const marks = {};
      if (f.k === 'c') f.i.forEach((j) => (marks[j] = '--c2'));
      if (f.k === 'w') marks[f.i[0]] = '--c3';
      return barsSvg(f.a, marks, () => '--c1', { label: `${name} sort step`, width });
    };
    const cap = (f) => {
      const what = f.k === 'start' ? `<span class="muted">Start, pivot index</span> ${r.pivot}`
        : f.k === 'end' ? `<span class="muted">Done:</span> ${list(f.a)}`
        : f.k === 'c' ? `<span class="muted">compare</span> a[${f.i[0]}] = ${f.a[f.i[0]]} <span class="muted">with</span> a[${f.i[1]}] = ${f.a[f.i[1]]}`
        : `<span class="muted">write</span> a[${f.i[0]}] ← ${f.a[f.i[0]]}`;
      return `${what} <span class="muted">· swaps ${f.s} · comparisons ${f.c}</span>`;
    };
    return `<div data-pivot="${k}" ${i ? 'hidden' : ''}>${player(`${name} quick sort, step by step${r.truncated ? ' (first steps only)' : ''}`, r.frames, draw, cap, legend)}</div>`;
  }).join('');
  const strat = (key) => PIVOTS.map(([k, name, c]) => ({ name, xs: d.sizes, ys: d.sweep[k][key], color: c, dash: k === 'first' }));
  return `<div class="algo-cards">${cards}</div>
    <div class="tabs" id="pivot-tabs">${PIVOTS.map(([k, name], i) => `<button class="tab" data-k="${k}" aria-selected="${i === 0}">${name}</button>`).join('')}</div>
    ${players}
    <div class="charts two" style="margin-top:16px">
      ${chart({ kind: 'bar', title: `Counters for ${list(input)}`, x: 'pivot strategy', y: 'count', cats: PIVOTS.map((p) => p[1]), series: [{ name: 'swaps', ys: PIVOTS.map(([k]) => d.runs[k].swaps), color: '--c4' }, { name: 'comparisons', ys: PIVOTS.map(([k]) => d.runs[k].comparisons), color: '--c6' }, { name: 'writes', ys: PIVOTS.map(([k]) => d.runs[k].writes), color: '--c7' }] })}
      ${chart({ title: 'Swaps vs array size (random arrays)', x: 'size n', y: 'swaps', series: strat('swaps') })}
      ${chart({ title: 'Comparisons vs array size (random arrays)', x: 'size n', y: 'comparisons', series: strat('comparisons') })}
      ${consoleBox(d.output, 'Lab output (its own print format)')}
    </div>`;
}
function bindLab3(out) {
  const tabs = out.querySelectorAll('#pivot-tabs .tab');
  tabs.forEach((t) => t.onclick = () => {
    tabs.forEach((x) => x.setAttribute('aria-selected', x === t));
    out.querySelectorAll('[data-pivot]').forEach((el) => (el.hidden = el.dataset.pivot !== t.dataset.k));
  });
}

function lab4View(d) {
  const n = d.arrays.length;
  const sortedMed = d.arrays.map((a) => { const s = sortedNum(a), m = s.length; return m % 2 ? s[(m - 1) / 2] : (s[m / 2 - 1] + s[m / 2]) / 2; });
  const labMed = d.medians.map((m) => (m.length === 1 ? m[0] : (m[0] + m[1]) / 2));
  const cw = Math.min(44, Math.max(24, 560 / n)), rh = 30, W = 40 + n * cw + 10, H = n * rh + 10;
  const rows = d.arrays.map((a, r) => {
    const m = a.length, x0 = 40 + ((n - m) * cw) / 2, y = 5 + r * rh;
    const mid = m % 2 ? [(m - 1) / 2] : [m / 2 - 1, m / 2];
    return `<text x="14" y="${y + rh / 2 - 2}" class="sub" dominant-baseline="central">${r + 1}</text>` + a.map((v, i) => {
      const hot = mid.includes(i);
      return `<rect x="${x0 + i * cw + 1.5}" y="${y + 1.5}" width="${cw - 3}" height="${rh - 7}" rx="5" fill="var(${hot ? '--js-soft' : '--py-soft'})" stroke="var(${hot ? '--js' : '--py'})" stroke-width="${hot ? 2 : 1.2}"/><text x="${x0 + i * cw + cw / 2}" y="${y + rh / 2 - 2}" text-anchor="middle" dominant-baseline="central" style="font-size:${cw < 30 ? 10 : 12}px;${hot ? 'font-weight:700' : ''}">${v}</text>`;
    }).join('');
  }).join('');
  const pyr = `<svg viewBox="0 0 ${W} ${H}" style="max-width:${W}px" role="img" aria-label="Pyramid of prefixes">${rows}</svg>`;
  const trs = d.arrays.map((a, i) => `<tr><td class="num">${i + 1}</td><td>${list(a)}</td><td>${d.medians[i].length === 1 ? d.medians[i][0] : `(${d.medians[i].join(', ')})`}</td><td class="num">${fmt(sortedMed[i])}</td></tr>`).join('');
  const differ = labMed.filter((v, i) => v !== sortedMed[i]).length;
  return `<div class="stats">${stat(n, 'iterations')}${stat(d.medians[n - 1].length === 1 ? d.medians[n - 1][0] : `(${d.medians[n - 1].join(', ')})`, 'final median(s)')}${stat(fmt(sortedMed[n - 1]), 'sorted median')}${stat(`${differ} of ${n}`, 'prefixes where they differ', differ ? 'bad' : 'good')}</div>
    <div class="two-col"><div class="box" data-copyable data-title="Pyramid"><div class="copy-head"><h2>Pyramid <small>· row i is the first i elements, middle element(s) highlighted</small></h2>${actions('png')}</div><div class="plot drawing" style="overflow-x:auto">${pyr}</div></div>
      <div class="box">${chart({ title: 'Running medians', x: 'iteration (prefix length)', y: 'median', intX: true, dots: true, series: [{ name: 'lab median (pairs averaged)', xs: range(n, (i) => i + 1), ys: labMed, color: '--c2', labels: d.medians.map((m) => (m.length === 1 ? String(m[0]) : `(${m.join(', ')})`)) }, { name: 'median of the sorted prefix', xs: range(n, (i) => i + 1), ys: sortedMed, color: '--c1', dash: true }] })}</div></div>
    <div class="box" data-copyable style="margin-top:16px"><div class="copy-head"><h2>Medians</h2>${actions('table')}</div><div class="table-wrap"><table><thead><tr><th class="num">Iteration</th><th>Array</th><th>Median(s), lab</th><th class="num">Sorted median</th></tr></thead><tbody>${trs}</tbody></table></div></div>
    <div style="margin-top:16px">${consoleBox(d.output)}</div>`;
}

function lab5View(r) {
  const { S, A, h1, h2 } = r.value;
  const [out1, out2] = r.output.split('[HASH FUNCTION 2]');
  const hits = (txt) => [...txt.matchAll(/A sum of (\d+) and (\d+) elements is appropriate/g)].map((m) => [+m[1], +m[2]]);
  const hit1 = hits(out1), hit2 = hits(out2 || '');
  const set1 = new Set(hit1.map(([i, u]) => `${i},${u}`)), set2 = new Set(hit2.map(([i, u]) => `${i}|${u}`));
  const head = `<tr><th>i \\ u</th>${A.map((v, u) => `<th>${u}<br><span class="muted" style="font-weight:400">${v}</span></th>`).join('')}</tr>`;
  const body = h1.map((row, i) => `<tr><th>${i} <span class="muted" style="font-weight:400">${A[i]}</span></th>${row.map((v, u) => `<td class="${i === u ? 'diag' : set1.has(`${i},${u}`) ? 'hit' : ''}">${v}</td>`).join('')}</tr>`).join('');
  const chips = h2.map((e) => { const [a, b] = e.split('|'); return `<span class="chip static${set2.has(`${a}|${b}`) ? ' hit' : ''}">${e}</span>`; }).join('');
  return `<div class="stats">${stat(S, 'sum S')}${stat(hit1.length, 'matches in table 1')}${stat(hit2.length, 'matches in table 2')}${stat(h1.length * h1.length, 'table 1 cells')}${stat(h2.length, 'table 2 entries')}</div>
    <p class="note">Table 1 holds both orders of every pair, so it finds each pair whose sum is S twice (as i and u, then u and i). Table 2 stores i &lt; u only and finds each pair once.</p>
    <div class="box" data-copyable><div class="copy-head"><h2>Hash table 1 <small>· h1[i][u] = A[i] + A[u], ❌ on the diagonal, cells equal to S highlighted</small></h2>${actions('table')}</div><div class="table-wrap"><table class="matrix">${head}${body}</table></div></div>
    <div class="box" data-copyable data-title="Hash table 2"><div class="copy-head"><h2>Hash table 2 <small>· i|u|sum for i &lt; u, entries with sum S highlighted</small></h2></div><div class="chips">${chips}</div></div>
    <div style="margin-top:16px">${consoleBox(r.output)}</div>`;
}

function lab6View(r) {
  const { tree, S } = r.value;
  // lay the tree out: x by in-order position, y by depth
  const nodes = [];
  const walk = (v, depth, parent) => { if (!v) return; walk(v.left, depth + 1, v); nodes.push({ v, depth, parent, x: nodes.length }); walk(v.right, depth + 1, v); };
  walk(tree.parent_main, 0, null);
  const byVert = new Map(nodes.map((n) => [n.v, n]));
  const maxDepth = Math.max(...nodes.map((n) => n.depth));
  const gap = 46, W = Math.max(300, nodes.length * gap + 20), H = (maxDepth + 1) * 62 + 20;
  const X = (n) => 10 + gap / 2 + n.x * gap, Y = (n) => 30 + n.depth * 62;
  const found = Object.entries(tree.sums).filter(([, s]) => s === S).map(([w]) => w);
  // every place on a root-to-vertex path where a found run of values occurs
  const chains = nodes.map((n) => { const c = []; for (let v = n.v; v; v = v.parent) c.unshift(v); return c; });
  const where = found.map((way) => {
    const vals = way.split(' -> ').map(Number), vs = new Set(), es = new Set();
    chains.forEach((c) => {
      for (let i = 0; i + vals.length <= c.length; i++) {
        if (!vals.every((v, j) => c[i + j].value === v)) continue;
        for (let j = 0; j < vals.length; j++) { vs.add(c[i + j]); if (j) es.add(c[i + j]); }
      }
    });
    return { vs, es };
  });
  const draw = (sel) => {
    const pick = sel === null ? where : [where[sel]];
    const lit = new Set(pick.flatMap((w) => [...w.vs])), litE = new Set(pick.flatMap((w) => [...w.es]));
    const edges = nodes.filter((n) => n.parent).map((n) => {
      const p = byVert.get(n.parent), hot = litE.has(n.v);
      return `<line x1="${X(p)}" y1="${Y(p)}" x2="${X(n)}" y2="${Y(n)}" stroke="var(${hot ? '--c2' : '--line'})" stroke-width="${hot ? 4 : 2}" stroke-linecap="round"/>`;
    }).join('');
    const circles = nodes.map((n) => {
      const hot = lit.has(n.v), side = n.parent ? (n.parent.left === n.v ? 'L' : 'R') : 'root';
      return `<circle cx="${X(n)}" cy="${Y(n)}" r="16" fill="var(${hot ? '--js-soft' : '--py-soft'})" stroke="var(${hot ? '--c2' : '--py'})" stroke-width="${hot ? 3 : 1.6}"/><text x="${X(n)}" y="${Y(n)}" text-anchor="middle" dominant-baseline="central" style="${hot ? 'font-weight:700' : ''}">${n.v.value}</text>${side === 'root' ? `<text x="${X(n) + 22}" y="${Y(n) - 10}" class="sub">root</text>` : ''}`;
    }).join('');
    return `<svg viewBox="0 0 ${W} ${H}" style="max-width:${W}px" role="img" aria-label="Binary search tree">${edges}${circles}</svg>`;
  };
  lab6View.state = { draw, count: found.length };
  const chips = found.map((w, i) => `<button type="button" class="chip" data-i="${i}">${w.replace(/ -> /g, ' → ')}</button>`).join('');
  return `<div class="stats">${stat(S, 'sum S')}${stat(found.length, 'paths found', found.length ? 'good' : 'bad')}${stat(tree.vert_array.length, 'vertices')}${stat(maxDepth + 1, 'levels')}${stat(Object.keys(tree.sums).length, 'downward runs checked')}</div>
    <div class="box" data-copyable data-title="Binary search tree, sum ${S}"><div class="copy-head"><h2>Tree <small>· smaller or equal values go left; the paths that sum to S are highlighted</small></h2>${actions('png')}</div>
      <div class="chips" id="bst-chips" style="margin-bottom:10px">${found.length ? `<button type="button" class="chip" data-i="all" aria-pressed="true">All paths</button>${chips}` : '<span class="muted">No path adds up to S.</span>'}</div>
      <div class="plot drawing" id="bst-plot" style="overflow-x:auto">${draw(null)}</div></div>
    <div style="margin-top:16px">${consoleBox(r.output)}</div>`;
}
function bindLab6(out) {
  const { draw } = lab6View.state;
  const chips = out.querySelectorAll('#bst-chips .chip'), plot = $('#bst-plot', out);
  chips.forEach((c) => c.onclick = () => {
    chips.forEach((x) => x.setAttribute('aria-pressed', x === c));
    plot.innerHTML = draw(c.dataset.i === 'all' ? null : +c.dataset.i);
  });
}

function graphSvg(g) {
  const n = g.n, W = 360, H = 330, cx = W / 2, cy = H / 2 + 4, R = 128;
  const P = (v) => { const a = -Math.PI / 2 + ((v - 1) * 2 * Math.PI) / n; return [cx + R * Math.cos(a), cy + R * Math.sin(a)]; };
  const onRoute = new Set(g.route.slice(1).map((v, i) => [Math.min(v, g.route[i]), Math.max(v, g.route[i])].join('|')));
  const edges = Object.entries(g.edges).map(([k, w]) => {
    const [a, b] = k.split(' | ').map(Number), [x1, y1] = P(a), [x2, y2] = P(b), hot = onRoute.has(`${a}|${b}`);
    const mx = x1 + (x2 - x1) * 0.5, my = y1 + (y2 - y1) * 0.5;
    return { hot, svg: `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(${hot ? '--c2' : '--line'})" stroke-width="${hot ? 4 : 1.4}" stroke-linecap="round"/>`, label: `<g><rect x="${mx - 10}" y="${my - 8}" width="20" height="15" rx="4" fill="var(--panel)" ${hot ? 'stroke="var(--c2)"' : ''}/><text x="${mx}" y="${my}" text-anchor="middle" dominant-baseline="central" class="${hot ? '' : 'sub'}" style="font-size:10.5px;${hot ? 'font-weight:700' : ''}">${w}</text></g>` };
  });
  edges.sort((a, b) => a.hot - b.hot);
  const opt = g.optimum && g.optimum.weight < g.best ? g.optimum.route.slice(1).map((v, i) => { const [x1, y1] = P(g.optimum.route[i]), [x2, y2] = P(v); return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--c3)" stroke-width="2.4" stroke-dasharray="6 5" stroke-linecap="round"/>`; }).join('') : '';
  const order = new Map(g.route.map((v, i) => [v, i + 1]));
  const verts = range(n, (i) => {
    const v = i + 1, [x, y] = P(v), start = v === g.route[0], end = v === g.route[n - 1];
    return `<circle cx="${x}" cy="${y}" r="15" fill="var(${start || end ? '--js-soft' : '--py-soft'})" stroke="var(${start || end ? '--c2' : '--py'})" stroke-width="2"/><text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" style="font-weight:700">${v}</text><text x="${x + (x >= cx ? 19 : -19)}" y="${y - 14}" text-anchor="${x >= cx ? 'start' : 'end'}" class="sub">#${order.get(v)}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" style="max-width:${W + 40}px;margin:0 auto" role="img" aria-label="Graph with the chosen route">${edges.map((e) => e.svg).join('')}${opt}${edges.map((e) => e.label).join('')}${verts}</svg>`;
}
function lab7View(d) {
  const blocks = d.graphs.map((g, gi) => {
    const opt = g.optimum, ok = !opt || opt.weight === g.best;
    const rows = [...g.ways].sort((a, b) => a.weight - b.weight).map((w) => `<tr class="${list(w.route) === list(g.route) ? 'sel' : ''}"><td>${w.route.join(' → ')}</td><td class="num">${w.weight}</td></tr>`).join('');
    return `<div class="panel" style="margin:0;padding:14px"><h2 style="margin-bottom:8px">Graph ${gi + 1} <small>· ${g.n} vertices</small></h2>
      <div class="stats" style="grid-template-columns:repeat(3,1fr)">${stat(g.best, 'route weight (lab)', opt ? (ok ? 'good' : 'bad') : '')}${stat(opt ? opt.weight : '—', 'true shortest')}${stat(g.ways.length, 'candidates tried')}</div>
      <div data-copyable data-title="Graph ${gi + 1}: route ${g.route.join('-')}, weight ${g.best}"><div class="copy-head"><span class="cap" style="font:13px var(--mono)">${g.route.join(' → ')}</span>${actions('png')}</div><div class="plot drawing">${graphSvg(g)}</div></div>
      ${opt && !ok ? `<p class="hint">The exhaustive search finds ${opt.route.join(' → ')} with weight ${opt.weight}.</p>` : ''}
      <div data-copyable style="margin-top:12px"><div class="copy-head"><h2>Candidate routes</h2>${actions('table')}</div><div class="table-wrap" style="max-height:260px"><table><thead><tr><th>Route</th><th class="num">Weight</th></tr></thead><tbody>${rows}</tbody></table></div></div></div>`;
  }).join('');
  return `<div class="two-col">${blocks}</div><div class="legend">${key('--c2', 'route the lab picked')}${key('--c3', 'true shortest route (dashed), when shorter')}<span>#k: position on the lab's route</span></div>
    <div style="margin-top:16px">${consoleBox(d.output)}</div>`;
}

function lab8View(d, p) {
  const chosen = new Set(d.chosen || []);
  const fits = d.sets.filter((s) => s.weight <= p.capacity);
  const label = (s) => `{${s.titles.join(', ')}}`;
  const isChosen = (s) => d.chosen && s.titles.join() === d.chosen.join();
  const pick = (f) => { const ss = d.sets.filter(f); return { xs: ss.map((s) => s.weight), ys: ss.map((s) => s.price), labels: ss.map(label) }; };
  const rows = d.goods.map((x) => `<tr class="${chosen.has(x.title) ? 'sel' : ''}"><td>${esc(x.title)}</td><td class="num">${x.weight}</td><td class="num">${x.price}</td><td class="num">${fmt(x.price / x.weight, 2)}</td><td>${chosen.has(x.title) ? '<span class="ok">✓ taken</span>' : ''}</td></tr>`).join('');
  return `<div class="stats">${stat(d.chosen ? pyList(d.chosen) : 'None', 'appropriate set')}${stat(`${d.weight} / ${p.capacity}`, 'weight / capacity')}${stat(d.price, 'price')}${stat(d.sets.length, 'sets listed')}${stat(fits.length, 'sets that fit')}</div>
    <div class="two-col"><div class="box" data-copyable><div class="copy-head"><h2>Goods <small>· the chosen set highlighted</small></h2>${actions('table')}</div><div class="table-wrap"><table><thead><tr><th>Title</th><th class="num">Weight</th><th class="num">Price</th><th class="num">Price / weight</th><th>Set</th></tr></thead><tbody>${rows}</tbody></table></div></div>
      ${chart({ title: 'Every listed set: weight vs price', x: 'weight', y: 'price', scatter: true, tightX: false, vline: { x: p.capacity, label: `capacity ${p.capacity}` }, series: [{ name: 'fits', ...pick((s) => s.weight <= p.capacity && !isChosen(s)), color: '--c1' }, { name: 'too heavy', ...pick((s) => s.weight > p.capacity), color: '--c5' }, { name: 'chosen', ...pick(isChosen), color: '--c3', r: 6 }] })}</div>
    <div style="margin-top:16px">${consoleBox(d.output)}</div>`;
}

// ------------------------------------------------------------------ copying --
const ACTION_LABEL = { png: 'Copy image', csv: 'Copy CSV', table: 'Copy table', results: 'Copy results' };
const ACTION_TIP = { png: 'Copy as a PNG image (downloads it if the clipboard is unavailable)', csv: 'Copy the plotted data as CSV', table: 'Copy the table as tab-separated text, pastes into spreadsheets', results: 'Copy the inputs and results as text' };
const actions = (...kinds) => `<span class="copy-actions">${kinds.map((k) => `<button type="button" class="mini" data-act="${k}" title="${ACTION_TIP[k]}">${ACTION_LABEL[k]}</button>`).join('')}</span>`;

// Render an on-screen SVG to PNG: computed colours and fonts are inlined so the image
// matches the current theme, with the caption drawn above it.
function svgPng(svg, title, legend = [], scale = 2) {
  const box = svg.viewBox.baseVal;
  const w = (box && box.width) || +svg.getAttribute('width') || svg.clientWidth;
  const h = (box && box.height) || +svg.getAttribute('height') || svg.clientHeight;
  const clone = svg.cloneNode(true);
  const src = [svg, ...svg.querySelectorAll('*')], dst = [clone, ...clone.querySelectorAll('*')];
  src.forEach((el, i) => {
    const cs = getComputedStyle(el), c = dst[i];
    for (const a of ['fill', 'stroke', 'stroke-opacity', 'fill-opacity', 'stroke-width', 'opacity', 'visibility']) c.setAttribute(a, cs.getPropertyValue(a));
    if (el.tagName === 'text') for (const a of ['font-family', 'font-size', 'font-weight', 'dominant-baseline']) c.setAttribute(a, cs.getPropertyValue(a));
    c.removeAttribute('style'); c.removeAttribute('class');
  });
  clone.querySelectorAll('title, .marks').forEach((t) => t.remove());
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', w); clone.setAttribute('height', h);
  if (!clone.getAttribute('viewBox')) clone.setAttribute('viewBox', `0 0 ${w} ${h}`);
  const css = getComputedStyle(document.documentElement);
  const head = title ? 30 : 0, pad = 14;
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = (w + pad * 2) * scale; c.height = (h + head + pad * 2) * scale;
      const ctx = c.getContext('2d');
      ctx.scale(scale, scale);
      ctx.fillStyle = css.getPropertyValue('--panel').trim();
      ctx.fillRect(0, 0, w + pad * 2, h + head + pad * 2);
      const family = getComputedStyle(document.body).fontFamily;
      if (title) {
        ctx.fillStyle = css.getPropertyValue('--ink').trim();
        ctx.font = `600 14px ${family}`;
        ctx.fillText(title, pad, pad + 14);
        ctx.font = `12px ${family}`;
        let x = w + pad;
        for (const { name, color } of [...legend].reverse()) {
          x -= ctx.measureText(name).width;
          ctx.fillStyle = css.getPropertyValue('--muted').trim();
          ctx.fillText(name, x, pad + 13);
          x -= 19;
          ctx.fillStyle = css.getPropertyValue(color).trim();
          ctx.fillRect(x, pad + 7, 14, 3);
          x -= 14;
        }
      }
      ctx.drawImage(img, pad, pad + head, w, h);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed'))), 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('SVG render failed')); };
    img.src = url;
  });
}

const csvCell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
function chartCsv(spec) {
  const rows = (r) => r.map((x) => x.map(csvCell).join(',')).join('\n');
  if (spec.kind === 'bar') return rows([[spec.x, ...spec.series.map((s) => s.name)], ...spec.cats.map((c, i) => [c, ...spec.series.map((s) => s.ys[i])])]);
  if (spec.scatter) return rows([['series', 'set', spec.x, spec.y], ...spec.series.flatMap((s) => s.xs.map((x, i) => [s.name, s.labels ? s.labels[i] : '', x, s.ys[i]]))]);
  const s0 = spec.series[0];
  const shared = spec.series.every((s) => s.xs.length === s0.xs.length && s.xs.every((x, i) => x === s0.xs[i]));
  if (shared) return rows([[spec.x, ...spec.series.map((s) => s.name || spec.y)], ...s0.xs.map((x, i) => [x, ...spec.series.map((s) => s.ys[i])])]);
  return rows([['series', spec.x, spec.y], ...spec.series.flatMap((s) => s.xs.map((x, i) => [s.name, x, s.ys[i]]))]);
}
const tableTsv = (table) => [...table.rows].map((r) => [...r.cells].map((c) => c.innerText.trim().replace(/\s+/g, ' ')).join('\t')).join('\n');

function resultsText(sec) {
  const lab = LABS.find((l) => `panel-${l.id}` === sec.id);
  const p = params(lab);
  const lines = [`Lab ${lab.tab}: ${lab.name}`, `Parameters: ${lab.fields.map((f) => `${f.label} = ${p[f.key]}`).join(', ')}`];
  const out = $('.out', sec);
  out.querySelectorAll('.note').forEach((el) => lines.push(el.innerText.trim()));
  out.querySelectorAll('.stats').forEach((st) => {
    const group = st.closest('.panel:not([role])')?.querySelector('h2')?.innerText.trim();
    if (group) lines.push(`${group}:`);
    st.querySelectorAll('.stat').forEach((x) => lines.push(`${group ? '  ' : ''}${$('span', x).innerText.trim()}: ${$('b', x).innerText.trim()}`));
  });
  out.querySelectorAll('pre.console').forEach((pre) => lines.push('', `${pre.closest('.box')?.querySelector('h2')?.innerText.trim() || 'Output'}:`, pre.textContent));
  return lines.join('\n');
}

async function copyAction(btn) {
  const kind = btn.dataset.act, box = btn.closest('[data-copyable]');
  const done = (text) => { btn.textContent = text; setTimeout(() => (btn.textContent = ACTION_LABEL[kind]), 1400); };
  const name = (box?.dataset.title || 'chart').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  try {
    if (kind === 'png') {
      const svg = box.querySelector('.plot svg');
      const spec = charts.get(box.dataset.chart);
      const legend = spec && (spec.series.length > 1) ? spec.series.map((x) => ({ name: x.name, color: x.color })) : [];
      const cap = box.querySelector('.player .cap, .cap')?.innerText.trim();
      const title = box.dataset.player && cap ? `${box.dataset.title}: ${cap}` : box.dataset.title;
      try {
        // pass the promise straight to ClipboardItem so Safari keeps the user gesture
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': svgPng(svg, title, legend) })]);
        return done('Copied');
      } catch {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(await svgPng(svg, title, legend));
        a.download = `${name}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        return done('Downloaded');
      }
    }
    const text = kind === 'csv' ? chartCsv(charts.get(box.dataset.chart))
      : kind === 'table' ? tableTsv(box.querySelector('table'))
      : resultsText(btn.closest('section.panel'));
    await navigator.clipboard.writeText(text);
    done('Copied');
  } catch (e) { console.error(e); done('Failed'); }
}
document.addEventListener('click', (e) => { const b = e.target.closest('button[data-act]'); if (b) copyAction(b); });

// --------------------------------------------------------------- framework --
const nav = $('#nav'), main = $('#labs');
const state = new Map(); // lab id -> { ran, running }
const LANG = { py: ['Py', 'Python'], js: ['JS', 'JavaScript'], hs: ['Hs', 'Haskell'] };

function fieldHtml(lab, f) {
  const id = `${lab.id}-${f.key}`;
  const type = f.type === 'list' ? 'text' : f.type || 'number';
  const attrs = type === 'number' ? ` min="${f.min}" max="${f.max}" step="${f.step || 1}" required` : ' spellcheck="false" autocomplete="off"';
  return `<label class="field${f.wide ? ` ${f.wide}` : ''}" for="${id}">${esc(f.label)}<input id="${id}" name="${f.key}" type="${type}" value="${esc(f.value)}"${attrs}></label>`;
}

function build() {
  for (const lab of LABS) {
    const b = document.createElement('button');
    b.type = 'button'; b.role = 'tab'; b.dataset.lab = lab.id;
    b.setAttribute('aria-controls', `panel-${lab.id}`);
    b.innerHTML = `<span class="lang ${lab.lang}">${LANG[lab.lang][0]}</span>${lab.extra ? `<span class="lang ${lab.extra}" style="margin-left:-3px">${LANG[lab.extra][0]}</span>` : ''}Lab ${lab.tab}<span class="long muted" style="font-weight:400">· ${esc(lab.name)}</span>`;
    b.onclick = () => select(lab.id, true);
    nav.appendChild(b);

    const sec = document.createElement('section');
    sec.className = 'panel'; sec.id = `panel-${lab.id}`; sec.role = 'tabpanel'; sec.hidden = true;
    sec.innerHTML = `<div class="lab-head"><span class="lang ${lab.lang}">${LANG[lab.lang][1]}</span>${lab.extra ? `<span class="lang ${lab.extra}">${LANG[lab.extra][1]} port</span>` : ''}<h3>Lab ${lab.tab}: ${esc(lab.name)}</h3><a href="${lab.src}" target="_blank" rel="noopener">View source</a></div>
      <p class="intro">${lab.intro}</p>
      <form class="params" novalidate>${lab.fields.map((f) => fieldHtml(lab, f)).join('')}<button class="run" type="submit">Run</button></form>
      ${lab.examples ? `<div class="examples"><span>Try</span>${lab.examples.map((e) => `<button type="button" class="chip" data-v="${esc(e)}">${esc(e.length > 26 ? `${e.slice(0, 24)}…` : e)}</button>`).join('')}</div>` : ''}
      ${lab.hint ? `<p class="hint">${lab.hint}</p>` : ''}
      <div class="out" style="margin-top:18px"></div>`;
    main.appendChild(sec);
    state.set(lab.id, { ran: false, running: false });

    const form = $('form', sec);
    form.addEventListener('submit', (e) => { e.preventDefault(); run(lab); });
    sec.querySelectorAll('.examples .chip').forEach((c) => c.onclick = () => { form.elements[lab.examplesKey || lab.fields[0].key].value = c.dataset.v; run(lab); });

    if (lab.lang === 'py' && !pyReady) sec.querySelector('.out').before(document.getElementById('py-loading').content.cloneNode(true));
  }
}

function params(lab) {
  const fd = new FormData($(`#panel-${lab.id} form`)), p = {};
  for (const f of lab.fields) { const v = fd.get(f.key); p[f.key] = f.type ? String(v) : Number(v); }
  return p;
}

function invalid(lab, p) {
  for (const f of lab.fields) {
    if (f.type) continue;
    const v = p[f.key];
    if (!Number.isFinite(v) || v < f.min || v > f.max || !Number.isInteger(v)) return `${f.label} must be an integer from ${f.min} to ${f.max}.`;
  }
  return lab.check ? lab.check(p) : null;
}

const BINDERS = { lab2: bindLab2, lab3: bindLab3, lab6: bindLab6 };
async function run(lab) {
  const st = state.get(lab.id);
  if (st.running) return;
  const sec = $(`#panel-${lab.id}`), btn = $('.run', sec), out = $('.out', sec);
  const p = params(lab);
  const bad = invalid(lab, p);
  if (bad) { out.innerHTML = `<div class="err">${esc(bad)}</div>`; return; }
  st.running = true; st.ran = true;
  btn.disabled = true; btn.textContent = lab.lang === 'py' && !pyReady ? 'Waiting for Python…' : 'Running…';
  out.style.opacity = '.45';
  try {
    const data = await lab.run(p);
    out.innerHTML = `<div class="out-actions">${actions('results')}</div>` + lab.render(data, p);
    drawCharts(out);
    bindPlayers(out);
    BINDERS[lab.id]?.(out);
  } catch (e) {
    console.error(e);
    out.innerHTML = `<div class="err">${esc(e.message || e)}</div>`;
  } finally {
    st.running = false; btn.disabled = false; btn.textContent = 'Run'; out.style.opacity = '';
  }
}

function select(id, push) {
  const lab = LABS.find((l) => l.id === id) || LABS[0];
  nav.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', b.dataset.lab === lab.id));
  main.querySelectorAll('section.panel[role="tabpanel"]').forEach((s) => s.hidden = s.id !== `panel-${lab.id}`);
  if (push) try { history.replaceState(null, '', `#${lab.id}`); } catch {}
  document.title = `Lab ${lab.tab} · Algorithms Labs`;
  if (!state.get(lab.id).ran) run(lab);
  else drawCharts($(`#panel-${lab.id}`));
}

build();
// elapsed counter for the Python loading notices
const started = Date.now();
const tick = setInterval(() => {
  if (pyReady) return clearInterval(tick);
  const sec = Math.round((Date.now() - started) / 1000);
  document.querySelectorAll('.py-status').forEach((el) => {
    $('.elapsed', el).textContent = sec ? `${sec} s` : '';
    if (sec >= 45) { el.classList.add('slow'); $('.note-text', el).textContent = 'This is taking longer than usual. Check your connection, or reload the page.'; }
  });
}, 1000);
select(location.hash.slice(1), false);
window.addEventListener('hashchange', () => select(location.hash.slice(1), false));
