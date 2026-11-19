// Vice Coast Cover Studio — the cover engine. Draws a multi-panel poster from the
// user's photos, a caption and a colour grade, onto any canvas at any size.
// Everything here is original art: no game logo, artwork or font is used.

/** The export sizes, keyed for the UI. */
export const SIZES = {
  square: { w: 1080, h: 1080, label: '1080 x 1080' },
  portrait: { w: 1080, h: 1350, label: '1080 x 1350' },
  wide: { w: 1920, h: 1080, label: '1920 x 1080' },
};

/** Layouts. Each is a function of (w, h) returning panel rects as fractions of
 *  the canvas, plus a title band height fraction and a frame style. */
export const LAYOUTS = {
  hero3: {
    label: 'Hero + 3',
    panels(w, h) {
      const gap = 0.012;
      const heroW = 0.62;
      return [
        { x: 0, y: 0, w: heroW - gap / 2, h: 1, rot: 0 },
        { x: heroW + gap / 2, y: 0, w: 1 - heroW - gap / 2, h: (1 - gap * 2) / 3, rot: 0 },
        { x: heroW + gap / 2, y: (1 + gap) / 3, w: 1 - heroW - gap / 2, h: (1 - gap * 2) / 3, rot: 0 },
        { x: heroW + gap / 2, y: (2 + 2 * gap) / 3, w: 1 - heroW - gap / 2, h: (1 - gap * 2) / 3, rot: 0 },
      ];
    },
    band: 0.24,
  },
  grid9: {
    label: 'Nine grid',
    panels(w, h) {
      const gap = 0.01;
      const cell = (1 - gap * 2) / 3;
      const out = [];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          out.push({
            x: c * (cell + gap),
            y: r * (cell + gap),
            w: cell,
            h: cell,
            rot: 0,
          });
        }
      }
      return out;
    },
    band: 0.22,
  },
  strip: {
    label: 'Full bleed + strip',
    panels(w, h) {
      const gap = 0.012;
      const split = 0.68;
      const stripH = 1 - split - gap;
      const pw = (1 - gap * 2) / 3;
      return [
        { x: 0, y: 0, w: 1, h: split, rot: 0 },
        { x: 0, y: split + gap, w: pw, h: stripH, rot: 0 },
        { x: pw + gap, y: split + gap, w: pw, h: stripH, rot: 0 },
        { x: 2 * pw + 2 * gap, y: split + gap, w: pw, h: stripH, rot: 0 },
      ];
    },
    band: 0.2,
  },
  tilt: {
    label: 'Tilted snapshots',
    panels(w, h) {
      return [
        { x: 0.03, y: 0.02, w: 0.6, h: 0.96, rot: -0.02, frame: true },
        { x: 0.66, y: 0.05, w: 0.31, h: 0.44, rot: 0.03, frame: true },
        { x: 0.66, y: 0.52, w: 0.31, h: 0.44, rot: -0.025, frame: true },
      ];
    },
    band: 0.22,
  },
};

/** Colour grades: a canvas filter for the photos plus overlay gradients. */
export const GRADES = {
  sunset: {
    label: 'Vice Sunset',
    filter: 'saturate(1.3) contrast(1.08) brightness(1.02)',
    overlays: [
      { from: 'rgba(255, 94, 98, 0)', to: 'rgba(255, 94, 98, 0.28)', mode: 'overlay' },
      { from: 'rgba(255, 170, 60, 0)', to: 'rgba(255, 120, 40, 0.30)', mode: 'soft-light' },
      { from: 'rgba(120, 40, 160, 0)', to: 'rgba(120, 40, 160, 0.35)', mode: 'multiply' },
    ],
  },
  neon: {
    label: 'Neon Nights',
    filter: 'saturate(1.55) contrast(1.14) hue-rotate(-8deg)',
    overlays: [
      { from: 'rgba(0, 229, 255, 0)', to: 'rgba(0, 229, 255, 0.30)', mode: 'overlay' },
      { from: 'rgba(255, 0, 128, 0)', to: 'rgba(255, 0, 128, 0.34)', mode: 'soft-light' },
      { from: 'rgba(10, 10, 60, 0)', to: 'rgba(10, 10, 60, 0.30)', mode: 'multiply' },
    ],
  },
  golden: {
    label: 'Golden Hour',
    filter: 'sepia(0.28) saturate(1.35) contrast(1.06)',
    overlays: [
      { from: 'rgba(255, 200, 80, 0)', to: 'rgba(255, 170, 40, 0.32)', mode: 'overlay' },
      { from: 'rgba(255, 120, 30, 0)', to: 'rgba(200, 90, 10, 0.28)', mode: 'soft-light' },
    ],
  },
  noir: {
    label: 'Mono Noir',
    filter: 'grayscale(1) contrast(1.18) brightness(1.05)',
    overlays: [
      { from: 'rgba(255, 255, 255, 0)', to: 'rgba(255, 255, 255, 0.12)', mode: 'overlay' },
      { from: 'rgba(0, 0, 0, 0)', to: 'rgba(0, 0, 0, 0.35)', mode: 'multiply' },
    ],
  },
};

