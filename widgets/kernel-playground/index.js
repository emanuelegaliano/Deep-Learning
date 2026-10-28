import { defineWidget, fmt, h } from 'texweb/client';
import dogUrl from '../../images/cnn-dog-input.png';
import './style.css';
// figura del cane: un kernel applicato a una vera immagine, con lente sui singoli pixel

const KERNELS = {
  diff: { name: '[1, −1]', k: [[1, -1]] },
  sharpen: { name: 'Sharpening', k: [[0, -1, 0], [-1, 5, -1], [0, -1, 0]] },
  blur: { name: 'Media 3×3', k: [[1, 1, 1], [1, 1, 1], [1, 1, 1]], scale: 1 / 9 },
  sobelx: { name: 'Sobel x', k: [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]] },
  sobely: { name: 'Sobel y', k: [[-1, -2, -1], [0, 0, 0], [1, 2, 1]] },
  laplace: { name: 'Laplaciano', k: [[0, 1, 0], [1, -4, 1], [0, 1, 0]] },
  id: { name: 'Identità', k: [[0, 0, 0], [0, 1, 0], [0, 0, 0]] },
};

function kernelPlayground(root, { image, initial = 'diff' }) {
  let current = initial;
  let kernel = KERNELS[current].k.map((r) => [...r]);
  let scale = KERNELS[current].scale ?? 1;
  let gray = null; // Float32Array dei valori in [0, 255]
  let W = 0, H = 0;
  let out = null, OW = 0, OH = 0;
  let probe = null; // {x, y} in coordinate dell'output

  const inCanvas = h('canvas', { class: 'pix', 'aria-label': 'Immagine in input' });
  const outCanvas = h('canvas', { class: 'pix', 'aria-label': 'Immagine in output' });
  const inOverlay = h('canvas', { class: 'pix-overlay' });
  const outOverlay = h('canvas', { class: 'pix-overlay' });
  const inSize = h('span', { class: 'dim' });
  const outSize = h('span', { class: 'dim' });
  const kernelBox = h('div', { class: 'kernel-edit' });
  const lens = h('div', { class: 'lens' }, h('p', { class: 'hint' }, 'Passa il mouse (o il dito) su una delle due immagini per vedere il calcolo in quel punto.'));

  const presets = h('div', { class: 'seg', role: 'group', 'aria-label': 'Kernel' },
    Object.entries(KERNELS).map(([key, { name }]) =>
      h('button', {
        type: 'button', class: 'seg-btn', 'data-key': key,
        onclick: () => { current = key; kernel = KERNELS[key].k.map((r) => [...r]); scale = KERNELS[key].scale ?? 1; buildKernelEditor(); run(); },
      }, name)));

  root.append(
    h('div', { class: 'controls' }, [h('span', { class: 'ctl-label' }, 'Kernel'), presets]),
    h('div', { class: 'kp-layout' }, [
      h('figure', { class: 'kp-pane' }, [h('div', { class: 'pix-wrap' }, [inCanvas, inOverlay]), h('figcaption', {}, ['Input ', inSize])]),
      h('div', { class: 'kp-mid' }, [h('div', { class: 'ctl-label' }, 'Kernel (modificabile)'), kernelBox]),
      h('figure', { class: 'kp-pane' }, [h('div', { class: 'pix-wrap' }, [outCanvas, outOverlay]), h('figcaption', {}, ['Output ', outSize])]),
    ]),
    lens,
  );

  function buildKernelEditor() {
    presets.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('on', b.dataset.key === current));
    kernelBox.replaceChildren();
    kernelBox.style.gridTemplateColumns = `repeat(${kernel[0].length}, 2.6rem)`;
    kernel.forEach((row, r) => row.forEach((v, c) => {
      const inp = h('input', {
        type: 'number', step: '1', value: v, class: 'kcell', 'aria-label': `peso riga ${r} colonna ${c}`,
        oninput: (e) => { kernel[r][c] = Number(e.target.value) || 0; run(); },
      });
      kernelBox.append(inp);
    }));
    if (scale !== 1) kernelBox.append(h('div', { class: 'kscale' }, `× 1/${Math.round(1 / scale)}`));
  }

  function run() {
    if (!gray) return;
    const kh = kernel.length, kw = kernel[0].length;
    OW = W - kw + 1; OH = H - kh + 1;
    out = new Float32Array(OW * OH);
    for (let y = 0; y < OH; y++) {
      for (let x = 0; x < OW; x++) {
        let acc = 0;
        for (let u = 0; u < kh; u++) for (let v = 0; v < kw; v++) acc += kernel[u][v] * gray[(y + u) * W + x + v];
        out[y * OW + x] = acc * scale;
      }
    }
    // kernel a somma nulla (rilevatori di bordi): lo 0 diventa grigio, come nella figura del libro
    const sum = kernel.flat().reduce((a, b) => a + b, 0) * scale;
    const pos = kernel.flat().filter((v) => v > 0).reduce((a, b) => a + b, 0) * scale || 1;
    const signed = Math.abs(sum) < 1e-9;
    outCanvas.width = outOverlay.width = OW;
    outCanvas.height = outOverlay.height = OH;
    const ctx = outCanvas.getContext('2d');
    const img = ctx.createImageData(OW, OH);
    for (let i = 0; i < out.length; i++) {
      const g = signed ? 128 + out[i] / pos : out[i];
      const c = Math.max(0, Math.min(255, g));
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = c;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    inSize.textContent = `${W}×${H}`;
    outSize.textContent = `${OW}×${OH}`;
    drawProbe();
  }

  function drawProbe() {
    const kh = kernel.length, kw = kernel[0].length;
    for (const cv of [inOverlay, outOverlay]) cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
    if (!probe) return;
    const { x, y } = probe;
    const red = getComputedStyle(root).getPropertyValue('--hot').trim() || '#c0392b';
    const ci = inOverlay.getContext('2d');
    ci.strokeStyle = red; ci.lineWidth = 2;
    ci.strokeRect(x - 0.5, y - 0.5, kw + 1, kh + 1);
    ci.strokeRect(x - 6, y - 6, kw + 12, kh + 12);
    const co = outOverlay.getContext('2d');
    co.strokeStyle = red; co.lineWidth = 2;
    co.strokeRect(x - 1, y - 1, 3, 3);
    co.strokeRect(x - 6, y - 6, 13, 13);

    // lente: valori dei pixel coperti, pesi e risultato
    const terms = [];
    const cells = [];
    for (let u = 0; u < kh; u++) for (let v = 0; v < kw; v++) {
      const p = Math.round(gray[(y + u) * W + x + v]);
      const w = kernel[u][v];
      cells.push(h('div', { class: 'lcell', style: { background: `rgb(${p},${p},${p})`, color: p > 128 ? '#111' : '#fff' } }, [
        h('span', { class: 'lp' }, p), h('span', { class: 'lw' }, `·${fmt(w)}`),
      ]));
      if (w !== 0) terms.push(`${fmt(w)}·${p}`);
    }
    const res = out[y * OW + x];
    lens.replaceChildren(
      h('div', { class: 'lens-grid', style: { gridTemplateColumns: `repeat(${kw}, 3.2rem)` } }, cells),
      h('div', { class: 'lens-eq' }, [
        h('div', { class: 'mono' }, `G[${y}, ${x}] = ${scale !== 1 ? `1/${Math.round(1 / scale)} · (` : ''}${terms.join(' + ').replaceAll('+ −', '− ')}${scale !== 1 ? ')' : ''}`),
        h('div', { class: 'lens-res' }, ['= ', h('strong', {}, fmt(Math.round(res * 10) / 10, 1))]),
      ]),
    );
  }

  function onMove(e, isOutput) {
    const cv = e.currentTarget;
    const rect = cv.getBoundingClientRect();
    const pt = e.touches ? e.touches[0] : e;
    const kh = kernel.length, kw = kernel[0].length;
    let x = Math.floor(((pt.clientX - rect.left) / rect.width) * cv.width);
    let y = Math.floor(((pt.clientY - rect.top) / rect.height) * cv.height);
    if (!isOutput) { x -= Math.floor(kw / 2); y -= Math.floor(kh / 2); }
    probe = { x: Math.max(0, Math.min(OW - 1, x)), y: Math.max(0, Math.min(OH - 1, y)) };
    drawProbe();
    if (e.touches) e.preventDefault();
  }
  for (const [cv, isOut] of [[inOverlay, false], [outOverlay, true]]) {
    cv.addEventListener('mousemove', (e) => onMove(e, isOut));
    cv.addEventListener('touchmove', (e) => onMove(e, isOut), { passive: false });
    cv.addEventListener('touchstart', (e) => onMove(e, isOut), { passive: false });
  }

  const img = new Image();
  img.onload = () => {
    W = img.naturalWidth; H = img.naturalHeight;
    inCanvas.width = inOverlay.width = W;
    inCanvas.height = inOverlay.height = H;
    const ctx = inCanvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, W, H).data;
    gray = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    // ridisegna l'input in scala di grigi
    const g = ctx.createImageData(W, H);
    for (let i = 0; i < W * H; i++) { g.data[i * 4] = g.data[i * 4 + 1] = g.data[i * 4 + 2] = gray[i]; g.data[i * 4 + 3] = 255; }
    ctx.putImageData(g, 0, 0);
    probe = { x: Math.floor(W * 0.42), y: Math.floor(H * 0.35) };
    run();
  };
  img.src = image;

  buildKernelEditor();
}

export default defineWidget({
  name: 'kernel-playground',
  params: {
    kernel: { type: 'enum', values: ['diff', 'sharpen', 'blur', 'sobelx', 'sobely', 'laplace', 'id'], default: 'diff' },
  },
  mount(el, { kernel }) {
    el.classList.add('w-kernel-playground');
    kernelPlayground(el, { image: dogUrl, initial: kernel });
  },
});
