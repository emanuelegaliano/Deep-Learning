import katex from 'katex';
import { defineWidget, h, s, svgRoot, fmt } from 'texweb/client';
import './style.css';

// triplet loss: ancora, positivo e negativo si trascinano; la discesa del gradiente
// avvicina P e allontana N finché la loss non si annulla

export default defineWidget({
  name: 'triplet',
  params: {
    alpha: { type: 'number', default: 0.5, min: 0, max: 3 },
    lr: { type: 'number', default: 0.08, min: 0.01, max: 0.4 },
  },

  mount(el, { alpha: a0, lr }) {
    el.classList.add('w-triplet');
    // posizioni iniziali: quelle della figura del PDF (caso 2)
    const START = { A: [0, 0], P: [1.4, -1.2], N: [0.6, 0.8] };
    const st = { ...structuredClone(START), alpha: a0 };

    const S = 110, X0 = -2, Y1 = 2.2, W = 4.6 * S, H = 4.2 * S;
    const px = ([x, y]) => [(x - X0) * S, (Y1 - y) * S];
    const unpx = (sx, sy) => [sx / S + X0, Y1 - sy / S];

    const svg = svgRoot(W, H, { 'aria-label': 'Ancora, positivo e negativo della triplet loss' });
    const ring = s('circle', { class: 'ring' });
    const lp = s('line', { class: 'dp' }), ln = s('line', { class: 'dn' });
    const node = (cls, text) => {
      const g = s('g', { class: `pt ${cls}` }, [s('circle', { r: 11 }), s('text', { class: 'pt-label', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, text)]);
      return g;
    };
    const nodes = { A: node('a', 'A'), P: node('p', 'P'), N: node('n', 'N') };
    svg.append(ring, lp, ln, nodes.A, nodes.P, nodes.N);

    const d2 = (u, v) => (u[0] - v[0]) ** 2 + (u[1] - v[1]) ** 2;
    const eq = h('div', { class: 'eq-line', 'aria-live': 'polite' });
    const note = h('p', { class: 'widget-note' });
    const r2 = (v) => Math.round(v * 100) / 100;
    const n2 = (v) => fmt(r2(v), 2).replace('−', '-');

    function draw() {
      const DP = d2(st.A, st.P), DN = d2(st.A, st.N);
      const loss = Math.max(0, DP - DN + st.alpha);
      for (const [k, g] of Object.entries(nodes)) {
        const [x, y] = px(st[k]);
        g.setAttribute('transform', `translate(${x},${y})`);
      }
      const [ax, ay] = px(st.A), [ppx, ppy] = px(st.P), [nx, ny] = px(st.N);
      lp.setAttribute('x1', ax); lp.setAttribute('y1', ay); lp.setAttribute('x2', ppx); lp.setAttribute('y2', ppy);
      ln.setAttribute('x1', ax); ln.setAttribute('y1', ay); ln.setAttribute('x2', nx); ln.setAttribute('y2', ny);
      // N deve stare fuori dal cerchio di raggio sqrt(D_P + alpha) attorno all'ancora
      ring.setAttribute('cx', ax); ring.setAttribute('cy', ay); ring.setAttribute('r', Math.sqrt(DP + st.alpha) * S);
      el.classList.toggle('solved', loss === 0);
      katex.render(`\\max(0,\\ D_P - D_N + \\alpha) = \\max(0,\\ ${n2(DP)} - ${n2(DN)} + ${n2(st.alpha)}) = ${n2(loss)}`, eq, { throwOnError: false });
      note.textContent = loss === 0
        ? 'Caso 1: il negativo è fuori dal cerchio, ovvero D_N ≥ D_P + α. La loss vale 0 e i pesi non cambiano: questa tripletta non serve più all\'apprendimento.'
        : 'Caso 2: il negativo è dentro il cerchio di raggio √(D_P + α). La loss è positiva, e il gradiente avvicina P all\'ancora e allontana N.';
      return loss;
    }

    // un passo di discesa del gradiente sulle posizioni di P e N (l'ancora resta ferma):
    // d/dP (D_P) = 2(P - A), d/dN (-D_N) = -2(N - A)
    function step() {
      const DP = d2(st.A, st.P), DN = d2(st.A, st.N);
      if (DP - DN + st.alpha <= 0) return false;
      for (let i = 0; i < 2; i++) {
        st.P[i] -= lr * 2 * (st.P[i] - st.A[i]);
        st.N[i] += lr * 2 * (st.N[i] - st.A[i]);
      }
      return draw() > 0;
    }

    let timer = null;
    const stop = () => { clearInterval(timer); timer = null; runBtn.textContent = '▶ ottimizza'; };
    const runBtn = h('button', { type: 'button', class: 'seg-btn', onclick: () => {
      if (timer) return stop();
      runBtn.textContent = '❚❚ pausa';
      timer = setInterval(() => { if (!step()) stop(); }, 180);
    } }, '▶ ottimizza');
    const controls = h('div', { class: 'controls' }, [
      h('div', { class: 'seg' }, [
        runBtn,
        h('button', { type: 'button', class: 'seg-btn', onclick: () => { stop(); step(); } }, 'un passo'),
        h('button', { type: 'button', class: 'seg-btn', onclick: () => { stop(); Object.assign(st, structuredClone(START)); draw(); } }, 'ricomincia'),
      ]),
      h('label', { class: 'sl triplet-alpha' }, [
        h('span', { class: 'sl-name' }, 'margine α'),
        h('input', { type: 'range', min: 0, max: 3, step: 0.05, value: st.alpha, 'aria-label': 'margine alpha',
          oninput: (e) => { st.alpha = Number(e.target.value); alphaOut.textContent = n2(st.alpha); draw(); } }),
      ]),
    ]);
    const alphaOut = h('output', { class: 'sl-val' }, n2(st.alpha));
    controls.lastChild.append(alphaOut);

    // trascinamento dei tre punti
    const toSvg = (e) => {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      const p = pt.matrixTransform(svg.getScreenCTM().inverse());
      return unpx(Math.max(0, Math.min(W, p.x)), Math.max(0, Math.min(H, p.y)));
    };
    for (const [k, g] of Object.entries(nodes)) {
      let drag = false;
      g.addEventListener('pointerdown', (e) => { stop(); drag = true; g.setPointerCapture(e.pointerId); e.preventDefault(); });
      g.addEventListener('pointermove', (e) => { if (drag) { st[k] = toSvg(e); draw(); } });
      g.addEventListener('pointerup', () => { drag = false; });
    }

    const hint = h('p', { class: 'widget-note' }, 'Trascina A, P e N, oppure premi «ottimizza» per vedere la discesa del gradiente.');
    el.append(controls, svg, eq, note, hint);
    draw();
  },
});
