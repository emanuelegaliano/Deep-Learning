import { defineWidget, h, s, svgRoot } from 'texweb/client';
import './style.css';

// K-NN: il pattern da classificare si trascina, K si sceglie con un cursore,
// e si possono mostrare le regioni di decisione e aggiungere un outlier

// i punti della figura del PDF (coordinate TikZ)
const CLASS1 = [[2.6, 1.7], [2.45, 0.75], [3.0, 0.35], [1.6, 2.0]];
const CLASS2 = [[0.4, 1.6], [1.0, 1.3], [0.5, 0.6], [1.6, 0.7], [1.4, -0.1], [2.0, 0.2]];
const OUTLIER = [2.8, 1.2]; // un esempio della classe 2 in mezzo alla classe 1 (il "1 che sembra un 7")

export default defineWidget({
  name: 'knn',
  params: {
    k: { type: 'integer', default: 3, min: 1, max: 9 },
    query: { type: 'list', default: [3.0, 1.0] },
  },

  mount(el, { k: k0, query }) {
    el.classList.add('w-knn');
    const st = { k: k0, q: [...query], regions: false, outlier: false };

    // coordinate: x da -0.2 a 3.6, y da -0.5 a 2.4
    const S = 130, X0 = -0.2, Y1 = 2.4, Wd = 3.8, Ht = 2.9;
    const W = Wd * S, H = Ht * S;
    const px = ([x, y]) => [(x - X0) * S, (Y1 - y) * S];
    const unpx = (sx, sy) => [sx / S + X0, Y1 - sy / S];

    const svg = svgRoot(W, H, { 'aria-label': 'Classificazione K-NN con il pattern da classificare trascinabile' });
    const regionImg = s('image', { x: 0, y: 0, width: W, height: H, class: 'regions', preserveAspectRatio: 'none' });
    const links = s('g'), pts = s('g');
    const ring = s('circle', { class: 'ring' });
    const qNode = s('rect', { width: 16, height: 16, class: 'query', rx: 2 });
    svg.append(regionImg, ring, links, pts, qNode);

    const points = () => [
      ...CLASS1.map((p) => ({ p, c: 1 })),
      ...CLASS2.map((p) => ({ p, c: 2 })),
      ...(st.outlier ? [{ p: OUTLIER, c: 2, outlier: true }] : []),
    ];
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const classify = (q, k, all) => {
      const near = all.map((o) => ({ ...o, d: dist(o.p, q) })).sort((a, b) => a.d - b.d).slice(0, k);
      const v1 = near.filter((o) => o.c === 1).length;
      return { near, v1, v2: near.length - v1, cls: v1 > near.length - v1 ? 1 : v1 < near.length - v1 ? 2 : near[0].c };
    };

    const info = h('p', { class: 'widget-note', 'aria-live': 'polite' });

    function drawPoints() {
      pts.replaceChildren();
      for (const o of points()) {
        const [x, y] = px(o.p);
        if (o.c === 1) pts.append(s('circle', { cx: x, cy: y, r: 7, class: 'c1' }));
        else pts.append(s('path', { d: `M${x - 7},${y - 7} L${x + 7},${y + 7} M${x - 7},${y + 7} L${x + 7},${y - 7}`, class: `c2${o.outlier ? ' outlier' : ''}` }));
      }
    }

    // regioni di decisione: ogni pixel colorato con la classe che gli darebbe il K-NN
    function drawRegions() {
      if (!st.regions) { regionImg.removeAttribute('href'); return; }
      const cv = document.createElement('canvas');
      const step = 4;
      cv.width = Math.ceil(W / step); cv.height = Math.ceil(H / step);
      const ctx = cv.getContext('2d');
      const all = points();
      const css = getComputedStyle(el);
      const col = { 1: css.getPropertyValue('--accent-soft').trim() || '#2f7d84', 2: css.getPropertyValue('--obs').trim() || '#9c5a12' };
      for (let i = 0; i < cv.width; i++) for (let j = 0; j < cv.height; j++) {
        ctx.fillStyle = col[classify(unpx(i * step, j * step), st.k, all).cls];
        ctx.fillRect(i, j, 1, 1);
      }
      regionImg.setAttribute('href', cv.toDataURL());
    }

    function draw() {
      const res = classify(st.q, st.k, points());
      const [qx, qy] = px(st.q);
      qNode.setAttribute('x', qx - 8); qNode.setAttribute('y', qy - 8);
      qNode.setAttribute('class', `query cls-${res.cls}`);
      const r = res.near[res.near.length - 1].d * S;
      ring.setAttribute('cx', qx); ring.setAttribute('cy', qy); ring.setAttribute('r', r + 10);
      links.replaceChildren(...res.near.map((o) => {
        const [x, y] = px(o.p);
        return s('line', { x1: qx, y1: qy, x2: x, y2: y, class: `link c${o.c}` });
      }));
      info.textContent = `K = ${st.k}: tra i vicini, ${res.v1} della classe 1 e ${res.v2} della classe 2. Classe assegnata: ${res.cls}.`
        + (st.outlier && st.k === 1 && res.near[0].outlier ? ' Il vicino più vicino è proprio l\'outlier: con K = 1 il classificatore sbaglia.' : '');
    }

    // trascinamento del pattern da classificare
    const toSvg = (e) => {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      const p = pt.matrixTransform(svg.getScreenCTM().inverse());
      return unpx(Math.max(0, Math.min(W, p.x)), Math.max(0, Math.min(H, p.y)));
    };
    let dragging = false;
    qNode.addEventListener('pointerdown', (e) => { dragging = true; qNode.setPointerCapture(e.pointerId); e.preventDefault(); });
    qNode.addEventListener('pointermove', (e) => { if (dragging) { st.q = toSvg(e); draw(); } });
    qNode.addEventListener('pointerup', () => { dragging = false; });
    svg.addEventListener('click', (e) => { if (e.target !== qNode) { st.q = toSvg(e); draw(); } });

    const kOut = h('output', { class: 'sl-val' }, st.k);
    const controls = h('div', { class: 'controls' }, [
      h('label', { class: 'sl knn-k' }, [
        h('span', { class: 'sl-name' }, 'K'),
        h('input', { type: 'range', min: 1, max: 9, step: 1, value: st.k, 'aria-label': 'K',
          oninput: (e) => { st.k = Number(e.target.value); kOut.textContent = st.k; drawRegions(); draw(); } }),
        kOut,
      ]),
      h('label', { class: 'check' }, [h('input', { type: 'checkbox', onchange: (e) => { st.regions = e.target.checked; drawRegions(); } }), ' regioni di decisione']),
      h('label', { class: 'check' }, [h('input', { type: 'checkbox', onchange: (e) => { st.outlier = e.target.checked; drawPoints(); drawRegions(); draw(); } }), ' aggiungi un outlier']),
    ]);
    const hint = h('p', { class: 'widget-note' }, 'Trascina il quadrato grigio, oppure clicca in un punto qualsiasi per spostarlo.');

    el.append(controls, svg, info, hint);
    drawPoints();
    draw();
  },
});