/** A small noise tile, made fresh each draw, for the film-grain finish. */
function makeGrainTile(size = 128) {
  const tile = document.createElement('canvas');
  tile.width = size;
  tile.height = size;
  const tctx = tile.getContext('2d');
  const data = tctx.createImageData(size, size);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = Math.floor(Math.random() * 255);
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = 22;
  }
  tctx.putImageData(data, 0, 0);
  return tile;
}

/** Draws one photo into a panel rect, cover-fit, with the panel's zoom and pan. */
function drawPanelPhoto(ctx, img, rect, panel, filter) {
  const { x, y, w, h, rot } = rect;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  if (rot) ctx.rotate(rot);
  ctx.translate(-w / 2, -h / 2);
  if (rect.frame) {
    ctx.fillStyle = '#fdf8ef';
    ctx.fillRect(-w * 0.03, -h * 0.03, w * 1.06, h * 1.06);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = w * 0.05;
    ctx.shadowOffsetY = w * 0.02;
    ctx.fillStyle = '#fdf8ef';
    ctx.fillRect(-w * 0.03, -h * 0.03, w * 1.06, h * 1.06);
    ctx.restore();
  }
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();
  const zoom = panel.zoom || 1;
  const base = Math.max(w / img.naturalWidth, h / img.naturalHeight) * zoom;
  const pw = img.naturalWidth * base;
  const ph = img.naturalHeight * base;
  const ox = (panel.ox || 0) * w;
  const oy = (panel.oy || 0) * h;
  ctx.filter = filter;
  ctx.drawImage(img, (w - pw) / 2 + ox, (h - ph) / 2 + oy, pw, ph);
  ctx.filter = 'none';
  ctx.restore();
}

