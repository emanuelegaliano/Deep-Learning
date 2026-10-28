import katex from 'katex';
import { defineWidget, h, s, svgRoot, createPlayer, fmt } from 'texweb/client';
import './style.css';

// il softmax come rete: modello lineare, logit (esponenziale), normalizzazione e loss,
// un passo alla volta, sui numeri dell'esempio del capitolo

const r2 = (v) => Math.round(v * 100) / 100;
const num = (v, d = 2) => fmt(r2(v), d).replace('−', '-');

export default defineWidget({
  name: 'softmax',
  params: {
    x: { type: 'list', default: [0.2, 0.1] },
    theta: { type: 'matrix', default: [[-1, 1, 0], [1, 0.5, 1], [2, 1, 1.5]] },
    target: { type: 'integer', default: 0, min: 0 },
    interval: { type: 'number', default: 1700, min: 300 },
  },

  mount(el, { x: x0, theta, target, interval }) {
    el.classList.add('w-softmax');
    const K = theta.length;
    const x = [1, ...x0]; // la prima componente è il bias
    let z, e, sum, p;
    const forward = () => {
      z = theta.map((row) => row.reduce((acc, w, j) => acc + w * x[j], 0));
      e = z.map(Math.exp);
      sum = e.reduce((a, b) => a + b, 0);
      p = e.map((v) => v / sum);
    };
    forward();

    // ---- disegno: input, z, barre degli esponenziali e delle probabilità
    const rowY = (k, n) => 50 + k * 70 + ((K - n) * 70) / 2;
    const X_IN = 40, X_Z = 190, X_E = 270, X_P = 470, BAR_E = 150, BAR_P = 130;
    const height = Math.max(K, x.length) * 70 + 40;
    const svg = svgRoot(640, height, { 'aria-label': `Softmax con ${x.length - 1} feature e ${K} classi` });
    const head = (cx, text) => s('text', { x: cx, y: 18, class: 'head' }, text);
    svg.append(head(X_IN, 'input'), head(X_Z, 'zₖ'), head(X_E + BAR_E / 2, 'e^zₖ'), head(X_P + BAR_P / 2, 'pₖ'));

    const edges = s('g');
    svg.append(edges);
    const e1 = theta.map((row, k) => row.map((w, j) => {
      const line = s('line', {
        x1: X_IN + 18, y1: rowY(j, x.length), x2: X_Z - 18, y2: rowY(k, K),
        class: `edge ${w < 0 ? 'neg' : 'pos'}`, 'stroke-width': 0.8 + 1.6 * Math.abs(w),
      });
      if (w === 0) line.classList.add('zero');
      edges.append(line);
      return line;
    }));

    const node = (cx, cy, name) => {
      const val = s('text', { x: cx, y: cy, class: 'val' });
      const g = s('g', { class: 'node' }, [s('circle', { cx, cy, r: 18 }), val, s('text', { x: cx, y: cy + 31, class: 'name' }, name)]);
      svg.append(g);
      return { g, val };
    };
    const nIn = x.map((_, j) => node(X_IN, rowY(j, x.length), j === 0 ? 'x₀ = 1' : `x${'₀₁₂₃₄'[j]}`));
    const nZ = theta.map((_, k) => node(X_Z, rowY(k, K), `classe ${k}`));

    const bar = (x0b, y, max, cls) => {
      const track = s('rect', { x: x0b, y: y - 11, width: max, height: 22, class: 'track', rx: 3 });
      const fill = s('rect', { x: x0b, y: y - 11, width: max, height: 22, class: `fill ${cls}`, rx: 3 });
      const val = s('text', { x: x0b + max + 8, y, class: 'barval' });
      svg.append(track, fill, val);
      return { fill, val };
    };
    const bE = theta.map((_, k) => bar(X_E, rowY(k, K), BAR_E, 'exp'));
    const bP = theta.map((_, k) => bar(X_P, rowY(k, K), BAR_P, k === target ? 'p target' : 'p'));

    const eq = h('div', { class: 'eq-line', 'aria-live': 'polite' });
    const note = h('p', { class: 'widget-note' });

    const setBar = (b, frac, text) => {
      b.fill.style.transform = `scaleX(${Math.max(0, Math.min(1, frac))})`;
      b.val.textContent = text;
    };

    // ---- un passo: tutto dipende solo da n
    // 0 input, 1 modello lineare, 2 esponenziali, 3 normalizzazione, 4 loss
    function draw(n) {
      nIn.forEach((nd, j) => { nd.val.textContent = num(x[j]); });
      e1.flat().forEach((l) => l.classList.toggle('on', n === 1));
      nZ.forEach((nd, k) => {
        nd.val.textContent = n >= 1 ? num(z[k]) : '';
        nd.g.classList.toggle('on', n >= 1);
      });
      const maxE = Math.max(...e);
      bE.forEach((b, k) => setBar(b, n >= 2 ? e[k] / maxE : 0, n >= 2 ? num(e[k]) : ''));
      bP.forEach((b, k) => setBar(b, n >= 3 ? p[k] : 0, n >= 3 ? num(p[k]) : ''));
      bP.forEach((b, k) => b.fill.classList.toggle('lit', n >= 4 && k === target));

      const vec = (a) => `[${a.map((v) => num(v)).join(',\\ ')}]`;
      const tex = [
        `x = ${vec(x)}`,
        `z = \\vartheta^T x = ${vec(z)}`,
        `e^{z} = ${vec(e)}, \\qquad \\textstyle\\sum_j e^{z_j} = ${num(sum)}`,
        `p_k = \\frac{e^{z_k}}{\\sum_j e^{z_j}} = ${vec(p)}`,
        `L = -\\log p_{${target}} = -\\log(${num(p[target], 4)}) \\approx ${num(-Math.log(p[target]))}`,
      ][n];
      katex.render(tex, eq, { throwOnError: false });
      note.textContent = [
        'La prima componente dell\'input è il bias, sempre pari a 1.',
        'Ogni classe ha la sua riga di pesi: gli archi rossi sono i pesi negativi.',
        'L\'esponenziale rende tutto positivo e amplifica le differenze tra i punteggi.',
        'Dividendo per la somma si ottengono probabilità che sommano a 1.',
        `La loss guarda solo la probabilità della classe corretta (la ${target}): più è bassa, più la loss è alta.`,
      ][n];
    }

    const player = createPlayer({ steps: 5, onStep: draw, interval });

    // cursori sulle feature: si ricalcola tutto e si ridisegna il passo corrente
    const sliders = h('div', { class: 'sliders' }, x0.map((v, i) => {
      const out = h('output', { class: 'sl-val' }, num(v));
      const input = h('input', {
        type: 'range', min: -2, max: 2, step: 0.05, value: v, 'aria-label': `x${i + 1}`,
        oninput: (ev) => {
          x[i + 1] = Number(ev.target.value);
          out.textContent = num(x[i + 1]);
          forward();
          draw(player.index);
        },
      });
      return h('label', { class: 'sl' }, [h('span', { class: 'sl-name' }, `x${'₁₂₃₄'[i]}`), input, out]);
    }));

    el.append(sliders, svg, eq, note, player.el);
  },
});
