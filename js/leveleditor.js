// Level editor screens: the list of tracks and the editor itself.
import { t } from './i18n.js';
import { BIOMES } from './biomes.js';
import { profile, save } from './save.js';
import { PIECES, SPEEDS, MAX_SLOTS, newLevel, encodeLevel, storeLevel, deleteLevel, levelId, pieceCount, trimmed, weeklyTrack, WEEKLY_TRACK_REWARD } from './levels.js';
import { qrCanvas } from './transfer.js';

export const PIECE_NAMES = { '.': 'empty', c: 'cactus', C: 'bigCactus', l: 'birdLow', m: 'birdHigh', z: 'zig', r: 'boulder', p: 'pit', f: 'platform', o: 'bones', u: 'power' };
const COLS = 10;

function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null) e.append(c);
  return e;
}

const stars = (n) => h('span', { class: 'mini-stars' }, [0, 1, 2].map((i) => h('i', { class: i < n ? 'on' : '' })));

function shareBox(ui, lv) {
  const code = encodeLevel(lv);
  const area = h('textarea', { class: 'code', readonly: true, rows: 3 });
  area.value = code;
  const copy = h('button', {
    class: 'val',
    text: t('xferCopy'),
    onclick: async () => {
      try {
        await navigator.clipboard.writeText(code);
        ui.toast(t('xferCopied'), 'gold');
      } catch {
        area.select();
      }
    },
  });
  return h('div', { class: 'xfer lv-share' }, h('p', { class: 'small', text: t('lvShareHelp') }), qrCanvas(code, 4), area, copy);
}

// ------------------------------------------------------------------ the list
export function levelsView(ui) {
  const list = profile.levels.map((lv, i) => {
    const best = profile.levelStars[levelId(lv)] || 0;
    const row = h(
      'div',
      { class: 'lv-row' },
      h(
        'div',
        { class: 'lv-info' },
        h('b', { text: lv.name || t('lvUntitled') }),
        h('span', { class: 'small muted', text: `${t('biome_' + BIOMES[lv.w].id)} · ${t('lvSpeed_' + lv.s)} · ${t('lvPieces', { n: pieceCount(lv) })}` }),
        h('span', { class: 'small lv-meta' }, stars(best), lv.from ? h('span', { class: 'muted', text: t('lvFrom') }) : null),
      ),
      h(
        'div',
        { class: 'lv-actions' },
        h('button', { class: 'val primary', text: t('lvPlay'), onclick: () => (ui.closePanel(true), ui.g.startMode('custom', { level: lv })) }),
        h('button', { class: 'val', text: t('lvEdit'), onclick: () => ui.editLevel(i) }),
        h('button', { class: 'val', text: t('lvShare'), onclick: () => ((ui.lvShare = ui.lvShare === i ? -1 : i), ui.renderPanel()) }),
        h('button', {
          class: 'val',
          text: t('photoDelete'),
          onclick: () => {
            if (ui.lvConfirm !== i) {
              ui.lvConfirm = i;
              ui.toast(t('lvDeleteAsk'), 'red');
              return;
            }
            ui.lvConfirm = -1;
            ui.lvShare = -1;
            deleteLevel(i);
            ui.renderPanel();
          },
        }),
      ),
    );
    return ui.lvShare === i ? h('div', {}, row, shareBox(ui, lv)) : row;
  });
  return h(
    'div',
    { class: 'lv-list' },
    h('p', { class: 'small', text: t('lvHelp') }),
    weeklyCard(ui),
    h('div', { class: 'row-btns' }, h('button', { class: 'menu-btn primary', text: t('lvNew'), onclick: () => ui.editLevel(-1) }), h('button', { class: 'menu-btn', text: t('lvScan'), onclick: () => ((ui.xferTab = 'scan'), ui.openPanel('transfer')) })),
    list.length ? list : h('p', { class: 'muted', text: t('lvNone') }),
  );
}

