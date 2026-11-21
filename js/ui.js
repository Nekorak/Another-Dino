// All menus, panels and HUD elements (plain DOM on top of the 3D canvas).
import { t, LANGS, getLang } from './i18n.js';
import { NEWS } from './whatsnew.js';
import { SKINS, HATS, PETS, POWERUP_COLOR, hatPixels, petPixels, BOSS_HAT } from './models.js';
import { UPGRADES, nextUpgradeCost, buyUpgrade, upgradeLevel, levelProgress, dailyInfo, EGG_PRICE, GOLD_EGG_PRICE, openEgg, eggPoolSize, PET_FOOD_PRICE, PET_FOOD_XP } from './progress.js';
import { BIOMES, SEASON_WORLD } from './biomes.js';
import { BOSS_KIND } from './bosses.js';
import { ADV_LEVELS, ADV_ORDER, advPos, LAST_STORY_W, SEASON_W, seasonRunBest, advPlusOpen, advHardOn, levelKey, stars as advStars, unlocked as advUnlocked, totalStars, todayMutator, SEASON_PASS_TIER } from './modes.js';
import { TRAILS, FOSSIL_KINDS, FOSSIL_WORLD_REWARD, fossilId, fossilPixels, allFossils } from './collection.js';
import { encodeProgress, decodeProgress, mergeProgress, QR_LIMIT, qrCanvas, readQrFromImage, CameraScanner, LanSync, isChallenge, decodeChallenge } from './transfer.js';
import { save, resetProgress, profile, SETTING_DEFAULTS } from './save.js';
import { DANCES, THEMES, EDITOR_GRID, editorCell } from './custom.js';
import { skinEditorView } from './editor.js';
import { MAX_PLAYERS, COOP_HEARTS, LAN_MODES, TRACK_MODES, TEAM_MODES, HANDICAPS, GIFTS, GIFTS_PER_DAY, QUICK_MSGS, isLanJoin, decodeLanJoin, encodeLanJoin } from './multiplayer.js';
import { layoutButtons, openControlsEditor } from './controls.js';
import { chestInfo, openChest, CHEST_DAYS, passState, passReward, claimTier, PASS_TIERS, PASS_XP, PASS_SPECIAL } from './rewards.js';
import { missionProgress, ACHIEVEMENTS, ensureWeekly, weeklyProgress, weekInfo, WEEKLY_BONUS, rerollMission, REROLL_PRICE } from './missions.js';
import { MEDALS, MEDAL_REWARD, MEDAL_NAMES, medalOf, medalCount } from './medals.js';
import { petLevel, petProgress, petPower, PET_MAX, feedPet } from './pets.js';
import { addPhoto, listPhotos, getPhoto, deletePhoto, toPng, MAX_PHOTOS } from './gallery.js';
import { isLevel, decodeLevel, storeLevel, levelId, weeklyTrackOpen, PIECES, trimmed } from './levels.js';
import { levelsView, levelEditView, startEdit } from './leveleditor.js';
import { TITLES, buyTitle, checkEarnedTitles, PAGES, STICKERS, PACK_PRICE, PACK_SIZE, GLITTER_COST, PAGE_REWARD, openPack, craftSticker, stickerCount, pageDone, MASTERY, MASTERY_BONUS, masteryOf, masteryCost, buyMastery, stars } from './longterm.js';
import { checkMedals } from './medals.js';
import { Capacitor, registerPlugin } from '@capacitor/core';

const Updater = registerPlugin('Updater');
const Share = registerPlugin('Share');
const Widget = registerPlugin('Widget');

const $ = (id) => document.getElementById(id);
const pad5 = (n) => String(Math.floor(n)).padStart(5, '0');
const REPO = 'Nekorak/Another-Dino';

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null) e.append(c);
  return e;
}

// A setting or choice with its picture and one line that says what it does.
export function infoRow(icon, label, desc, control) {
  return el(
    'div',
    { class: 'row info-row' },
    el('span', { class: 'info-ico', 'aria-hidden': 'true', text: icon }),
    el('span', { class: 'info-text' }, el('b', { text: label }), desc ? el('small', { text: desc }) : null),
    control || null,
  );
}
// an on/off switch that shows its state with a slider and a word
export function switchBtn(on, fn, label) {
  return el('button', { class: 'val switch' + (on ? ' on' : ''), role: 'switch', 'aria-checked': on ? 'true' : 'false', 'aria-label': label, onclick: fn }, el('i', { 'aria-hidden': 'true' }), el('span', { text: on ? t('on') : t('off') }));
}
// Every option visible at once (picture + name), never hidden behind one button that cycles;
// the explanation of the chosen one is written underneath.
//   options: [{ v, icon | pic, name, desc }]
export function choiceRow({ icon, label, desc, options, value, pick, disabled, cls }) {
  const cur = options.find((o) => o.v === value);
  return el(
    'div',
    { class: 'choice' + (cls ? ' ' + cls : '') },
    label ? el('div', { class: 'choice-head' }, icon ? el('span', { class: 'info-ico', 'aria-hidden': 'true', text: icon }) : null, el('span', { class: 'info-text' }, el('b', { text: label }), desc ? el('small', { text: desc }) : null)) : null,
    el(
      'div',
      { class: 'seg', role: 'radiogroup', 'aria-label': label || '' },
      options.map((o) =>
        el(
          'button',
          {
            class: 'seg-opt' + (o.v === value ? ' on' : ''),
            role: 'radio',
            'aria-checked': o.v === value ? 'true' : 'false',
            'aria-label': o.name + (o.desc ? '. ' + o.desc : ''),
            disabled: !!disabled,
            onclick: (e) => {
              e.stopPropagation();
              if (o.v !== value) pick(o.v);
            },
          },
          o.pic || el('span', { class: 'seg-ico', 'aria-hidden': 'true', text: o.icon || '' }),
          el('span', { class: 'seg-name', text: o.name }),
        ),
      ),
    ),
    cur && cur.desc ? el('p', { class: 'seg-help small', text: cur.desc }) : null,
  );
}
// an animated picture for each LAN mode and each game mode
const LAN_MODE_ICON = { race: '🏃', sabotage: '🪨', elimination: '⚡', tournament: '🏆', coop: '❤️', teams: '🆚', bosses: '🐉', relay: '🏃‍♂️', bracket: '🥊' };
const MODE_ICON = { mode_adventure: '🗺️', daily: '📅', mode_bossrush: '👹', mode_mutator: '🎲', multiplayer: '📶', mode_season: '🍂', mode_zen: '🧘', mode_hardcore: '💀', mode_bot: '🤖', mode_custom: '✏️', mode_challenge: '📷', mode_local: '🎮' };
const HC_ICON = ['🦖', '🐢', '🐌'];
const GIFT_ICON = { b25: '🦴', b100: '🎁', snack: '🍖' };

// Step-by-step unlocks: a new player starts with PLAY, the collection and the settings;
// the rest opens as they play (players from older versions have it all already)
export function unlocks(p = profile) {
  const g = p.stats.games;
  return {
    modes: g >= 3,
    collection: true,
    progress: g >= 1,
    settings: true,
    lan: g >= 5,
    levels: g >= 10 || (p.adventure['0-0'] || 0) > 0,
  };
}
const UNLOCK_LABEL = { modes: 'modes', progress: 'progress', lan: 'multiplayer', levels: 'mode_custom' };

// how many things in the shop the player could buy right now (for the red dot)
function shopAffordable(p = profile) {
  let n = 0;
  for (const [kind, list] of [['skin', SKINS], ['hat', HATS], ['pet', PETS]])
    for (const [id, it] of Object.entries(list)) if (it.price > 0 && it.price <= p.coins && !p.owned[kind].includes(id)) n++;
  return n;
}

const BOSS_EMOJI = { ptero: '🦅', parrot: '🦜', crab: '🦀', mammoth: '🦣', bat: '🦇', robot: '🤖', dragon: '🐉', ufo: '🛸', octopus: '🐙', gummy: '🍬', ghost: '👻', croc: '🐊', storm: '🌩️' };
const PU_ICON = { shield: '🛡️', magnet: '🧲', slow: '⏳', double: '⏫', rocket: '🚀', giant: '🦖', rain: '🦴' };
const BONE_SVG =
  '<svg class="bone" viewBox="0 0 11 5" aria-hidden="true"><path d="M0 0h2v1h1v1h5V1h1V0h2v2h-1v1h1v2H9V4H8V3H3v1H2v1H0V3h1V2H0z"/></svg>';
const bone = () => {
  const s = el('span', { class: 'bone-wrap' });
  s.innerHTML = BONE_SVG;
  return s;
};

// tiny pixel dino used on shop cards
const ICON = [
  '         GGGGGG ',
  '        GGWGGGGG',
  '        GGGGGGGG',
  '        GGGGMMMM',
  '        GGGG    ',
  'G      GGGGGG   ',
  'GG    GGGGGBA   ',
  'GGG  GGGGGBB    ',
  'GGGGGGGGGBBB    ',
  ' GGGGGGGGBB     ',
  '  GGGGGGGG      ',
  '   GGG GGG      ',
  '   GG   GG      ',
  '   FF   FF      ',
];
function dinoIcon(skin) {
  const s = SKINS[skin];
  if (skin === 'custom') {
    // the painted side view, as drawn in the editor
    const c = document.createElement('canvas');
    c.className = 'dino-icon';
    c.width = EDITOR_GRID[0].length;
    c.height = EDITOR_GRID.length;
    const g = c.getContext('2d');
    for (let r = 0; r < c.height; r++)
      for (let x = 0; x < c.width; x++) {
        const col = editorCell(s, x, r);
        if (!col) continue;
        g.fillStyle = col;
        g.fillRect(x, r, 1, 1);
      }
    return c;
  }
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 14;
  c.className = 'dino-icon';
  const g = c.getContext('2d');
  const col = { G: s.body, A: s.body, B: s.belly, W: s.eye, M: s.mouth, F: s.foot };
  ICON.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (!col[row[x]]) continue;
      g.fillStyle = col[row[x]];
      g.fillRect(x, y, 1, 1);
    }
  });
  return c;
}

// a dino that does a little of its dance (CSS animation)
function danceIcon(id, skin) {
  const c = dinoIcon(SKINS[skin] ? skin : 'classic');
  c.classList.add('dance-icon', 'dance-' + id);
  return c;
}

// the theme's sheet, line and accent colours as a small flag
function themeIcon(id) {
  const v = THEMES[id].vars;
  const c = document.createElement('canvas');
  c.className = 'dino-icon';
  c.width = 12;
  c.height = 10;
  const g = c.getContext('2d');
  g.fillStyle = v['--line'] || '#3b3326';
  g.fillRect(0, 0, 12, 10);
  g.fillStyle = v['--sheet'] || '#fff8ea';
  g.fillRect(1, 1, 10, 8);
  g.fillStyle = v['--accent'] || '#5fae3e';
  g.fillRect(2, 5, 8, 3);
  g.fillStyle = v['--sheet-ink'] || '#3b3326';
  g.fillRect(2, 2, 5, 1);
  return c;
}

function hatIcon(id) {
  return pixelIcon(hatPixels(id));
}

function petIcon(id) {
  return pixelIcon(petPixels(id, id !== 'none' && profile.owned.pet.includes(id) && petLevel(id) >= PET_MAX));
}

function trailIcon(id) {
  const c = document.createElement('canvas');
  c.className = 'dino-icon';
  c.width = 12;
  c.height = 7;
  const g = c.getContext('2d');
  const cols = TRAILS[id].colors;
  if (!cols) {
    g.fillStyle = '#9a8f7a';
    for (let i = 0; i < 7; i++) g.fillRect(i + 2, 6 - i, 1, 1);
    return c;
  }
  for (let x = 0; x < 12; x++) {
    const h = TRAILS[id].motion === 'line' ? 3 : 3 + Math.round(Math.sin(x * 0.9) * 2);
    g.fillStyle = cols[x % cols.length];
    g.fillRect(x, h, 1, TRAILS[id].motion === 'line' ? 2 : 1);
    if (x % 3 === 0 && TRAILS[id].motion !== 'line') g.fillRect(x, h - 2, 1, 1);
  }
  return c;
}

function pixelIcon(px) {
  const c = document.createElement('canvas');
  c.className = 'dino-icon';
  if (!px.length) {
    c.width = c.height = 7;
    const g = c.getContext('2d');
    g.fillStyle = '#9a8f7a';
    for (let i = 0; i < 7; i++) g.fillRect(i, 6 - i, 1, 1);
    return c;
  }
  const xs = px.map((p) => p.x);
  const ys = px.map((p) => p.y);
  const x0 = Math.min(...xs);
  const y1 = Math.max(...ys);
  const w = Math.max(...xs) - x0 + 1;
  const h = y1 - Math.min(...ys) + 1;
  const size = Math.max(w, h) + 2;
  c.width = c.height = size;
  const g = c.getContext('2d');
  const ox = Math.floor((size - w) / 2);
  const oy = Math.floor((size - h) / 2);
  for (const p of px) {
    g.fillStyle = p.color;
    g.fillRect(p.x - x0 + ox, y1 - p.y + oy, 1, 1);
  }
  return c;
}

export class UI {
  constructor(game) {
    this.g = game;
    this.p = game.profile;
    this.panel = null;
    this.overShownAt = 0;
    this.shopTab = 'skin';
    this.preview = null;
    this.lanView = 'home';
    this.rooms = [];
    this.lobby = [];
    this.lanIsHost = false;
    this.lastHud = '';
    this.shownScore = -1;
    this.bind();
  }

