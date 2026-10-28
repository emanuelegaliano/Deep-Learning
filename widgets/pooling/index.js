import { createPlayer, defineWidget, fmt, grid, h, label, s, svgRoot } from 'texweb/client';
import './style.css';
// max pooling e average pooling 2x2 con stride 2, con il backward pass

const MAPS = {
  a: [[1, 0, 2, 3], [4, 6, 6, 8], [3, 1, 1, 0], [1, 2, 2, 4]],
  b: [[29, 15, 28, 184], [0, 100, 70, 38], [12, 12, 7, 2], [12, 12, 45, 6]],
};
const REGION_CLS = ['r0', 'r1', 'r2', 'r3'];
const C = 48;

function pooling(root) {
  const st = { map: 'a', mode: 'max', backward: false };
  const svg = svgRoot(470, 250, { 'aria-label': 'Pooling 2×2 con stride 2 su una feature map 4×4' });
  const ix = 10, iy = 34, ox = 330, oy = 34 + C;
  const inp = grid({ x: ix, y: iy, size: C, values: MAPS.a, cls: 'g-pool' });
  const out = grid({ x: ox, y: oy, size: C, rows: 2, cols: 2, cls: 'g-pool' });
  const inLabel = label(ix + 2 * C, 22, 'feature map 4×4');
  const outLabel = label(ox + C, oy - 12, 'output 2×2');
  const flyer = s('text', { class: 'flyer', 'font-size': 18 });
  const arrow = s('path', { d: `M ${ix + 4 * C + 22} ${iy + 2 * C} h 80`, class: 'arrow' });
  const arrowText = s('text', { x: ix + 4 * C + 62, y: iy + 2 * C - 10, class: 'label small', 'text-anchor': 'middle' });
  svg.append(inLabel, inp.g, outLabel, out.g, arrow, arrowText, flyer);
  inp.cells.forEach((row, r) => row.forEach((cell, c) => cell.rect.classList.add(REGION_CLS[Math.floor(r / 2) * 2 + Math.floor(c / 2)])));
  out.cells.forEach((row, r) => row.forEach((cell, c) => cell.rect.classList.add(REGION_CLS[r * 2 + c])));

  const eq = h('div', { class: 'eq-line mono', 'aria-live': 'polite' });
  const note = h('p', { class: 'widget-note' });

  const region = (k) => {
    const r0 = Math.floor(k / 2) * 2, c0 = (k % 2) * 2;
    return [[r0, c0], [r0, c0 + 1], [r0 + 1, c0], [r0 + 1, c0 + 1]];
  };
  const pool = (k) => {
    const vals = region(k).map(([r, c]) => MAPS[st.map][r][c]);
    if (st.mode === 'max') {
      const m = Math.max(...vals);
      return { v: m, arg: vals.indexOf(m), vals };
    }
    return { v: vals.reduce((a, b) => a + b, 0) / 4, arg: -1, vals };
  };

  function draw(k) {
    const M = MAPS[st.map];
    arrowText.textContent = st.backward ? '← gradiente' : st.mode === 'max' ? 'max' : 'media';
    inp.cells.forEach((row, r) => row.forEach((cell, c) => {
      cell.text.textContent = st.backward ? '' : fmt(M[r][c]);
      cell.rect.classList.remove('pick', 'cur', 'grad');
    }));
    out.cells.flat().forEach((cell) => cell.rect.classList.remove('cur'));

    if (!st.backward) {
      // forward: le regioni si riducono una alla volta
      out.cells.flat().forEach((cell, idx) => {
        cell.text.textContent = idx < k || (idx === k) ? fmt(Math.round(pool(idx).v * 100) / 100) : '';
      });
      const { v, arg, vals } = pool(k);
      const cells = region(k);
      cells.forEach(([r, c], n) => {
        inp.cells[r][c].rect.classList.add('cur');
        if (n === arg) inp.cells[r][c].rect.classList.add('pick');
      });
      out.cells[Math.floor(k / 2)][k % 2].rect.classList.add('cur');
      // il valore scelto "vola" verso l'output
      const [sr, sc] = st.mode === 'max' ? cells[arg] : [cells[0][0] + 0.5, cells[0][1] + 0.5];
      flyer.textContent = fmt(Math.round(v * 100) / 100);
      flyer.style.transition = 'none';
      flyer.style.opacity = 1;
      flyer.style.transform = `translate(${ix + sc * C + C / 2}px, ${iy + sr * C + C / 2}px)`;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        flyer.style.transition = '';
        flyer.style.transform = `translate(${ox + (k % 2) * C + C / 2}px, ${oy + Math.floor(k / 2) * C + C / 2}px)`;
        flyer.style.opacity = 0;
      }));
      eq.textContent = st.mode === 'max'
        ? `max(${vals.join(', ')}) = ${fmt(v)}`
        : `(${vals.join(' + ')}) / 4 = ${fmt(Math.round(v * 100) / 100)}`;
    } else {
      // backward: il gradiente g = 1 di ogni output torna indietro
      flyer.style.opacity = 0;
      out.cells.flat().forEach((cell, idx) => { cell.text.textContent = idx <= k ? 'g' : ''; });
      for (let idx = 0; idx <= k; idx++) {
        const { arg } = pool(idx);
        region(idx).forEach(([r, c], n) => {
          const t = inp.cells[r][c].text;
          if (st.mode === 'max') {
            t.textContent = n === arg ? 'g' : '0';
            if (n === arg) inp.cells[r][c].rect.classList.add('grad');
          } else {
            t.textContent = 'g/4';
            inp.cells[r][c].rect.classList.add('grad');
          }
          if (idx === k) inp.cells[r][c].rect.classList.add('cur');
        });
      }
      out.cells[Math.floor(k / 2)][k % 2].rect.classList.add('cur');
      eq.textContent = st.mode === 'max'
        ? 'Il gradiente passa solo alla cella che conteneva il massimo (lo switch salvato nel forward).'
        : 'Con la media ogni cella ha contribuito per 1/4, e riceve 1/4 del gradiente.';
    }
    note.textContent = st.map === 'b' && !st.backward
      ? 'In alto a sinistra il max pooling tiene solo il 100: l\'informazione sui valori piccoli va persa. In basso a sinistra i valori sono uguali e i due pooling coincidono.'
      : '';
  }

  const player = createPlayer({ steps: 4, onStep: draw, interval: 1300 });
  const seg = (opts, key) => {
    const el = h('div', { class: 'seg', role: 'group' }, opts.map(([v, txt]) =>
      h('button', {
        type: 'button', class: `seg-btn ${st[key] === v ? 'on' : ''}`,
        onclick: (e) => {
          st[key] = v;
          el.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('on', b === e.target));
          player.go(0);
        },
      }, txt)));
    return el;
  };
  root.append(
    h('div', { class: 'controls' }, [
      seg([['max', 'Max pooling'], ['avg', 'Average pooling']], 'mode'),
      seg([[false, 'Forward'], [true, 'Backward']], 'backward'),
      seg([['a', 'Esempio 1'], ['b', 'Esempio 2']], 'map'),
    ]),
    svg, eq, note, player.el,
  );
}

export default defineWidget({
  name: 'pooling',
  params: {},
  mount(el) {
    el.classList.add('w-pooling');
    pooling(el);
  },
});
