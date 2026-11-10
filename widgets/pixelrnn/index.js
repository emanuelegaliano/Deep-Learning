import katex from 'katex';
import { createPlayer, defineWidget, h, s, svgRoot } from 'texweb/client';
import './style.css';

// PixelRNN: lo stato h_{i,j} dipende da quello a sinistra e da quello sopra, quindi gli stati
// sulla stessa antidiagonale (stesso passo t = i + j - 1) si calcolano insieme, in 2N - 1 passi.
// Cliccando su un pixel si evidenziano i pixel da cui dipende (tutti quelli sopra e a sinistra).

// griglia (gx, gy, lato g) e grafico a barre (cx0..cx1, cy0..cy1): affiancati,
// oppure uno sotto l'altro quando il widget è stretto (ad esempio su un telefono)
const LAYOUT = {
  wide: { w: 620, h: 330, gx: 16, gy: 16, g: 298, cx0: 372, cx1: 604, cy0: 70, cy1: 268 },
  narrow: { w: 330, h: 600, gx: 16, gy: 16, g: 298, cx0: 28, cx1: 312, cy0: 392, cy1: 548 },
};
const NARROW = 520;

const passo = (i, j) => i + j - 1;                  // i, j vanno da 1 a N
const quanti = (t, n) => (t <= n ? t : 2 * n - t);  // stati calcolati al passo t

