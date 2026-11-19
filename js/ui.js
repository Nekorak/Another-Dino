// All menus, panels and HUD elements (plain DOM on top of the 3D canvas).
import { t, LANGS, getLang } from './i18n.js';
import { NEWS } from './whatsnew.js';
import { SKINS, HATS, PETS, POWERUP_COLOR, hatPixels, petPixels } from './models.js';
import { UPGRADES, nextUpgradeCost, buyUpgrade, upgradeLevel, levelProgress, dailyInfo, EGG_PRICE, GOLD_EGG_PRICE, openEgg, eggPoolSize, PET_FOOD_PRICE, PET_FOOD_XP } from './progress.js';
import { BIOMES, SEASON_WORLD } from './biomes.js';
import { BOSS_KIND } from './bosses.js';
import { ADV_LEVELS, ADV_ORDER, advPos, LAST_STORY_W, SEASON_W, seasonRunBest, stars as advStars, unlocked as advUnlocked, totalStars, todayMutator, SEASON_PASS_TIER } from './modes.js';
import { TRAILS, FOSSIL_KINDS, FOSSIL_WORLD_REWARD, fossilId, fossilPixels, allFossils } from './collection.js';
import { encodeProgress, decodeProgress, mergeProgress, QR_LIMIT, qrCanvas, readQrFromImage, CameraScanner, LanSync, isChallenge, decodeChallenge } from './transfer.js';
import { save, resetProgress, profile } from './save.js';
import { DANCES, THEMES, EDITOR_GRID, editorCell } from './custom.js';
import { skinEditorView } from './editor.js';
import { MAX_PLAYERS, COOP_HEARTS } from './multiplayer.js';
import { layoutButtons, openControlsEditor } from './controls.js';
import { chestInfo, openChest, CHEST_DAYS, passState, passReward, claimTier, PASS_TIERS, PASS_XP, PASS_SPECIAL } from './rewards.js';
import { missionProgress, ACHIEVEMENTS, ensureWeekly, weeklyProgress, weekInfo, WEEKLY_BONUS, rerollMission, REROLL_PRICE } from './missions.js';
import { MEDALS, MEDAL_REWARD, MEDAL_NAMES, medalOf, medalCount } from './medals.js';
import { petLevel, petProgress, petPower, PET_MAX, feedPet } from './pets.js';
import { addPhoto, listPhotos, getPhoto, deletePhoto, toPng, MAX_PHOTOS } from './gallery.js';
import { isLevel, decodeLevel, storeLevel, levelId, weeklyTrackOpen } from './levels.js';
import { levelsView, levelEditView, startEdit } from './leveleditor.js';
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
  showWin({ stars, reward, adv, coins, spawned, hits, xp }) {
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
  spectate(name) {
    const s = $('spectate');
    s.classList.toggle('hidden', !name);
    if (name) s.textContent = t('spectating', { name });
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
      ['album', t('hubAlbum', { n: this.p.fossils.length, max: 30 }), () => this.openPanel('album', 'collection'), 'album'],
      ['pass', t('hubPass'), () => this.openPanel('pass', 'collection'), 'pass'],
      ['jukebox', t('hubJukebox'), () => this.openPanel('jukebox', 'collection')],
    ]);
  }
  progressView() {
    return this.hubView([
      ['missions', t('hubMissions'), () => this.openPanel('missions', 'progress'), 'ach'],
      ['albumMedals', t('hubMedals'), () => ((this.albumTab = 'medals'), this.openPanel('album', 'progress'))],
      ['stats', t('hubStats'), () => this.openPanel('stats', 'progress')],
    ]);
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
  showOver({ score, record, coins, missions, lan, xp, local2, daily, bot, mode, challenge, canChallenge, near, mutator, season }) {
    $('btn-replay').classList.toggle('hidden', !!lan || this.g.replay.length < 5);
    $('btn-challenge').classList.toggle('hidden', !canChallenge || score <= 0);
    this.overShownAt = performance.now() / 1000;
    $('over-title').textContent = mode === 'zen' ? t('zenOver') : 'GAME OVER';
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
      const head = top.length > 1 ? t('draw') : t('mpWinner', { name: top[0].name });
      extra.append(el('p', { class: 'winner', text: head }), el('p', { text: local2.map((q) => `${q.name} ${pad5(q.sc)}`).join('   ') }));
    }
    if (challenge)
      extra.append(
        el('p', { class: challenge.won ? 'winner' : '', text: challenge.won ? t('chWon', { name: challenge.name, n: challenge.reward }) : t('chLost', { name: challenge.name, n: challenge.target }) }),
      );
    if (mutator) extra.append(el('p', { class: mutator.isBest ? 'winner' : '', text: t('mutBest', { name: t('mut_' + mutator.id), n: mutator.best }) }));
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
      this.row(t('jukeAuto'), s.menuSong >= 0 ? t('off') : t('on'), () => {
        s.menuSong = -1;
        save();
        this.renderPanel();
      }),
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
    while (box.children.length > 3) box.firstChild.remove();
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
    const titles = { collection: 'collection', progress: 'progress', shop: 'shop', missions: 'missions', stats: 'stats', settings: 'settings', lan: 'mpTitle', modes: 'modes', adventure: 'adventure', album: 'album', transfer: 'transfer', editor: 'edTitle', challenge: 'chTitle', pass: 'passTitle', levels: 'lvTitle', leveledit: 'lvEditTitle', jukebox: 'jukebox' };
    $('panel-title').textContent = t(titles[this.panel]);
    this.setCoins();
    const body = $('panel-body');
    const render = {
      shop: () => this.shopView(),
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
    const TABS = { skin: 'shopSkins', hat: 'shopHats', pet: 'shopPets', trail: 'shopTrails', dance: 'shopDances', theme: 'shopThemes', upgrade: 'shopUpgrades' };
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
    return el('div', {}, tabs, info, grid);
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
    const card = (key, desc, fn, extra) =>
      el('button', { class: 'mode-card', onclick: fn, 'aria-label': t(key) + '. ' + desc }, el('b', { text: t(key) }), el('span', { class: 'small muted', text: desc }), extra || null);
    const botBtn = el('button', {
      class: 'val',
      text: t('bot_' + s.botLevel),
      onclick: (e) => {
        e.stopPropagation();
        s.botLevel = (s.botLevel + 1) % 3;
        save();
        this.renderPanel();
      },
    });
    const localBtns = el(
      'span',
      { class: 'mode-count' },
      [2, 3, 4].map((n) =>
        el('button', {
          class: 'val',
          text: String(n),
          onclick: (e) => {
            e.stopPropagation();
            g.startMode('local', { count: n });
          },
        }),
      ),
    );
    const un = unlocks();
    const st = this.badgeState();
    // a mode that opens later: shown greyed out, with what it takes to open it
    const locked = (key, need) => el('div', { class: 'mode-card locked' }, el('b', { text: '🔒 ' + t(key) }), el('span', { class: 'small muted', text: need }));
    const mu = todayMutator();
    const withBadge = (c, on) => (on && c.classList.add('badge'), c);
    return el(
      'div',
      { class: 'modes' },
      card('mode_adventure', t('modeDesc_adventure', { n: totalStars(), max: BIOMES.length * ADV_LEVELS * 3 }), () => this.openPanel('adventure', 'modes')),
      withBadge(card('daily', d.done ? t('dailyDoneShort', { n: d.streak }) : t('dailyTarget', { n: d.target, b: d.reward }), () => g.startMode('daily')), st.daily),
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
      un.lan ? el('div', { class: 'mode-card' }, el('b', { text: t('mode_local') }), el('span', { class: 'small muted', text: t('modeDesc_local') }), localBtns) : locked('mode_local', t('unlockAfter', { n: 5 })),
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
        );
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
    return el('div', {}, el('p', { class: 'small muted', text: t('advHelp') }), el('div', { class: 'adv-map' }, worlds));
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
    const rows = ['best', 'games', 'distance', 'jumps', 'ducks', 'coins', 'obstacles', 'perfects', 'bestCombo', 'powerups', 'meteors', 'pounds', 'revives', 'dailies', 'eggs', 'bosses', 'botWins', 'time', 'mpGames', 'mpWins', 'coopGames', 'coopBest', 'goldBones', 'miniBosses', 'chests', 'challengesWon', 'tournaments', 'levelsMade', 'levelsWon', 'weeklies', 'photos'].map((k) =>
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
    const toggle = (key) =>
      this.row(t('set_' + key), s[key] ? t('on') : t('off'), () => {
        s[key] = !s[key];
        apply();
      });
    const cycle = (key, values, label) =>
      this.row(t('set_' + key), label(s[key]), () => {
        s[key] = values[(values.indexOf(s[key]) + 1) % values.length];
        apply();
      });
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
    return el(
      'div',
      { class: 'settings' },
      cycle('lang', LANGS, (v) => (v === 'auto' ? t('lang_auto') : v.toUpperCase())),
      toggle('music'),
      cycle('musicVol', [25, 50, 75, 100], (v) => v + '%'),
      toggle('sfx'),
      cycle('sfxVol', [25, 50, 75, 100], (v) => v + '%'),
      toggle('vibration'),
      toggle('lefty'),
      cycle('style', ['normal', 'outline', 'gameboy', 'crt'], (v) => t('style_' + v)),
      cycle('pixel', [0, 1, 2], (v) => 'PX' + (v + 1)),
      toggle('ghost'),
      cycle('quality', ['auto', 'high', 'medium', 'low'], (v) => t('q_' + v)),
      toggle('highlight'),
      toggle('bigText'),
      this.g.isTouch ? null : this.keyRow('keyJump'),
      this.g.isTouch ? null : this.keyRow('keyDuck'),
      toggle('seasons'),
      this.row(t('set_menuMusic'), s.menuMusic ? t('on') : t('off'), () => {
        s.menuMusic = !s.menuMusic;
        save();
        this.g.menuMusic();
        this.renderPanel();
      }),
      this.g.isTouch
        ? this.row(t('set_controls'), t(s.controls.mode === 'buttons' ? 'ctlModeButtons' : 'ctlModeZones'), () => {
            this.closePanel(true);
            $('menu').classList.add('hidden');
            openControlsEditor(() => {
              this.openPanel('settings');
            });
          })
        : null,
      this.row(t('transfer'), t('open'), () => this.openPanel('transfer')),
      this.row(t('set_news'), t('open'), () => this.showNews()),
      this.g.isApp ? this.updateRow() : null,
      reset,
    );
  }
  keyRow(key) {
    const label = this.capturing === key ? t('pressKey') : keyName(this.p.settings[key]);
    return this.row(t('set_' + key), label, () => {
      this.capturing = key;
      this.renderPanel();
    });
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
    const row = this.row(t('set_version', { v: this.version || '…' }), this.updating ? '…' : t('updateCheck'), () => this.checkUpdates(true));
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
        el('span', { text: `${r.name} (${r.n}/${MAX_PLAYERS})` }),
        r.st === 'race' || r.n >= MAX_PLAYERS
          ? el('span', { class: 'muted', text: r.st === 'race' ? t('mpRacing') : t('mpFull') })
          : el('button', {
              text: t('mpJoin'),
              onclick: () => {
                this.lanView = 'lobby';
                this.lanIsHost = false;
                this.g.lanJoin(r);
                this.renderPanel();
              },
            }),
      ),
    );
  }
  mpLobby(players, isHost, myId, mode) {
    this.lobby = players;
    this.lanIsHost = isHost;
    this.myId = myId;
    this.lanMode = mode || 'race';
    if (this.lanView === 'home' && !isHost) this.lanView = 'lobby';
    if (this.panel === 'lan' && this.lanView === 'lobby') this.renderPanel();
  }
  mpResults(results, myId, tour) {
    this.results = results;
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
    return el(
      'div',
      { class: 'lan' },
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
      el(
        'div',
        { class: 'field inline' },
        el('span', { text: t('mpManual') }),
        ip,
        el('button', {
          text: t('mpConnect'),
          onclick: () => {
            if (!ip.value.trim()) return;
            this.g.lanSetName(name.value);
            this.lanView = 'lobby';
            this.g.lanJoinIp(ip.value);
            this.renderPanel();
          },
        }),
      ),
      this.myIp ? el('p', { class: 'muted small', text: t('mpYourIp', { ip: this.myIp }) }) : null,
      el('p', { class: 'muted small', text: t('mpHotspotTip') }),
      this.coopTopEl(),
    );
  }
  lobbyEl() {
    const players = this.lobby.map((p, i) =>
      el(
        'div',
        { class: 'player' },
        dinoIcon(SKINS[p.skin] ? p.skin : 'classic'),
        el('span', { text: p.name }),
        el('span', { class: 'muted', text: [i === 0 ? t('mpHostTag') : '', p.id === this.myId ? t('mpYou') : ''].filter(Boolean).join(' · ') }),
      ),
    );
    const canStart = this.lobby.length >= 2;
    const MODES = ['race', 'sabotage', 'elimination', 'tournament', 'coop'];
    const modeRow = this.lanIsHost
      ? this.row(t('lanModeLabel'), t('lanMode_' + (this.lanMode || 'race')), () => this.g.lanSetMode(MODES[(MODES.indexOf(this.lanMode || 'race') + 1) % MODES.length]))
      : this.row(t('lanModeLabel'), t('lanMode_' + (this.lanMode || 'race')), () => {});
    return el(
      'div',
      { class: 'lan' },
      el('h3', { text: t('mpPlayers', { n: this.lobby.length }) }),
      modeRow,
      el('p', { class: 'muted small', text: t('lanModeHelp_' + (this.lanMode || 'race')) }),
      el('div', { class: 'players' }, players.length ? players : el('p', { class: 'muted', text: '…' })),
      this.myIp ? el('p', { class: 'muted small', text: t('mpYourIp', { ip: this.myIp }) }) : null,
      this.lanIsHost
        ? el('button', { class: 'menu-btn primary', text: t('mpStart'), disabled: !canStart, onclick: () => this.g.lanStart() })
        : el('p', { class: 'blink', text: t('mpWaitHost') }),
      this.lanIsHost && !canStart ? el('p', { class: 'muted small', text: t('mpNeed2') }) : null,
      el('button', { class: 'menu-btn', text: t('mpLeave'), onclick: () => this.leaveLanToMenu() }),
    );
  }
  resultsEl() {
    const r = this.results || [];
    const winner = r[0];
    const coop = this.lanMode === 'coop';
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
    const again = tour ? (tour.done ? t('tourNew') : t('tourNext')) : t('again');
    return el(
      'div',
      { class: 'lan' },
      tour && !tour.done ? null : el('h3', { class: 'winner', text: head }),
      tourEls,
      el('ol', { class: 'top' }, r.map((p) => el('li', { class: p.id === this.myId ? 'me' : '' }, el('b', { text: pad5(p.sc) }), el('span', { text: p.name })))),
      coop ? this.coopTopEl() : null,
      this.lanIsHost
        ? el('button', { class: 'menu-btn primary', text: again, disabled: this.lobby.length < 2, onclick: () => this.g.lanStart() })
        : el('p', { class: 'blink', text: t('mpWaitHost') }),
      el('button', { class: 'menu-btn', text: t('mpLeave'), onclick: () => this.leaveLanToMenu() }),
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

