import katex from 'katex';
import { defineWidget, h, s, svgRoot, shade } from 'texweb/client';
import DATA from './data.js';
import './style.css';

// autoencoder lineare con pesi legati sulle cifre 8x8: l'input x viene codificato in h = W(x - c)
// (k numeri) e ricostruito come x̂ = c + Wᵀh, ovvero l'immagine media più le k feature pesate da h

const D = 64, SIDE = 8;
const W_SVG = 640, H_SVG = 186;
const CELL = 15, GRID = CELL * SIDE;
const X_IN = 20, X_OUT = W_SVG - 20 - GRID, Y_GRID = 34;
const X_CODE = 226, W_CODE = 188, CY = Y_GRID + GRID / 2, HALF = 54;
const TERMS = 6, MINI = 5;

const encode = (x, k) => DATA.comp.slice(0, k).map((w) => w.reduce((a, wi, i) => a + wi * (x[i] - DATA.mean[i]), 0));
const decode = (hh) => DATA.mean.map((m, i) => hh.reduce((a, hj, j) => a + hj * DATA.comp[j][i], m));
const sqErr = (a, b) => a.reduce((acc, v, i) => acc + (v - b[i]) ** 2, 0);
const fix = (v, d = 2) => (Math.abs(v) < 0.005 ? 0 : v).toFixed(d);

// una griglia 8x8 di rettangoli senza testo
function pixels(x0, y0, size, cls) {
  const g = s('g', { class: `px ${cls}`, transform: `translate(${x0},${y0})` });
  const cells = [];
  for (let i = 0; i < D; i++) {
    const r = s('rect', { x: (i % SIDE) * size, y: Math.floor(i / SIDE) * size, width: size, height: size });
    g.append(r);
    cells.push(r);
  }
  g.append(s('rect', { x: 0, y: 0, width: size * SIDE, height: size * SIDE, class: 'px-frame' }));
  return { g, cells };
}
const paint = (cells, v) => cells.forEach((r, i) => { r.style.fill = shade(Math.max(0, Math.min(1, v[i])), 1).fill; });

// le feature hanno segno: positivo in un colore, negativo nell'altro
function paintSigned(cells, w) {
  const a = Math.max(...w.map(Math.abs)) || 1;
  cells.forEach((r, i) => {
    const t = Math.round((Math.abs(w[i]) / a) * 85);
    r.style.fill = `color-mix(in oklab, ${w[i] >= 0 ? 'var(--accent-soft)' : 'var(--hot)'} ${t}%, var(--surface))`;
  });
}