export default defineWidget({
  name: 'pixelrnn',
  params: {
    n: { type: 'integer', default: 5, min: 3, max: 10 },
    step: { type: 'integer', default: 5, min: 1, max: 19 },
  },

  mount(el, { n: n0, step: step0 }) {
    el.classList.add('w-prnn');
    const pick = () => (el.clientWidth > 0 && el.clientWidth < NARROW ? 'narrow' : 'wide');
    const st = { n: n0, t: 1, sel: null, layout: pick() };

    const svg = svgRoot(LAYOUT.wide.w, LAYOUT.wide.h, { 'aria-label': 'Ordine di calcolo degli stati della PixelRNN su una griglia di pixel' });
    const gGrid = s('g');
    const gChart = s('g');
    svg.append(gGrid, gChart);
    const eq = h('div', { class: 'eq-line', 'aria-live': 'polite' });
    const note = h('p', { class: 'widget-note' });

    let nodes = [], edges = [], bars = [], region = null;

    // ---- griglia degli stati e grafico, ricostruiti quando cambia N
    function build() {
      gGrid.replaceChildren();
      gChart.replaceChildren();
      const L = LAYOUT[st.layout];
      svg.setAttribute('viewBox', `0 0 ${L.w} ${L.h}`);
      svg.style.maxWidth = `${Math.round(L.w * 1.4)}px`;
      const n = st.n, d = L.g / n, r = Math.min(17, d * 0.33);
      const cx = (j) => L.gx + d * (j - 0.5), cy = (i) => L.gy + d * (i - 0.5);

      region = s('rect', { class: 'region', rx: 8 });
      gGrid.append(region);

      // archi verso destra e verso il basso: chi riceve la freccia dipende da chi la manda
      edges = [];
      const a = Math.max(3, Math.min(6, (d - 2 * r) * 0.35));
      for (let i = 1; i <= n; i++) for (let j = 1; j <= n; j++) {
        for (const [di, dj] of [[0, 1], [1, 0]]) {
          const i2 = i + di, j2 = j + dj;
          if (i2 > n || j2 > n) continue;
          const x1 = cx(j) + dj * (r + 2), y1 = cy(i) + di * (r + 2);
          const x2 = cx(j2) - dj * (r + 2), y2 = cy(i2) - di * (r + 2);
          const head = dj
            ? `M ${x2} ${y2} l ${-a} ${-a * 0.6} v ${a * 1.2} z`
            : `M ${x2} ${y2} l ${-a * 0.6} ${-a} h ${a * 1.2} z`;
          const g = s('g', { class: 'edge' }, [
            s('line', { x1, y1, x2: x2 - dj * a * 0.8, y2: y2 - di * a * 0.8 }),
            s('path', { d: head }),
          ]);
          edges.push({ g, to: [i2, j2] });
          gGrid.append(g);
        }
      }

      nodes = [];
      const fs = Math.min(13, d * 0.36);
      for (let i = 1; i <= n; i++) for (let j = 1; j <= n; j++) {
        const g = s('g', { class: 'node', onclick: (e) => { e.stopPropagation(); select(i, j); } }, [
          s('circle', { cx: cx(j), cy: cy(i), r }),
          s('text', { x: cx(j), y: cy(i), 'font-size': fs }, String(passo(i, j))),
        ]);
        nodes.push({ g, i, j });
        gGrid.append(g);
      }

      // quanti stati si calcolano insieme a ogni passo: 1, 2, ..., N, ..., 2, 1
      const T = 2 * n - 1, bw = (L.cx1 - L.cx0) / T;
      bars = [];
      gChart.append(
        s('text', { class: 'label', x: (L.cx0 + L.cx1) / 2, y: L.cy0 - 40 }, 'stati calcolati insieme'),
        s('line', { class: 'axis', x1: L.cx0, y1: L.cy1, x2: L.cx1, y2: L.cy1 }),
        s('text', { class: 'label small', x: (L.cx0 + L.cx1) / 2, y: L.cy1 + 36 }, 'passo t'),
      );
      for (let t = 1; t <= T; t++) {
        const m = quanti(t, n), hgt = (m / n) * (L.cy1 - L.cy0);
        const x = L.cx0 + bw * (t - 1) + bw * 0.15, mid = x + bw * 0.35;
        const g = s('g', { class: 'bar' }, [
          s('rect', { x, y: L.cy1 - hgt, width: bw * 0.7, height: hgt, rx: 2 }),
          s('text', { class: 'bar-val', x: mid, y: L.cy1 - hgt - 6 }, String(m)),
          n <= 6 || t % 2 === 1 ? s('text', { class: 'label small', x: mid, y: L.cy1 + 16 }, String(t)) : null,
        ]);
        bars.push(g);
        gChart.append(g);
      }
    }

    // ---- stato del passo t ed eventuale pixel selezionato
    function draw() {
      const { n, t, sel } = st, T = 2 * n - 1;
      const isSel = (i, j) => sel && i === sel[0] && j === sel[1];
      nodes.forEach(({ g, i, j }) => {
        const p = passo(i, j);
        g.classList.toggle('done', p < t);
        g.classList.toggle('cur', p === t);
        g.classList.toggle('todo', p > t);
        g.classList.toggle('dep', !!sel && i <= sel[0] && j <= sel[1] && !isSel(i, j));
        g.classList.toggle('sel', !!isSel(i, j));
      });
      edges.forEach(({ g, to }) => {
        g.classList.toggle('cur', passo(...to) === t);
        g.classList.toggle('direct', !!isSel(...to));
      });
      bars.forEach((g, k) => {
        g.classList.toggle('done', k + 1 < t);
        g.classList.toggle('cur', k + 1 === t);
      });

      if (sel) {
        const L = LAYOUT[st.layout], d = L.g / n;
        Object.entries({ x: L.gx + 2, y: L.gy + 2, width: d * sel[1] - 4, height: d * sel[0] - 4 })
          .forEach(([k, v]) => region.setAttribute(k, v));
      }
      region.classList.toggle('on', !!sel);

      katex.render(`t = i + j - 1 = ${t}, \\qquad 2N - 1 = ${T} \\text{ passi, contro } N^2 = ${n * n}`, eq, { throwOnError: false });

      if (sel) {
        const [i, j] = sel, p = passo(i, j), k = i * j - 1;
        const diretti = i === 1 ? 'da quello a sinistra' : j === 1 ? 'da quello sopra' : 'da quello a sinistra e da quello sopra';
        if (p === 1) note.textContent = 'Il primo pixel non dipende da nessun altro: il suo stato si calcola al passo 1.';
        else if (k === 1) note.textContent = `Lo stato del pixel (${i}, ${j}) si calcola al passo ${p}, e dipende solo ${diretti}.`;
        else note.textContent = `Lo stato del pixel (${i}, ${j}) si calcola al passo ${p}. Dipende direttamente ${diretti}, e quindi implicitamente dagli altri ${k} pixel evidenziati.`;
      } else if (t === 1) note.textContent = 'Al passo 1 si calcola solo lo stato del primo pixel, in alto a sinistra.';
      else if (t === T) note.textContent = `All'ultimo passo si calcola lo stato dell'ultimo pixel. In totale servono ${T} passi: calcolando un pixel alla volta ne servirebbero ${n * n}.`;
      else note.textContent = `Al passo ${t} si calcolano insieme ${quanti(t, n)} stati, ovvero quelli con i + j − 1 = ${t}: ognuno dipende solo da stati del passo ${t - 1}, già calcolati.`;
    }

    // ---- interazione
    function select(i, j) {
      st.sel = st.sel && st.sel[0] === i && st.sel[1] === j ? null : [i, j];
      if (st.sel) player.pause();
      draw();
    }
    svg.addEventListener('click', () => { if (st.sel) { st.sel = null; draw(); } });
    new ResizeObserver(() => {
      const l = pick();
      if (l !== st.layout) { st.layout = l; build(); draw(); }
    }).observe(el);

    build();
    const player = createPlayer({ steps: 2 * st.n - 1, onStep: (k) => { st.t = k + 1; draw(); }, interval: 1000 });
    player.go(Math.min(step0, 2 * st.n - 1) - 1);

    const nOut = h('output', { class: 'sl-val' }, String(st.n));
    const controls = h('div', { class: 'controls' }, [
      h('label', { class: 'sl prnn-n' }, [
        h('span', { class: 'sl-name' }, 'dimensione N'),
        h('input', {
          type: 'range', min: 3, max: 10, step: 1, value: st.n, 'aria-label': 'lato N dell\'immagine',
          oninput: (e) => {
            st.n = Number(e.target.value);
            nOut.textContent = st.n;
            st.sel = null;
            build();
            player.setSteps(2 * st.n - 1, { keep: true });
          },
        }),
        nOut,
      ]),
    ]);
    const hint = h('p', { class: 'widget-note' }, 'Cliccando su un pixel si vedono i pixel da cui dipende il suo stato.');

    el.append(controls, svg, eq, note, player.el, hint);
  },
});
