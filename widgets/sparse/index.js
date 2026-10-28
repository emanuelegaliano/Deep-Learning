import { defineWidget, h, s, svgRoot } from 'texweb/client';
import './style.css';
// sparse connections, receptive field nei layer profondi e parameter sharing, su vettori 1D

const N = 5;
const DX = 62, R = 17, X0 = 96;
const LAYERS = [{ name: 'x', y: 250 }, { name: 'h', y: 150 }, { name: 'g', y: 50 }];
const WEIGHT_COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)'];

function sparse(root) {
  const st = { fc: false, k: 3, sharing: false, sel: { l: 2, i: 2 } };
  const svg = svgRoot(X0 + N * DX - 20, 290, { 'aria-label': 'Tre layer di unità collegate da una convoluzione 1D' });
  const edgesG = s('g'), unitsG = s('g');
  svg.append(edgesG, unitsG);

  const units = LAYERS.map((L, l) => Array.from({ length: N }, (_, i) => {
    const cx = X0 + i * DX;
    const g = s('g', {
      class: 'unit', tabindex: 0, role: 'button', 'aria-label': `${L.name}${i + 1}`,
      onmouseenter: () => select(l, i), onclick: () => select(l, i), onfocus: () => select(l, i),
    }, [
      s('circle', { cx, cy: L.y, r: R }),
      s('text', { x: cx, y: L.y + 1, class: 'unit-text' }, [L.name, s('tspan', { 'baseline-shift': 'sub', 'font-size': 10 }, i + 1)]),
    ]);
    unitsG.append(g);
    return g;
  }));
  LAYERS.forEach((L) => svg.append(s('text', { x: 14, y: L.y + 4, class: 'label', style: { textAnchor: 'start' } }, L.name === 'x' ? 'input' : L.name === 'h' ? 'layer 1' : 'layer 2')));

  const connected = (i, j) => st.fc || Math.abs(i - j) <= (st.k - 1) / 2;

  // unità raggiunte partendo da (l, i), verso l'alto (dir = 1) o verso il basso (dir = -1)
  function reach(l, i, dir) {
    const on = LAYERS.map(() => new Set());
    on[l].add(i);
    for (let m = l; m + dir >= 0 && m + dir < LAYERS.length; m += dir) {
      for (const a of on[m]) for (let b = 0; b < N; b++) if (connected(a, b)) on[m + dir].add(b);
    }
    return on;
  }

  const info = h('p', { class: 'widget-note', 'aria-live': 'polite' });

  function draw() {
    const { l, i } = st.sel;
    const up = reach(l, i, 1), down = reach(l, i, -1);
    const lit = LAYERS.map((_, m) => new Set([...up[m], ...down[m]]));
    edgesG.replaceChildren();
    for (let m = 0; m < 2; m++) for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) {
      if (!connected(a, b)) continue;
      // un arco è acceso se sta su un cammino che passa per l'unità selezionata
      const onPath = (up[m].has(a) && up[m + 1].has(b)) || (down[m].has(a) && down[m + 1].has(b));
      let color = null;
      if (st.sharing) {
        color = st.fc
          ? `hsl(${((m * N * N + a * N + b) * 47) % 360} 55% 50%)`
          : WEIGHT_COLORS[b - a + (st.k - 1) / 2];
      }
      const line = s('line', {
        x1: X0 + a * DX, y1: LAYERS[m].y - R, x2: X0 + b * DX, y2: LAYERS[m + 1].y + R,
        class: `edge ${onPath ? 'on' : ''} ${st.sharing ? 'shared' : ''}`,
      });
      if (color) line.style.stroke = color;
      edgesG.append(line);
    }
    units.forEach((row, m) => row.forEach((u, j) => {
      u.classList.toggle('lit', lit[m].has(j));
      u.classList.toggle('sel', m === l && j === i);
    }));
    const name = `${LAYERS[l].name}${i + 1}`;
    const below = l > 0 ? down[0].size : 0;
    const above = l < 2 ? up[2].size : 0;
    const params = st.fc ? `${N * N} pesi per layer, tutti diversi` : `${st.k} pesi per layer, condivisi da tutte le posizioni`;
    info.textContent = (l === 0
      ? `L'input ${name} influenza ${up[1].size} unità del layer 1 e ${above} del layer 2.`
      : l === 2
        ? `Il receptive field di ${name} contiene ${down[1].size} unità del layer 1 e ${below} input.`
        : `${name} dipende da ${below} input e influenza ${above} unità del layer 2.`) + ` ${params}.`;
  }

  function select(l, i) { st.sel = { l, i }; draw(); }

  const seg = (opts, cur, onPick) => {
    const el = h('div', { class: 'seg', role: 'group' }, opts.map(([v, txt]) =>
      h('button', {
        type: 'button', class: `seg-btn ${v === cur ? 'on' : ''}`,
        onclick: (e) => { el.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('on', b === e.target)); onPick(v); },
      }, txt)));
    return el;
  };

  const kSeg = seg([[1, '1'], [3, '3'], [5, '5']], 3, (v) => { st.k = v; draw(); });
  root.append(
    h('div', { class: 'controls' }, [
      seg([[false, 'Convoluzione'], [true, 'Moltiplicazione matriciale']], false, (v) => { st.fc = v; kWrap.hidden = v; draw(); }),
      h('span', { class: 'kwrap' }, [h('span', { class: 'ctl-label' }, 'larghezza kernel'), kSeg]),
      h('label', { class: 'check' }, [
        h('input', { type: 'checkbox', onchange: (e) => { st.sharing = e.target.checked; draw(); } }),
        ' colora i pesi',
      ]),
    ]),
    svg, info,
  );
  const kWrap = root.querySelector('.kwrap');
  draw();
}

export default defineWidget({
  name: 'sparse',
  params: {},
  mount(el) {
    el.classList.add('w-sparse');
    sparse(el);
  },
});
