import { defineWidget, h, s, svgRoot, createPlayer, fmt } from 'texweb/client';
import './style.css';

// dropout: a ogni passo di training una rete assottigliata diversa, poi al test
// tutti i neuroni attivi con i pesi moltiplicati per p

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default defineWidget({
  name: 'dropout',
  params: {
    p: { type: 'number', default: 0.5, min: 0.1, max: 1 },
    units: { type: 'integer', default: 5, min: 3, max: 8 },
    train: { type: 'integer', default: 4, min: 1, max: 10 },
    seed: { type: 'integer', default: 3 },
    interval: { type: 'number', default: 1600, min: 300 },
  },

  mount(el, { p: p0, units, train, seed, interval }) {
    el.classList.add('w-dropout');
    let p = p0;
    const LAYERS = 3; // input e due hidden layer, poi un neurone di output

    // la maschera del passo di training t: dipende solo da t, così si può tornare indietro
    const mask = (t) => {
      const rand = rng(seed * 1000 + t);
      return Array.from({ length: LAYERS }, () => {
        const m = Array.from({ length: units }, () => rand() < p);
        if (!m.some(Boolean)) m[Math.floor(rand() * units)] = true; // almeno un neurone acceso
        return m;
      });
    };

    const W = 460, H = 330, gapX = (W - 80) / (units - 1);
    const pos = (l, i) => [40 + i * gapX, H - 40 - l * 78];
    const OUT = [W / 2, 34];
    const svg = svgRoot(W, H, { 'aria-label': 'Rete con due hidden layer a cui si applica il dropout' });
    const edgesG = s('g'), nodesG = s('g');
    svg.append(edgesG, nodesG);

    const edges = [];
    for (let l = 0; l < LAYERS - 1; l++) for (let i = 0; i < units; i++) for (let j = 0; j < units; j++) {
      const [x1, y1] = pos(l, i), [x2, y2] = pos(l + 1, j);
      const line = s('line', { x1, y1, x2, y2, class: 'edge' });
      edgesG.append(line);
      edges.push({ line, from: [l, i], to: [l + 1, j] });
    }
    for (let i = 0; i < units; i++) {
      const [x1, y1] = pos(LAYERS - 1, i);
      const line = s('line', { x1, y1, x2: OUT[0], y2: OUT[1], class: 'edge' });
      edgesG.append(line);
      edges.push({ line, from: [LAYERS - 1, i], to: null });
    }

    const nodes = Array.from({ length: LAYERS }, (_, l) => Array.from({ length: units }, (_, i) => {
      const [cx, cy] = pos(l, i);
      const g = s('g', { class: 'unit' }, [
        s('circle', { cx, cy, r: 11 }),
        s('path', { d: `M${cx - 7},${cy - 7} L${cx + 7},${cy + 7} M${cx + 7},${cy - 7} L${cx - 7},${cy + 7}`, class: 'cross' }),
      ]);
      nodesG.append(g);
      return g;
    }));
    nodesG.append(s('circle', { cx: OUT[0], cy: OUT[1], r: 11, class: 'out' }));
    const names = ['input', 'hidden 1', 'hidden 2'];
    names.forEach((n, l) => svg.append(s('text', { x: 6, y: pos(l, 0)[1] - 18, class: 'layer' }, n)));
    const weightLabel = s('text', { x: W / 2, y: H - 8, class: 'wlabel' });
    svg.append(weightLabel);

    const status = h('p', { class: 'widget-note dropout-status', 'aria-live': 'polite' });

    // passi: 0 rete standard, 1..train passi di training, train+1 test
    function draw(n) {
      const test = n === train + 1;
      const m = n >= 1 && !test ? mask(n) : null;
      const on = (l, i) => !m || m[l][i];
      nodes.forEach((row, l) => row.forEach((g, i) => g.classList.toggle('off', !on(l, i))));
      edges.forEach(({ line, from, to }) => {
        const alive = on(...from) && (!to || on(...to));
        line.classList.toggle('off', !alive);
        line.classList.toggle('scaled', test);
      });
      el.classList.toggle('testing', test);
      weightLabel.textContent = test ? `test: tutti i neuroni attivi, pesi moltiplicati per p = ${fmt(p, 2)}` : '';
      if (n === 0) status.textContent = 'La rete standard: ogni neurone è collegato a tutti quelli del layer successivo.';
      else if (test) status.textContent = 'Al test non si spegne niente: per compensare, i pesi in uscita vengono moltiplicati per p, così l\'output atteso resta quello del training.';
      else {
        const off = m.flat().filter((x) => !x).length;
        status.textContent = `Passo di training ${n}: ${off} neuroni spenti, ognuno resta attivo con probabilità p = ${fmt(p, 2)}. A ogni passo la rete assottigliata è diversa.`;
      }
    }

    const player = createPlayer({ steps: train + 2, onStep: draw, interval });

    const out = h('output', { class: 'sl-val' }, fmt(p, 2));
    const slider = h('label', { class: 'sl' }, [
      h('span', { class: 'sl-name' }, 'p (attivo)'),
      h('input', {
        type: 'range', min: 0.1, max: 1, step: 0.05, value: p, 'aria-label': 'probabilità di restare attivo',
        oninput: (e) => { p = Number(e.target.value); out.textContent = fmt(p, 2); draw(player.index); },
      }),
      out,
    ]);

    el.append(h('div', { class: 'sliders' }, slider), svg, status, player.el);
  },
});
