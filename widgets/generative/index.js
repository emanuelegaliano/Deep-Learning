import katex from 'katex';
import { defineWidget, h, s, svgRoot } from 'texweb/client';
import './style.css';

// cosa compete per la massa di probabilità nei tre modelli, con lo spazio delle immagini
// ridotto a quattro immagini: le etichette di ogni immagine (discriminativo), tutte le immagini
// (generativo), tutte le immagini fissata un'etichetta (condizionato, ricavato con Bayes)

const IMAGES = ['gatto', 'cane', 'scimmia', 'rumore'];
const LABELS = ['gatto', 'cane', 'scimmia'];
const MODES = [
  { id: 'discriminativo', f: 'P(Y | X)' },
  { id: 'generativo', f: 'P(X)' },
  { id: 'condizionato', f: 'P(X | Y)' },
];

// geometria: stesse proporzioni della figura del PDF
const W = 620, H = 344, BASE = 236, HB = 180, TOP = BASE - HB;
const CX = [135, 265, 395, 525];
const BAR = 50, SUB = 24, PITCH = 29, THUMB = 64, BR_Y = TOP - 24;

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const normalize = (a) => {
  const t = a.reduce((x, y) => x + y, 0);
  return t > 0 ? a.map((v) => v / t) : a.map(() => 1 / a.length);
};

// arrotondamento a due cifre che conserva la somma (metodo dei resti maggiori):
// i valori mostrati sommano sempre a 1.00
function round2(a) {
  const sc = a.map((v) => v * 100);
  const fl = sc.map(Math.floor);
  let left = 100 - fl.reduce((x, y) => x + y, 0);
  sc.map((v, i) => [v - fl[i], i]).sort((p, q) => q[0] - p[0]).forEach(([, i]) => {
    if (left > 0) { fl[i]++; left--; }
  });
  return fl.map((v) => (v / 100).toFixed(2));
}

// la barra i va a v, le altre si riscalano in proporzione: la somma resta 1
function setProb(a, i, v) {
  v = clamp01(v);
  const rest = 1 - a[i];
  for (let j = 0; j < a.length; j++) {
    if (j !== i) a[j] = rest > 1e-9 ? (a[j] * (1 - v)) / rest : (1 - v) / (a.length - 1);
  }
  a[i] = v;
}

// ---- miniature, in un quadrato di lato 1 con l'asse y verso l'alto (come in TikZ)
const R = (x, y, w, hh, fill) => s('rect', { x, y, width: w, height: hh, fill });
const C = (cx, cy, r, fill) => s('circle', { cx, cy, r, fill });
const E = (cx, cy, rx, ry, fill) => s('ellipse', { cx, cy, rx, ry, fill });
const P = (pts, fill) => s('polygon', { points: pts.map((p) => p.join(',')).join(' '), fill });
const L = (x1, y1, x2, y2, stroke) => s('line', { x1, y1, x2, y2, stroke, 'stroke-width': 0.012 });

function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ICONS = {
  gatto: () => [
    R(0, 0.42, 1, 0.58, '#bcd9ec'), R(0, 0, 1, 0.42, '#6f9a3c'),
    P([[0.30, 0.60], [0.32, 0.86], [0.47, 0.70]], '#8c8c8c'),
    P([[0.70, 0.60], [0.68, 0.86], [0.53, 0.70]], '#8c8c8c'),
    C(0.5, 0.52, 0.22, '#b9b9b9'), E(0.5, 0.44, 0.11, 0.08, '#f4f4f4'),
    C(0.42, 0.56, 0.028, '#2b2b2b'), C(0.58, 0.56, 0.028, '#2b2b2b'),
    P([[0.47, 0.48], [0.53, 0.48], [0.5, 0.45]], '#e48a9a'),
    L(0.40, 0.45, 0.20, 0.48, '#f4f4f4'), L(0.40, 0.43, 0.20, 0.41, '#f4f4f4'),
    L(0.60, 0.45, 0.80, 0.48, '#f4f4f4'), L(0.60, 0.43, 0.80, 0.41, '#f4f4f4'),
  ],
  cane: () => [
    R(0, 0, 1, 1, '#7b4a24'),
    ...[[0.12, 0.85], [0.85, 0.15], [0.88, 0.80], [0.15, 0.18], [0.5, 0.92], [0.07, 0.5], [0.93, 0.48]]
      .map(([x, y], i) => C(x, y, 0.06, i % 2 ? '#d08a2e' : '#b5651d')),
    E(0.29, 0.52, 0.08, 0.17, '#c07a22'), E(0.71, 0.52, 0.08, 0.17, '#c07a22'),
    C(0.5, 0.56, 0.21, '#f2e3c4'), E(0.5, 0.43, 0.12, 0.09, '#ffffff'),
    E(0.5, 0.36, 0.045, 0.05, '#e07a8f'), E(0.5, 0.48, 0.045, 0.03, '#222222'),
    C(0.42, 0.61, 0.028, '#2b2b2b'), C(0.58, 0.61, 0.028, '#2b2b2b'),
  ],
  scimmia: () => [
    R(0, 0, 1, 1, '#77756f'), C(0.15, 0.8, 0.2, '#8a8882'), C(0.85, 0.25, 0.22, '#67655f'),
    C(0.27, 0.56, 0.07, '#9a6a3c'), C(0.73, 0.56, 0.07, '#9a6a3c'),
    C(0.27, 0.56, 0.04, '#d8a878'), C(0.73, 0.56, 0.04, '#d8a878'),
    C(0.5, 0.56, 0.22, '#9a6a3c'),
    C(0.43, 0.58, 0.085, '#d8a878'), C(0.57, 0.58, 0.085, '#d8a878'), E(0.5, 0.45, 0.13, 0.1, '#d8a878'),
    C(0.43, 0.58, 0.025, '#2b2b2b'), C(0.57, 0.58, 0.025, '#2b2b2b'),
    C(0.48, 0.47, 0.012, '#5a3a1f'), C(0.52, 0.47, 0.012, '#5a3a1f'), L(0.45, 0.41, 0.55, 0.41, '#5a3a1f'),
  ],
  rumore: () => {
    const rnd = mulberry32(11), out = [];
    for (let r = 0; r < 6; r++) {
      for (let q = 0; q < 6; q++) out.push(R(q / 6, r / 6, 1 / 6 + 0.002, 1 / 6 + 0.002, `hsl(${Math.floor(rnd() * 360)} 85% 55%)`));
    }
    return out;
  },
};