export default defineWidget({
  name: 'autoencoder',
  params: {
    k: { type: 'integer', default: 8, min: 1, max: 64 },
    digit: { type: 'integer', default: 2, min: 0, max: 9 },
  },

  mount(el, { k: k0, digit }) {
    el.classList.add('w-ae');
    const st = { k: k0, x: DATA.samples[digit].map((v) => v / 16), src: digit };

    // ---- schema: input, encoder, codice, decoder, ricostruzione
    const svg = svgRoot(W_SVG, H_SVG, { 'aria-label': 'Un autoencoder lineare: input 8x8, codice di k numeri e ricostruzione 8x8' });
    const head = (x, text) => s('text', { x, y: 20, class: 'head' }, text);
    const foot = (x, text) => s('text', { x, y: Y_GRID + GRID + 22, class: 'foot' }, text);
    const inp = pixels(X_IN, Y_GRID, CELL, 'in');
    const out = pixels(X_OUT, Y_GRID, CELL, 'out');
    const encX = X_IN + GRID + 12, decX = X_OUT - 12, TW = 50;
    const enc = s('polygon', { class: 'trap', points: `${encX},${Y_GRID} ${encX + TW},${CY - 22} ${encX + TW},${CY + 22} ${encX},${Y_GRID + GRID}` });
    const dec = s('polygon', { class: 'trap', points: `${decX},${Y_GRID} ${decX - TW},${CY - 22} ${decX - TW},${CY + 22} ${decX},${Y_GRID + GRID}` });
    const kFoot = foot(X_CODE + W_CODE / 2, '');
    svg.append(
      head(X_IN + GRID / 2, 'input x'), head(X_CODE + W_CODE / 2, 'codice h'), head(X_OUT + GRID / 2, 'ricostruzione x̂'),
      enc, dec,
      s('text', { x: encX + TW / 2, y: CY, class: 'trap-t' }, 'f'), s('text', { x: decX - TW / 2, y: CY, class: 'trap-t' }, 'g'),
      foot(encX + TW / 2, 'encoder'), foot(decX - TW / 2, 'decoder'),
      foot(X_IN + GRID / 2, 'D = 64 pixel'), kFoot,
      s('line', { x1: X_CODE, x2: X_CODE + W_CODE, y1: CY, y2: CY, class: 'zero' }),
      inp.g, out.g,
    );
    const bars = Array.from({ length: D }, () => {
      const r = s('rect', { x: 0, y: 0, width: 1, height: 1, class: 'bar' });
      svg.append(r);
      return r;
    });
    const recErr = foot(X_OUT + GRID / 2, '');
    svg.append(recErr);

    // ---- il decoder come somma: x̂ = c + h1·w1 + h2·w2 + ...
    const SW = 640, SH = 70, MY = 14;
    const strip = svgRoot(SW, SH, { class: 'fig-svg strip', 'aria-label': 'La ricostruzione come immagine media più le feature pesate dal codice' });
    strip.append(s('text', { x: 0, y: MY + 20, class: 'sum-t lead' }, 'x̂ ='));
    const meanPx = pixels(34, MY, MINI, 'mini');
    strip.append(meanPx.g, s('text', { x: 54, y: MY + 56, class: 'sum-l' }, 'c'));
    paint(meanPx.cells, DATA.mean);
    const terms = Array.from({ length: TERMS }, (_, j) => {
      const x0 = 84 + j * 86;
      const coef = s('text', { x: x0 + 34, y: MY + 20, class: 'sum-t coef' });
      const px = pixels(x0 + 38, MY, MINI, 'mini');
      const lab = s('text', { x: x0 + 58, y: MY + 56, class: 'sum-l' }, `w${'₁₂₃₄₅₆'[j]}`);
      paintSigned(px.cells, DATA.comp[j]);
      const g = s('g', { class: 'term' }, [coef, px.g, lab]);
      strip.append(g);
      return { g, coef };
    });
    const more = s('text', { x: 84 + TERMS * 86 + 30, y: MY + 20, class: 'sum-t' }, '+ …');
    strip.append(more);

    const eq = h('div', { class: 'eq-line', 'aria-live': 'polite' });
    const note = h('p', { class: 'widget-note' });

    // errore medio delle dieci cifre con lo stesso k, come termine di paragone
    const digitErr = (k) => DATA.samples.reduce((acc, smp) => {
      const x = smp.map((v) => v / 16);
      return acc + sqErr(decode(encode(x, k)), x);
    }, 0) / DATA.samples.length;

    function draw() {
      const { k, x } = st;
      const code = encode(x, k);
      const rec = decode(code);
      const err = sqErr(rec, x);
      paint(inp.cells, x);
      paint(out.cells, rec);

      const bw = W_CODE / k, gap = bw > 4 ? Math.min(3, bw * 0.15) : 0;
      bars.forEach((r, j) => {
        if (j >= k) {
          r.style.opacity = 0;
          r.style.transform = `translate(${X_CODE + W_CODE}px, ${CY}px) scale(0.001, 0.001)`;
          return;
        }
        const v = Math.max(-1, Math.min(1, code[j] / DATA.hmax)) * HALF;
        r.style.opacity = 1;
        r.classList.toggle('neg', v < 0);
        r.style.transform = `translate(${X_CODE + j * bw + gap / 2}px, ${v >= 0 ? CY - v : CY}px) scale(${Math.max(bw - gap, 0.5)}, ${Math.max(Math.abs(v), 0.5)})`;
      });
      kFoot.textContent = `k = ${k}`;
      recErr.textContent = `errore ${fix(err)}`;

      terms.forEach((t, j) => {
        t.g.style.opacity = j < k ? 1 : 0.12;
        t.coef.textContent = j < k ? `${code[j] < 0 ? '−' : '+'}${fix(Math.abs(code[j]))}·` : '+0·';
      });
      more.style.opacity = k > TERMS ? 1 : 0;

      const kept = Math.round(DATA.cumvar[k - 1] * 100);
      katex.render(`\\|\\hat{x} - x\\|_2^2 = ${fix(err)}, \\qquad k = ${k} \\text{ su } D = ${D}, \\qquad \\text{varianza conservata: } ${kept}\\%`, eq, { throwOnError: false });

      if (k === D) note.textContent = 'Con k = D il codice è grande quanto l\'input: la ricostruzione è perfetta, ma l\'autoencoder non ha compresso niente.';
      else if (st.src === 'rumore') note.textContent = `Il rumore non somiglia a nessuna cifra del dataset: la ricostruzione resta lontana dall'input (errore ${fix(err)}, contro una media di ${fix(digitErr(k))} per le cifre con lo stesso k).`;
      else if (st.src === 'disegno') note.textContent = 'Il decoder può produrre solo l\'immagine media più una combinazione delle k feature: la ricostruzione è la proiezione del disegno su questo sottospazio, quindi tende a somigliare a una cifra.';
      else note.textContent = 'Il codice h dice quanto ciascuna delle k feature (le righe di W) è presente nell\'input. Il decoder parte dall\'immagine media c e somma le feature pesate da h.';
    }

    // ---- disegno sull'input: si colora o si cancella trascinando
    const hit = s('rect', { x: X_IN, y: Y_GRID, width: GRID, height: GRID, class: 'hit' });
    svg.append(hit);
    const toSvg = (e) => {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      return pt.matrixTransform(svg.getScreenCTM().inverse());
    };
    const cellAt = (p) => {
      const c = Math.floor((p.x - X_IN) / CELL), r = Math.floor((p.y - Y_GRID) / CELL);
      return c >= 0 && c < SIDE && r >= 0 && r < SIDE ? r * SIDE + c : -1;
    };
    // si colorano anche le celle tra due posizioni del puntatore, così un tratto veloce non lascia buchi
    let brush = null, last = null;
    const stroke = (p) => {
      const from = last ?? p;
      const n = Math.max(1, Math.ceil(Math.hypot(p.x - from.x, p.y - from.y) / (CELL / 3)));
      let changed = false;
      for (let t = 0; t <= n; t++) {
        const i = cellAt({ x: from.x + ((p.x - from.x) * t) / n, y: from.y + ((p.y - from.y) * t) / n });
        if (i >= 0 && st.x[i] !== brush) { st.x[i] = brush; changed = true; }
      }
      last = p;
      if (!changed) return;
      st.src = 'disegno';
      selectSrc();
      draw();
    };
    hit.addEventListener('pointerdown', (e) => {
      const p = toSvg(e), i = cellAt(p);
      if (i < 0) return;
      brush = st.x[i] > 0.5 ? 0 : 1;
      last = null;
      hit.setPointerCapture(e.pointerId);
      e.preventDefault();
      stroke(p);
    });
    hit.addEventListener('pointermove', (e) => { if (brush !== null) stroke(toSvg(e)); });
    const end = () => { brush = null; last = null; };
    hit.addEventListener('pointerup', end);
    hit.addEventListener('pointercancel', end);

    // ---- controlli
    const load = (src) => {
      st.src = src;
      if (src === 'rumore') st.x = Array.from({ length: D }, () => Math.random());
      else if (src === 'vuoto') { st.x = new Array(D).fill(0); st.src = 'disegno'; }
      else st.x = DATA.samples[src].map((v) => v / 16);
      selectSrc();
      draw();
    };
    const srcs = [...Array(10).keys(), 'rumore', 'vuoto'];
    const srcBtns = srcs.map((v) => h('button', { type: 'button', class: 'seg-btn', onclick: () => load(v) }, String(v)));
    const selectSrc = () => srcBtns.forEach((b, i) => b.classList.toggle('on', srcs[i] === st.src));
    const kOut = h('output', { class: 'sl-val' }, String(st.k));
    const controls = h('div', { class: 'controls' }, [
      h('div', { class: 'seg' }, srcBtns),
      h('label', { class: 'sl ae-k' }, [
        h('span', { class: 'sl-name' }, 'dimensione k'),
        h('input', {
          type: 'range', min: 1, max: D, step: 1, value: st.k, 'aria-label': 'dimensione del codice k',
          oninput: (e) => { st.k = Number(e.target.value); kOut.textContent = st.k; draw(); },
        }),
        kOut,
      ]),
    ]);
    const hint = h('p', { class: 'widget-note' }, 'Si può anche disegnare sull\'input: cliccando o trascinando si colorano (o si cancellano) i pixel. «vuoto» parte da un foglio bianco.');

    el.append(controls, svg, strip, eq, note, hint);
    selectSrc();
    draw();
  },
});
