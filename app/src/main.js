// Vice Coast Cover Studio — wires the page: load photos, pick a layout and grade,
// crop and position each panel, edit the caption, export the PNG.
// A `?shot=` query sets up a fixed scene for a screenshot instead (./shots.js).
import { LAYOUTS, GRADES, SIZES, drawCover, renderCover } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const status = document.getElementById('status');
const titleInput = document.getElementById('title');
const subtitleInput = document.getElementById('subtitle');
const tray = document.getElementById('tray');
const zoomSlider = document.getElementById('zoom');
const sizeButtons = document.querySelectorAll('[data-size]');

const state = {
  photos: [],
  panels: Array.from({ length: 9 }, () => ({ photo: null, zoom: 1, ox: 0, oy: 0 })),
  layout: 'hero3',
  grade: 'sunset',
  title: 'Vice Coast',
  subtitle: 'where the sun never sets on the score',
  grain: true,
  vignette: true,
};
let selectedPanel = 0;
let activePhoto = null;
let exportSize = 'square';
let dragging = null;

function panelRects() {
  const layout = LAYOUTS[state.layout];
  return layout.panels(canvas.width, canvas.height).map((f) => ({
    x: f.x * canvas.width,
    y: f.y * canvas.height,
    w: f.w * canvas.width,
    h: f.h * canvas.height,
  }));
}