  // ------------------------------------------------------------ static wiring
  bind() {
    const g = this.g;
    const btn = (id, fn) => {
      const b = $(id);
      b.addEventListener('pointerdown', (e) => e.stopPropagation());
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        g.unlockAudio();
        fn();
        b.blur();
      });
      return b;
    };
    btn('btn-pause', () => g.setPaused(g.state === 'running'));
    btn('btn-sound', () => {
      const s = this.p.settings;
      const on = !(s.sfx || s.music);
      s.sfx = s.music = on;
      save();
      g.applySettings();
    });
    if (document.fullscreenEnabled || document.webkitFullscreenEnabled) {
      btn('btn-fs', () => {
        const d = document;
        if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
        else {
          const r = d.documentElement;
          Promise.resolve((r.requestFullscreen || r.webkitRequestFullscreen).call(r, { navigationUI: 'hide' })).catch(() => {});
        }
      });
    } else $('btn-fs').remove();
    btn('btn-restart', () => {
      if (g.state === 'over' && g.mode !== 'lan') g.restart();
    });
    btn('btn-share', () => this.share());
    btn('btn-replay', () => this.showReplay());
    btn('chest-open', () => this.doOpenChest());
    btn('btn-chest', () => this.showChest());
    btn('chest-ok', () => $('chest').classList.add('hidden'));
    btn('news-ok', () => this.closeNews());
    btn('story-ok', () => this.closeStory());
    btn('btn-replay-close', () => this.hideReplay());
    btn('btn-replay-gif', () => this.saveReplay());
    btn('btn-challenge', () => this.openPanel('challenge'));
    btn('btn-revive-yes', () => g.acceptRevive());
    btn('btn-revive-no', () => g.declineRevive());
    btn('btn-bomb', () => g.lanAttack());
    btn('egg-ok', () => $('egg').classList.add('hidden'));
    const emo = $('emotes');
    for (const e of g.emotes) {
      const b = el('button', { class: 'emote', text: e, 'aria-label': e });
      b.addEventListener('pointerdown', (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        g.lanEmote(e);
      });
      emo.append(b);
    }
    btn('btn-over-menu', () => g.toMenu());
    btn('panel-back', () => this.closePanel());
    btn('btn-resume', () => g.setPaused(false));
    btn('btn-photo', () => g.startPhoto());
    btn('btn-pause-menu', () => g.toMenu());
    btn('btn-zen-end', () => g.endZen());
    btn('btn-photo-back', () => g.endPhoto());
    btn('btn-photo-save', () => this.savePhoto());
    btn('btn-photo-share', () => this.share(true));
    btn('photo-view-close', () => this.closePhoto());
    btn('btn-win-next', () => this.nextLevel());
    btn('btn-win-map', () => {
      const custom = g.adv && g.adv.custom;
      g.toMenu();
      this.openPanel(custom ? 'levels' : 'adventure');
    });
    btn('btn-win-retry', () => g.restart());

    const menu = $('menu-buttons');
    // PLAY and four groups: modes (multiplayer inside), collection (shop, album, pass),
    // progress (missions, stats, medals) and settings
    const items = [
      ['play', () => g.startSolo(), 'primary'],
      ['modes', () => this.openPanel('modes')],
      ['collection', () => this.openPanel('collection')],
      ['progress', () => this.openPanel('progress')],
      ['settings', () => this.openPanel('settings')],
    ];
    for (const [key, fn, cls] of items) {
      const b = el('button', { class: 'menu-btn ' + (cls || ''), 'data-t': key, id: 'menu-' + key });
      b.addEventListener('click', () => {
        g.unlockAudio();
        this.markSeen(key);
        fn();
      });
      menu.append(b);
    }
    this.initSeen();
    $('menu-coins').prepend(bone());
    $('panel-coins').prepend(bone());
    $('runcoins').prepend(bone());
  }

  refreshTexts() {
    for (const e of document.querySelectorAll('[data-t]')) e.textContent = t(e.dataset.t);
    $('controls-msg').textContent = ''; // the tutorial and Settings already explain the controls
    $('hint-jump').textContent = t('jump');
    $('hint-duck').textContent = t('duck');
    $('hints').classList.toggle('lefty', this.p.settings.lefty);
    $('paused-title').textContent = t('paused');
    $('paused-msg').textContent = t('resume');
    $('btn-sound').classList.toggle('off', !(this.p.settings.sfx || this.p.settings.music));
    $('revive-title').textContent = t('reviveTitle');
    $('btn-revive-no').textContent = t('reviveNo');
    $('btn-share').textContent = t('share');
    $('btn-restart-label').textContent = t('again');
    $('btn-bomb').textContent = t('bombSend');
    for (const [id, key] of [['btn-resume', 'resumeBtn'], ['btn-photo', 'photo'], ['btn-pause-menu', 'menu'], ['btn-zen-end', 'zenEnd'], ['btn-photo-back', 'back'], ['btn-photo-save', 'photoSave'], ['btn-photo-share', 'share'], ['btn-win-next', 'advNext'], ['btn-win-map', 'advMap'], ['btn-win-retry', 'again']]) $(id).textContent = t(key);
    $('photo-hint').textContent = t('photoHint');
    this.setCoins();
    this.menuInfo();
    if (this.panel) this.renderPanel();
  }

  menuInfo() {
    const d = dailyInfo();
    const db = $('menu-daily');
    if (db) {
      db.textContent = '';
      db.append(el('span', { text: t('daily') }), el('small', { text: d.done ? t('dailyDoneShort', { n: d.streak }) : t('dailyTarget', { n: d.target, b: d.reward }) }));
      db.classList.toggle('done', d.done);
    }
    const lp = levelProgress();
    $('menu-level').replaceChildren(
      el('span', { text: t('levelShort', { n: lp.level }) }),
      el('span', { class: 'xpbar' }, el('i', { style: `width:${Math.round((lp.into / lp.need) * 100)}%` })),
    );
  }

  setCoins() {
    $('menu-coins-n').textContent = this.p.coins;
    $('panel-coins-n').textContent = this.p.coins;
  }

  // ------------------------------------------------------------ HUD
  setScore(s) {
    const n = Math.floor(s);
    if (n !== this.shownScore) {
      this.shownScore = n;
      $('score').textContent = pad5(n);
    }
  }
  setHi(n) {
    $('hi').textContent = 'HI ' + pad5(n);
    $('menu-best').textContent = t('best') + ' ' + pad5(n);
  }
  setRunCoins(n) {
    $('runcoins-n').textContent = n;
  }
  flashScore() {
    const s = $('score');
    s.classList.remove('flash');
    void s.offsetWidth;
    s.classList.add('flash');
  }
  setPowerups(power, max) {
    const box = $('powerups');
    const key = Object.entries(power)
      .map(([k, v]) => k + ':' + Math.ceil(v * 4))
      .join('|');
    if (key === this.lastHud) return;
    this.lastHud = key;
    // a square icon per power-up with a ring that empties as the time runs out
    box.replaceChildren(
      ...Object.entries(power)
        .filter(([, v]) => v > 0)
        .map(([k, v]) =>
          el(
            'div',
            { class: 'pu', style: `--c:${POWERUP_COLOR[k]};--k:${Math.round(Math.min(1, v / max[k]) * 100)}%`, title: t('pu_' + k), 'aria-label': t('pu_' + k) },
            el('span', { class: 'pu-icon', text: PU_ICON[k] || '?' }),
            el('span', { class: 'pu-s', text: String(Math.ceil(v)) }),
          ),
        ),
    );
  }
  setPlaying(on, mode = 'solo', lanMode = 'race') {
    document.body.classList.toggle('playing', on);
    // the movable on-screen buttons (only on touch screens, not in split screen)
    layoutButtons(on && this.g.isTouch && mode !== 'local' && mode !== 'local2');
    document.body.classList.toggle('local2', on && mode === 'local2');
    document.body.classList.toggle('lan-race', on && mode === 'lan');
    $('lan-actions').classList.toggle('hidden', !(on && mode === 'lan'));
    $('btn-bomb').classList.toggle('hidden', lanMode !== 'sabotage');
    $('mp-hud').replaceChildren();
    this.mpKey = '';
    if (!on) $('powerups').replaceChildren();
  }
  setCombo(mult, pop) {
    const c = $('combo');
    if (mult <= 1) {
      c.classList.add('hidden');
      return;
    }
    c.classList.remove('hidden');
    const txt = 'COMBO ×' + mult;
    if (c.textContent !== txt) c.textContent = txt;
    if (pop) {
      c.classList.remove('pop');
      void c.offsetWidth;
      c.classList.add('pop');
    }
  }
  perfect() {
    const n = el('div', { class: 'perfect', text: t('perfect') });
    $('perfects').append(n);
    setTimeout(() => n.remove(), 900);
  }
  advProgress(k) {
    const b = $('advbar');
    b.classList.toggle('hidden', k == null);
    if (k != null) b.firstElementChild.style.width = Math.round(k * 100) + '%';
  }
  bossBar(k, kind) {
    const b = $('bossbar');
    b.classList.toggle('hidden', k == null);
    if (k != null) {
      b.querySelector('i').style.width = Math.round(k * 100) + '%';
      b.querySelector('span').textContent = kind ? t('boss_' + kind) : t('bossName');
    }
  }
  // co-op: the team's shared hearts (null hides them)
  coopHearts(n) {
    const box = $('coop-hearts');
    if (n == null) {
      box.classList.add('hidden');
      document.body.classList.remove('coop');
      this.heartsShown = null;
      return;
    }
    if (this.heartsShown === n) return;
    this.heartsShown = n;
    box.classList.remove('hidden');
    document.body.classList.add('coop');
    box.replaceChildren(el('span', { class: 'small', text: t('coopTeam') }), ...Array.from({ length: COOP_HEARTS }, (_, i) => el('i', { class: 'heart' + (i < n ? '' : ' lost') })));
  }

  // photo mode: the picture goes into the album in the game
  async savePhoto() {
    const b = $('btn-photo-save');
    if (b.disabled) return;
    b.disabled = true;
    try {
      const data = await this.g.photoImage();
      await addPhoto(data, { biome: this.g.biomeId });
      this.p.stats.photos = (this.p.stats.photos || 0) + 1;
      save();
      for (const m of checkMedals()) this.toast(t('medalGot', { medal: t('medal_' + MEDAL_NAMES[m.tier]), name: t('st_' + m.stat), n: m.reward }), 'gold');
      this.g.sfx.reward();
      this.toast(t('photoKept'), 'gold');
    } catch {
      this.toast(t('photoFailed'), 'red');
    }
    b.disabled = false;
  }

  photoMode(on) {
    document.body.classList.toggle('photo', on);
    $('photo-ui').classList.toggle('hidden', !on);
  }
  showWin({ stars, reward, adv, coins, spawned, hits, xp, timing }) {
    this.overShownAt = performance.now() / 1000;
    $('win-title').textContent = adv.custom ? t('lvWin') : adv.boss ? t('bossDefeated') : t('advWin');
    $('btn-win-map').textContent = adv.custom ? t('lvList') : t('advMap');
    // the stars light up one after another, each with a beep
    $('win-stars').replaceChildren(...[0, 1, 2].map((i) => el('span', { class: 'star' + (i < stars ? ' on' : ''), style: `--i:${i}` })));
    clearTimeout(this.starTimer);
    for (let i = 0; i < stars; i++) this.starTimer = setTimeout(() => this.g.sfx.beep(i === 2), 450 + i * 450);
    // replaceChildren would print a null as the text "null"
    const lines = [
      spawned ? el('p', { text: t('advBones', { a: coins, b: spawned }) }) : null,
      el('p', { text: hits ? t('advHits', { n: hits }) : t('advNoHits') }),
      reward ? el('p', { class: 'mission-done', text: t('coinsEarned', { n: reward }) }) : null,
      xp ? el('p', { class: 'small', text: t('xpGained', { n: xp }) }) : null,
      timing ? el('p', { class: timing.isBest ? 'winner' : 'small', text: t(timing.isBest ? 'timeBest' : 'timeLine', { n: timing.time, b: timing.best }) }) : null,
      timing && timing.crown ? el('p', { class: 'mission-done', text: t('crownGot', { n: 40 }) }) : null,
    ];
    $('win-details').replaceChildren(...lines.filter(Boolean));
    const hasNext = this.nextLevelOf(adv) != null;
    // the last page of the story, once, after the boss of the last world (before the seasonal one)
    if (!adv.custom && adv.boss && adv.world === LAST_STORY_W && !this.p.storySeen.includes('end')) setTimeout(() => this.g.state === 'won' && this.showStory('end'), 2600);
    $('btn-win-next').classList.toggle('hidden', !hasNext);
    $('win').classList.remove('hidden');
    document.body.classList.add('over');
  }
  nextLevelOf(adv) {
    if (!adv || adv.custom) return null;
    if (adv.level < ADV_LEVELS - 1) return { world: adv.world, level: adv.level + 1 };
    const next = ADV_ORDER[advPos(adv.world) + 1];
    if (next != null) return { world: next, level: 0 };
    return null;
  }
  nextLevel() {
    const n = this.nextLevelOf(this.g.adv);
    if (n) this.g.startMode('adventure', n);
  }
  setBombs(n) {
    const b = $('btn-bomb');
    if (n == null) return;
    b.dataset.n = n;
    b.disabled = n <= 0;
    b.textContent = t('bombSend') + ' ×' + n;
  }
  spectate(name, key = 'spectating') {
    const s = $('spectate');
    s.classList.toggle('hidden', !name);
    if (name) s.textContent = t(key, { name });
  }
  showRevive(cost, seconds) {
    $('btn-revive-yes').replaceChildren(document.createTextNode(t('reviveYes') + ' '), bone(), document.createTextNode(' ' + cost));
    this.reviveTick(seconds);
    $('revive').classList.remove('hidden');
  }
  reviveTick(n) {
    $('revive-timer').textContent = String(Math.max(0, n));
  }
  hideRevive() {
    $('revive').classList.add('hidden');
  }

  // ------------------------------------------------------------ screens
  hideScreens() {
    for (const id of ['menu', 'over', 'paused', 'win', 'chest', 'egg', 'news', 'story']) $(id).classList.add('hidden');
    this.hideReplay();
    document.body.classList.remove('over');
    this.closePanel(true);
    this.tutorial(null);
    $('hints').classList.add('hidden');
  }
  showMenu() {
    this.hideScreens();
    $('menu').classList.remove('hidden');
    this.setCoins();
    this.refreshTexts();
    this.passBadge();
    this.updateWidget();
    // the daily chest pops up once per session (not before the tutorial is done); after that
    // a small chest button on the menu waits until it is opened
    const chest = this.p.tutorial && chestInfo().available;
    $('btn-chest').classList.toggle('hidden', !chest);
    // «Что нового» один раз на новую запись; сундук ждёт, пока окно не закроют
    if (this.p.newsSeen !== NEWS[0].id) {
      if (!this.p.tutorial || !this.p.stats.games) {
        // новичку (обучение ещё не пройдено) список изменений ни к чему: отмечаем как прочитанное
        this.p.newsSeen = NEWS[0].id;
        save();
      } else if (!this.newsPopped) {
        this.newsPopped = true;
        setTimeout(() => this.g.state === 'menu' && !this.panel && this.showNews(), 600);
        return;
      }
    }
    if (chest && !this.chestPopped) {
      this.chestPopped = true;
      setTimeout(() => this.g.state === 'menu' && !this.panel && this.showChest(), 600);
    }
  }

  // the Android home-screen widget shows the record and the daily challenge
  updateWidget() {
    if (Capacitor.getPlatform() !== 'android') return;
    const d = dailyInfo();
    Widget.update({
      best: Math.floor(this.p.stats.best),
      dailyDone: d.done,
      streak: d.streak,
      recordLabel: t('widgetRecord'),
      dailyTodo: t('widgetDailyTodo'),
      dailyDoneText: t('widgetDailyDone'),
      streakText: d.streak ? t('widgetStreak', { n: d.streak }) : '',
    }).catch(() => {});
  }

  // ------------------------------------------------------------ what's new
  showNews() {
    const items = NEWS[0][getLang()] || NEWS[0].en;
    // как и t(): в пиксельном шрифте есть ş/ţ, но нет ș/ț
    const fix = (s) => (getLang() === 'ro' ? s.replace(/ș/g, 'ş').replace(/Ș/g, 'Ş').replace(/ț/g, 'ţ').replace(/Ț/g, 'Ţ') : s);
    $('news-list').replaceChildren(...items.map((s) => el('li', { text: fix(s) })));
    $('news').classList.remove('hidden');
  }
  closeNews() {
    $('news').classList.add('hidden');
    if (this.p.newsSeen !== NEWS[0].id) {
      this.p.newsSeen = NEWS[0].id;
      save();
    }
    // окно открыли при запуске: теперь можно показать сундук дня
    if (this.g.state === 'menu' && !this.panel && this.p.tutorial && chestInfo().available && !this.chestPopped) {
      this.chestPopped = true;
      this.showChest();
    }
  }

  // ------------------------------------------------------------ daily chest
  showChest() {
    const info = chestInfo();
    if (!info.available) return;
    $('chest-title').textContent = t('chestTitle', { n: info.day });
    $('chest-days').replaceChildren(
      ...CHEST_DAYS.map((b, i) => el('span', { class: 'cday' + (i + 1 < info.day ? ' got' : i + 1 === info.day ? ' now' : '') }, el('b', { text: String(i + 1) }), bone(), document.createTextNode(String(b)))),
    );
    $('chest-result').replaceChildren();
    $('chest-open').classList.remove('hidden');
    $('chest-ok').classList.add('hidden');
    $('chest').classList.remove('hidden', 'open');
  }
  doOpenChest() {
    const r = openChest();
    if (!r) return $('chest').classList.add('hidden');
    const box = $('chest');
    box.classList.add('shaking');
    this.g.sfx.beep();
    $('chest-open').classList.add('hidden');
    setTimeout(() => {
      box.classList.remove('shaking');
      box.classList.add('open');
      this.g.sfx.reward();
      $('chest-result').replaceChildren(el('p', {}, bone(), ' +' + r.bones), el('p', { class: 'small', text: '+' + r.xp + ' XP' }));
      for (const l of r.levelUps) this.toast(t('levelUp', { n: l }), 'gold');
      $('chest-ok').classList.remove('hidden');
      $('btn-chest').classList.add('hidden');
      this.setCoins();
      this.passBadge();
    }, 900);
  }

  // ------------------------------------------------------------ season pass
  passBadge() {
    this.badges();
  }

  // ------------------------------------------------------------ red dots and step-by-step unlocks
  // what is new for each button: a red dot sends the player where something waits for them
  badgeState() {
    const p = this.p;
    const seen = p.seen;
    const pass = passState().unclaimed.length > 0;
    const shop = shopAffordable() > seen.shop;
    const album = p.fossils.length > seen.fossils;
    const ach = Object.keys(p.achievements).length > seen.ach;
    const daily = !dailyInfo().done;
    const levels = p.levels.some((lv) => lv.from === 'qr' && !p.levelStars[levelId(lv)]) || weeklyTrackOpen();
    return { pass, shop, album, ach, daily, levels, collection: pass || shop || album, progress: ach, modes: daily || levels };
  }
  badges() {
    const st = this.badgeState();
    const un = unlocks();
    for (const key of ['modes', 'collection', 'progress', 'settings']) {
      const b = $('menu-' + key);
      if (!b) continue;
      b.classList.toggle('hidden', !un[key]);
      const isNew = un[key] && !this.p.seen.unlocks.includes(key);
      b.classList.toggle('badge', !!st[key] && !isNew);
      b.classList.toggle('is-new', isNew);
      b.dataset.new = t('newBadge');
    }
  }
  // players who already had everything before this version must not get a pile of "new!"
  initSeen() {
    const p = this.p;
    if (p.seen.init) return;
    p.seen.init = true;
    p.seen.ach = Object.keys(p.achievements).length;
    p.seen.fossils = p.fossils.length;
    const un = unlocks();
    p.seen.unlocks = Object.keys(un).filter((k) => un[k]);
    save();
  }
  markSeen(key) {
    const seen = this.p.seen;
    if (!seen.unlocks.includes(key)) seen.unlocks.push(key);
    if (key === 'shop') seen.shop = shopAffordable();
    if (key === 'album') seen.fossils = this.p.fossils.length;
    if (key === 'progress' || key === 'missions') seen.ach = Object.keys(this.p.achievements).length;
    save();
  }
  // after a run: tell the player about a button that just opened
  announceUnlocks() {
    const un = unlocks();
    for (const key of Object.keys(un)) if (un[key] && !this.p.seen.unlocks.includes(key) && !(this.announced || (this.announced = new Set())).has(key)) {
      this.announced.add(key);
      this.toast(t('unlockedNew', { name: t(UNLOCK_LABEL[key] || key) }), 'gold');
    }
  }

  // a menu of big buttons that leads on to other panels (collection, progress)
  hubView(list) {
    const st = this.badgeState();
    return el(
      'div',
      { class: 'hub' },
      list.map(([key, desc, fn, badge]) => {
        const b = el('button', { class: 'mode-card hub-card' + (st[badge] ? ' badge' : ''), onclick: fn }, el('b', { text: t(key) }), el('span', { class: 'small muted', text: desc }));
        return b;
      }),
    );
  }
  collectionView() {
    return this.hubView([
      ['shop', t('hubShop'), () => this.openPanel('shop', 'collection'), 'shop'],
      ['album', t('hubAlbum', { n: this.p.fossils.length, max: allFossils().length }), () => this.openPanel('album', 'collection'), 'album'],
      ['bestiary', t('hubBestiary'), () => this.openPanel('bestiary', 'collection')],
      ['pass', t('hubPass'), () => this.openPanel('pass', 'collection'), 'pass'],
      ['jukebox', t('hubJukebox'), () => this.openPanel('jukebox', 'collection')],
    ]);
  }
  progressView() {
    return this.hubView([
      ['missions', t('hubMissions'), () => this.openPanel('missions', 'progress'), 'ach'],
      ['albumMedals', t('hubMedals'), () => ((this.albumTab = 'medals'), this.openPanel('album', 'progress'))],
      ['stats', t('hubStats'), () => this.openPanel('stats', 'progress')],
      ['playerCard', t('hubPlayerCard'), () => this.sharePlayerCard()],
    ]);
  }
  async sharePlayerCard() {
    let data;
    try {
      data = await this.g.playerCard();
    } catch {
      return this.toast(t('shareFailed'), 'red');
    }
    return this.shareData(data, 'image/png');
  }
  dinoCanvas(skin) {
    return dinoIcon(SKINS[skin] ? skin : 'classic');
  }
  // every world's boss and obstacles: how often you beat them (unknown ones stay hidden)
  bestiaryView() {
    const kills = this.p.bossKills;
    const obs = this.p.obsBiome;
    const rows = ADV_ORDER.map((w) => {
      const b = BIOMES[w];
      const kind = BOSS_KIND[b.id];
      const met = (kills[kind] || 0) > 0 || (obs[b.id] || 0) > 0 || advStars(w, 0) > 0;
      const hat = BOSS_HAT[b.id];
      return el(
        'div',
        { class: 'beast' + (met ? '' : ' locked'), style: `--sky:${b.sky};--ground:${b.ground}` },
        el('span', { class: 'beast-icon', text: met ? BOSS_EMOJI[kind] || '?' : '?' }),
        el(
          'div',
          { class: 'beast-text' },
          el('b', { text: met ? t('boss_' + kind) : '???' }),
          el('span', { class: 'small', text: t('biome_' + b.id) }),
          el('span', { class: 'small muted', text: t('beastLine', { n: kills[kind] || 0, o: obs[b.id] || 0 }) }),
          hat && this.p.owned.hat.includes(hat) ? el('span', { class: 'small', text: '🎩 ' + t('hat_' + hat) }) : null,
        ),
      );
    });
    return el('div', {}, el('p', { class: 'small muted', text: t('bestiaryHelp') }), el('div', { class: 'bestiary' }, rows));
  }
  passView() {
    const st = passState();
    const SEASONS = ['passWinter', 'passSpring', 'passSummer', 'passAutumn'];
    const head = el(
      'div',
      { class: 'pass-head' },
      el('b', { text: t(SEASONS[st.q]) }),
      el('span', { class: 'small muted', text: t('passLeft', { n: st.daysLeft }) }),
      el('p', { class: 'small', text: st.tier >= PASS_TIERS ? t('passDone') : t('passTier', { n: st.tier, total: PASS_TIERS }) }),
      el('div', { class: 'bar' }, el('i', { style: `width:${st.tier >= PASS_TIERS ? 100 : Math.round((st.into / PASS_XP) * 100)}%` })),
      el('p', { class: 'small muted', text: t('passHelp', { n: PASS_XP }) }),
    );
    const claimAll = st.unclaimed.length
      ? el('button', {
          class: 'menu-btn primary',
          text: t('passClaimAll', { n: st.unclaimed.length }),
          onclick: () => {
            for (const n of st.unclaimed) this.claimPassTier(n, true);
            this.g.sfx.reward();
            this.renderPanel();
          },
        })
      : null;
    const tiers = el('div', { class: 'pass-tiers' });
    for (let n = 1; n <= PASS_TIERS; n++) {
      const r = passReward(n);
      const got = this.p.pass.claimed.includes(n);
      const ready = n <= st.tier && !got;
      // the exclusive items always show themselves, even once claimed (or owned from an earlier season)
      const sp = PASS_SPECIAL[n];
      const icon = sp ? (sp[0] === 'skin' ? dinoIcon(sp[1]) : sp[0] === 'hat' ? hatIcon(sp[1]) : trailIcon(sp[1])) : null;
      const card = el(
        'button',
        { class: 'tier' + (got ? ' got' : ready ? ' ready' : ' locked') + (icon ? ' special' : '') },
        el('span', { class: 'tier-n', text: String(n) }),
        icon || el('span', { class: 'tier-bones' }, bone(), ' ' + r.n),
        el('span', { class: 'tier-tag', text: got ? '✓' : ready ? t('passClaim') : '' }),
      );
      card.addEventListener('click', () => {
        if (!ready) return this.toast(sp ? t(sp[0] + '_' + sp[1]) : t('passLocked', { n }), 'gold');
        this.claimPassTier(n);
        this.renderPanel();
      });
      tiers.append(card);
    }
    return el('div', {}, head, claimAll, tiers);
  }
  claimPassTier(n, quiet) {
    const r = claimTier(n);
    if (!r) return;
    if (!quiet) this.g.sfx.reward();
    this.toast(r.kind === 'bones' ? t('passGotBones', { n: r.n }) : t('passGotItem', { name: t(r.kind + '_' + r.id) }), 'gold');
    this.setCoins();
    this.passBadge();
  }
  showPaused(on, mode) {
    $('paused').classList.toggle('hidden', !on);
    document.body.classList.toggle('paused', !!on);
    $('btn-zen-end').classList.toggle('hidden', mode !== 'zen');
  }
  showOver({ score, record, coins, missions, lan, finish, xp, local2, daily, bot, mode, challenge, canChallenge, near, mutator, season, rush, team }) {
    $('btn-replay').classList.toggle('hidden', !!lan || this.g.replay.length < 5);
    $('btn-challenge').classList.toggle('hidden', !canChallenge || score <= 0);
    this.overShownAt = performance.now() / 1000;
    $('over-title').textContent = mode === 'zen' ? t('zenOver') : finish ? t('lanFinishTitle') : 'GAME OVER';
    $('over-score').textContent = pad5(score);
    $('over-record').textContent = record ? t('record') : '';
    $('over-xp').textContent = xp ? '+' + xp + ' XP' : '';
    // the level bar fills up with the XP of this run
    const lv = $('over-level');
    lv.classList.toggle('hidden', !xp);
    if (xp) {
      const lp = levelProgress();
      const to = lp.need ? lp.into / lp.need : 1;
      const from = lp.into >= xp && lp.need ? (lp.into - xp) / lp.need : 0;
      $('over-level-n').textContent = t('levelShort', { n: lp.level });
      const bar = lv.querySelector('.xpbar i');
      bar.style.transition = 'none';
      bar.style.width = Math.round(from * 100) + '%';
      void bar.offsetWidth;
      bar.style.transition = '';
      setTimeout(() => (bar.style.width = Math.round(to * 100) + '%'), 250);
    }
    // so close: a few points short of the record or of the finish line
    $('over-near').textContent = near ? (near.kind === 'finish' ? t('nearFinish', { n: near.n }) : t('nearRecord', { n: near.n })) : '';
    const extra = $('over-extra');
    extra.replaceChildren();
    if (local2) {
      const best = Math.max(...local2.map((q) => q.sc));
      const top = local2.filter((q) => q.sc === best);
      const head = team ? t('localCoopResult', { n: best }) : top.length > 1 ? t('draw') : t('mpWinner', { name: top[0].name });
      extra.append(el('p', { class: 'winner', text: head }), el('p', { text: local2.map((q) => `${q.name} ${pad5(q.sc)}`).join('   ') }));
    }
    if (challenge)
      extra.append(
        el('p', { class: challenge.won ? 'winner' : '', text: challenge.won ? t('chWon', { name: challenge.name, n: challenge.reward }) : t('chLost', { name: challenge.name, n: challenge.target }) }),
      );
    if (mutator) extra.append(el('p', { class: mutator.isBest ? 'winner' : '', text: t('mutBest', { name: t('mut_' + mutator.id), n: mutator.best }) }));
    if (rush)
      extra.append(
        el('p', { class: rush.isBest ? 'winner' : '', text: rush.done ? t('rushDone', { time: rush.time, n: 150 }) : t('rushResult', { n: rush.n, max: rush.max }) }),
        el('p', { class: 'small muted', text: t('rushBest', { n: rush.best, max: rush.max, time: rush.bestTime ? rush.bestTime + 's' : '-' }) }),
      );
    if (season) extra.append(el('p', { class: season.isBest ? 'winner' : '', text: t('seasonBest', { name: t('biome_season'), n: season.best }) }));
    if (bot) extra.append(el('p', { class: bot.won ? 'winner' : '', text: bot.won ? t('botBeaten', { n: bot.reward }) : t('botWon') }));
    if (daily) extra.append(el('p', { class: daily.done ? 'mission-done' : '', text: daily.done ? t('dailyDoneShort', { n: daily.streak }) : t('dailyBest', { n: daily.best, target: daily.target }) }));
    $('btn-share').classList.toggle('hidden', !!lan || score <= 0);
    $('over-coins').replaceChildren(bone(), document.createTextNode(' ' + t('coinsEarned', { n: coins })));
    $('over-missions').replaceChildren(...missions.map((m) => el('p', { class: 'mission-done', text: '+ ' + t('m_' + m.kind, { n: m.target }) + '  +' + m.reward })));
    $('again-msg').textContent = lan ? t('mpWaitOthers') : this.g.isTouch ? t('tapAgain') : t('keyAgain');
    $('btn-restart').classList.toggle('hidden', lan);
    $('btn-over-menu').classList.toggle('hidden', lan);
    $('over').classList.remove('hidden');
    document.body.classList.add('over');
    this.setCoins();
    this.announceUnlocks();
  }
  // ------------------------------------------------------------ replay
  showReplay() {
    const rec = this.g.replay;
    if (!rec.length) return;
    const c = $('replay-canvas');
    const f = rec.frames[0].c;
    c.width = f.width;
    c.height = f.height;
    $('replay').classList.remove('hidden');
    let i = 0;
    clearInterval(this.replayTimer);
    this.replayTimer = setInterval(() => {
      rec.draw(c, i);
      i = (i + 1) % rec.length;
    }, 100);
  }
  hideReplay() {
    clearInterval(this.replayTimer);
    $('replay').classList.add('hidden');
  }
  async saveReplay() {
    const b = $('btn-replay-gif');
    b.disabled = true;
    b.textContent = t('replayMaking');
    // let the button repaint before the (blocking) encoding starts
    await new Promise((r) => setTimeout(r, 30));
    try {
      const blob = this.g.replay.toGif();
      const data = await new Promise((res) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result);
        fr.readAsDataURL(blob);
      });
      if (window.desktop && window.desktop.shareImage) {
        await window.desktop.shareImage(data);
        this.toast(t('shareSaved'), 'gold');
      } else if (Capacitor.getPlatform() === 'android') {
        await Share.shareImage({ data: data.split(',')[1], text: t('shareText'), mime: 'image/gif' });
      } else {
        const file = new File([blob], 'another-dino-replay.gif', { type: 'image/gif' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], text: t('shareText') });
        else {
          const a = el('a', { href: URL.createObjectURL(blob), download: 'another-dino-replay.gif' });
          document.body.append(a);
          a.click();
          a.remove();
          this.toast(t('replaySaved'), 'gold');
        }
      }
    } catch (err) {
      if (!err || err.name !== 'AbortError') this.toast(t('shareFailed'), 'red');
    }
    b.disabled = false;
    b.textContent = t('replayGif');
  }

  // ------------------------------------------------------------ jukebox
  // every song of the game: listen to it, or pick it for the menu
  jukeboxView() {
    const s = this.p.settings;
    const tracks = this.g.tracks();
    const list = tracks.map((tr) => {
      const name = tr.open ? t(tr.key) : '???';
      const playing = this.jukeTrack === tr.i;
      const isMenu = s.menuSong === tr.i;
      return el(
        'div',
        { class: 'row juke' + (playing ? ' on' : '') },
        el('span', { text: (isMenu ? '★ ' : '') + name }),
        el(
          'div',
          { class: 'juke-btns' },
          el('button', {
            class: 'val',
            text: playing ? '■' : '▶',
            disabled: !tr.open,
            onclick: () => {
              this.jukeTrack = playing ? null : tr.i;
              this.g.playTrack(this.jukeTrack);
              this.renderPanel();
            },
          }),
          el('button', {
            class: 'val',
            text: isMenu ? t('jukeMenuOn') : t('jukeMenu'),
            disabled: !tr.open,
            onclick: () => {
              s.menuSong = isMenu ? -1 : tr.i;
              save();
              this.renderPanel();
            },
          }),
        ),
      );
    });
    return el(
      'div',
      { class: 'settings' },
      el('p', { class: 'small muted', text: s.music ? t('jukeHelp') : t('jukeMusicOff') }),
      infoRow('🎼', t('jukeAuto'), t('jukeAutoHelp'), switchBtn(s.menuSong < 0, () => {
        s.menuSong = -1;
        save();
        this.renderPanel();
      }, t('jukeAuto'))),
      list,
    );
  }

  // ------------------------------------------------------------ QR challenge
  challengeView() {
    const code = this.g.challengeCode();
    if (!code) return el('p', { class: 'muted', text: t('chNone') });
    const area = el('textarea', { class: 'code', readonly: true, rows: 3 });
    area.value = code;
    const copy = el('button', { class: 'val', text: t('xferCopy') });
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(code);
        this.toast(t('xferCopied'), 'gold');
      } catch {
        area.select();
      }
    });
    return el('div', { class: 'xfer' }, el('p', { class: 'small', text: t('chHelp') }), qrCanvas(code, 4), area, copy);
  }
  askChallenge(text) {
    let c;
    try {
      c = decodeChallenge(text);
    } catch (err) {
      return this.toast(t(err.message || 'xferBadCode'), 'red');
    }
    this.stopTransfer();
    const box = $('xfer-confirm');
    if (!box) return;
    box.replaceChildren(
      el(
        'div',
        { class: 'confirm' },
        el('p', { text: t('chFrom', { name: c.name, n: c.score }) }),
        el('p', { class: 'small muted', text: t('chRules') }),
        el('button', {
          class: 'menu-btn primary',
          text: t('chAccept'),
          onclick: () => {
            this.closePanel(true);
            this.g.startMode('challenge', c);
          },
        }),
      ),
    );
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // a track from a friend's level editor
  askLevel(text) {
    let lv;
    try {
      lv = decodeLevel(text);
    } catch (err) {
      return this.toast(t(err.message || 'xferBadCode'), 'red');
    }
    this.stopTransfer();
    const box = $('xfer-confirm');
    if (!box) return;
    const keep = () => storeLevel(lv, 'qr');
    box.replaceChildren(
      el(
        'div',
        { class: 'confirm' },
        el('p', { text: t('lvGot', { name: lv.name || t('lvUntitled') }) }),
        el('p', { class: 'small muted', text: `${t('biome_' + BIOMES[lv.w].id)} · ${t('lvSpeed_' + lv.s)}` }),
        el('button', {
          class: 'menu-btn primary',
          text: t('lvPlay'),
          onclick: () => {
            const i = keep();
            this.closePanel(true);
            this.g.startMode('custom', { level: this.p.levels[i] });
          },
        }),
        el('button', {
          class: 'menu-btn',
          text: t('lvKeep'),
          onclick: () => {
            keep();
            this.toast(t('lvSaved'), 'gold');
            this.openPanel('levels');
          },
        }),
      ),
    );
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  hideOver() {
    $('over').classList.add('hidden');
    document.body.classList.remove('over');
  }
  tutorial(kind) {
    const box = $('tutorial');
    if (!kind) {
      box.classList.add('hidden');
      if (this.g.state === 'running') $('hints').classList.add('hidden');
      return;
    }
    const touch = this.g.isTouch;
    const key = kind === 'jump' ? (touch ? 'tutJump' : 'tutJumpKey') : touch ? 'tutDuck' : 'tutDuckKey';
    box.textContent = t(key);
    box.className = 'tut-' + kind;
    if (touch) $('hints').classList.remove('hidden');
  }
  countdown(text) {
    const c = $('countdown');
    c.classList.toggle('hidden', !text);
    if (text) {
      c.textContent = text;
      c.classList.remove('pop');
      void c.offsetWidth;
      c.classList.add('pop');
    }
  }
  countdownText() {
    return $('countdown').classList.contains('hidden') ? '' : $('countdown').textContent;
  }
  toast(text, kind = '') {
    // on the result screens the rewards come one after another, not in a pile
    if (document.body.classList.contains('over') && kind === 'gold') {
      this.toastQueue = this.toastQueue || [];
      this.toastQueue.push(text);
      if (!this.toastTimer) this.nextToast();
      return;
    }
    this.showToast(text, kind);
  }
  nextToast() {
    const text = this.toastQueue.shift();
    if (text == null || !document.body.classList.contains('over')) {
      // left the result screen: whatever is still waiting shows at once
      this.toastTimer = null;
      for (const q of this.toastQueue.splice(0)) this.showToast(q, 'gold');
      return;
    }
    this.showToast(text, 'gold', 1500);
    this.g.sfx.beep?.();
    this.toastTimer = setTimeout(() => this.nextToast(), 900);
  }
  showToast(text, kind = '', life = 2200) {
    const box = $('toasts');
    const n = el('div', { class: 'toast ' + kind, text });
    if (POWERUP_COLOR[kind]) n.style.setProperty('--c', POWERUP_COLOR[kind]);
    box.append(n);
    // a small phone shows fewer at once, so a pile of medals does not cover the menu
    while (box.children.length > (innerWidth <= 420 ? 2 : 3)) box.firstChild.remove();
    setTimeout(() => n.classList.add('out'), life);
    setTimeout(() => n.remove(), life + 500);
  }
  banner(text, action, fn) {
    const b = $('banner');
    b.replaceChildren(el('span', { text }), el('button', { text: action, onclick: () => fn() }));
    b.classList.remove('hidden');
  }

  // ------------------------------------------------------------ panels
  panelOpen() {
    return this.panel;
  }
  // a window on top of the menu (chest, egg, replay, controls editor): keys must not start a run behind it
  modalOpen() {
    return !!document.getElementById('ctl-editor') || ['chest', 'egg', 'replay', 'photo-view', 'news', 'story'].some((id) => !$(id).classList.contains('hidden'));
  }
  closeModal() {
    const ed = document.getElementById('ctl-editor');
    if (ed) return ed.querySelector('.ctl-bar .ctl-row:last-child .menu-btn:not(.primary)')?.click();
    if (!$('news').classList.contains('hidden')) return this.closeNews();
    if (!$('story').classList.contains('hidden')) return void $('story').classList.add('hidden');
    if (!$('replay').classList.contains('hidden')) return this.hideReplay();
    if (!$('photo-view').classList.contains('hidden')) return this.closePhoto();
    if (!$('chest').classList.contains('hidden') && !$('chest').classList.contains('shaking')) return $('chest').classList.add('hidden');
    if (!$('egg').classList.contains('hidden') && $('egg').classList.contains('open')) $('egg').classList.add('hidden');
  }
  // parent: the panel that BACK returns to (the menu when there is none)
  openPanel(name, parent) {
    this.parentOf = this.parentOf || {};
    if (parent) this.parentOf[name] = parent;
    this.markSeen(name);
    this.panel = name;
    $('menu').classList.add('hidden');
    $('panel').classList.remove('hidden');
    $('panel').dataset.panel = name;
    document.body.classList.add('panel-open');
    if (name === 'shop') this.preview = { skin: this.p.skin, hat: this.p.hat, pet: this.p.pet, trail: this.p.trail, dance: this.p.dance, theme: this.p.theme };
    if (name === 'lan') this.lanView = this.g.lan && this.g.lan.role !== 'idle' ? this.lanView : 'home';
    if (name === 'levels') this.lvConfirm = -1;
    $('panel-body').scrollTop = 0; // a new panel starts at the top, not where the last one was scrolled
    this.renderPanel();
    if (name === 'lan') this.startLan();
  }
  // the level editor: i = index in the list, -1 for a new track
  editLevel(i) {
    this.lvEdit = startEdit(i);
    this.lvEditIdx = i;
    this.openPanel('leveledit');
  }
  closePanel(silent) {
    if (!this.panel) return;
    const was = this.panel;
    // leaving the editor goes back to the list of tracks, not to the menu
    if (was === 'leveledit' && !silent) return this.openPanel('levels');
    this.panel = null;
    $('panel').classList.add('hidden');
    document.body.classList.remove('panel-open');
    if ((was === 'shop' || was === 'editor') && (this.preview.skin !== this.p.skin || this.preview.hat !== this.p.hat || this.preview.pet !== this.p.pet || was === 'editor')) {
      if (was === 'editor') this.g.setCustomSkin(this.p.customSkin); // leaving without saving
      this.g.previewDino(this.p.skin, this.p.hat, this.p.pet);
    }
    if (was === 'shop' && this.preview.theme !== this.p.theme) this.g.applyTheme(this.p.theme); // only tried on
    if (!silent) this.menuInfo();
    if (was === 'lan') this.stopScan();
    if (was === 'lan' && !silent) this.g.lanLeave();
    if (was === 'transfer') this.stopTransfer();
    if (was === 'jukebox') this.g.menuMusic(true);
    const parent = this.parentOf && this.parentOf[was];
    if (!silent && parent && this.g.state === 'menu') return this.openPanel(parent);
    if (!silent && this.g.state === 'menu') {
      $('menu').classList.remove('hidden');
      this.badges();
    }
  }
  renderPanel() {
    const titles = { bestiary: 'bestiary', collection: 'collection', progress: 'progress', shop: 'shop', missions: 'missions', stats: 'stats', settings: 'settings', lan: 'mpTitle', modes: 'modes', adventure: 'adventure', album: 'album', transfer: 'transfer', editor: 'edTitle', challenge: 'chTitle', pass: 'passTitle', levels: 'lvTitle', leveledit: 'lvEditTitle', jukebox: 'jukebox' };
    $('panel-title').textContent = t(titles[this.panel]);
    this.setCoins();
    const body = $('panel-body');
    const render = {
      shop: () => this.shopView(),
      bestiary: () => this.bestiaryView(),
      collection: () => this.collectionView(),
      progress: () => this.progressView(),
      missions: () => this.missionsView(),
      stats: () => this.statsView(),
      settings: () => this.settingsView(),
      lan: () => this.lanViewEl(),
      modes: () => this.modesView(),
      adventure: () => this.adventureView(),
      album: () => this.albumView(),
      transfer: () => this.transferView(),
      challenge: () => this.challengeView(),
      pass: () => this.passView(),
      jukebox: () => this.jukeboxView(),
      levels: () => levelsView(this),
      leveledit: () => levelEditView(this),
      editor: () =>
        skinEditorView(this, () => {
          this.shopTab = 'skin';
          this.openPanel('shop');
        }),
    }[this.panel];
    const scroll = body.scrollTop;
    body.replaceChildren(render());
    body.scrollTop = scroll;
  }

  // ------------------------------------------------------------ shop
  shopView() {
    const p = this.p;
    const TABS = { skin: 'shopSkins', hat: 'shopHats', pet: 'shopPets', trail: 'shopTrails', dance: 'shopDances', theme: 'shopThemes', upgrade: 'shopUpgrades', title: 'shopTitles', album: 'shopAlbum', mastery: 'shopMastery' };
    const tabs = el(
      'div',
      { class: 'tabs' },
      Object.entries(TABS).map(([tab, label]) =>
        el('button', {
          class: 'tab' + (this.shopTab === tab ? ' on' : ''),
          text: t(label),
          onclick: () => {
            this.shopTab = tab;
            this.renderPanel();
          },
        }),
      ),
    );
    if (this.shopTab === 'upgrade') return el('div', {}, tabs, this.upgradesView());
    if (this.shopTab === 'title') return el('div', {}, tabs, this.titlesView());
    if (this.shopTab === 'album') return el('div', {}, tabs, this.stickersView());
    if (this.shopTab === 'mastery') return el('div', {}, tabs, this.masteryView());
    const kind = this.shopTab;
    const list = { skin: SKINS, hat: HATS, pet: PETS, trail: TRAILS, dance: DANCES, theme: THEMES }[kind];
    const owned = p.owned[kind];
    const grid = el('div', { class: 'cards' });
    if (kind === 'skin' || kind === 'hat' || kind === 'pet') grid.append(this.eggCard(), this.eggCard(true));
    for (const [id, item] of Object.entries(list)) {
      if (item.hidden) continue;
      const have = owned.includes(id);
      const status = item.editor && have ? t('edOpen') : id === p[kind] ? t('equipped') : have ? t('owned') : null;
      if ((item.season || item.album || item.pass || item.boss) && !have) continue; // gifts are shown once you have them
      const icon =
        kind === 'skin' ? dinoIcon(id) : kind === 'hat' ? hatIcon(id) : kind === 'pet' ? petIcon(id) : kind === 'dance' ? danceIcon(id, p.skin) : kind === 'theme' ? themeIcon(id) : trailIcon(id);
      const price = item.level
        ? el('span', { class: 'card-price' }, t('levelShort', { n: item.level }))
        : el('span', { class: 'card-price' }, bone(), ' ' + item.price);
      const petLv = kind === 'pet' && have && id !== 'none' ? petLevel(id) : 0;
      const card = el(
        'button',
        { class: 'card' + (id === this.preview[kind] ? ' sel' : '') + (have ? '' : ' locked') },
        icon,
        el('span', { class: 'card-name', text: t(kind + '_' + id) }),
        petLv ? el('span', { class: 'small', text: t('petLevel', { n: petLv }) }) : null,
        status ? el('span', { class: 'card-tag', text: status }) : price,
      );
      card.addEventListener('click', () => this.shopClick(kind, id, item, have));
      grid.append(card);
    }
    const info = kind === 'pet' ? this.petInfo(this.preview.pet) : null;
    return el('div', {}, tabs, kind === 'skin' || kind === 'hat' ? this.dailyShopEl() : null, info, grid);
  }
  // the shop of the day: three things you do not have yet, 30% off, the same all day
  dailyOffers() {
    const d = new Date();
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    if (this.p.dailyShop.date !== key) this.p.dailyShop = { date: key, bought: [] };
    if (this.p.dailyShop.offers) return this.p.dailyShop.offers; // the same three all day
    const pool = [
      ...Object.entries(SKINS).filter(([id, it]) => it.price > 0 && !it.editor && !this.p.owned.skin.includes(id)).map(([id, it]) => ['skin', id, it.price]),
      ...Object.entries(HATS).filter(([id, it]) => it.price > 0 && !this.p.owned.hat.includes(id)).map(([id, it]) => ['hat', id, it.price]),
    ].sort((a, b) => (a[0] + a[1] < b[0] + b[1] ? -1 : 1));
    let seed = [...key].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
    const out = [];
    while (pool.length && out.length < 3) {
      seed = (seed * 1103515245 + 12345) >>> 0;
      const [kind, id, price] = pool.splice(seed % pool.length, 1)[0];
      out.push({ kind, id, price: Math.round((price * 0.7) / 5) * 5 });
    }
    this.p.dailyShop.offers = out;
    save();
    return out;
  }
  dailyShopEl() {
    const offers = this.dailyOffers().filter((o) => !this.p.dailyShop.bought.includes(o.kind + ':' + o.id));
    if (!offers.length) return null;
    return el(
      'div',
      { class: 'daily-shop' },
      el('b', { text: t('dailyShop') }),
      el(
        'div',
        { class: 'cards' },
        offers.map((o) => {
          const icon = o.kind === 'skin' ? dinoIcon(o.id) : hatIcon(o.id);
          const full = (o.kind === 'skin' ? SKINS : HATS)[o.id].price;
          return el(
            'button',
            {
              class: 'card deal',
              onclick: () => {
                if (this.p.coins < o.price) return this.toast(t('notEnough'), 'red');
                this.p.coins -= o.price;
                this.p.owned[o.kind].push(o.id);
                this.p[o.kind] = o.id;
                this.p.dailyShop.bought.push(o.kind + ':' + o.id);
                save();
                this.g.sfx.reward();
                this.toast(t('bought'), 'gold');
                this.preview[o.kind] = o.id;
                this.g.previewDino(this.preview.skin, this.preview.hat, this.preview.pet);
                this.g.lanSetLook();
                this.renderPanel();
              },
            },
            icon,
            el('span', { class: 'card-name', text: t(o.kind + '_' + o.id) }),
            el('span', { class: 'card-price' }, el('s', { text: String(full) }), ' ', bone(), ' ' + o.price),
          );
        }),
      ),
    );
  }
  // what the chosen pet can do now, and what it learns as it grows
  petInfo(id) {
    if (!id || id === 'none') return el('p', { class: 'small muted', text: t('petHelp') });
    const pr = petProgress(id);
    const owned = this.p.owned.pet.includes(id);
    const lines = [];
    for (let l = 1; l <= PET_MAX; l++) {
      const pw = petPower(id, l);
      const what =
        id === 'turtle' ? t('petPw_turtle', { n: pw.bones100 }) : id === 'ptera' ? t('petPw_ptera', { n: Math.round((pw.reach / 1.4) * 100) }) : id === 'frog' ? t('petPw_frog', { n: pw.tongue.toFixed(1) }) : t('petPw_chick', { n: Math.round((pw.powerK - 1) * 100) });
      lines.push(el('li', { class: owned && l <= pr.level ? 'on' : 'muted' }, `${t('petLevel', { n: l })}: ${what}${l === PET_MAX ? ' · ' + t('petPw_shield') : ''}`));
    }
    return el(
      'div',
      { class: 'pet-info' },
      el('b', { text: t('pet_' + id) + (owned ? ' · ' + t('petLevel', { n: pr.level }) : '') }),
      owned && pr.need ? el('div', { class: 'bar' }, el('i', { style: `width:${Math.round((pr.into / pr.need) * 100)}%` })) : null,
      el('p', { class: 'small muted', text: owned ? (pr.need ? t('petGrow', { a: pr.into, b: pr.need }) : t('petMax')) : t('petHelp') }),
      el('ul', { class: 'pet-levels small' }, lines),
      // pet food: bones make it grow faster
      owned && pr.need && id === this.p.pet
        ? el('button', {
            class: 'menu-btn',
            text: t('petFeed', { n: PET_FOOD_PRICE, d: PET_FOOD_XP }),
            onclick: () => {
              if (this.p.coins < PET_FOOD_PRICE) return this.toast(t('notEnough'), 'red');
              const r = feedPet(PET_FOOD_PRICE, PET_FOOD_XP);
              if (!r) return;
              this.g.sfx.reward();
              if (r.level) {
                this.toast(t(r.level >= PET_MAX ? 'petEvolved' : 'petGrew', { name: t('pet_' + id), n: r.level }), 'gold');
                this.g.previewDino(this.p.skin, this.p.hat, this.p.pet, true);
              } else this.toast(t('petFed'), 'gold');
              this.renderPanel();
            },
          })
        : null,
    );
  }
  // gold: the golden egg, only the expensive things inside
  eggCard(gold = false) {
    const left = eggPoolSize(gold);
    const card = el(
      'button',
      { class: 'card egg-card' + (gold ? ' gold-egg' : '') + (left ? '' : ' locked') },
      el('span', { class: 'egg-icon' }),
      el('span', { class: 'card-name', text: t(gold ? 'eggGold' : 'egg') }),
      left ? el('span', { class: 'card-price' }, bone(), ' ' + (gold ? GOLD_EGG_PRICE : EGG_PRICE)) : el('span', { class: 'card-tag', text: t('eggEmpty') }),
    );
    card.addEventListener('click', () => this.openEggClick(gold));
    return card;
  }
  openEggClick(gold = false) {
    if (!eggPoolSize(gold)) return this.toast(t('eggEmpty'), 'gold');
    if (this.p.coins < (gold ? GOLD_EGG_PRICE : EGG_PRICE)) return this.toast(t('notEnough'), 'red');
    const prize = openEgg(gold);
    if (!prize) return;
    const box = $('egg');
    const result = $('egg-result');
    result.replaceChildren();
    box.classList.remove('hidden', 'open');
    void box.offsetWidth;
    box.classList.add('shaking');
    this.g.sfx.beep();
    setTimeout(() => {
      box.classList.remove('shaking');
      box.classList.add('open');
      this.g.sfx.reward();
      const icon = prize.kind === 'skin' ? dinoIcon(prize.id) : prize.kind === 'hat' ? hatIcon(prize.id) : petIcon(prize.id);
      result.append(icon, el('p', { text: t('eggGot', { name: t(prize.kind + '_' + prize.id) }) }));
      this.renderPanel();
    }, 1300);
  }
  // ------------------------------------------------------------ v1.8: the long-term shop
  // what each tab is for, with its picture, at the top of the tab
  shopHelp(icon, key, vars) {
    return infoRow(icon, t(key + 'Title'), t(key, vars), null);
  }
  // after anything that could earn a title
  earnedTitles() {
    for (const id of checkEarnedTitles()) this.toast(t('titleGot', { name: TITLES[id].icon + ' ' + t('title_' + id) }), 'gold');
  }
  titlesView() {
    const p = this.p;
    const grid = el('div', { class: 'cards titles' });
    for (const [id, tt] of Object.entries(TITLES)) {
      const have = p.titles.includes(id);
      const worn = p.title === id;
      const tag = worn ? t('titleWorn') : have ? t('titleWear') : null;
      const price = tt.price ? el('span', { class: 'card-price' }, bone(), ' ' + tt.price) : el('span', { class: 'card-price small', text: t('titleHow_' + tt.earn) });
      grid.append(
        el(
          'button',
          {
            class: 'card' + (worn ? ' sel' : '') + (have ? '' : ' locked'),
            onclick: () => {
              if (have) p.title = worn ? '' : id;
              else if (!tt.price) return this.toast(t('titleHow_' + tt.earn), 'gold');
              else if (!buyTitle(id)) return this.toast(t('notEnough'), 'red');
              else {
                this.g.sfx.reward();
                this.toast(t('bought'), 'gold');
              }
              save();
              this.g.lanSetLook?.();
              this.renderPanel();
            },
          },
          el('span', { class: 'title-ico', 'aria-hidden': 'true', text: tt.icon }),
          el('span', { class: 'card-name', text: t('title_' + id) }),
          tag ? el('span', { class: 'card-tag', text: tag }) : price,
        ),
      );
    }
    return el('div', {}, this.shopHelp('🏷️', 'titlesHelp'), grid);
  }
  stickersView() {
    const p = this.p;
    const last = this.lastPack;
    const openBtn = el('button', {
      class: 'menu-btn primary',
      onclick: () => {
        const r = openPack();
        if (!r) return this.toast(t('notEnough'), 'red');
        this.g.sfx.reward();
        this.lastPack = r.stickers;
        for (const n of r.pages) this.toast(t('albumPageDone', { name: t('albumPage_' + PAGES[n].id), n: PAGE_REWARD }), 'gold');
        this.earnedTitles();
        this.renderPanel();
      },
    });
    openBtn.append('🎴 ' + t('albumOpen', { n: PACK_SIZE }) + ' · ', bone(), ' ' + PACK_PRICE);
    const pages = PAGES.map((pg, n) =>
      el(
        'div',
        { class: 'album-page' + (pageDone(n) ? ' done' : '') },
        el('h3', { text: (pageDone(n) ? '✅ ' : '') + t('albumPage_' + pg.id) }),
        el(
          'div',
          { class: 'stickers' },
          STICKERS.filter((s) => s.page === n).map((s) => {
            const have = p.stickers[s.id] || 0;
            const cost = GLITTER_COST[s.r];
            return el(
              'button',
              {
                class: `sticker r-${s.r}` + (have ? ' have' : ''),
                title: t('rarity_' + s.r),
                'aria-label': (have ? s.e : '?') + ' · ' + t('rarity_' + s.r) + (have ? '' : ' · ✨' + cost),
                onclick: () => {
                  if (have) return this.toast(s.e + ' ×' + have + ' · ' + t('rarity_' + s.r), 'gold');
                  if (p.glitter < cost) return this.toast(t('albumNeedGlitter', { n: cost }), 'red');
                  const r = craftSticker(s.id);
                  if (!r) return;
                  this.g.sfx.reward();
                  for (const k of r.pages) this.toast(t('albumPageDone', { name: t('albumPage_' + PAGES[k].id), n: PAGE_REWARD }), 'gold');
                  this.earnedTitles();
                  this.renderPanel();
                },
              },
              el('span', { class: 'st-e', 'aria-hidden': 'true', text: have ? s.e : '?' }),
              have > 1 ? el('i', { text: '×' + have }) : have ? null : el('i', { text: '✨' + cost }),
            );
          }),
        ),
      ),
    );
    return el(
      'div',
      { class: 'album' },
      this.shopHelp('📒', 'stkHelp', { n: PAGE_REWARD }),
      el('p', { class: 'album-count', text: t('albumCount', { n: stickerCount(), max: STICKERS.length }) + ' · ✨ ' + t('glitter', { n: p.glitter }) }),
      openBtn,
      last ? el('div', { class: 'pack-open' }, last.map((s, i) => el('span', { class: `sticker big r-${s.r}`, style: `animation-delay:${i * 0.15}s` }, el('span', { class: 'st-e', text: s.e }), el('i', { text: s.dup ? t('albumDup') : t('albumNew') })))) : null,
      el('p', { class: 'muted small', text: t('albumRarity') }),
      pages,
    );
  }
  masteryView() {
    const p = this.p;
    const rows = p.owned.skin
      .filter((id) => SKINS[id] && !SKINS[id].hidden)
      .map((id) => {
        const r = masteryOf(id);
        const cost = masteryCost(id);
        const btn =
          cost == null
            ? el('span', { class: 'card-tag', text: t('maxed') })
            : el('button', {
                class: 'val',
                onclick: () => {
                  if (!buyMastery(id)) return this.toast(t('notEnough'), 'red');
                  this.g.sfx.reward();
                  this.toast(t('masteryUp', { name: t('skin_' + id), n: masteryOf(id) }), 'gold');
                  this.earnedTitles();
                  this.renderPanel();
                },
              });
        if (cost != null) btn.append(bone(), ' ' + cost);
        return el(
          'div',
          { class: 'upgrade mastery' + (p.skin === id ? ' worn' : '') },
          dinoIcon(id),
          el('div', {}, el('p', { text: t('skin_' + id) + (p.skin === id ? ' · ' + t('equipped') : '') }), el('p', { class: 'stars', text: stars(r) }), el('p', { class: 'muted small', text: t('masteryBonus', { n: Math.round(r * MASTERY_BONUS * 100) }) })),
          btn,
        );
      });
    return el('div', { class: 'upgrades' }, this.shopHelp('⭐', 'masteryHelp', { n: Math.round(MASTERY_BONUS * 100), a: MASTERY[0], b: MASTERY[1], c: MASTERY[2] }), rows);
  }

  upgradesView() {
    const rows = Object.keys(UPGRADES).map((id) => {
      const lvl = upgradeLevel(id);
      const max = UPGRADES[id].cost.length;
      const cost = nextUpgradeCost(id);
      const dots = el('span', { class: 'dots' }, Array.from({ length: max }, (_, i) => el('i', { class: i < lvl ? 'on' : '' })));
      const btn =
        cost == null
          ? el('span', { class: 'card-tag', text: t('maxed') })
          : el('button', {
              class: 'val',
              onclick: () => {
                if (buyUpgrade(id)) {
                  this.g.sfx.reward();
                  this.toast(t('bought'), 'gold');
                } else this.toast(t('notEnough'), 'red');
                this.renderPanel();
              },
            });
      if (cost != null) btn.append(bone(), ' ' + cost);
      return el('div', { class: 'upgrade' }, el('div', {}, el('p', { text: t('up_' + id) }), el('p', { class: 'muted small', text: t('upd_' + id) }), dots), btn);
    });
    return el('div', { class: 'upgrades' }, rows);
  }
  shopClick(kind, id, item, have) {
    const p = this.p;
    const selected = this.preview[kind] === id;
    this.preview[kind] = id;
    if (kind === 'dance') this.g.previewDance(id);
    if (kind === 'theme') this.g.applyTheme(id);
    if (item.editor && have && selected) return this.openPanel('editor');
    if (have) {
      p[kind] = id;
      save();
      this.g.lanSetLook();
    } else if (item.level) {
      this.toast(t('needLevel', { n: item.level }), 'gold');
    } else if (selected) {
      // second tap on a locked item buys it
      if (p.coins >= item.price) {
        p.coins -= item.price;
        p.owned[kind].push(id);
        p[kind] = id;
        save();
        this.g.sfx.reward();
        this.toast(t('bought'), 'gold');
        this.g.lanSetLook();
        if (item.editor) return this.openPanel('editor');
      } else {
        this.toast(t('notEnough'), 'red');
      }
    }
    if (kind === 'trail' && have) this.p.trail = id;
    this.g.previewDino(this.preview.skin, this.preview.hat, this.preview.pet);
    this.renderPanel();
  }


  // ------------------------------------------------------------ modes
  modesView() {
    const g = this.g;
    const d = dailyInfo();
    const s = this.p.settings;
    // every card has its own little animated picture next to the name and the explanation
    const head = (key) => el('span', { class: 'mode-head' }, el('span', { class: 'mode-ico', 'aria-hidden': 'true', text: MODE_ICON[key] || '🦖' }), el('b', { text: t(key) }));
    const card = (key, desc, fn, extra) =>
      el(extra ? 'div' : 'button', { class: 'mode-card' + (extra ? ' has-extra' : ''), onclick: extra ? null : fn, role: extra ? null : 'button', 'aria-label': t(key) + '. ' + desc }, head(key), el('span', { class: 'small muted', text: desc }), extra || null);
    // the robot's level: all three visible, the chosen one explained
    const botBtn = el(
      'div',
      { class: 'mode-extra' },
      choiceRow({
        label: t('botLevelLabel'),
        options: [0, 1, 2].map((v) => ({ v, icon: ['🐣', '🤖', '🔥'][v], name: t('bot_' + v), desc: t('optDesc_bot_' + v) })),
        value: s.botLevel,
        pick: (v) => {
          s.botLevel = v;
          save();
          this.renderPanel();
        },
      }),
      el('button', { class: 'menu-btn primary', text: t('mode_bot') + ' ▶', onclick: () => g.startMode('bot') }),
    );
    // versus or co-op (3 shared hearts and a team boss), then how many players
    const localBtns = el(
      'div',
      { class: 'mode-extra' },
      choiceRow({
        label: t('localModeLabel'),
        options: [
          { v: false, icon: '🆚', name: t('localVs'), desc: t('optDesc_localVs') },
          { v: true, icon: '🤝', name: t('localCoop'), desc: t('optDesc_localCoop') },
        ],
        value: !!this.localCoop,
        pick: (v) => {
          this.localCoop = v;
          this.renderPanel();
        },
      }),
      el('p', { class: 'small muted', text: t('localPlayers') }),
      el(
        'span',
        { class: 'mode-count' },
        [2, 3, 4].map((n) =>
          el('button', {
            class: 'val',
            text: '👤'.repeat(n) + ' ' + n,
            'aria-label': String(n),
            onclick: (e) => {
              e.stopPropagation();
              g.startMode('local', { count: n, coop: !!this.localCoop });
            },
          }),
        ),
      ),
    );
    const un = unlocks();
    const st = this.badgeState();
    // a mode that opens later: shown greyed out, with what it takes to open it
    const locked = (key, need) => el('div', { class: 'mode-card locked' }, el('span', { class: 'mode-head' }, el('span', { class: 'mode-ico', 'aria-hidden': 'true', text: '🔒' }), el('b', { text: t(key) })), el('span', { class: 'small muted', text: need }));
    const mu = todayMutator();
    const withBadge = (c, on) => (on && c.classList.add('badge'), c);
    return el(
      'div',
      { class: 'modes' },
      card('mode_adventure', t('modeDesc_adventure', { n: totalStars(), max: BIOMES.length * ADV_LEVELS * 3 }), () => this.openPanel('adventure', 'modes')),
      withBadge(card('daily', d.done ? t('dailyDoneShort', { n: d.streak }) : t('dailyTarget', { n: d.target, b: d.reward }), () => g.startMode('daily')), st.daily),
      advStars(0, ADV_LEVELS - 1) > 0
        ? card('mode_bossrush', t('modeDesc_bossrush', { n: this.p.bossRush.best, max: ADV_ORDER.length, time: this.p.bossRush.time ? this.p.bossRush.time + 's' : '-' }), () => g.startMode('bossrush'))
        : locked('mode_bossrush', t('unlockBossRush')),
      card('mode_mutator', t('mut_' + mu.id) + ' · ' + t('mutDesc', { k: mu.bones, n: mu.best }), () => g.startMode('mutator')),
      un.lan ? card('multiplayer', t('modeDesc_lan'), () => this.openPanel('lan', 'modes')) : locked('multiplayer', t('unlockAfter', { n: 5 })),
      advUnlocked(SEASON_W, 0)
        ? card('mode_season', t('modeDesc_season', { name: t('biome_season'), n: seasonRunBest() }), () => this.playSeasonRun())
        : locked('mode_season', t('seasonWorldHow', { n: SEASON_PASS_TIER })),
      card('mode_zen', t('modeDesc_zen'), () => g.startMode('zen')),
      card('mode_hardcore', t('modeDesc_hardcore'), () => g.startMode('hardcore')),
      card('mode_bot', t('modeDesc_bot'), () => g.startMode('bot'), botBtn),
      un.levels ? withBadge(card('mode_custom', t('modeDesc_custom', { n: this.p.levels.length }), () => this.openPanel('levels', 'modes')), st.levels) : locked('mode_custom', t('unlockLevels')),
      card('mode_challenge', t('modeDesc_challenge'), () => {
        // scanning a friend's challenge uses the same scanner as the progress transfer
        this.xferTab = 'scan';
        this.openPanel('transfer', 'modes');
      }),
      un.lan ? card('mode_local', t('modeDesc_local'), null, localBtns) : locked('mode_local', t('unlockAfter', { n: 5 })),
    );
  }

  // ------------------------------------------------------------ adventure map
  // a winding road through the worlds: every world is a little scene in its own colours,
  // with its three levels as stops on the road and the dino standing at the next one
  adventureView() {
    let here = null; // the first open level without stars: where the dino stands
    for (const w of ADV_ORDER) for (let l = 0; l < ADV_LEVELS; l++) if (!here && advUnlocked(w, l) && !advStars(w, l)) here = [w, l];
    const worlds = ADV_ORDER.map((w, pos) => {
      const b = BIOMES[w];
      const open0 = advUnlocked(w, 0);
      const stops = Array.from({ length: ADV_LEVELS }, (_, l) => {
        const open = advUnlocked(w, l);
        const st = advStars(w, l);
        const isHere = here && here[0] === w && here[1] === l;
        const btn = el(
          'button',
          { class: 'stop' + (open ? '' : ' locked') + (l === ADV_LEVELS - 1 ? ' boss' : '') + (st ? ' done' : '') + (isHere ? ' here' : ''), disabled: !open },
          isHere ? dinoIcon(this.p.skin) : null,
          el('span', { class: 'stop-n', text: l === ADV_LEVELS - 1 ? t('bossShort') : String(pos * ADV_LEVELS + l + 1) }),
          el('span', { class: 'mini-stars' }, [0, 1, 2].map((i) => el('i', { class: i < st ? 'on' : '' }))),
          this.p.advCrowns[levelKey(w, l)] ? el('span', { class: 'crown', text: '👑' }) : null,
        );
        const best = this.p.advTimes[levelKey(w, l) + (advHardOn() ? 'h' : '')];
        if (best) btn.title = t('bestTime', { n: best });
        btn.addEventListener('click', () => this.playLevel(w, l));
        return btn;
      });
      const story = el('button', { class: 'val story-btn', text: '📖', 'aria-label': t('storyRead'), title: t('storyRead'), disabled: !open0, onclick: () => this.showStory(w) });
      return el(
        'div',
        { class: 'map-world' + (pos % 2 ? ' rev' : '') + (open0 ? '' : ' locked'), style: `--sky:${b.sky};--ground:${b.ground};--path:${b.path}` },
        el('div', { class: 'map-head' }, el('b', { text: t('biome_' + b.id) }), story),
        el('div', { class: 'map-road' }, stops),
        b.seasonal && !open0 ? el('p', { class: 'small', text: t('seasonWorldHow', { n: SEASON_PASS_TIER }) }) : null,
      );
    });
    const plus = advPlusOpen()
      ? el(
          'div',
          {},
          infoRow('👑', t('advPlus'), t('advPlusHelp', { n: Object.keys(this.p.advCrowns).length, max: ADV_ORDER.length * ADV_LEVELS }), switchBtn(advHardOn(), () => {
            this.p.advHard = !this.p.advHard;
            save();
            this.renderPanel();
          }, t('advPlus'))),
        )
      : null;
    return el('div', { class: advHardOn() ? 'adv-hard' : '' }, el('p', { class: 'small muted', text: t('advHelp') }), plus, el('div', { class: 'adv-map' }, worlds));
  }
  // the story page of a world comes before its first level, the first time
  playLevel(w, l) {
    const start = () => this.g.startMode('adventure', { world: w, level: l });
    if (l === 0 && !this.p.storySeen.includes(w)) return this.showStory(w, start);
    start();
  }
  // the season run has a story page of its own, a new one every season (shown once)
  playSeasonRun() {
    const start = () => this.g.startMode('season');
    if (!this.p.storySeen.includes('s2' + SEASON_WORLD)) return this.showStory('s2', start);
    start();
  }
  // w: a world index, 'end' for the last page (after the last boss) or 's2' for the
  // second chapter of the season world (the season run)
  showStory(w, then) {
    if (w === 's2') return this.showSeasonStory(then);
    const end = w === 'end';
    const b = end ? BIOMES[LAST_STORY_W] : BIOMES[w];
    const scene = $('story-scene');
    scene.style.cssText = `--sky:${b.sky};--ground:${b.ground}`;
    const kind = end ? null : BOSS_KIND[b.id];
    scene.replaceChildren(
      el('span', { class: 'story-sky', text: end ? '✨🌠✨' : '☄️' }),
      el('span', { class: 'story-boss', text: kind ? BOSS_EMOJI[kind] || '' : '🥳' }),
      dinoIcon(this.p.skin),
    );
    $('story-title').textContent = end ? t('storyEndTitle') : t('storyChapter', { n: advPos(w) + 1, name: t('biome_' + b.id) });
    $('story-text').textContent = t(end ? 'story_end' : b.seasonal ? 'story_season_' + SEASON_WORLD : 'story_' + b.id);
    $('story-ok').textContent = then ? t('storyGo') : t('newsOk');
    this.storyThen = then || null;
    $('story').classList.remove('hidden');
    const key = end ? 'end' : w;
    if (!this.p.storySeen.includes(key)) {
      this.p.storySeen.push(key);
      save();
    }
  }
  showSeasonStory(then) {
    const b = BIOMES[SEASON_W];
    $('story-scene').style.cssText = `--sky:${b.sky};--ground:${b.ground}`;
    $('story-scene').replaceChildren(el('span', { class: 'story-sky', text: '🌙' }), el('span', { class: 'story-boss', text: BOSS_EMOJI.ghost }), dinoIcon(this.p.skin));
    $('story-title').textContent = t('storyChapter', { n: 2, name: t('biome_season') });
    $('story-text').textContent = t('story2_season_' + SEASON_WORLD);
    $('story-ok').textContent = then ? t('storyGo') : t('newsOk');
    this.storyThen = then || null;
    $('story').classList.remove('hidden');
    const key = 's2' + SEASON_WORLD;
    if (!this.p.storySeen.includes(key)) {
      this.p.storySeen.push(key);
      save();
    }
  }
  closeStory() {
    $('story').classList.add('hidden');
    const fn = this.storyThen;
    this.storyThen = null;
    if (fn) {
      this.closePanel(true);
      fn();
    }
  }

  // ------------------------------------------------------------ album: fossils, medals, photos
  albumView() {
    const tab = this.albumTab || 'fossils';
    const tabs = el(
      'div',
      { class: 'tabs' },
      [
        ['fossils', 'albumFossils'],
        ['medals', 'albumMedals'],
        ['photos', 'albumPhotos'],
      ].map(([id, key]) =>
        el('button', {
          class: 'tab' + (tab === id ? ' on' : ''),
          text: t(key),
          onclick: () => {
            this.albumTab = id;
            this.renderPanel();
          },
        }),
      ),
    );
    const body = tab === 'medals' ? this.medalsView() : tab === 'photos' ? this.photosView() : this.fossilsView();
    return el('div', {}, tabs, body);
  }

  // a bronze, silver and gold medal for every statistic
  medalsView() {
    // medals earned since the last run (or by an older version of the game) are given right away
    for (const m of checkMedals()) this.toast(t('medalGot', { medal: t('medal_' + MEDAL_NAMES[m.tier]), name: t('st_' + m.stat), n: m.reward }), 'gold');
    this.setCoins();
    const s = this.p.stats;
    const c = medalCount();
    const fmt = (k, v) => (k === 'time' ? `${Math.floor(v / 3600)}h` : String(v));
    const rows = Object.entries(MEDALS).map(([k, steps]) => {
      const have = medalOf(k);
      const v = s[k] || 0;
      const next = steps[have];
      const prev = have ? steps[have - 1] : 0;
      const pct = next == null ? 100 : Math.round((Math.max(0, v - prev) / (next - prev)) * 100);
      return el(
        'div',
        { class: 'medal-row' + (have === 3 ? ' done' : '') },
        el('div', { class: 'medals' }, [1, 2, 3].map((tier) => el('i', { class: 'medal ' + MEDAL_NAMES[tier] + (tier <= have ? ' on' : ''), title: t('medal_' + MEDAL_NAMES[tier]) }))),
        el(
          'div',
          { class: 'medal-info' },
          el('span', { text: t('st_' + k) }),
          el('div', { class: 'bar' }, el('i', { style: `width:${Math.min(100, pct)}%` })),
          el('small', { class: 'muted', text: next == null ? t('medalAll') : `${fmt(k, v)} / ${fmt(k, next)} · +${MEDAL_REWARD[have + 1]}` }),
        ),
      );
    });
    return el(
      'div',
      {},
      el('p', { class: 'small', text: t('medalsHelp', { g: c.gold, s: c.silver, b: c.bronze, max: c.total }) }),
      el('div', { class: 'medal-list' }, rows),
    );
  }

  // the photo gallery: pictures from photo mode
  photosView() {
    const box = el('div', { class: 'gallery' }, el('p', { class: 'muted gallery-empty', text: '…' }));
    listPhotos()
      .then((list) => {
        if (!list.length) return box.replaceChildren(el('p', { class: 'muted gallery-empty', text: t('photosNone') }));
        box.replaceChildren(
          ...list.map((ph) => {
            const b = el('button', { class: 'thumb', 'aria-label': new Date(ph.d).toLocaleString() }, el('img', { src: ph.thumb, alt: '' }));
            b.addEventListener('click', () => this.openPhoto(ph.id));
            return b;
          }),
        );
      })
      .catch(() => box.replaceChildren(el('p', { class: 'muted gallery-empty', text: t('photoFailed') })));
    return el('div', {}, el('p', { class: 'small', text: t('photosHelp', { n: MAX_PHOTOS }) }), box);
  }
  async openPhoto(id) {
    let ph;
    try {
      ph = await getPhoto(id);
    } catch {
      ph = null;
    }
    if (!ph) return this.toast(t('photoFailed'), 'red');
    this.photoShown = ph;
    this.photoDelAsk = false;
    $('photo-view-img').src = ph.full;
    $('photo-view-date').textContent = new Date(ph.d).toLocaleString();
    $('photo-view').classList.remove('hidden');
    const share = $('photo-view-share');
    share.textContent = t('share');
    share.onclick = async (e) => {
      e.stopPropagation();
      try {
        this.shareData(await toPng(ph.full));
      } catch {
        this.toast(t('shareFailed'), 'red');
      }
    };
    const del = $('photo-view-del');
    del.textContent = t('photoDelete');
    del.onclick = async (e) => {
      e.stopPropagation();
      if (!this.photoDelAsk) {
        this.photoDelAsk = true;
        del.textContent = t('photoDeleteSure');
        return;
      }
      await deletePhoto(ph.id).catch(() => {});
      this.closePhoto();
      if (this.panel === 'album') this.renderPanel();
    };
    $('photo-view-close').textContent = t('close');
  }
  closePhoto() {
    $('photo-view').classList.add('hidden');
    $('photo-view-img').removeAttribute('src');
    this.photoShown = null;
  }

  fossilsView() {
    const have = new Set(this.p.fossils);
    const total = allFossils().length;
    const rows = BIOMES.filter((b) => !b.seasonal).map((b) => {
      const done = FOSSIL_KINDS.every((_, k) => have.has(fossilId(b.id, k)));
      return el(
        'div',
        { class: 'album-row' + (done ? ' done' : '') },
        el('b', { text: t('biome_' + b.id) }),
        el(
          'div',
          { class: 'album-slots' },
          FOSSIL_KINDS.map((_, k) => {
            const id = fossilId(b.id, k);
            const got = have.has(id);
            const icon = pixelIcon(fossilPixels(id));
            return el('div', { class: 'slot' + (got ? ' got' : '') }, got ? icon : el('span', { text: '?' }), el('small', { text: got ? t('fossil_' + k) : '' }));
          }),
        ),
        el('small', { class: done ? 'mission-done' : 'muted', text: done ? t('albumWorldDone') : t('albumReward', { n: FOSSIL_WORLD_REWARD }) }),
      );
    });
    return el('div', {}, el('p', { class: 'small', text: t('albumHelp', { n: have.size, max: total }) }), el('div', { class: 'album' }, rows));
  }

  // ------------------------------------------------------------ progress transfer
  transferView() {
    const tab = this.xferTab || 'qr';
    const tabs = el(
      'div',
      { class: 'tabs' },
      [
        ['qr', 'xferSendQr'],
        ['scan', 'xferScan'],
        ['lan', 'xferLan'],
      ].map(([id, key]) =>
        el('button', {
          class: 'tab' + (tab === id ? ' on' : ''),
          text: t(key),
          onclick: () => {
            this.stopTransfer();
            this.xferTab = id;
            this.renderPanel();
          },
        }),
      ),
    );
    let body;
    if (tab === 'qr') {
      const code = encodeProgress();
      const copy = el('button', { class: 'val', text: t('xferCopy') });
      copy.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(code);
          this.toast(t('xferCopied'), 'gold');
        } catch {
          area.select();
        }
      });
      const area = el('textarea', { class: 'code', readonly: true, rows: 4 });
      area.value = code;
      // a long code makes a dense QR that cameras struggle with: the QR then leaves the tracks out
      let qrCode = code;
      if (new TextEncoder().encode(code).length > QR_LIMIT) qrCode = encodeProgress({ levels: false });
      let qr;
      try {
        qr = qrCanvas(qrCode, 3);
      } catch {
        qr = null; // too big even for the largest QR: the text code and Wi-Fi still work
      }
      const note = qrCode !== code || !qr ? el('p', { class: 'small muted', text: t('xferQrNoLevels') }) : null;
      body = el('div', { class: 'xfer' + (qrCode.length > 600 ? ' qr-big' : '') }, el('p', { class: 'small', text: t('xferQrHelp') }), qr, note, el('p', { class: 'small muted', text: t('xferCodeHelp') }), area, copy);
    } else if (tab === 'scan') {
      const video = el('video', { class: 'scan-video', playsinline: true, muted: true, autoplay: true });
      const camBtn = el('button', { class: 'menu-btn primary', text: t('xferCamera') });
      camBtn.addEventListener('click', () => {
        this.stopTransfer();
        video.classList.add('on');
        this.scanner = new CameraScanner(
          video,
          (text) => {
            video.classList.remove('on');
            this.askImport(text);
          },
          (key) => {
            video.classList.remove('on');
            this.toast(t(key), 'red');
          },
        );
        this.scanner.start();
      });
      const file = el('input', { type: 'file', accept: 'image/*', id: 'xfer-file', class: 'hidden' });
      file.addEventListener('change', async () => {
        if (!file.files[0]) return;
        try {
          this.askImport(await readQrFromImage(file.files[0]));
        } catch (err) {
          this.toast(t(err.message && err.message.startsWith('xfer') ? err.message : 'xferNoQrInImage'), 'red');
        }
        file.value = '';
      });
      const pick = el('button', { class: 'menu-btn', text: t('xferImage'), onclick: () => file.click() });
      const paste = el('textarea', { class: 'code', rows: 3, placeholder: 'ANOTHERDINO;v=1;…', id: 'xfer-paste' });
      const go = el('button', { class: 'val', text: t('xferImport'), onclick: () => this.askImport(paste.value) });
      body = el('div', { class: 'xfer' }, el('p', { class: 'small', text: t('xferScanHelp') }), camBtn, video, pick, file, el('p', { class: 'small muted', text: t('xferPasteHelp') }), paste, go);
    } else {
      body = this.lanTransferView();
    }
    return el('div', {}, tabs, body, el('div', { id: 'xfer-confirm' }));
  }

  askImport(text) {
    if (isLanJoin(text)) return this.joinFromQr(text);
    if (isChallenge(text)) return this.askChallenge(text);
    if (isLevel(text)) return this.askLevel(text);
    let data;
    try {
      data = decodeProgress(text);
    } catch (err) {
      return this.toast(t(err.message || 'xferBadCode'), 'red');
    }
    this.stopTransfer();
    const box = $('xfer-confirm');
    if (!box) return;
    const summary = t('xferSummary', { bones: data.bones, xp: data.xp, skins: data.skins.length, fossils: data.fossils.length, stars: Object.values(data.adventure).reduce((a, b) => a + b, 0) });
    box.replaceChildren(
      el(
        'div',
        { class: 'confirm' },
        el('p', { text: t('xferFound', { name: data.name || '?' }) }),
        el('p', { class: 'small', text: summary }),
        el('p', { class: 'small muted', text: t('xferMergeHelp') }),
        el('button', {
          class: 'menu-btn primary',
          text: t('xferApply'),
          onclick: () => {
            mergeProgress(data);
            this.g.setCustomSkin(this.p.customSkin);
            this.g.applyTheme(this.p.theme);
            this.g.previewDino(this.p.skin, this.p.hat, this.p.pet);
            this.g.applySettings();
            this.toast(t('xferDone'), 'gold');
            this.g.sfx.reward();
            box.replaceChildren();
          },
        }),
      ),
    );
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  lanTransferView() {
    if (!this.g.lanAvailable) return el('div', { class: 'xfer' }, el('p', { text: t('xferLanWebOnly') }));
    const role = this.xferRole;
    if (!role) {
      return el(
        'div',
        { class: 'xfer' },
        el('p', { class: 'small', text: t('xferLanHelp') }),
        el('button', { class: 'menu-btn primary', text: t('xferLanReceive'), onclick: () => this.startLanSync('receive') }),
        el('button', { class: 'menu-btn', text: t('xferLanSend'), onclick: () => this.startLanSync('send') }),
      );
    }
    if (role === 'receive') {
      return el('div', { class: 'xfer' }, el('p', { text: t('xferPinIs') }), el('p', { class: 'pin', text: this.xferPin || '…' }), el('p', { class: 'small muted blink', text: t('xferWaiting') }));
    }
    const pin = el('input', { id: 'xfer-pin', inputmode: 'numeric', maxlength: 4, placeholder: '1234', autocomplete: 'off' });
    // the device list refreshes every second; keep what was typed
    pin.value = this.xferPinTyped || '';
    pin.addEventListener('input', () => (this.xferPinTyped = pin.value.replace(/\D/g, '').slice(0, 4)));
    const list = (this.xferDevices || []).map((d) =>
      el(
        'div',
        { class: 'room' },
        el('span', { text: d.name }),
        el('button', {
          text: t('xferSendTo'),
          onclick: () => {
            if (!/^\d{4}$/.test(pin.value)) return this.toast(t('xferNeedPin'), 'red');
            this.sync.send(d, pin.value, encodeProgress());
            this.toast(t('xferSending'), 'gold');
          },
        }),
      ),
    );
    return el(
      'div',
      { class: 'xfer' },
      el('label', { class: 'field' }, el('span', { text: t('xferEnterPin') }), pin),
      el('div', { class: 'rooms', id: 'xfer-devices' }, list.length ? list : el('p', { class: 'muted small', text: t('xferSearching') })),
    );
  }

  async startLanSync(role) {
    const tr = this.g.transport;
    if (!tr) return;
    this.g.lanLeave();
    this.sync = new LanSync(tr, {
      devices: (list) => {
        this.xferDevices = list;
        if (this.panel === 'transfer' && this.xferRole === 'send' && !document.activeElement?.matches('#xfer-pin')) this.renderPanel();
      },
      received: (text) => {
        this.xferRole = null;
        this.renderPanel();
        this.askImport(text);
      },
      sent: () => this.toast(t('xferSent'), 'gold'),
      error: (key) => this.toast(t(key), 'red'),
    });
    try {
      await this.sync.start();
    } catch (err) {
      this.toast(t('mpPortError', { msg: (err && err.message) || String(err) }), 'red');
      this.sync = null;
      return;
    }
    this.xferRole = role;
    if (role === 'receive') this.xferPin = this.sync.wait(this.p.name || 'Dino');
    else this.sync.browse();
    this.renderPanel();
  }

  stopTransfer() {
    if (this.scanner) this.scanner.stop();
    this.scanner = null;
    if (this.sync) this.sync.stop();
    this.sync = null;
    this.xferRole = null;
    this.xferDevices = [];
    this.xferPinTyped = '';
  }

  // ------------------------------------------------------------ missions
  missionsView() {
    const ms = this.p.missions.active.map((m, i) => {
      const prog = missionProgress(m, null);
      const pct = Math.round((Math.max(0, prog) / m.target) * 100);
      // another mission instead of this one, for a few bones
      const reroll = el('button', {
        class: 'val reroll',
        'aria-label': t('missionReroll', { n: REROLL_PRICE }),
        title: t('missionReroll', { n: REROLL_PRICE }),
        onclick: () => {
          if (!rerollMission(i)) return this.toast(t('notEnough'), 'red');
          this.g.sfx.beep();
          this.renderPanel();
        },
      }, '↻ ', bone(), ' ' + REROLL_PRICE);
      return el(
        'div',
        { class: 'mission' },
        el('p', { text: t('m_' + m.kind, { n: m.target }) }),
        m.scope === 'run' ? null : el('div', { class: 'bar' }, el('i', { style: `width:${pct}%` })),
        el('p', { class: 'mission-meta' }, m.scope === 'run' ? '' : `${Math.max(0, prog)}/${m.target}  `, bone(), ' +' + m.reward, reroll),
      );
    });
    const ach = ACHIEVEMENTS.map((a) => {
      const done = !!this.p.achievements[a.id];
      return el('div', { class: 'ach' + (done ? ' done' : '') }, el('span', { class: 'ach-mark' }), el('span', { text: t('a_' + a.id) }));
    });
    const count = Object.keys(this.p.achievements).length;
    // the weekly missions: longer, counted over every run of the week
    const W = ensureWeekly();
    const wk = weekInfo();
    const weekly = W.list.map((m) => {
      const prog = weeklyProgress(m);
      return el(
        'div',
        { class: 'mission weekly' + (m.done ? ' done' : '') },
        el('p', { text: t('w_' + m.kind, { n: m.target }) }),
        el('div', { class: 'bar' }, el('i', { style: `width:${Math.round((prog / m.target) * 100)}%` })),
        el('p', { class: 'mission-meta' }, m.done ? el('span', { class: 'mission-done', text: t('weeklyClaimed') }) : `${prog}/${m.target}  `, m.done ? null : bone(), m.done ? null : ' +' + m.reward),
      );
    });
    return el(
      'div',
      {},
      el('h3', { text: t('missionsTitle') }),
      ms,
      el('h3', { text: t('weeklyTitle') }),
      el('p', { class: 'small muted', text: t(wk.daysLeft > 1 ? 'weeklyHelp' : 'weeklyHelpLast', { d: wk.daysLeft, n: WEEKLY_BONUS }) + (W.bonus ? ' ✓' : '') }),
      weekly,
      el('h3', { text: `${t('achievementsTitle')} ${count}/${ACHIEVEMENTS.length}` }),
      el('div', { class: 'ach-grid' }, ach),
    );
  }

  // ------------------------------------------------------------ stats
  statsView() {
    const s = this.p.stats;
    const fmtTime = (sec) => `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
    const lp = levelProgress();
    const level = el('div', { class: 'stat' }, el('span', { text: t('levelShort', { n: lp.level }) }), el('b', { text: `${lp.into}/${lp.need} XP` }));
    const rows = ['best', 'games', 'distance', 'jumps', 'ducks', 'coins', 'obstacles', 'perfects', 'bestCombo', 'powerups', 'meteors', 'pounds', 'revives', 'dailies', 'eggs', 'bosses', 'botWins', 'time', 'mpGames', 'mpWins', 'coopGames', 'coopBest', 'goldBones', 'miniBosses', 'chests', 'challengesWon', 'tournaments', 'levelsMade', 'levelsWon', 'weeklies', 'photos', 'teamBosses', 'seasonRuns', 'seasonBest', 'rushes'].map((k) =>
      el('div', { class: 'stat' }, el('span', { text: t('st_' + k) }), el('b', { text: k === 'time' ? fmtTime(s[k] || 0) : String(s[k] || 0) })),
    );
    const top = this.p.top.length
      ? el(
          'ol',
          { class: 'top' },
          this.p.top.map((e) => el('li', {}, el('b', { text: pad5(e.s) }), el('span', { text: new Date(e.d).toLocaleDateString() + (e.lan ? ' · LAN' : '') }))),
        )
      : el('p', { class: 'muted', text: t('noScores') });
    return el('div', {}, el('div', { class: 'stats' }, level, rows), el('h3', { text: t('top10') }), top);
  }

  // ------------------------------------------------------------ settings
  settingsView() {
    const s = this.p.settings;
    const apply = () => {
      save();
      this.g.applySettings();
    };
    // every setting: a picture, its name, one line on what it does, and its control
    const SET_ICON = {
      lang: '🌐', ghost: '👻', seasons: '🎃', autoPause: '⏸️', fullscreen: '🖥️', music: '🎵', musicVol: '🔊', sfx: '🔔', sfxVol: '🔉', menuMusic: '🎼',
      keyJump: '⬆️', keyDuck: '⬇️', controls: '👆', lefty: '🤚', vibration: '📳', quality: '✨', style: '🎨', pixel: '🔲', shake: '💥', showFps: '⏱️',
      bigText: '🔠', highlight: '🟥', colorblind: '👁️', reduceFx: '🌙', oneButton: '1️⃣', transfer: '📲', news: '📰', update: '⬇️', about: 'ℹ️', defaults: '↩️', reset: '🗑️',
    };
    const desc = (key) => t('setDesc_' + key);
    const sw = switchBtn;
    const toggle = (key) =>
      infoRow(SET_ICON[key], t('set_' + key), desc(key), sw(s[key], () => {
        s[key] = !s[key];
        apply();
        this.renderPanel();
      }, t('set_' + key)));
    const pickOf = (key) => (v) => {
      s[key] = v;
      apply();
      this.renderPanel();
    };
    const choice = (key, options) => choiceRow({ icon: SET_ICON[key], label: t('set_' + key), desc: desc(key), options, value: s[key], pick: pickOf(key) });
    const open = (key, label, fn) => infoRow(SET_ICON[key], label, desc(key), el('button', { class: 'val', text: t('open'), onclick: fn }));
    const vol = (key) => choice(key, [0, 25, 50, 75, 100].map((v) => ({ v, icon: ['🔇', '🔈', '🔉', '🔊', '📢'][v / 25], name: v + '%' })));
    const reset = el('button', { class: 'danger', text: t('set_reset') });
    reset.addEventListener('click', () => {
      if (reset.dataset.armed) {
        resetProgress();
        this.g.previewDino('classic', 'none', 'none');
        this.toast(t('set_resetDone'), 'red');
        this.g.applySettings();
      } else {
        reset.dataset.armed = '1';
        reset.textContent = t('set_resetConfirm');
      }
    });
    const head = (key) => el('h3', { class: 'set-head', text: t(key) });
    const defaults = el('button', {
      class: 'menu-btn',
      text: t('set_defaults'),
      onclick: () => {
        // settings only: the progress stays
        const keep = { lang: s.lang, controls: s.controls, keyJump: s.keyJump, keyDuck: s.keyDuck };
        Object.assign(s, SETTING_DEFAULTS, keep);
        apply();
        this.toast(t('set_defaultsDone'), 'gold');
        this.renderPanel();
      },
    });
    // a small picture of each graphic style
    const stylePic = (v) => el('span', { class: 'style-pic style-' + v, 'aria-hidden': 'true' }, el('i'), el('i'), el('i'));
    const LANG_FLAG = { auto: '🌐', ro: '🇷🇴', ru: '🇷🇺', en: '🇬🇧' };
    const LANG_NAME = { ro: 'Română', ru: 'Русский', en: 'English' };
    return el(
      'div',
      { class: 'settings' },
      head('setSec_game'),
      choice('lang', LANGS.map((v) => ({ v, icon: LANG_FLAG[v], name: v === 'auto' ? t('lang_auto') : LANG_NAME[v], desc: v === 'auto' ? t('optDesc_lang_auto') : '' }))),
      toggle('ghost'),
      toggle('seasons'),
      toggle('autoPause'),
      this.g.isTouch ? null : infoRow(SET_ICON.fullscreen, t('set_fullscreen'), desc('fullscreen'), sw(!!document.fullscreenElement, () => this.toggleFullscreen(), t('set_fullscreen'))),
      head('setSec_sound'),
      toggle('music'),
      vol('musicVol'),
      toggle('sfx'),
      vol('sfxVol'),
      infoRow(SET_ICON.menuMusic, t('set_menuMusic'), desc('menuMusic'), sw(s.menuMusic, () => {
        s.menuMusic = !s.menuMusic;
        save();
        this.g.menuMusic();
        this.renderPanel();
      }, t('set_menuMusic'))),
      head('setSec_controls'),
      this.g.isTouch ? null : this.keyRow('keyJump'),
      this.g.isTouch ? null : this.keyRow('keyDuck'),
      this.g.isTouch
        ? infoRow(SET_ICON.controls, t('set_controls'), desc('controls'), el('button', { class: 'val', text: t(s.controls.mode === 'buttons' ? 'ctlModeButtons' : 'ctlModeZones'), onclick: () => {
            this.closePanel(true);
            $('menu').classList.add('hidden');
            openControlsEditor(() => {
              this.openPanel('settings');
            });
          } }))
        : null,
      toggle('lefty'),
      toggle('vibration'),
      // every key and button of the game in one place (the LAN ones were only in the help texts)
      infoRow('⌨️', t('keysTitle'), t('keysList'), null),
      head('setSec_graphics'),
      choice('quality', ['auto', 'high', 'medium', 'low'].map((v) => ({ v, icon: { auto: '🪄', high: '🌟', medium: '⭐', low: '▫️' }[v], name: t('q_' + v), desc: t('optDesc_q_' + v) }))),
      choice('style', ['normal', 'outline', 'gameboy', 'crt'].map((v) => ({ v, pic: stylePic(v), name: t('style_' + v), desc: t('optDesc_style_' + v) }))),
      choice('pixel', [0, 1, 2].map((v) => ({ v, pic: el('span', { class: 'px-pic px' + v, 'aria-hidden': 'true' }), name: 'PX' + (v + 1) }))),
      toggle('shake'),
      toggle('showFps'),
      head('setSec_access'),
      toggle('bigText'),
      toggle('highlight'),
      toggle('colorblind'),
      toggle('reduceFx'),
      toggle('oneButton'),
      head('setSec_data'),
      open('transfer', t('transfer'), () => this.openPanel('transfer')),
      open('news', t('set_news'), () => this.showNews()),
      this.g.isApp ? this.updateRow() : null,
      open('about', t('set_about'), () => this.toast(t('aboutText'), 'gold')),
      infoRow(SET_ICON.defaults, t('set_defaults'), desc('defaults'), defaults),
      infoRow(SET_ICON.reset, t('set_reset'), desc('reset'), reset),
    );
  }
  toggleFullscreen() {
    const d = document;
    if (d.fullscreenElement) d.exitFullscreen?.();
    else d.documentElement.requestFullscreen?.().catch(() => {});
    setTimeout(() => this.panel === 'settings' && this.renderPanel(), 300);
  }
  keyRow(key) {
    const label = this.capturing === key ? t('pressKey') : keyName(this.p.settings[key]);
    return infoRow(key === 'keyJump' ? '⬆️' : '⬇️', t('set_' + key), t('setDesc_' + key), el('button', { class: 'val', text: label, onclick: () => {
      this.capturing = key;
      this.renderPanel();
    } }));
  }
  capturingKey() {
    return !!this.capturing;
  }
  capturedKey(code) {
    if (code !== 'Escape') {
      this.p.settings[this.capturing] = code;
      save();
    }
    this.capturing = null;
    this.renderPanel();
  }
  updateRow() {
    const row = infoRow('⬇️', t('set_version', { v: this.version || '…' }), t('setDesc_update'), el('button', { class: 'val', text: this.updating ? '…' : t('updateCheck'), onclick: () => this.checkUpdates(true) }));
    row.querySelector('.val').id = 'upd-btn';
    if (!this.version) this.currentVersion().then(() => this.panel === 'settings' && this.renderPanel());
    return row;
  }
  row(label, value, fn) {
    return el('div', { class: 'row' }, el('span', { text: label }), el('button', { class: 'val', text: value, onclick: fn }));
  }

  // ------------------------------------------------------------ LAN
  async startLan() {
    if (!this.g.lanAvailable) return;
    const ok = await this.g.lanOpen();
    if (!ok) return this.closePanel();
    if (this.lanView === 'home') this.g.lanBrowse();
    const ips = await this.g.lanAddresses();
    this.myIp = ips.filter((a) => !a.startsWith('tab-')).join(', ') || ips.join(', ');
    if (this.panel === 'lan') this.renderPanel();
  }
  mpRooms(list) {
    this.rooms = list;
    if (this.panel === 'lan' && this.lanView === 'home') {
      const box = $('lan-rooms');
      if (box) box.replaceChildren(...this.roomEls());
    }
  }
  roomEls() {
    if (!this.rooms.length) return [el('p', { class: 'muted', text: t('mpSearching') }), el('p', { class: 'muted small', text: t('mpNoRooms') })];
    return this.rooms.map((r) =>
      el(
        'div',
        { class: 'room' },
        el('span', { text: `📶 ${r.name} (${r.n}/${MAX_PLAYERS})` }),
        r.old || r.n >= MAX_PLAYERS
          ? el('span', { class: 'muted small', text: r.old ? t('mpOldVersion') : t('mpFull') })
          : el('button', {
              // a room in the middle of a race: you wait inside and join the next one
              text: r.st === 'race' ? t('mpJoinNext') : t('mpJoin'),
              onclick: () => this.joinRoom(r.addr, r.port, r.name),
            }),
      ),
    );
  }
  joinRoom(addr, port, name) {
    this.stopScan();
    const field = $('lan-name');
    if (field) this.g.lanSetName(field.value);
    this.lanView = 'lobby';
    this.lanIsHost = false;
    this.g.lanJoinIp(addr, port, name);
    this.renderPanel();
  }
  // a LAN room's QR code (from the host's lobby): tries every address it lists
  joinFromQr(text) {
    const j = decodeLanJoin(text);
    if (!j) return this.toast(t('mpQrNotLan'), 'red');
    if (this.panel !== 'lan') {
      this.openPanel('lan', 'modes');
      return setTimeout(() => this.joinFromQr(text), 400);
    }
    this.joinRoom(j.ips[0], j.port, j.name);
    // a phone can have several addresses (Wi-Fi and hotspot): knock on the others too
    for (const ip of j.ips.slice(1)) setTimeout(() => this.g.lan && this.g.lan.role === 'client' && !this.g.lan.lobby.length && this.g.lanJoinIp(ip, j.port, j.name), 1500);
  }
  stopScan() {
    if (this.lanScanner) this.lanScanner.stop();
    this.lanScanner = null;
  }
  mpLobby(players, isHost, myId, mode) {
    this.lobby = players;
    this.lanIsHost = isHost;
    this.myId = myId;
    this.lanMode = mode || 'race';
    if (this.lanView === 'home' && !isHost) this.lanView = 'lobby';
    if (this.panel === 'lan' && this.lanView === 'lobby') this.renderPanel();
  }
  mpResults(results, myId, tour, mode, cup) {
    this.results = results;
    this.resultsCup = cup || null;
    this.resultsMode = mode || this.lanMode;
    this.tour = tour || null;
    this.myId = myId;
    this.lanView = 'results';
    $('over').classList.add('hidden');
    document.body.classList.remove('over');
    if (this.panel !== 'lan') {
      this.panel = 'lan';
      $('panel').classList.remove('hidden');
      $('panel').dataset.panel = 'lan';
      document.body.classList.add('panel-open');
    }
    this.renderPanel();
  }
  mpHud(list, myId) {
    const key = list.map((p) => p.id + p.sc + p.a).join();
    if (key === this.mpKey) return;
    this.mpKey = key;
    $('mp-hud').replaceChildren(
      ...list.map((p, i) => el('div', { class: 'mp-row' + (p.id === myId ? ' me' : '') + (p.a ? '' : ' dead') }, el('span', { text: `${i + 1}. ${p.name}` }), el('b', { text: pad5(p.sc) }))),
    );
  }

  // something arrived (a pack of tracks): show it if the room is open
  lanRefresh() {
    if (this.panel === 'lan' && this.lanView !== 'home' && !this.giftTo) this.renderPanel();
  }
  quickLog(log) {
    const box = $('quick-log');
    if (box) box.replaceChildren(...this.quickLines(log));
  }
  quickLines(log = this.g.quickLog || []) {
    if (!log.length) return [el('p', { class: 'muted small', text: t('qmEmpty') })];
    return log.map((q) => el('p', { class: 'qm-line' + (q.me ? ' me' : '') }, el('b', { text: q.name + ': ' }), el('span', { text: t('qm_' + q.i) })));
  }
  // quick messages: 8 ready-made phrases, one tap sends to everyone in the room
  quickEl() {
    return el(
      'div',
      { class: 'quick-box' },
      el('h3', { text: '💬 ' + t('qmTitle') }),
      el('p', { class: 'muted small', text: t('qmHelp') }),
      el(
        'div',
        { class: 'qm-grid' },
        Array.from({ length: QUICK_MSGS }, (_, i) =>
          el('button', {
            class: 'qm-btn',
            text: t('qm_' + i),
            onclick: (e) => {
              const b = e.currentTarget;
              b.disabled = true;
              setTimeout(() => (b.disabled = false), 1200); // no flooding the room
              this.g.lanQuick(i);
            },
          }),
        ),
      ),
      el('div', { id: 'quick-log', class: 'quick-log', 'aria-live': 'polite' }, this.quickLines()),
    );
  }
  // spectator: in the room, but only watching the races
  specEl() {
    const on = !!this.p.lanSpec;
    return infoRow(
      '👁️',
      t('specLabel'),
      t('specHelp'),
      switchBtn(on, () => {
        this.g.lanSetSpectator(!on);
        this.renderPanel();
      }, t('specLabel')),
    );
  }
  // the host shares all their tracks from the level editor with the room
  packEl() {
    if (!this.lanIsHost) return null;
    const n = (this.p.levels || []).length;
    return infoRow(
      '📦',
      t('packLabel', { n }),
      t(n ? 'packHelp' : 'packNone'),
      el('button', {
        class: 'val',
        text: t('packSend'),
        disabled: !n || this.lobby.length < 2,
        onclick: () => {
          const k = this.g.lanSendPack();
          if (k) this.toast(t('packSending', { n: k }), 'gold');
        },
      }),
    );
  }
  // the knockout cup: this round's duels, the earlier rounds and the champion
  cupEl(cup) {
    if (!cup) return null;
    const duel = (a, b, w) =>
      el(
        'div',
        { class: 'cup-duel' },
        el('span', { class: w && w === a ? 'win' : w ? 'lose' : '', text: a }),
        el('i', { text: b ? 'VS' : '' }),
        el('span', { class: !b ? 'muted' : w && w === b ? 'win' : w ? 'lose' : '', text: b || t('cupBye') }),
      );
    const rounds = (cup.rounds || []).map((pairs, i) => el('div', { class: 'cup-round done' }, el('small', { class: 'muted', text: t('cupRound', { n: i + 1 }) }), pairs.map((p) => duel(p.a, p.b, p.w))));
    const now = cup.done
      ? el('p', { class: 'winner', text: '🏆 ' + t('cupChamp', { name: cup.champ ? cup.champ.name : '-' }) })
      : cup.pairs && cup.pairs.length && Array.isArray(cup.pairs[0])
        ? el('div', { class: 'cup-round now' }, el('small', { text: t('cupRound', { n: (cup.round || 0) + 1 }) + ' · ' + t('cupNext') }), cup.pairs.map(([a, b]) => duel(a, b, null)))
        : null;
    return el('div', { class: 'cup' }, el('h3', { text: '🥊 ' + t('cupTitle') }), rounds, now, el('p', { class: 'muted small', text: t('cupHelp') }));
  }

  lanViewEl() {
    if (!this.g.lanAvailable) {
      return el(
        'div',
        { class: 'lan' },
        el('p', { text: t('mpWebOnly') }),
        el('a', { class: 'btn-link', href: `https://github.com/${REPO}/releases/latest`, target: '_blank', rel: 'noopener', text: 'GitHub Releases' }),
      );
    }
    if (this.lanView === 'results') return this.resultsEl();
    if (this.lanView === 'lobby') return this.lobbyEl();
    const name = el('input', { id: 'lan-name', maxlength: 12, value: this.p.name || '', autocomplete: 'off' });
    name.addEventListener('change', () => this.g.lanSetName(name.value));
    const ip = el('input', { id: 'lan-ip', placeholder: '192.168.43.1', inputmode: 'decimal', autocomplete: 'off' });
    // scanning the host's QR: the quickest way in, and it works where searching does not
    const video = el('video', { class: 'scan-video', playsinline: true, muted: true, autoplay: true });
    const scanBtn = el('button', {
      class: 'menu-btn',
      text: '📷 ' + t('mpScanJoin'),
      onclick: () => {
        this.stopScan();
        video.classList.add('on');
        this.lanScanner = new CameraScanner(
          video,
          (text) => {
            video.classList.remove('on');
            if (isLanJoin(text)) this.joinFromQr(text);
            else this.toast(t('mpQrNotLan'), 'red');
          },
          (key) => {
            video.classList.remove('on');
            this.toast(t(key), 'red');
          },
        );
        this.lanScanner.start();
      },
    });
    const last = this.p.lanLast;
    const rejoin =
      last && last.addr && Date.now() - (last.at || 0) < 6 * 3600 * 1000
        ? infoRow('🔁', t('mpRejoin', { name: last.name || last.addr }), t('mpRejoinHelp'), el('button', { class: 'val', text: t('mpJoin'), onclick: () => this.joinRoom(last.addr, last.port || undefined, last.name) }))
        : null;
    return el(
      'div',
      { class: 'lan' },
      el('div', { class: 'lan-hero', 'aria-hidden': 'true' }, el('span', { class: 'lh-dino a', text: '🦖' }), el('span', { class: 'lh-wifi', text: '📶' }), el('span', { class: 'lh-dino b', text: '🦕' })),
      el('p', { class: 'small', text: t('mpIntro') }),
      el('label', { class: 'field' }, el('span', { text: t('mpName') }), name),
      el('button', {
        class: 'menu-btn primary',
        text: t('mpHost'),
        onclick: () => {
          this.g.lanSetName(name.value);
          this.lanView = 'lobby';
          this.g.lanHost();
          this.renderPanel();
        },
      }),
      el('div', { id: 'lan-rooms', class: 'rooms' }, this.roomEls()),
      rejoin,
      scanBtn,
      el('p', { class: 'muted small', text: t('mpScanHelp') }),
      video,
      el(
        'div',
        { class: 'field inline' },
        el('span', { text: t('mpManual') }),
        ip,
        el('button', {
          text: t('mpConnect'),
          onclick: () => {
            if (!ip.value.trim()) return;
            this.joinRoom(ip.value.trim(), undefined, ip.value.trim());
          },
        }),
      ),
      this.myIp ? el('p', { class: 'muted small', text: t('mpYourIp', { ip: this.myIp }) }) : null,
      el('p', { class: 'muted small', text: t('mpHotspotTip') }),
      this.hcEl(),
      this.specEl(),
      this.lanHistEl(),
      this.coopTopEl(),
    );
  }
  // handicap: each player picks their own, everybody sees it next to the name
  hcEl() {
    return choiceRow({
      icon: '🐢',
      label: t('hcLabel'),
      options: HANDICAPS.map((h, v) => ({ v, icon: HC_ICON[v], name: t('hc_' + v), desc: t('hcDesc_' + v) })),
      value: this.p.lanHc | 0,
      pick: (v) => {
        this.g.lanSetHandicap(v);
        this.renderPanel();
      },
    });
  }
  // the mode picker: all 8 modes visible, each with a moving picture and its rules
  lanModesEl() {
    const cur = this.lanMode || 'race';
    return el(
      'div',
      { class: 'lan-modes' },
      el('h3', { text: t('mpModesTitle') }),
      this.lanIsHost ? null : el('p', { class: 'muted small', text: t('mpModeHostOnly') }),
      el(
        'div',
        { class: 'lan-mode-grid', role: 'radiogroup', 'aria-label': t('lanModeLabel') },
        LAN_MODES.map((m) =>
          el(
            'button',
            {
              class: 'lan-mode lm-' + m + (m === cur ? ' on' : ''),
              role: 'radio',
              'aria-checked': m === cur ? 'true' : 'false',
              'aria-label': t('lanMode_' + m) + '. ' + t('lanModeHelp_' + m),
              disabled: !this.lanIsHost && m !== cur,
              onclick: () => this.lanIsHost && m !== cur && this.g.lanSetMode(m),
            },
            el('span', { class: 'lm-ico', 'aria-hidden': 'true', text: LAN_MODE_ICON[m] }),
            el('b', { text: t('lanMode_' + m) }),
          ),
        ),
      ),
      el('p', { class: 'seg-help small', text: LAN_MODE_ICON[cur] + ' ' + t('lanModeHelp_' + cur) }),
    );
  }
  // a track from the level editor, for the modes that can use one
  trackEl() {
    const lan = this.g.lan;
    const mode = this.lanMode || 'race';
    const cur = lan && lan.track;
    const pic = (lv) => el('span', { class: 'trk-pic', 'aria-hidden': 'true', text: [...trimmed(lv)].filter((c) => c !== '.').slice(0, 8).map((c) => PIECES[c]).join('') || '·' });
    if (!TRACK_MODES.includes(mode)) return infoRow('🛤️', t('trkLabel'), t('trkNotInMode'), null);
    if (!this.lanIsHost) return infoRow('🛤️', t('trkLabel') + ': ' + (cur ? cur.name || t('lvUntitled') : t('trkRandom')), cur ? t('trkDesc') : t('trkRandomDesc'), cur ? pic(cur) : null);
    const levels = this.p.levels || [];
    const idOf = (lv) => (lv ? levelId(lv) : '');
    return el(
      'div',
      {},
      choiceRow({
        icon: '🛤️',
        label: t('trkLabel'),
        cls: 'trk-choice',
        options: [{ v: '', icon: '🎲', name: t('trkRandom'), desc: t('trkRandomDesc') }].concat(levels.map((lv) => ({ v: idOf(lv), pic: pic(lv), name: lv.name || t('lvUntitled'), desc: t('trkDesc') }))),
        value: idOf(cur),
        pick: (v) => {
          this.g.lanSetTrack(levels.find((lv) => idOf(lv) === v) || null);
          this.renderPanel();
        },
      }),
      levels.length ? null : el('p', { class: 'muted small', text: t('trkNone') }),
    );
  }
  // gifts for a friend in the room: what each costs and what it does, all on one card
  giftEl(to) {
    const p = this.lobby.find((x) => x.id === to);
    if (!p) return null;
    const gd = this.p.giftDay || {};
    const left = gd.d === new Date().toISOString().slice(0, 10) ? Math.max(0, GIFTS_PER_DAY - gd.n) : GIFTS_PER_DAY;
    return el(
      'div',
      { class: 'gift-box' },
      el('h3', { text: '🎁 ' + t('giftTitle', { name: p.name }) }),
      Object.keys(GIFTS).map((k) =>
        infoRow(
          GIFT_ICON[k],
          t('giftKind_' + k),
          t('giftDesc_' + k),
          el('button', {
            class: 'val',
            text: '🦴 ' + GIFTS[k],
            disabled: left <= 0 || this.p.coins < GIFTS[k],
            onclick: () => {
              if (this.g.lanGift(to, k)) {
                this.giftTo = null;
                this.renderPanel();
              }
            },
          }),
        ),
      ),
      el('p', { class: 'muted small', text: t('giftLeft', { n: left }) }),
      el('button', { class: 'menu-btn', text: t('back'), onclick: () => ((this.giftTo = null), this.renderPanel()) }),
    );
  }
  // the host's QR code: friends scan it and are in
  joinQrEl() {
    if (!this.lanIsHost || !this.myIp) return null;
    const ips = this.myIp.split(',').map((x) => x.trim()).filter(Boolean);
    let qr = null;
    try {
      qr = qrCanvas(encodeLanJoin(ips, this.p.name), 3);
    } catch {
      return null;
    }
    return el('div', { class: 'join-qr' }, qr, el('p', { class: 'muted small', text: t('mpJoinQr') }));
  }
  lobbyEl() {
    if (this.giftTo) {
      const box = this.giftEl(this.giftTo);
      if (box) return el('div', { class: 'lan' }, box);
      this.giftTo = null;
    }
    const lan = this.g.lan;
    const mode = this.lanMode || 'race';
    const team = TEAM_MODES.includes(mode);
    const players = this.lobby.map((p, i) =>
      el(
        'div',
        { class: 'player' + (p.late ? ' late' : '') },
        dinoIcon(SKINS[p.skin] ? p.skin : 'classic'),
        el('span', { text: p.name }),
        TITLES[p.ti] ? el('span', { class: 'title-tag small', text: TITLES[p.ti].icon + ' ' + t('title_' + p.ti) }) : null,
        el('span', {
          class: 'muted small',
          text: [
            team ? t(i % 2 ? 'teamB' : 'teamA') : '',
            p.hc ? HC_ICON[p.hc] + ' ' + t('hc_' + p.hc) : '',
            i === 0 ? t('mpHostTag') : '',
            p.id === this.myId ? t('mpYou') : '',
            p.late ? '⏳' : '',
            p.spec ? '👁️ ' + t('specTag') : '',
          ]
            .filter(Boolean)
            .join(' · '),
        }),
        p.id !== this.myId ? el('button', { class: 'val gift-btn', text: '🎁', title: t('giftBtn'), 'aria-label': t('giftBtn') + ' ' + p.name, onclick: () => ((this.giftTo = p.id), this.renderPanel()) }) : null,
      ),
    );
    const canStart = this.lobby.filter((p) => !p.spec).length >= 2;
    // someone who came in during a race waits for the next one
    const waiting = !this.lanIsHost && lan && lan.lobbySt === 'race' && lan.state !== 'race';
    return el(
      'div',
      { class: 'lan' },
      el('h3', { text: t('mpPlayers', { n: this.lobby.length }) }),
      el('div', { class: 'players' }, players.length ? players : el('p', { class: 'muted', text: '…' })),
      waiting ? el('p', { class: 'blink', text: '⏳ ' + t('mpLateWait') }) : null,
      this.lanIsHost
        ? el('button', { class: 'menu-btn primary', text: t('mpStart'), disabled: !canStart, onclick: () => this.g.lanStart() })
        : waiting
          ? null
          : el('p', { class: 'blink', text: t('mpWaitHost') }),
      this.lanIsHost && !canStart ? el('p', { class: 'muted small', text: t('mpNeed2') }) : null,
      this.joinQrEl(),
      mode === 'bracket' ? this.cupEl(lan && lan.cup) : null,
      this.quickEl(),
      this.lanModesEl(),
      this.trackEl(),
      this.packEl(),
      this.hcEl(),
      this.specEl(),
      this.myIp ? el('p', { class: 'muted small', text: t('mpYourIp', { ip: this.myIp }) }) : null,
      el('button', { class: 'menu-btn', text: t('mpLeave'), onclick: () => this.leaveLanToMenu() }),
    );
  }
  resultsEl() {
    const r = this.results || [];
    const winner = r[0];
    const mode = this.resultsMode || this.lanMode;
    const coop = mode === 'coop' || mode === 'bosses';
    const timeOf = (p) => (p.ft ? ' · 🏁 ' + p.ft.toFixed(1) + 's' : '') + (p.hc ? ' · ' + HC_ICON[p.hc] : '');
    const again = (label) =>
      this.lanIsHost ? el('button', { class: 'menu-btn primary', text: label, disabled: this.lobby.filter((p) => !p.spec).length < 2, onclick: () => this.g.lanStart() }) : el('p', { class: 'blink', text: t('mpWaitHost') });
    // teams and relay: A and B, a team scores the sum of its runners
    if (TEAM_MODES.includes(mode) && winner) {
      const tt = this.g.teamTotals(r, this.lobby);
      const name = (i) => t(i ? 'teamB' : 'teamA');
      const mine = tt.of.get(this.myId);
      const headT = tt.winner == null ? t('draw') : tt.winner === mine ? t('teamsWeWon', { team: name(tt.winner) }) : t('mpWinner', { name: name(tt.winner) });
      return el(
        'div',
        { class: 'lan' },
        el('h3', { class: 'winner', text: LAN_MODE_ICON[mode] + ' ' + headT }),
        el('p', { text: `${name(0)} ${pad5(tt.sum[0])}   ${name(1)} ${pad5(tt.sum[1])}` }),
        el('ol', { class: 'top' }, r.map((p) => el('li', { class: p.id === this.myId ? 'me' : '' }, el('b', { text: pad5(p.sc) }), el('span', { text: `${p.name} · ${name(tt.of.get(p.id) ?? 0)}${timeOf(p)}` })))),
        again(t('again')),
        this.quickEl(),
        el('button', { class: 'menu-btn', text: t('mpLeave'), onclick: () => this.leaveLanToMenu() }),
        this.lanHistEl(),
      );
    }
    // the cup: the duels of this round, then the next round (or the champion)
    if (mode === 'bracket' && this.resultsCup) {
      const cup = this.resultsCup;
      const live = this.g.lan && this.g.lan.cup;
      return el(
        'div',
        { class: 'lan' },
        el('h3', { class: 'winner', text: '🥊 ' + (cup.done ? (cup.champ && cup.champ.id === this.myId ? t('cupYouChamp') : t('cupChamp', { name: cup.champ ? cup.champ.name : '-' })) : t('cupRoundDone', { n: cup.round, left: cup.left })) }),
        this.cupEl(cup.done ? { ...cup, rounds: (live && live.rounds) || [cup.pairs] } : live || cup),
        el('ol', { class: 'top' }, r.map((p) => el('li', { class: p.id === this.myId ? 'me' : '' }, el('b', { text: pad5(p.sc) }), el('span', { text: p.name + timeOf(p) })))),
        again(cup.done ? t('cupNew') : t('cupNextBtn')),
        this.quickEl(),
        el('button', { class: 'menu-btn', text: t('mpLeave'), onclick: () => this.leaveLanToMenu() }),
        this.lanHistEl(),
      );
    }
    const head = coop && winner ? t('coopResult', { n: Math.max(...r.map((p) => p.sc)) }) : winner ? (winner.id === this.myId && r.length > 1 ? t('mpYouWon') : t('mpWinner', { name: winner.name })) : '';
    const tour = this.tour;
    // tournament: the standings after this race, and the champion after the last one
    const tourEls = tour
      ? [
          el('h3', { text: tour.done ? (tour.table[0].id === this.myId ? t('tourYouChampion') : t('tourChampion', { name: tour.table[0].name })) : t('tourRace', { n: tour.race, total: tour.total }) }),
          el('ol', { class: 'top tour' }, tour.table.map((p) => el('li', { class: p.id === this.myId ? 'me' : '' }, el('b', { text: String(p.pts).padStart(3, ' ') + ' ' + t('tourPts') }), el('span', { text: p.name })))),
          el('p', { class: 'muted small', text: t('tourThisRace') }),
        ]
      : [];
    return el(
      'div',
      { class: 'lan' },
      tour && !tour.done ? null : el('h3', { class: 'winner', text: (LAN_MODE_ICON[mode] || '') + ' ' + head }),
      tourEls,
      el('ol', { class: 'top' }, r.map((p) => el('li', { class: p.id === this.myId ? 'me' : '' }, el('b', { text: pad5(p.sc) }), el('span', { text: p.name + timeOf(p) })))),
      coop ? this.coopTopEl() : null,
      again(tour ? (tour.done ? t('tourNew') : t('tourNext')) : t('again')),
      this.quickEl(),
      el('button', { class: 'menu-btn', text: t('mpLeave'), onclick: () => this.leaveLanToMenu() }),
      this.lanHistEl(),
    );
  }
  // the last 10 LAN races on this device, and who wins most often
  lanHistEl() {
    const h = this.p.lanHistory || [];
    const wins = Object.entries(this.p.lanWins || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const when = (d) => new Date(d).toLocaleString(undefined, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const line = (e) => {
      const coop = e.m === 'coop' || e.m === 'bosses';
      const team = TEAM_MODES.includes(e.m);
      const res = coop
        ? t('lanHistCoop', { n: Math.max(0, ...e.r.map((x) => x.s)) })
        : team
          ? e.w
            ? t('lanHistTeam', { team: t(e.w === 'B' ? 'teamB' : 'teamA') })
            : t('lanHistDraw')
          : '🏆 ' + (e.w || '-');
      const me = e.r.find((x) => x.me);
      const place = me && !coop && !team ? ' · #' + (e.r.indexOf(me) + 1) : '';
      return el(
        'li',
        {},
        el('span', { class: 'hist-ico', 'aria-hidden': 'true', text: LAN_MODE_ICON[e.m] || '🏃' }),
        el('span', {}, el('b', { text: t('lanMode_' + e.m) + ' · ' + res + place }), el('small', { class: 'muted', text: when(e.d) + ' · ' + e.r.map((x) => x.n + ' ' + x.s).join(', ') })),
      );
    };
    return el(
      'div',
      { class: 'lan-hist' },
      el('h3', { text: '📜 ' + t('lanHistTitle') }),
      h.length ? el('ol', { class: 'hist' }, h.map(line)) : el('p', { class: 'muted small', text: t('lanHistEmpty') }),
      wins.length ? el('h3', { text: '🏅 ' + t('lanWinsTitle') }) : null,
      wins.length ? el('ol', { class: 'top' }, wins.map(([n, k]) => el('li', {}, el('b', { text: '×' + k }), el('span', { text: n })))) : null,
    );
  }
  // co-op: the best teams that played on this device
  coopTopEl() {
    const top = this.p.coopTop;
    if (!top.length) return null;
    return el(
      'div',
      { class: 'coop-top' },
      el('h3', { text: t('coopTopTitle') }),
      el('ol', { class: 'top' }, top.map((e) => el('li', {}, el('b', { text: pad5(e.s) }), el('span', { text: e.names })))),
    );
  }
  leaveLanToMenu() {
    this.stopScan();
    this.giftTo = null;
    this.lanView = 'home';
    this.g.toMenu();
  }

  // ------------------------------------------------------------ share
  async share(isPhoto = false) {
    let data;
    try {
      data = await (isPhoto ? this.g.photoImage() : this.g.recordImage());
    } catch (err) {
      return this.toast(t('shareFailed'), 'red');
    }
    return this.shareData(data, 'image/png');
  }

  // shares (or saves) an image given as a data URL
  async shareData(data, mime = 'image/png') {
    const text = t('shareText');
    try {
      if (window.desktop && window.desktop.shareImage) {
        await window.desktop.shareImage(data);
        this.toast(t('shareSaved'), 'gold');
      } else if (Capacitor.getPlatform() === 'android') {
        await Share.shareImage({ data: data.split(',')[1], text, mime });
      } else {
        const blob = await (await fetch(data)).blob();
        const file = new File([blob], mime === 'image/jpeg' ? 'another-dino.jpg' : 'another-dino.png', { type: mime });
        if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], text });
        else if (navigator.clipboard && window.ClipboardItem) {
          await navigator.clipboard.write([new ClipboardItem({ [mime]: blob })]);
          this.toast(t('shareCopied'), 'gold');
        } else this.toast(t('shareFailed'), 'red');
      }
    } catch (err) {
      if (!err || err.name !== 'AbortError') this.toast(t('shareFailed'), 'red');
    }
  }

  // ------------------------------------------------------------ updates
  // The installed apps compare their version with the latest GitHub release and
  // offer a one-tap update (download + install, no browser needed).
  async currentVersion() {
    if (!this.version) {
      try {
        this.version = (await (await fetch('version.json')).json()).version;
      } catch {
        this.version = null;
      }
    }
    return this.version;
  }

  async checkUpdates(manual = false) {
    if (!this.g.isApp || this.updating) return;
    const current = await this.currentVersion();
    if (!current) return;
    let latest = null;
    try {
      const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
      if (res.ok) latest = String((await res.json()).tag_name || '').replace(/^v/, '');
    } catch {
      /* offline */
    }
    if (!latest) {
      if (manual) this.toast(t('updateFailed', { msg: 'offline' }), 'red');
      return;
    }
    if (!newerVersion(latest, current)) {
      if (manual) this.toast(t('updateLatest', { v: current }), 'gold');
      return;
    }
    this.latest = latest;
    this.banner(t('updateAvail', { v: 'v' + latest }), t('updateNow'), () => this.runUpdate());
    if (manual) this.runUpdate();
  }

  updateStatus(text) {
    const b = $('banner');
    b.replaceChildren(el('span', { text }));
    b.classList.remove('hidden');
    const s = $('upd-btn');
    if (s) s.textContent = text;
  }

  async runUpdate() {
    if (this.updating || !this.latest) return;
    this.updating = true;
    const progress = (p) => this.updateStatus(t('updateDownloading', { p: p < 0 ? '…' : p + '%' }));
    progress(0);
    try {
      if (window.desktop && window.desktop.update) {
        window.desktop.update.onProgress(progress);
        const r = await window.desktop.update.start(this.latest);
        this.updateStatus(r === 'opened' ? t('updateMacOpen') : t('updateInstalling'));
      } else if (Capacitor.getPlatform() === 'android') {
        const handle = await Updater.addListener('progress', (e) => progress(e.percent));
        const url = `https://github.com/${REPO}/releases/download/v${this.latest}/Another-Dino-android.apk`;
        let r;
        try {
          r = await Updater.install({ url });
        } finally {
          handle.remove(); // also after a failed download, so a retry does not count progress twice
        }
        this.updateStatus(r.status === 'permission' ? t('updatePermission') : t('updateInstalling'));
      }
    } catch (err) {
      this.toast(t('updateFailed', { msg: (err && err.message) || String(err) }), 'red');
      this.banner(t('updateAvail', { v: 'v' + this.latest }), t('updateNow'), () => this.runUpdate());
    } finally {
      this.updating = false;
    }
  }
}

function keyName(code) {
  if (!code) return '—';
  if (code === 'Space') return 'SPACE';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' }[code] || code;
}

function newerVersion(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  return false;
}

