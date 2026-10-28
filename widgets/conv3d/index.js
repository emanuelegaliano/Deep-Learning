import katex from 'katex';
import { createPlayer, defineWidget, fmt, grid, h, label, s, svgRoot, windowRect } from 'texweb/client';
// convoluzione 3D: input 7x7x3 (già con padding), due filtri 3x3x3, stride 2, output 3x3x2

const X = [
  [[0, 0, 0, 0, 0, 0, 0], [0, 2, 1, 2, 2, 1, 0], [0, 2, 2, 0, 0, 0, 0], [0, 0, 2, 2, 0, 1, 0], [0, 2, 0, 2, 0, 1, 0], [0, 2, 0, 1, 0, 2, 0], [0, 0, 0, 0, 0, 0, 0]],
  [[0, 0, 0, 0, 0, 0, 0], [0, 0, 2, 1, 1, 1, 0], [0, 1, 1, 1, 2, 2, 0], [0, 2, 2, 1, 1, 2, 0], [0, 1, 0, 2, 0, 2, 0], [0, 1, 0, 0, 1, 0, 0], [0, 0, 0, 0, 0, 0, 0]],
  [[0, 0, 0, 0, 0, 0, 0], [0, 0, 1, 2, 1, 2, 0], [0, 2, 2, 1, 1, 1, 0], [0, 0, 1, 1, 0, 2, 0], [0, 0, 0, 0, 2, 2, 0], [0, 2, 0, 2, 1, 1, 0], [0, 0, 0, 0, 0, 0, 0]],
];
const WS = [
  [[[-1, 0, 1], [0, -1, 0], [-1, 1, 1]], [[-1, 0, 1], [1, 1, 0], [-1, 1, 0]], [[-1, -1, 0], [1, 0, 0], [1, 1, 0]]],
  [[[0, 0, -1], [-1, 0, 0], [0, -1, -1]], [[-1, 0, 1], [0, 0, 0], [1, 0, 0]], [[0, 0, 0], [0, 0, 1], [1, -1, 0]]],
];
const B = [1, 0];
const STRIDE = 2;
const C = 24;

// contributo del canale c del filtro f nella posizione (i, j) dell'output
const partial = (f, c, i, j) => {
  let acc = 0;
  for (let u = 0; u < 3; u++) for (let v = 0; v < 3; v++) acc += WS[f][c][u][v] * X[c][STRIDE * i + u][STRIDE * j + v];
  return acc;
};
const outVal = (f, i, j) => [0, 1, 2].reduce((a, c) => a + partial(f, c, i, j), B[f]);

function conv3d(root) {
  let filter = 0;
  const rowH = 7 * C + 34;
  const svg = svgRoot(620, 3 * rowH + 30, { 'aria-label': 'Convoluzione 3D con due filtri e stride 2' });

  const ix = 10, fx = [222, 330], outX = 470;
  const wins = [], partLabels = [], fRects = [[], []];
  for (let c = 0; c < 3; c++) {
    const y = 22 + c * rowH;
    const g = grid({ x: ix, y, size: C, values: X[c], cls: 'g-input' });
    svg.append(label(ix, y - 8, `x[:, :, ${c}]`, 'label mono', 'start'), g.g);
    const w = windowRect({ size: C, w: 3, h: 3, cls: 'win blue' });
    svg.append(s('g', { transform: `translate(${ix},${y})` }, w.g));
    wins.push(w);
    // freccia e contributo del canale
    partLabels.push(s('text', { x: ix + 7 * C + 22, y: y + 3.5 * C, class: 'partial', 'text-anchor': 'middle' }));
    svg.append(partLabels[c]);
    for (let f = 0; f < 2; f++) {
      const kg = grid({ x: fx[f], y: y + 2 * C, size: C, values: WS[f][c], cls: 'g-kernel' });
      const frame = s('rect', { x: fx[f], y: y + 2 * C, width: 3 * C, height: 3 * C, class: 'win hot', rx: 3 });
      svg.append(label(fx[f], y + 2 * C - 8, `W${f}[:, :, ${c}]`, 'label mono', 'start'), kg.g, frame);
      fRects[f].push(frame);
    }
  }
  svg.append(
    label(fx[0], 3 * rowH + 14, `b₀ = ${B[0]}`, 'label mono', 'start'),
    label(fx[1], 3 * rowH + 14, `b₁ = ${B[1]}`, 'label mono', 'start'),
  );

  // output: una matrice per filtro
  const outs = [0, 1].map((f) => {
    const y = 22 + 2 * C + f * (rowH + 10);
    const g = grid({ x: outX, y, size: C + 8, rows: 3, cols: 3, cls: 'g-output' });
    svg.append(label(outX, y - 8, `o[:, :, ${f}]`, 'label mono', 'start'), g.g);
    return g;
  });

  const eq = h('div', { class: 'eq-line', 'aria-live': 'polite' });
  const toggle = h('div', { class: 'seg', role: 'group', 'aria-label': 'Filtro' }, [0, 1].map((f) =>
    h('button', {
      type: 'button', class: `seg-btn ${f === 0 ? 'on' : ''}`,
      onclick: (e) => {
        filter = f;
        toggle.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('on', b === e.target));
        player.go(0);
      },
    }, `Filtro W${f}`)));

  function draw(n) {
    const i = Math.floor(n / 3), j = n % 3;
    wins.forEach((w) => w.move(STRIDE * j, STRIDE * i));
    fRects.forEach((rs, f) => rs.forEach((r) => r.classList.toggle('off', f !== filter)));
    const parts = [0, 1, 2].map((c) => partial(filter, c, i, j));
    partLabels.forEach((t, c) => (t.textContent = `→ ${fmt(parts[c])}`));
    outs.forEach((g, f) => g.cells.flat().forEach((cell, idx) => {
      const shown = f < filter || (f === filter && idx <= n);
      const r = Math.floor(idx / 3), c = idx % 3;
      cell.text.textContent = shown ? fmt(outVal(f, r, c)) : '';
      cell.rect.classList.toggle('done', shown);
      cell.rect.classList.toggle('active', f === filter && idx === n);
    }));
    const ps = parts.map((v) => (v < 0 ? `(${v})` : v)).join(' + ');
    katex.render(`o[${i},${j},${filter}] = ${ps} + b_${filter} = ${ps} + ${B[filter]} = ${outVal(filter, i, j)}`, eq, { throwOnError: false });
  }

  const player = createPlayer({ steps: 9, onStep: draw, interval: 1400 });
  root.append(h('div', { class: 'controls' }, toggle), svg, eq, player.el);
}

export default defineWidget({
  name: 'conv3d',
  params: {},
  mount(el) {
    el.classList.add('w-conv3d');
    conv3d(el);
  },
});