function redraw() {
  drawCover(canvas, state);
  document.querySelectorAll('[data-layout]').forEach((b) => b.classList.toggle('on', b.dataset.layout === state.layout));
  document.querySelectorAll('[data-grade]').forEach((b) => b.classList.toggle('on', b.dataset.grade === state.grade));
  sizeButtons.forEach((b) => b.classList.toggle('on', b.dataset.size === exportSize));
  zoomSlider.value = String(Math.round(((state.panels[selectedPanel].zoom || 1) - 1) * 100));
  document.getElementById('panelLabel').textContent = `Panel ${selectedPanel + 1} of ${panelRects().length}`;
  document.getElementById('fillAll').disabled = activePhoto === null;
}

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function addPhoto(img, name) {
  const index = state.photos.length;
  state.photos.push(img);
  activePhoto = index;
  // First photo fills every panel; later photos fill the first empty panel.
  if (state.panels.every((p) => p.photo === null)) {
    state.panels.forEach((p) => { p.photo = index; });
  } else {
    const empty = state.panels.find((p) => p.photo === null);
    if (empty) empty.photo = index;
  }
  const thumb = document.createElement('button');
  thumb.type = 'button';
  thumb.className = 'thumb';
  thumb.title = name || `Photo ${index + 1}`;
  const t = document.createElement('canvas');
  t.width = 96;
  t.height = 96;
  const tctx = t.getContext('2d');
  const s = Math.max(96 / img.naturalWidth, 96 / img.naturalHeight);
  tctx.drawImage(img, (96 - img.naturalWidth * s) / 2, (96 - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
  thumb.append(t);
  thumb.addEventListener('click', () => {
    activePhoto = index;
    document.querySelectorAll('.thumb').forEach((el) => el.classList.remove('on'));
    thumb.classList.add('on');
    redraw();
  });
  tray.append(thumb);
  document.querySelectorAll('.thumb').forEach((el) => el.classList.remove('on'));
  thumb.classList.add('on');
  redraw();
}

document.getElementById('photos').addEventListener('change', async (e) => {
  for (const file of e.target.files) {
    try {
      addPhoto(await loadImage(URL.createObjectURL(file)), file.name);
    } catch {
      status.textContent = `Could not read ${file.name}.`;
    }
  }
  status.textContent = `${state.photos.length} photo${state.photos.length === 1 ? '' : 's'} loaded. Click a panel, then drag to crop.`;
});

document.getElementById('fillAll').addEventListener('click', () => {
  if (activePhoto === null) return;
  state.panels.forEach((p) => { p.photo = activePhoto; p.zoom = 1; p.ox = 0; p.oy = 0; });
  redraw();
});

document.getElementById('shuffle').addEventListener('click', () => {
  if (!state.photos.length) return;
  const rects = panelRects();
  rects.forEach((_, i) => {
    state.panels[i].photo = Math.floor(Math.random() * state.photos.length);
  });
  redraw();
});

document.querySelectorAll('[data-layout]').forEach((b) => {
  b.addEventListener('click', () => { state.layout = b.dataset.layout; selectedPanel = 0; redraw(); });
});
document.querySelectorAll('[data-grade]').forEach((b) => {
  b.addEventListener('click', () => { state.grade = b.dataset.grade; redraw(); });
});
sizeButtons.forEach((b) => {
  b.addEventListener('click', () => { exportSize = b.dataset.size; redraw(); });
});
titleInput.addEventListener('input', () => { state.title = titleInput.value; redraw(); });
subtitleInput.addEventListener('input', () => { state.subtitle = subtitleInput.value; redraw(); });
document.getElementById('grain').addEventListener('change', (e) => { state.grain = e.target.checked; redraw(); });
document.getElementById('vignette').addEventListener('change', (e) => { state.vignette = e.target.checked; redraw(); });
zoomSlider.addEventListener('input', () => {
  state.panels[selectedPanel].zoom = 1 + Number(zoomSlider.value) / 100;
  redraw();
});
document.getElementById('resetPanel').addEventListener('click', () => {
  state.panels[selectedPanel] = { photo: state.panels[selectedPanel].photo, zoom: 1, ox: 0, oy: 0 };
  redraw();
});

// Click a panel to select it (and assign the active photo); drag to pan it.
function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
}
canvas.addEventListener('pointerdown', (e) => {
  const p = canvasPoint(e);
  const i = panelRects().findIndex((r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h);
  if (i === -1) return;
  selectedPanel = i;
  if (activePhoto !== null) state.panels[i].photo = activePhoto;
  dragging = { x: p.x, y: p.y, ox: state.panels[i].ox, oy: state.panels[i].oy, w: panelRects()[i].w, h: panelRects()[i].h };
  canvas.setPointerCapture(e.pointerId);
  redraw();
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const p = canvasPoint(e);
  const panel = state.panels[selectedPanel];
  panel.ox = dragging.ox + (p.x - dragging.x) / dragging.w;
  panel.oy = dragging.oy + (p.y - dragging.y) / dragging.h;
  panel.ox = Math.max(-0.6, Math.min(0.6, panel.ox));
  panel.oy = Math.max(-0.6, Math.min(0.6, panel.oy));
  redraw();
});
canvas.addEventListener('pointerup', () => { dragging = null; });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const panel = state.panels[selectedPanel];
  panel.zoom = Math.max(1, Math.min(3, (panel.zoom || 1) - Math.sign(e.deltaY) * 0.08));
  redraw();
}, { passive: false });

// Export: renders the cover at the chosen size and downloads it as a PNG.
function exportPNG(sizeKey) {
  const out = renderCover(state, sizeKey);
  return new Promise((resolve) => {
    out.toBlob((blob) => {
      const size = SIZES[sizeKey];
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `vice-coast-cover-${size.w}x${size.h}.png`;
      a.click();
      status.textContent = `Saved vice-coast-cover-${size.w}x${size.h}.png`;
      resolve(blob);
    }, 'image/png');
  });
}
document.getElementById('export').addEventListener('click', () => exportPNG(exportSize));

// Handles the screenshot scenes use: export without a download click, as a data URL.
window.__exportPNG = async (sizeKey) => {
  const out = renderCover(state, sizeKey);
  return out.toDataURL('image/png');
};
window.__state = state;

const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  runShot(shot, new URLSearchParams(location.search), async (sample, text, sub) => {
    const img = await loadImage(sample);
    addPhoto(img, sample);
    state.title = text;
    titleInput.value = text;
    if (sub !== undefined) {
      state.subtitle = sub;
      subtitleInput.value = sub;
    }
    redraw();
  });
} else {
  redraw();
}