export default defineWidget({
  name: 'generative',
  params: {
    px: { type: 'list', default: [0.31, 0.43, 0.23, 0.03] },
    pyx: { type: 'matrix', default: [[0.85, 0.10, 0.05], [0.07, 0.90, 0.03], [0.10, 0.15, 0.75], [0.40, 0.25, 0.35]] },
    mode: { type: 'enum', values: MODES.map((m) => m.id), default: 'generativo' },
    y: { type: 'enum', values: LABELS, default: 'cane' },
  },

  mount(el, { px: px0, pyx: pyx0, mode, y }) {
    el.classList.add('w-gen');
    // una P(x) per ogni immagine e, per ogni immagine, una P(y | x) per ogni etichetta
    const init = () => ({
      px: normalize(IMAGES.map((_, i) => px0[i] ?? 0)),
      pyx: IMAGES.map((_, i) => normalize(LABELS.map((__, k) => pyx0[i]?.[k] ?? 0))),
    });
    const st = { ...init(), mode, y: LABELS.indexOf(y), focus: 3 };

    // condizionato con Bayes: P(x | y) = P(y | x) P(x) / P(y), con P(y) = sum_x P(y | x) P(x)
    const bayes = () => {
      const joint = st.px.map((p, i) => st.pyx[i][st.y] * p);
      const py = joint.reduce((a, b) => a + b, 0);
      return { pxy: joint.map((j) => (py > 0 ? j / py : 1 / joint.length)), py };
    };

    const uid = Math.random().toString(36).slice(2, 8);
    const svg = svgRoot(W, H, { 'aria-label': 'Distribuzioni di probabilità su quattro immagini: gatto, cane, scimmia e rumore' });
    svg.append(s('defs', {}, [s('clipPath', { id: `gen-clip-${uid}` }, [s('rect', { x: 0, y: 0, width: 1, height: 1 })])]));

    // griglia e asse
    const grid = s('g');
    for (const t of [0.25, 0.5, 0.75, 1]) {
      const yy = BASE - t * HB;
      grid.append(s('line', { x1: 60, x2: W - 20, y1: yy, y2: yy, class: 'gl' }));
      if (t === 0.5 || t === 1) grid.append(s('text', { x: 52, y: yy, class: 'tick' }, String(t)));
    }
    grid.append(s('text', { x: 52, y: BASE, class: 'tick' }, '0'));

    // parentesi sopra le barre: cosa deve sommare a 1
    const bracket = (x1, x2, text) => {
      const t = s('text', { x: (x1 + x2) / 2, y: BR_Y - 7, class: 'br-t' }, text);
      return [s('g', {}, [s('path', { d: `M${x1},${BR_Y + 6} V${BR_Y} H${x2} V${BR_Y + 6}`, class: 'br' }), t]), t];
    };
    const brDis = s('g', { class: 'brs dis' }, CX.map((c) => bracket(c - 42, c + 42, 'Σ = 1')[0]));
    const [brAllG, brAllT] = bracket(CX[0] - 42, CX[3] + 42, '');
    const brAll = s('g', { class: 'brs all' }, [brAllG]);

    // tre barre per immagine: nel discriminativo sono le tre etichette, negli altri due
    // modi si sovrappongono in una sola barra (si vede solo quella centrale)
    const barsG = s('g'), valsG = s('g'), hitsG = s('g');
    const bars = CX.map(() => [0, 1, 2].map((k) => {
      const r = s('rect', { x: 0, y: 0, width: 1, height: 1, class: `bar k${k}` });
      barsG.append(r);
      return r;
    }));
    const vals = CX.map(() => [0, 1, 2].map((k) => {
      const t = s('text', { x: 0, y: 0, class: `val k${k}` });
      valsG.append(t);
      return t;
    }));

    const thumbs = CX.map((c, i) => {
      const x0 = c - THUMB / 2, y0 = BASE + 12;
      const g = s('g', { class: 'thumb' }, [
        s('g', { transform: `translate(${x0},${y0 + THUMB}) scale(${THUMB},${-THUMB})`, 'clip-path': `url(#gen-clip-${uid})` }, ICONS[IMAGES[i]]()),
        s('rect', { x: x0, y: y0, width: THUMB, height: THUMB, rx: 3, class: 'frame' }),
        s('text', { x: c, y: y0 + THUMB + 17, class: 'name' }, IMAGES[i]),
      ]);
      g.addEventListener('click', () => { if (st.mode === 'discriminativo') { st.focus = i; draw(); } });
      return g;
    });

    svg.append(grid, brDis, brAll, barsG, valsG, s('line', { x1: 60, x2: W - 20, y1: BASE, y2: BASE, class: 'axis' }), ...thumbs, hitsG);

    const eq = h('div', { class: 'eq-line', 'aria-live': 'polite' });
    const note = h('p', { class: 'widget-note' });
    const hint = h('p', { class: 'widget-note' }, 'Trascina le barre in alto o in basso (oppure usa le frecce della tastiera): le altre si riscalano in modo che la somma resti 1.');

    // ---- trascinamento: in ogni modo si modifica la distribuzione che compete
    const toV = (e) => {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      const p = pt.matrixTransform(svg.getScreenCTM().inverse());
      return clamp01((BASE - p.y) / HB);
    };
    let hits = [];
    function buildHits() {
      hitsG.replaceChildren();
      hits = [];
      if (st.mode === 'condizionato') return;
      const dis = st.mode === 'discriminativo';
      CX.forEach((c, i) => (dis ? [0, 1, 2] : [null]).forEach((k) => {
        const x = dis ? c + (k - 1) * PITCH - PITCH / 2 : c - 40;
        const width = dis ? PITCH : 80;
        const arr = () => (dis ? st.pyx[i] : st.px);
        const idx = dis ? k : i;
        const set = (v) => { setProb(arr(), idx, v); if (dis) st.focus = i; draw(); };
        const r = s('rect', {
          x, y: TOP - 8, width, height: HB + 8, class: 'hit', tabindex: 0, role: 'slider',
          'aria-valuemin': 0, 'aria-valuemax': 1,
          'aria-label': dis ? `P(${LABELS[k]} | immagine ${IMAGES[i]})` : `P(immagine ${IMAGES[i]})`,
        });
        let drag = false;
        r.addEventListener('pointerdown', (e) => {
          drag = true; el.classList.add('live'); r.setPointerCapture(e.pointerId); e.preventDefault(); set(toV(e));
        });
        r.addEventListener('pointermove', (e) => { if (drag) set(toV(e)); });
        const end = () => { drag = false; el.classList.remove('live'); };
        r.addEventListener('pointerup', end);
        r.addEventListener('pointercancel', end);
        r.addEventListener('keydown', (e) => {
          const d = { ArrowUp: 0.01, ArrowRight: 0.01, ArrowDown: -0.01, ArrowLeft: -0.01, PageUp: 0.1, PageDown: -0.1 }[e.key];
          if (d === undefined && e.key !== 'Home' && e.key !== 'End') return;
          e.preventDefault();
          const v = e.key === 'Home' ? 0 : e.key === 'End' ? 1 : arr()[idx] + d;
          set(Math.round(v * 100) / 100);
        });
        r.addEventListener('focus', () => { if (dis && st.focus !== i) { st.focus = i; draw(); } });
        hits.push({ r, value: () => arr()[idx] });
        hitsG.append(r);
      }));
    }

    // ---- disegno: dipende solo dallo stato
    const tx = (name) => `\\text{${name}}`;
    function draw() {
      const m = st.mode, dis = m === 'discriminativo';
      MODES.forEach((md, j) => modeBtns[j].classList.toggle('on', md.id === m));
      LABELS.forEach((_, k) => labBtns[k].classList.toggle('on', st.y === k));
      el.classList.toggle('m-dis', dis);
      el.classList.toggle('m-gen', m === 'generativo');
      el.classList.toggle('m-con', m === 'condizionato');
      LABELS.forEach((_, k) => el.classList.toggle(`y${k}`, st.y === k));
      labSeg.hidden = m !== 'condizionato';
      legend.hidden = !dis;
      hint.hidden = m === 'condizionato';

      const { pxy, py } = bayes();
      const one = m === 'generativo' ? st.px : pxy;
      const oneR = round2(one);
      CX.forEach((c, i) => {
        const disR = round2(st.pyx[i]);
        [0, 1, 2].forEach((k) => {
          const x = dis ? c + (k - 1) * PITCH - SUB / 2 : c - BAR / 2;
          const w = dis ? SUB : BAR;
          const hh = (dis ? st.pyx[i][k] : one[i]) * HB;
          bars[i][k].style.transform = `translate(${x}px, ${BASE - hh}px) scale(${w}, ${Math.max(hh, 0.001)})`;
          vals[i][k].style.transform = `translate(${x + w / 2}px, ${BASE - hh - 6}px)`;
          vals[i][k].textContent = dis ? disR[k] : oneR[i];
        });
        thumbs[i].classList.toggle('sel', dis && st.focus === i);
      });
      brAllT.replaceChildren('Σ', s('tspan', { class: 'subx', dy: 4 }, 'x'), s('tspan', { dy: -4 }, m === 'generativo' ? ' P(x) = 1' : ` P(x | ${LABELS[st.y]}) = 1`));
      hits.forEach(({ r, value }) => {
        r.setAttribute('aria-valuenow', value().toFixed(2));
        r.setAttribute('aria-valuetext', value().toFixed(2));
      });

      const lab = tx(LABELS[st.y]);
      const tex = {
        discriminativo: `\\sum_{y} P(y \\mid x_{${tx(IMAGES[st.focus])}}) = ${round2(st.pyx[st.focus]).join(' + ')} = 1`,
        generativo: `\\sum_{x} P(x) = ${oneR.join(' + ')} = 1`,
        condizionato: `P(x \\mid ${lab}) = \\dfrac{P(${lab} \\mid x)\\,P(x)}{P(${lab})}, \\qquad P(${lab}) = \\sum_{x} P(${lab} \\mid x)\\,P(x) = ${py.toFixed(2)}`,
      }[m];
      katex.render(tex, eq, { throwOnError: false });

      const noise = Number(oneR[3]);
      const conNote = noise >= 0.15
        ? `Fissata Y = ${LABELS[st.y]}, il rumore ha probabilità ${noise.toFixed(2)}: con Bayes eredita la probabilità che gli assegna P(X).`
        : `Fissata Y = ${LABELS[st.y]}, competono di nuovo tutte le immagini.`;
      note.textContent = {
        discriminativo: 'Per ogni immagine competono le etichette: le tre barre di un\'immagine sommano a 1. Le immagini invece non competono tra loro, quindi anche il rumore deve ricevere un\'etichetta.',
        generativo: noise >= 0.15
          ? `Il rumore ha ora probabilità ${noise.toFixed(2)}: le tre immagini realistiche, insieme, scendono a ${(1 - noise).toFixed(2)}.`
          : 'Tutte le immagini competono per la stessa massa di probabilità: se una barra sale, le altre scendono.',
        condizionato: `${conNote} Queste barre non si trascinano: si ricavano con Bayes da P(Y | X) e P(X), quindi cambiano se si modificano le altre due viste.`,
      }[m];
    }

    // ---- controlli
    const setMode = (id) => { st.mode = id; buildHits(); draw(); };
    const modeBtns = MODES.map((md) => h('button', { type: 'button', class: 'seg-btn', onclick: () => setMode(md.id) },
      [md.id, h('span', { class: 'f' }, md.f)]));
    const labBtns = LABELS.map((l, k) => h('button', { type: 'button', class: 'seg-btn', onclick: () => { st.y = k; draw(); } },
      [h('span', { class: `sw k${k}` }), `Y = ${l}`]));
    const labSeg = h('div', { class: 'seg' }, labBtns);
    const legend = h('div', { class: 'legend' }, LABELS.map((l, k) => h('span', {}, [h('span', { class: `sw k${k}` }), l])));
    const reset = h('button', { type: 'button', class: 'seg-btn', onclick: () => { Object.assign(st, init()); draw(); } }, 'ripristina');
    const controls = h('div', { class: 'controls' }, [h('div', { class: 'seg' }, modeBtns), labSeg, legend, h('div', { class: 'seg' }, [reset])]);

    el.append(controls, svg, eq, note, hint);
    buildHits();
    draw();
  },
});
