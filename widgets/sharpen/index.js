import katex from 'katex';
import { createPlayer, defineWidget, fmt, grid, h, label, s, shade, svgRoot, windowRect } from 'texweb/client';
// esempio dello sharpening: immagine 5x5 a due zone, kernel 3x3, output 3x3

const INPUT = [[2, 2, 2, 8, 8], [2, 2, 2, 8, 8], [2, 2, 2, 8, 8], [2, 2, 8, 8, 8], [2, 2, 8, 8, 8]];
const K = [[0, -1, 0], [-1, 5, -1], [0, -1, 0]];
const C = 40;

const conv = (i, j) => K.flat().reduce((acc, w, n) => acc + w * INPUT[i + Math.floor(n / 3)][j + (n % 3)], 0);

function sharpen(root) {
  const svg = svgRoot(540, 250, { 'aria-label': 'Il kernel di sharpening scorre su un\'immagine 5×5' });
  const inp = grid({ x: 10, y: 34, size: C, values: INPUT, cls: 'g-input' });
  inp.cells.forEach((row, r) => row.forEach((cell, c) => {
    const { fill, text } = shade(INPUT[r][c]);
    cell.rect.style.fill = fill; cell.text.style.fill = text;
  }));
  const subs = INPUT.map((row, r) => row.map((_, c) =>
    s('text', { x: 10 + c * C + C - 4, y: 34 + r * C + C - 5, class: 'sub', 'text-anchor': 'end' })));
  const win = windowRect({ size: C, w: 3, h: 3, cls: 'win hot' });

  const ker = grid({ x: 262, y: 74, size: C, values: K, cls: 'g-kernel' });
  const out = grid({ x: 418, y: 74, size: C, rows: 3, cols: 3, cls: 'g-output' });
  const owin = windowRect({ size: C, cls: 'win hot' });

  svg.append(
    label(10 + 2.5 * C, 22, 'Input'), inp.g, ...subs.flat(), s('g', { transform: 'translate(10,34)' }, win.g),
    s('text', { x: 236, y: 140, class: 'op' }, '⊗'),
    label(262 + 1.5 * C, 62, 'Kernel'), ker.g,
    s('text', { x: 394, y: 140, class: 'op' }, '='),
    label(418 + 1.5 * C, 62, 'Output'), out.g, s('g', { transform: 'translate(418,74)' }, owin.g),
  );

  const eq = h('div', { class: 'eq-line', 'aria-live': 'polite' });
  const note = h('p', { class: 'widget-note' });

  function draw(n) {
    const i = Math.floor(n / 3), j = n % 3;
    win.move(j, i);
    owin.move(j, i);
    subs.flat().forEach((t) => (t.textContent = ''));
    for (let u = 0; u < 3; u++) for (let v = 0; v < 3; v++) {
      if (K[u][v] !== 0) subs[i + u][j + v].textContent = `·${fmt(K[u][v])}`;
    }
    out.cells.flat().forEach((cell, idx) => {
      const r = Math.floor(idx / 3), c = idx % 3;
      if (idx <= n) {
        const v = conv(r, c);
        const { fill, text } = shade(v);
        cell.rect.style.fill = fill; cell.text.style.fill = text;
        cell.text.textContent = fmt(v);
      } else {
        cell.rect.style.fill = ''; cell.text.textContent = '';
      }
    });
    const c = INPUT[i + 1][j + 1];
    const nb = [INPUT[i][j + 1], INPUT[i + 1][j], INPUT[i + 1][j + 2], INPUT[i + 2][j + 1]];
    katex.render(`G[${i},${j}] = 5 \\cdot ${c} - (${nb.join(' + ')}) = ${conv(i, j)}`, eq, { throwOnError: false });
    const v = conv(i, j);
    note.textContent = v === c
      ? 'Zona uniforme: il kernel restituisce il valore del pixel centrale.'
      : v < c
        ? 'Lato chiaro del bordo: il valore scende sotto quello dell\'input.'
        : 'Lato scuro del bordo: il valore sale sopra quello dell\'input.';
  }

  const player = createPlayer({ steps: 9, onStep: draw, interval: 1200 });
  root.append(svg, eq, note, player.el);
}

export default defineWidget({
  name: 'sharpen',
  params: {},
  mount(el) {
    el.classList.add('w-sharpen');
    sharpen(el);
  },
});
