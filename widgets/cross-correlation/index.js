import katex from 'katex';
import { createPlayer, defineWidget, grid, h, label, s, svgRoot, windowRect } from 'texweb/client';
// cross-correlation simbolica (input 3x4, kernel 2x2) con l'opzione di ribaltare il kernel

const INPUT = [['a', 'b', 'c', 'd'], ['e', 'f', 'g', 'h'], ['i', 'j', 'k', 'l']];
const KERNEL = [['w', 'x'], ['y', 'z']];
const C = 44;

function crossCorrelation(root) {
  let flipped = false;
  let step = 0;

  const svg = svgRoot(430, 350, { 'aria-label': 'Un kernel 2×2 scorre su un input 3×4' });
  const inp = grid({ x: 10, y: 34, size: C, values: INPUT, cls: 'g-input sym' });
  svg.append(label(10 + 2 * C, 22, 'Input'), inp.g);

  // pedici: il peso che moltiplica ciascuna cella coperta
  const subs = INPUT.map((row, r) => row.map((_, c) =>
    s('text', { x: 10 + c * C + C - 5, y: 34 + r * C + C - 6, class: 'sub', 'text-anchor': 'end' })));
  subs.flat().forEach((t) => svg.append(t));

  const win = windowRect({ size: C, w: 2, h: 2, cls: 'win hot' });
  svg.append(s('g', { transform: 'translate(10,34)' }, win.g));

  // kernel: ogni cella è un gruppo che si può spostare, per animare il ribaltamento
  const kx = 270, ky = 34;
  svg.append(label(kx + C, 22, 'Kernel'));
  const kcells = KERNEL.map((row, r) => row.map((v, c) => {
    const g = s('g', { class: 'kcell-g' }, [
      s('rect', { width: C, height: C, class: 'cell k' }),
      s('text', { x: C / 2, y: C / 2, class: 'cell-text', 'font-size': 18 }, v),
    ]);
    g.style.transform = `translate(${kx + c * C}px, ${ky + r * C}px)`;
    svg.append(g);
    return g;
  }));
  const flipNote = s('text', { x: kx + C, y: ky + 2 * C + 22, class: 'label small', 'text-anchor': 'middle' }, '');
  svg.append(flipNote);

  // output 2x3: ogni cella contiene l'espressione su due righe
  const ox = 10, oy = 214, OWc = 132, OHc = 58, gap = 7;
  svg.append(label(ox, oy - 12, 'Output', 'label', 'start'));
  const outs = [];
  for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) {
    const x = ox + j * (OWc + gap), y = oy + i * (OHc + gap);
    const rect = s('rect', { x, y, width: OWc, height: OHc, class: 'cell out', rx: 3 });
    const t1 = s('text', { x: x + OWc / 2, y: y + 22, class: 'expr' });
    const t2 = s('text', { x: x + OWc / 2, y: y + 42, class: 'expr' });
    svg.append(rect, t1, t2);
    outs.push({ i, j, rect, t1, t2 });
  }

  const eq = h('div', { class: 'eq-line', 'aria-live': 'polite' });
  const toggle = h('div', { class: 'seg', role: 'group' }, [
    h('button', { type: 'button', class: 'seg-btn on', onclick: (e) => setFlip(false, e.target) }, 'Cross-correlation  h ⊗ F'),
    h('button', { type: 'button', class: 'seg-btn', onclick: (e) => setFlip(true, e.target) }, 'Convoluzione  h ∗ F'),
  ]);

  const k = (u, v) => (flipped ? KERNEL[1 - u][1 - v] : KERNEL[u][v]);
  const terms = (i, j) => [0, 1].map((u) => [0, 1].map((v) => `${INPUT[i + u][j + v]}${k(u, v)}`));

  function draw(n) {
    step = n;
    const i = Math.floor(n / 3), j = n % 3;
    win.move(j, i);
    subs.flat().forEach((t) => (t.textContent = ''));
    for (let u = 0; u < 2; u++) for (let v = 0; v < 2; v++) subs[i + u][j + v].textContent = k(u, v);
    outs.forEach((o, idx) => {
      const [r1, r2] = terms(o.i, o.j);
      const shown = idx <= n;
      o.t1.textContent = shown ? `${r1.join(' + ')} +` : '';
      o.t2.textContent = shown ? r2.join(' + ') : '';
      o.rect.classList.toggle('active', idx === n);
      o.rect.classList.toggle('done', shown);
    });
    const [r1, r2] = terms(i, j);
    const tex = [...r1, ...r2].map((t) => `${t[0]}\\,${t[1]}`).join(' + ');
    katex.render(`G[${i},${j}] = ${tex}`, eq, { throwOnError: false });
  }

  function setFlip(f, btn) {
    flipped = f;
    toggle.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('on', b === btn));
    KERNEL.forEach((row, r) => row.forEach((_, c) => {
      const [rr, cc] = f ? [1 - r, 1 - c] : [r, c];
      kcells[r][c].style.transform = `translate(${kx + cc * C}px, ${ky + rr * C}px)`;
    }));
    flipNote.textContent = f ? 'ribaltato di 180°' : '';
    draw(step);
  }

  const player = createPlayer({ steps: 6, onStep: draw, interval: 1300 });
  root.append(h('div', { class: 'controls' }, toggle), svg, eq, player.el);
}

export default defineWidget({
  name: 'cross-correlation',
  params: {},
  mount(el) {
    el.classList.add('w-cross-correlation');
    crossCorrelation(el);
  },
});