// ------------------------------------------------------------------ the editor
export function levelEditView(ui) {
  const lv = ui.lvEdit;
  if (!lv.brush) lv.brush = 'c';
  const track = h('div', { class: 'lv-track', style: `--cols:${COLS}` });
  const drawTrack = () => {
    track.replaceChildren(
      ...[...lv.t].map((ch, i) =>
        h('button', { class: 'lv-slot' + (ch === '.' ? ' empty' : ''), 'data-i': i, text: ch === '.' ? String(i + 1) : PIECES[ch], 'aria-label': t('lvp_' + PIECE_NAMES[ch]) }),
      ),
    );
  };
  const setSlot = (i, ch) => {
    if (i < 0 || i >= lv.t.length || lv.t[i] === ch) return;
    lv.t = lv.t.slice(0, i) + ch + lv.t.slice(i + 1);
    lv.dirty = true;
    const b = track.children[i];
    b.textContent = ch === '.' ? String(i + 1) : PIECES[ch];
    b.classList.toggle('empty', ch === '.');
  };
  // tap a slot to put the piece there (tap the same piece again to clear it); drag to paint a row
  let paint = null;
  const slotAt = (e) => {
    const b = document.elementFromPoint(e.clientX, e.clientY);
    return b && b.classList.contains('lv-slot') && track.contains(b) ? Number(b.dataset.i) : -1;
  };
  track.addEventListener('pointerdown', (e) => {
    const i = slotAt(e);
    if (i < 0) return;
    paint = lv.t[i] === lv.brush ? '.' : lv.brush;
    setSlot(i, paint);
    track.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  track.addEventListener('pointermove', (e) => paint && setSlot(slotAt(e), paint));
  const stop = () => (paint = null);
  track.addEventListener('pointerup', stop);
  track.addEventListener('pointercancel', stop);
  drawTrack();

  const palette = h(
    'div',
    { class: 'lv-palette' },
    Object.keys(PIECES).map((ch) =>
      h(
        'button',
        {
          class: 'chip' + (lv.brush === ch ? ' on' : ''),
          onclick: () => {
            lv.brush = ch;
            ui.renderPanel();
          },
        },
        h('span', { class: 'lv-emoji', text: PIECES[ch] }),
        h('span', { text: t('lvp_' + PIECE_NAMES[ch]) }),
      ),
    ),
  );
  const name = h('input', { maxlength: 18, value: lv.name || '', placeholder: t('lvUntitled'), autocomplete: 'off' });
  name.addEventListener('input', () => {
    lv.name = name.value;
    lv.dirty = true;
  });
  const keep = () => {
    if (!pieceCount(lv)) {
      ui.toast(t('lvEmpty'), 'red');
      return false;
    }
    const isNew = ui.lvEditIdx < 0;
    // a friend's track that you changed is yours now
    if (lv.dirty) lv.from = '';
    ui.lvEditIdx = storeLevel(lv, lv.from || '', ui.lvEditIdx);
    if (isNew) {
      profile.stats.levelsMade = (profile.stats.levelsMade || 0) + 1;
      save();
    }
    lv.dirty = false;
    return true;
  };
  return h(
    'div',
    { class: 'lv-editor' },
    h('label', { class: 'field' }, h('span', { text: t('lvName') }), name),
    ui.row(t('lvWorld'), t('biome_' + BIOMES[lv.w].id), () => {
      lv.w = (lv.w + 1) % BIOMES.length;
      lv.dirty = true;
      ui.renderPanel();
    }),
    ui.row(t('lvSpeedLabel'), t('lvSpeed_' + lv.s), () => {
      lv.s = (lv.s + 1) % SPEEDS.length;
      lv.dirty = true;
      ui.renderPanel();
    }),
    h('p', { class: 'small muted', text: t('lvEditHelp') }),
    palette,
    track,
    h(
      'div',
      { class: 'row-btns' },
      lv.t.length < MAX_SLOTS
        ? h('button', {
            class: 'val',
            text: t('lvMore'),
            onclick: () => {
              lv.t = (lv.t + '.'.repeat(COLS)).slice(0, MAX_SLOTS);
              ui.renderPanel();
            },
          })
        : null,
      h('button', {
        class: 'val',
        text: t('edClear'),
        onclick: () => {
          lv.t = '.'.repeat(lv.t.length);
          lv.dirty = true;
          ui.renderPanel();
        },
      }),
    ),
    h(
      'div',
      { class: 'row-btns' },
      h('button', {
        class: 'menu-btn primary',
        text: t('lvTest'),
        onclick: () => {
          if (!keep()) return;
          ui.closePanel(true);
          ui.g.startMode('custom', { level: profile.levels[ui.lvEditIdx] });
        },
      }),
      h('button', {
        class: 'menu-btn',
        text: t('lvSave'),
        onclick: () => {
          if (!keep()) return;
          ui.g.sfx.reward();
          ui.toast(t('lvSaved'), 'gold');
          ui.lvShare = ui.lvEditIdx;
          ui.openPanel('levels');
        },
      }),
    ),
  );
}

// a copy to edit (the stored one changes only on save); i = -1 for a new track
export function startEdit(i) {
  const src = i >= 0 ? profile.levels[i] : newLevel();
  const lv = { ...src };
  const len = Math.min(MAX_SLOTS, Math.max(24, Math.ceil((trimmed(lv).length + 4) / COLS) * COLS));
  lv.t = (trimmed(lv) + '.'.repeat(MAX_SLOTS)).slice(0, len);
  return lv;
}

// the track of the week: one track, the same all week, a reward for the first finish
function weeklyCard(ui) {
  const w = weeklyTrack();
  const lv = w.lv;
  return h(
    'div',
    { class: 'lv-row weekly-track' + (w.done ? ' done' : '') },
    h('b', { text: t('wtTitle') }),
    h('p', { text: lv.name || t('lvUntitled') }),
    h('p', { class: 'small muted', text: `${t('biome_' + BIOMES[lv.w].id)} · ${t('lvSpeed_' + lv.s)} · ` + (w.done ? t('wtDone') : t('wtHelp', { n: WEEKLY_TRACK_REWARD, d: w.daysLeft })) }),
    h('div', { class: 'lv-actions' }, h('button', { class: 'val primary', text: t('lvPlay'), onclick: () => (ui.closePanel(true), ui.g.startMode('custom', { level: lv })) })),
  );
}
