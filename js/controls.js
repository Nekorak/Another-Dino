// On-screen controls: either the two halves of the screen (with a movable border)
// or two visible buttons that the player places and sizes in the layout editor.
import { t } from './i18n.js';
import { profile, save } from './save.js';

const BASE = 84; // button size in CSS pixels at scale 1
const DEFAULTS = { mode: 'zones', split: 0.4, jump: { x: 0.86, y: 0.78, s: 1 }, duck: { x: 0.14, y: 0.78, s: 1 } };

const cfg = () => profile.settings.controls;
const $ = (id) => document.getElementById(id);

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

function place(el, b) {
  const size = BASE * b.s;
  el.style.width = el.style.height = size + 'px';
  el.style.left = `calc(${(b.x * 100).toFixed(2)}% - ${size / 2}px)`;
  el.style.top = `calc(${(b.y * 100).toFixed(2)}% - ${size / 2}px)`;
}

// the buttons shown while running (they only show where to press; touches are tested below)
export function layoutButtons(visible) {
  const c = cfg();
  for (const id of ['jump', 'duck']) {
    const el = $('ctl-' + id);
    if (!el) continue;
    place(el, c[id]);
    el.classList.toggle('hidden', !visible || c.mode !== 'buttons');
  }
}

// which control a touch at (x, y) presses: 'jump' | 'duck' | null (buttons mode),
// or by the zone border (zones mode)
export function controlAt(x, y, lefty) {
  const c = cfg();
  if (c.mode === 'buttons') {
    let best = null;
    let bd = Infinity;
    for (const id of ['jump', 'duck']) {
      const b = c[id];
      const r = (BASE * b.s) / 2;
      const d = Math.hypot(x - b.x * innerWidth, y - b.y * innerHeight);
      // a little bigger than drawn: thumbs are not precise
      if (d < r * 1.25 && d < bd) {
        bd = d;
        best = id;
      }
    }
    return best;
  }
  const split = c.split ?? 0.4;
  const left = x / innerWidth < (lefty ? 1 - split : split);
  return (lefty ? !left : left) ? 'duck' : 'jump';
}

// ------------------------------------------------------------------ layout editor
export function openControlsEditor(onClose) {
  const work = JSON.parse(JSON.stringify(cfg()));
  let selected = 'jump';
  const lefty = profile.settings.lefty;
  const root = h('div', { id: 'ctl-editor' });
  const zoneLine = h('div', { class: 'ctl-split' });
  const zoneLabels = h('div', { class: 'ctl-zones' }, h('span', { text: t(lefty ? 'jump' : 'duck') }), h('span', { text: t(lefty ? 'duck' : 'jump') }));
  const btns = {};
  for (const id of ['jump', 'duck']) {
    const b = h('div', { class: 'ctl-btn ctl-' + id + ' edit' }, h('span', { text: t(id) }));
    let drag = null;
    b.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      selected = id;
      drag = { id: e.pointerId };
      b.setPointerCapture(e.pointerId);
      draw();
    });
    b.addEventListener('pointermove', (e) => {
      if (!drag) return;
      work[id].x = Math.min(0.97, Math.max(0.03, e.clientX / innerWidth));
      work[id].y = Math.min(0.97, Math.max(0.12, e.clientY / innerHeight));
      draw();
    });
    b.addEventListener('pointerup', () => (drag = null));
    btns[id] = b;
  }
  // dragging the border between the two zones
  let splitDrag = false;
  zoneLine.addEventListener('pointerdown', (e) => {
    splitDrag = true;
    zoneLine.setPointerCapture(e.pointerId);
  });
  zoneLine.addEventListener('pointermove', (e) => {
    if (!splitDrag) return;
    const x = e.clientX / innerWidth;
    work.split = Math.min(0.7, Math.max(0.2, lefty ? 1 - x : x));
    draw();
  });
  zoneLine.addEventListener('pointerup', () => (splitDrag = false));

  const modeBtn = h('button', { class: 'menu-btn' });
  modeBtn.addEventListener('click', () => {
    work.mode = work.mode === 'buttons' ? 'zones' : 'buttons';
    draw();
  });
  const smaller = h('button', { class: 'menu-btn', text: '−' });
  const bigger = h('button', { class: 'menu-btn', text: '+' });
  smaller.addEventListener('click', () => {
    work[selected].s = Math.max(0.6, +(work[selected].s - 0.15).toFixed(2));
    draw();
  });
  bigger.addEventListener('click', () => {
    work[selected].s = Math.min(2, +(work[selected].s + 0.15).toFixed(2));
    draw();
  });
  const reset = h('button', { class: 'menu-btn', text: t('ctlReset') });
  reset.addEventListener('click', () => {
    Object.assign(work, JSON.parse(JSON.stringify(DEFAULTS)), { mode: work.mode });
    draw();
  });
  const close = (keep) => {
    if (keep) {
      profile.settings.controls = work;
      save();
    }
    root.remove();
    onClose && onClose(keep);
  };
  const ok = h('button', { class: 'menu-btn primary', text: t('ctlSave') });
  ok.addEventListener('click', () => close(true));
  const cancel = h('button', { class: 'menu-btn', text: t('back') });
  cancel.addEventListener('click', () => close(false));
  const help = h('p', { class: 'small ctl-help' });
  const sizeRow = h('div', { class: 'ctl-row' }, smaller, bigger);
  const bar = h('div', { class: 'ctl-bar' }, help, h('div', { class: 'ctl-row' }, modeBtn, reset), sizeRow, h('div', { class: 'ctl-row' }, cancel, ok));

  function draw() {
    const buttons = work.mode === 'buttons';
    modeBtn.textContent = t(buttons ? 'ctlModeButtons' : 'ctlModeZones');
    help.textContent = t(buttons ? 'ctlHelpButtons' : 'ctlHelpZones');
    sizeRow.classList.toggle('hidden', !buttons);
    zoneLine.classList.toggle('hidden', buttons);
    zoneLabels.classList.toggle('hidden', buttons);
    const sx = lefty ? 1 - work.split : work.split;
    zoneLine.style.left = `calc(${(sx * 100).toFixed(1)}% - 14px)`;
    zoneLabels.style.setProperty('--split', (sx * 100).toFixed(1) + '%');
    for (const id of ['jump', 'duck']) {
      btns[id].classList.toggle('hidden', !buttons);
      btns[id].classList.toggle('sel', selected === id);
      place(btns[id], work[id]);
    }
  }
  root.append(zoneLabels, zoneLine, btns.jump, btns.duck, bar);
  document.body.append(root);
  draw();
}
