import katex from 'katex';
import { defineWidget, h, s, svgRoot, createPlayer, fmt } from 'texweb/client';
import './style.css';

// forward e backward pass su f(x, y, z) = (x + y) * z, un nodo alla volta, con i B-diagram del capitolo

const num = (v) => fmt(Math.round(v * 100) / 100, 2).replace('−', '-');

export default defineWidget({
  name: 'backprop-graph',
  params: {
    x: { type: 'number', default: -2 },
    y: { type: 'number', default: 5 },
    z: { type: 'number', default: -4 },
    interval: { type: 'number', default: 1700, min: 300 },
  },

  mount(el, { x: x0, y: y0, z: z0, interval }) {
    el.classList.add('w-backprop');
    const v = { x: x0, y: y0, z: z0 };

    const svg = svgRoot(620, 270, { 'aria-label': 'Grafo computazionale di f = (x + y) z con forward e backward pass' });

    // un B-diagram: a sinistra le derivate locali, a destra la primitiva
    const bnode = (cx, cy, op) => {
      const g = s('g', { class: 'bnode' }, [
        s('rect', { x: cx - 50, y: cy - 22, width: 100, height: 44, rx: 18, class: 'box' }),
        s('line', { x1: cx, y1: cy - 22, x2: cx, y2: cy + 22, class: 'sep' }),
        s('text', { x: cx + 25, y: cy, class: 'op' }, op),
      ]);
      const deriv = s('text', { x: cx - 25, y: cy, class: 'deriv' });
      g.append(deriv);
      svg.append(g);
      return { g, deriv, left: [cx - 50, cy], right: [cx + 50, cy] };
    };

    const IN = { x: [40, 40], y: [40, 135], z: [40, 225] };
    const plus = bnode(250, 90, '+');
    const mul = bnode(440, 165, '∗');
    const OUT = [590, 165];

    // un arco con il valore del forward sopra e quello del backward sotto
    const edge = ([x1, y1], [x2, y2], t = 0.5) => {
      const line = s('line', { x1, y1, x2, y2, class: 'edge' });
      const mx = x1 + (x2 - x1) * t, my = y1 + (y2 - y1) * t;
      const fwd = s('text', { x: mx, y: my - 9, class: 'fwd' });
      const bwd = s('text', { x: mx, y: my + 17, class: 'bwd' });
      svg.prepend(line);
      svg.append(fwd, bwd);
      return { line, fwd, bwd };
    };
    const E = {
      x: edge([IN.x[0] + 14, IN.x[1]], plus.left, 0.4),
      y: edge([IN.y[0] + 14, IN.y[1]], plus.left, 0.4),
      q: edge(plus.right, mul.left),
      z: edge([IN.z[0] + 14, IN.z[1]], mul.left, 0.35),
      f: edge(mul.right, OUT, 0.45),
    };
    for (const [k, [cx, cy]] of Object.entries(IN)) svg.append(s('text', { x: cx, y: cy, class: 'var' }, k));
    svg.append(s('text', { x: OUT[0] + 12, y: OUT[1], class: 'var' }, 'f'));

    const eq = h('div', { class: 'eq-line', 'aria-live': 'polite' });
    const note = h('p', { class: 'widget-note' });

    // 0 vuoto, 1 input, 2 nodo +, 3 nodo *, 4 gradiente iniziale, 5 nodo * all'indietro, 6 nodo + all'indietro, 7 risultato
    function draw(n) {
      const q = v.x + v.y, f = q * v.z;
      const dq = v.z, dz = q; // il mul gate scambia
      const show = (t, cond, val) => { t.textContent = cond ? num(val) : ''; };
      show(E.x.fwd, n >= 1, v.x); show(E.y.fwd, n >= 1, v.y); show(E.z.fwd, n >= 1, v.z);
      show(E.q.fwd, n >= 2, q); show(E.f.fwd, n >= 3, f);
      show(E.f.bwd, n >= 4, 1);
      show(E.q.bwd, n >= 5, dq); show(E.z.bwd, n >= 5, dz);
      show(E.x.bwd, n >= 6, dq); show(E.y.bwd, n >= 6, dq);
      plus.deriv.textContent = n >= 2 ? '1, 1' : '';
      mul.deriv.textContent = n >= 3 ? `${num(v.z)}, ${num(q)}` : '';
      plus.g.classList.toggle('active', n === 2 || n === 6);
      mul.g.classList.toggle('active', n === 3 || n === 5);
      el.classList.toggle('backward', n >= 4);
      E.x.line.classList.toggle('lit', n === 1 || n === 6 || n === 7);
      E.y.line.classList.toggle('lit', n === 1 || n === 6 || n === 7);
      E.z.line.classList.toggle('lit', n === 1 || n === 5 || n === 7);
      E.q.line.classList.toggle('lit', n === 2 || n === 5);
      E.f.line.classList.toggle('lit', n === 3 || n === 4);
      [E.x.bwd, E.y.bwd, E.z.bwd].forEach((t) => t.classList.toggle('result', n === 7));

      const tex = [
        'f(x, y, z) = (x + y)\\cdot z',
        `x = ${num(v.x)},\\quad y = ${num(v.y)},\\quad z = ${num(v.z)}`,
        `q = x + y = ${num(q)}, \\qquad \\frac{\\partial q}{\\partial x} = \\frac{\\partial q}{\\partial y} = 1`,
        `f = q \\cdot z = ${num(f)}, \\qquad \\frac{\\partial f}{\\partial q} = z = ${num(v.z)},\\quad \\frac{\\partial f}{\\partial z} = q = ${num(q)}`,
        '\\frac{\\partial f}{\\partial f} = 1',
        `\\frac{\\partial f}{\\partial q} = 1 \\cdot z = ${num(dq)}, \\qquad \\frac{\\partial f}{\\partial z} = 1 \\cdot q = ${num(dz)}`,
        `\\frac{\\partial f}{\\partial x} = \\frac{\\partial f}{\\partial q}\\cdot\\frac{\\partial q}{\\partial x} = ${num(dq)} \\cdot 1 = ${num(dq)}, \\qquad \\frac{\\partial f}{\\partial y} = ${num(dq)}`,
        `\\nabla f = \\Big[\\frac{\\partial f}{\\partial x},\\ \\frac{\\partial f}{\\partial y},\\ \\frac{\\partial f}{\\partial z}\\Big] = [${num(dq)},\\ ${num(dq)},\\ ${num(dz)}]`,
      ][n];
      katex.render(tex, eq, { throwOnError: false });
      note.textContent = [
        'Il grafo computazionale: un nodo per ogni operazione.',
        'Forward pass: i valori degli input scorrono sugli archi (sopra, in verde petrolio).',
        'Il nodo + calcola la primitiva e salva a sinistra le sue derivate rispetto agli input.',
        'Il nodo ∗ fa lo stesso: le derivate di un prodotto sono il valore dell\'altro input.',
        'Backward pass: si parte da 1 sull\'output, e i gradienti scorrono all\'indietro (sotto, in rosso).',
        'Il mul gate scambia: ogni input riceve il gradiente moltiplicato per il valore dell\'altro input.',
        'L\'add gate distribuisce: il gradiente passa invariato a entrambi gli input.',
        'I valori sotto gli archi degli input sono le derivate parziali di f.',
      ][n];
    }

    const player = createPlayer({ steps: 8, onStep: draw, interval });

    const sliders = h('div', { class: 'sliders' }, ['x', 'y', 'z'].map((k) => {
      const out = h('output', { class: 'sl-val' }, num(v[k]));
      return h('label', { class: 'sl' }, [
        h('span', { class: 'sl-name' }, k),
        h('input', { type: 'range', min: -6, max: 6, step: 1, value: v[k], 'aria-label': k,
          oninput: (e) => { v[k] = Number(e.target.value); out.textContent = num(v[k]); draw(player.index); } }),
        out,
      ]);
    }));

    el.append(sliders, svg, eq, note, player.el);
  },
});
