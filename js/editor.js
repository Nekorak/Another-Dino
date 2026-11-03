// Skin editor: paint the standing dino pixel by pixel and pick the colours of its parts.
import { t } from './i18n.js';
import { profile, save } from './save.js';
import { EDITOR_GRID, EDITOR_PALETTE, EDITOR_SLOTS, editorCell, darker } from './custom.js';

const W = EDITOR_GRID[0].length;
const H = EDITOR_GRID.length;

function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null) e.append(c);
  return e;
}

// ui: the UI object (toast, g.previewDino, sfx…); onDone: back to the shop
export function skinEditorView(ui, onDone) {
  const skin = JSON.parse(JSON.stringify(profile.customSkin));
  skin.paint = skin.paint || {};
  let brush = EDITOR_PALETTE[4];
  let target = 'paint'; // 'paint' | 'erase' | one of EDITOR_SLOTS
  let timer = null;

  const canvas = h('canvas', { class: 'editor-grid', width: W, height: H });
  const g = canvas.getContext('2d');
  const draw = () => {
    g.clearRect(0, 0, W, H);
    for (let r = 0; r < H; r++)
      for (let x = 0; x < W; x++) {
        const c = editorCell(skin, x, r);
        if (!c) continue;
        g.fillStyle = c;
        g.fillRect(x, r, 1, 1);
      }
  };
  // live preview on the 3D dino behind the panel (a little later, rebuilding costs time)
  const preview = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      ui.g.setCustomSkin(skin);
      ui.g.previewDino('custom', profile.hat);
    }, 180);
  };
  let painting = false;
  const paintAt = (e) => {
    const b = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - b.left) / b.width) * W);
    const r = Math.floor(((e.clientY - b.top) / b.height) * H);
    if (x < 0 || r < 0 || x >= W || r >= H || EDITOR_GRID[r][x] === ' ') return;
    const k = x + ',' + r;
    if (target === 'erase') delete skin.paint[k];
    else skin.paint[k] = brush;
    draw();
    preview();
  };
  canvas.addEventListener('pointerdown', (e) => {
    if (target !== 'paint' && target !== 'erase') return;
    painting = true;
    canvas.setPointerCapture(e.pointerId);
    paintAt(e);
  });
  canvas.addEventListener('pointermove', (e) => painting && paintAt(e));
  canvas.addEventListener('pointerup', () => (painting = false));
  canvas.addEventListener('pointercancel', () => (painting = false));

  const toolRow = h('div', { class: 'editor-tools' });
  const swatchRow = h('div', { class: 'editor-palette' });
  const renderTools = () => {
    toolRow.replaceChildren(
      ...['paint', 'erase', ...EDITOR_SLOTS].map((id) =>
        h('button', {
          class: 'chip' + (target === id ? ' on' : ''),
          text: t('ed_' + id),
          style: EDITOR_SLOTS.includes(id) ? `--c:${skin[id]}` : '',
          onclick: () => {
            target = id;
            renderTools();
          },
        }),
      ),
    );
    swatchRow.replaceChildren(
      ...EDITOR_PALETTE.map((c) =>
        h('button', {
          class: 'swatch' + ((target === 'paint' && c === brush) || (EDITOR_SLOTS.includes(target) && skin[target] === c) ? ' on' : ''),
          style: `background:${c}`,
          'aria-label': c,
          onclick: () => {
            if (EDITOR_SLOTS.includes(target)) {
              skin[target] = c;
              if (target === 'body') skin.dark = darker(c);
              draw();
              preview();
            } else {
              brush = c;
              target = 'paint';
            }
            renderTools();
          },
        }),
      ),
    );
  };
  renderTools();
  draw();
  preview();

  const help = h('p', { class: 'small muted', text: t('edHelp') });
  const clear = h('button', {
    class: 'val',
    text: t('edClear'),
    onclick: () => {
      skin.paint = {};
      draw();
      preview();
    },
  });
  const saveBtn = h('button', {
    class: 'menu-btn primary',
    text: t('edSave'),
    onclick: () => {
      profile.customSkin = JSON.parse(JSON.stringify(skin));
      profile.skin = 'custom';
      save();
      ui.g.setCustomSkin(skin);
      ui.g.previewDino('custom', profile.hat, profile.pet);
      ui.g.lanSetLook();
      ui.g.sfx.reward();
      ui.toast(t('edSaved'), 'gold');
      onDone();
    },
  });
  return h('div', { class: 'editor' }, help, canvas, toolRow, swatchRow, h('div', { class: 'row' }, h('span', { text: t('edPaint') }), clear), saveBtn);
}