/** Draws a photo-less panel: a sunset gradient with a palm-ish silhouette bar. */
function drawEmptyPanel(ctx, rect, grade, index) {
  const { x, y, w, h, rot } = rect;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  if (rot) ctx.rotate(rot);
  ctx.translate(-w / 2, -h / 2);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  const hues = [
    ['#ff7e5f', '#feb47b'],
    ['#ff5f9e', '#7b2ff7'],
    ['#f7971e', '#ffd200'],
    ['#43cea2', '#185a9d'],
  ][index % 4];
  g.addColorStop(0, hues[0]);
  g.addColorStop(1, hues[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(20, 8, 30, 0.55)';
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, h * 0.82);
  for (let i = 0; i <= 6; i++) {
    ctx.lineTo((w / 6) * i, h * (0.82 + 0.06 * Math.sin(i * 1.7 + index)));
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `700 ${Math.max(12, h * 0.055)}px 'Noto Sans', 'DejaVu Sans', sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('ADD PHOTO', w / 2, h * 0.5);
  ctx.restore();
}

/** Fits the caption into one line, shrinking until it fits the band width. */
function fitTitleFont(ctx, text, maxWidth, startSize) {
  let size = startSize;
  ctx.font = `900 ${size}px 'Arial Black', 'Noto Sans', 'DejaVu Sans', sans-serif`;
  while (size > 16 && ctx.measureText(text).width > maxWidth) {
    size = Math.floor(size * 0.94);
    ctx.font = `900 ${size}px 'Arial Black', 'Noto Sans', 'DejaVu Sans', sans-serif`;
  }
  return size;
}

/** The title block: gradient-filled heavy capitals with a dark outline, a
 *  neon script-style subtitle, and a thin rule with the studio mark. */
function drawTitleBlock(ctx, w, h, state, layout) {
  const bandH = h * layout.band;
  const bandY = h - bandH;
  const shade = ctx.createLinearGradient(0, bandY - h * 0.06, 0, h);
  shade.addColorStop(0, 'rgba(12, 4, 24, 0)');
  shade.addColorStop(0.45, 'rgba(12, 4, 24, 0.72)');
  shade.addColorStop(1, 'rgba(12, 4, 24, 0.92)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, bandY - h * 0.06, w, bandH + h * 0.06);

  const title = (state.title || 'VICE COAST').trim().toUpperCase() || 'VICE COAST';
  const maxW = w * 0.92;
  const size = fitTitleFont(ctx, title, maxW, h * 0.115);
  const cx = w / 2;
  const ty = h - h * 0.085;
  ctx.save();
  ctx.translate(cx, ty);
  ctx.rotate(-0.018);
  ctx.scale(0.88, 1);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const fill = ctx.createLinearGradient(0, -size, 0, size * 0.25);
  fill.addColorStop(0, '#fff7e0');
  fill.addColorStop(0.45, '#ffd166');
  fill.addColorStop(0.75, '#ff5e62');
  fill.addColorStop(1, '#c642ff');
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(10, 2, 20, 0.9)';
  ctx.lineWidth = Math.max(3, size * 0.09);
  ctx.strokeText(title, 0, 0);
  ctx.fillStyle = fill;
  ctx.fillText(title, 0, 0);
  ctx.restore();

  const sub = (state.subtitle || '').trim();
  if (sub) {
    const subSize = Math.max(14, h * 0.026);
    ctx.font = `italic 700 ${subSize}px 'Noto Serif', Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#7df9ff';
    ctx.shadowColor = 'rgba(255, 0, 180, 0.9)';
    ctx.shadowBlur = subSize * 0.7;
    ctx.fillText(sub, w / 2, h - h * 0.028);
    ctx.shadowBlur = 0;
  }

  // Thin neon rule above the title, with a small studio mark at the left.
  const ruleY = bandY + h * 0.012;
  const rule = ctx.createLinearGradient(0, 0, w, 0);
  rule.addColorStop(0, 'rgba(255, 94, 98, 0)');
  rule.addColorStop(0.5, '#ff5e62');
  rule.addColorStop(1, 'rgba(198, 66, 255, 0)');
  ctx.fillStyle = rule;
  ctx.fillRect(w * 0.04, ruleY, w * 0.92, Math.max(2, h * 0.003));
  ctx.font = `700 ${Math.max(11, h * 0.014)}px 'Noto Sans', 'DejaVu Sans', sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText('VICE COAST COVER STUDIO', w * 0.04, ruleY + h * 0.024);
  ctx.textAlign = 'right';
  ctx.fillText('EST. 2026', w * 0.96, ruleY + h * 0.024);
}

/**
 * Draws the whole cover onto `canvas` (sized by the caller) from `state`:
 *   { photos: [HTMLImageElement], panels: [{photo, zoom, ox, oy}],
 *     layout: key of LAYOUTS, grade: key of GRADES,
 *     title, subtitle, grain: bool, vignette: bool }
 */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const layout = LAYOUTS[state.layout] || LAYOUTS.hero3;
  const grade = GRADES[state.grade] || GRADES.sunset;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#160a24';
  ctx.fillRect(0, 0, w, h);

  const rects = layout.panels(w, h);
  rects.forEach((frac, i) => {
    const rect = {
      x: frac.x * w,
      y: frac.y * h,
      w: frac.w * w,
      h: frac.h * h,
      rot: frac.rot || 0,
      frame: !!frac.frame,
    };
    const panel = (state.panels && state.panels[i]) || { photo: null, zoom: 1, ox: 0, oy: 0 };
    const img = panel.photo != null ? state.photos[panel.photo] : null;
    if (img) drawPanelPhoto(ctx, img, rect, panel, grade.filter);
    else drawEmptyPanel(ctx, rect, grade, i);
  });

  // Grade overlays across the whole cover.
  for (const o of grade.overlays) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, o.from);
    g.addColorStop(1, o.to);
    ctx.globalCompositeOperation = o.mode;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.globalCompositeOperation = 'source-over';

  // A cream gutter line between the hero and the side column, taken from the
  // hero panel's own right edge instead of a hard-coded split.
  if (state.layout === 'hero3') {
    const gap = Math.max(2, w * 0.008);
    ctx.fillStyle = '#fdf8ef';
    ctx.fillRect((rects[0].x + rects[0].w) * w, 0, gap, h);
  }

  drawTitleBlock(ctx, w, h, state, layout);

  if (state.vignette !== false) {
    const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(8,2,16,0.42)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }
  if (state.grain !== false) {
    const tile = makeGrainTile();
    const pattern = ctx.createPattern(tile, 'repeat');
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, w, h);
  }
  // Thin outer frame, the poster's edge.
  ctx.strokeStyle = 'rgba(253, 248, 239, 0.95)';
  ctx.lineWidth = Math.max(3, w * 0.006);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
}

/** Renders the cover at an export size and returns the fresh canvas. */
export function renderCover(state, sizeKey) {
  const size = SIZES[sizeKey] || SIZES.square;
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  drawCover(canvas, state);
  return canvas;
}
