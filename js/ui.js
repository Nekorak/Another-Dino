// All menus, panels and HUD elements (plain DOM on top of the 3D canvas).
import { t, LANGS } from './i18n.js';
import { SKINS, HATS, PETS, POWERUP_COLOR, hatPixels, petPixels } from './models.js';
import { UPGRADES, nextUpgradeCost, buyUpgrade, upgradeLevel, levelProgress, dailyInfo, EGG_PRICE, openEgg, eggPoolSize } from './progress.js';
import { BIOMES } from './biomes.js';
import { ADV_LEVELS, stars as advStars, unlocked as advUnlocked, totalStars } from './modes.js';
import { TRAILS, FOSSIL_KINDS, FOSSIL_WORLD_REWARD, fossilId, fossilPixels, allFossils } from './collection.js';
import { encodeProgress, decodeProgress, mergeProgress, qrCanvas, readQrFromImage, CameraScanner, LanSync } from './transfer.js';
import { save, resetProgress } from './save.js';
import { DANCES, THEMES, EDITOR_GRID, editorCell } from './custom.js';
import { skinEditorView } from './editor.js';
import { missionProgress, ACHIEVEMENTS } from './missions.js';
import { Capacitor, registerPlugin } from '@capacitor/core';

const Updater = registerPlugin('Updater');
const Share = registerPlugin('Share');

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
  return pixelIcon(petPixels(id));
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
    btn('btn-photo-save', () => this.share(true));
    btn('btn-win-next', () => this.nextLevel());
    btn('btn-win-map', () => {
      g.toMenu();
      this.openPanel('adventure');
    });
    btn('btn-win-retry', () => g.restart());

    const menu = $('menu-buttons');
    const items = [
      ['play', () => g.startSolo(), 'primary'],
      ['modes', () => this.openPanel('modes')],
      ['multiplayer', () => this.openPanel('lan')],
      ['shop', () => this.openPanel('shop')],
      ['missions', () => this.openPanel('missions')],
      ['album', () => this.openPanel('album')],
      ['stats', () => this.openPanel('stats')],
      ['settings', () => this.openPanel('settings')],
    ];
    for (const [key, fn, cls] of items) {
      const b = el('button', { class: 'menu-btn ' + (cls || ''), 'data-t': key, id: 'menu-' + key });
      b.addEventListener('click', () => {
        g.unlockAudio();
        fn();
      });
      menu.append(b);
    }
    $('menu-coins').prepend(bone());
    $('panel-coins').prepend(bone());
    $('runcoins').prepend(bone());
  }

  refreshTexts() {
    for (const e of document.querySelectorAll('[data-t]')) e.textContent = t(e.dataset.t);
    $('controls-msg').textContent = (this.g.isTouch ? '' : t('controlsKey') + ' · ') + t('abilitiesHint');
    $('hint-jump').textContent = t('jump');
    $('hint-duck').textContent = t('duck');
    $('hints').classList.toggle('lefty', this.p.settings.lefty);
    $('paused-title').textContent = t('paused');
    $('paused-msg').textContent = t('resume');
    $('btn-sound').classList.toggle('off', !(this.p.settings.sfx || this.p.settings.music));
    $('revive-title').textContent = t('reviveTitle');
    $('btn-revive-no').textContent = t('reviveNo');
    $('btn-share').textContent = t('share');
    $('btn-bomb').textContent = t('bombSend');
    for (const [id, key] of [['btn-resume', 'resumeBtn'], ['btn-photo', 'photo'], ['btn-pause-menu', 'menu'], ['btn-zen-end', 'zenEnd'], ['btn-photo-back', 'back'], ['btn-photo-save', 'photoSave'], ['btn-win-next', 'advNext'], ['btn-win-map', 'advMap'], ['btn-win-retry', 'again']]) $(id).textContent = t(key);
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
    box.replaceChildren(
      ...Object.entries(power)
        .filter(([, v]) => v > 0)
        .map(([k, v]) =>
          el(
            'div',
            { class: 'pu', style: `--c:${POWERUP_COLOR[k]}` },
            el('span', { text: t('pu_' + k) }),
            el('i', { style: `width:${Math.round((v / max[k]) * 100)}%` }),
          ),
        ),
    );
  }
  setPlaying(on, mode = 'solo', lanMode = 'race') {
    document.body.classList.toggle('playing', on);
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
  bossBar(k) {
    const b = $('bossbar');
    b.classList.toggle('hidden', k == null);
    if (k != null) {
      b.querySelector('i').style.width = Math.round(k * 100) + '%';
      b.querySelector('span').textContent = t('bossName');
    }
  }
  photoMode(on) {
    document.body.classList.toggle('photo', on);
    $('photo-ui').classList.toggle('hidden', !on);
  }
  showWin({ stars, reward, adv, coins, spawned, hits, xp }) {
    this.overShownAt = performance.now() / 1000;
    $('win-title').textContent = adv.boss ? t('bossDefeated') : t('advWin');
    $('win-stars').replaceChildren(...[0, 1, 2].map((i) => el('span', { class: 'star' + (i < stars ? ' on' : '') })));
    // replaceChildren would print a null as the text "null"
    const lines = [
      el('p', { text: t('advBones', { a: coins, b: spawned }) }),
      el('p', { text: hits ? t('advHits', { n: hits }) : t('advNoHits') }),
      reward ? el('p', { class: 'mission-done', text: t('coinsEarned', { n: reward }) }) : null,
      xp ? el('p', { class: 'small', text: t('xpGained', { n: xp }) }) : null,
    ];
    $('win-details').replaceChildren(...lines.filter(Boolean));
    const hasNext = this.nextLevelOf(adv) != null;
    $('btn-win-next').classList.toggle('hidden', !hasNext);
    $('win').classList.remove('hidden');
    document.body.classList.add('over');
  }
  nextLevelOf(adv) {
    if (!adv) return null;
    if (adv.level < ADV_LEVELS - 1) return { world: adv.world, level: adv.level + 1 };
    if (adv.world < BIOMES.length - 1) return { world: adv.world + 1, level: 0 };
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
    for (const id of ['menu', 'over', 'paused', 'win']) $(id).classList.add('hidden');
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
  }
  showPaused(on, mode) {
    $('paused').classList.toggle('hidden', !on);
    document.body.classList.toggle('paused', !!on);
    $('btn-zen-end').classList.toggle('hidden', mode !== 'zen');
  }
  showOver({ score, record, coins, missions, lan, xp, local2, daily, bot, mode }) {
    this.overShownAt = performance.now() / 1000;
    $('over-title').textContent = mode === 'zen' ? t('zenOver') : 'GAME OVER';
    $('over-score').textContent = pad5(score);
    $('over-record').textContent = record ? t('record') : '';
    $('over-xp').textContent = xp ? t('xpGained', { n: xp }) : '';
    const extra = $('over-extra');
    extra.replaceChildren();
    if (local2) {
      const best = Math.max(...local2.map((q) => q.sc));
      const top = local2.filter((q) => q.sc === best);
      const head = top.length > 1 ? t('draw') : t('mpWinner', { name: top[0].name });
      extra.append(el('p', { class: 'winner', text: head }), el('p', { text: local2.map((q) => `${q.name} ${pad5(q.sc)}`).join('   ') }));
    }
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
    const box = $('toasts');
    const n = el('div', { class: 'toast ' + kind, text });
    if (POWERUP_COLOR[kind]) n.style.setProperty('--c', POWERUP_COLOR[kind]);
    box.append(n);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => n.classList.add('out'), 2200);
    setTimeout(() => n.remove(), 2700);
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
  openPanel(name) {
    this.panel = name;
    $('menu').classList.add('hidden');
    $('panel').classList.remove('hidden');
    $('panel').dataset.panel = name;
    document.body.classList.add('panel-open');
    if (name === 'shop') this.preview = { skin: this.p.skin, hat: this.p.hat, pet: this.p.pet, trail: this.p.trail, dance: this.p.dance, theme: this.p.theme };
    if (name === 'lan') this.lanView = this.g.lan && this.g.lan.role !== 'idle' ? this.lanView : 'home';
    this.renderPanel();
    if (name === 'lan') this.startLan();
  }
  closePanel(silent) {
    if (!this.panel) return;
    const was = this.panel;
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
    if (!silent && this.g.state === 'menu') $('menu').classList.remove('hidden');
  }
  renderPanel() {
    const titles = { shop: 'shop', missions: 'missions', stats: 'stats', settings: 'settings', lan: 'mpTitle', modes: 'modes', adventure: 'adventure', album: 'album', transfer: 'transfer', editor: 'edTitle' };
    $('panel-title').textContent = t(titles[this.panel]);
    this.setCoins();
    const body = $('panel-body');
    const render = {
      shop: () => this.shopView(),
      missions: () => this.missionsView(),
      stats: () => this.statsView(),
      settings: () => this.settingsView(),
      lan: () => this.lanViewEl(),
      modes: () => this.modesView(),
      adventure: () => this.adventureView(),
      album: () => this.albumView(),
      transfer: () => this.transferView(),
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
    if (kind === 'skin' || kind === 'hat' || kind === 'pet') grid.append(this.eggCard());
    for (const [id, item] of Object.entries(list)) {
      if (item.hidden) continue;
      const have = owned.includes(id);
      const status = item.editor && have ? t('edOpen') : id === p[kind] ? t('equipped') : have ? t('owned') : null;
      if ((item.season || item.album) && !have) continue; // gifts are shown once you have them
      const icon =
        kind === 'skin' ? dinoIcon(id) : kind === 'hat' ? hatIcon(id) : kind === 'pet' ? petIcon(id) : kind === 'dance' ? danceIcon(id, p.skin) : kind === 'theme' ? themeIcon(id) : trailIcon(id);
      const price = item.level
        ? el('span', { class: 'card-price' }, t('levelShort', { n: item.level }))
        : el('span', { class: 'card-price' }, bone(), ' ' + item.price);
      const card = el(
        'button',
        { class: 'card' + (id === this.preview[kind] ? ' sel' : '') + (have ? '' : ' locked') },
        icon,
        el('span', { class: 'card-name', text: t(kind + '_' + id) }),
        status ? el('span', { class: 'card-tag', text: status }) : price,
      );
      card.addEventListener('click', () => this.shopClick(kind, id, item, have));
      grid.append(card);
    }
    return el('div', {}, tabs, grid);
  }
  eggCard() {
    const left = eggPoolSize();
    const card = el(
      'button',
      { class: 'card egg-card' + (left ? '' : ' locked') },
      el('span', { class: 'egg-icon' }),
      el('span', { class: 'card-name', text: t('egg') }),
      left ? el('span', { class: 'card-price' }, bone(), ' ' + EGG_PRICE) : el('span', { class: 'card-tag', text: t('eggEmpty') }),
    );
    card.addEventListener('click', () => this.openEggClick());
    return card;
  }
  openEggClick() {
    if (!eggPoolSize()) return this.toast(t('eggEmpty'), 'gold');
    if (this.p.coins < EGG_PRICE) return this.toast(t('notEnough'), 'red');
    const prize = openEgg();
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
      el('button', { class: 'mode-card', onclick: fn }, el('b', { text: t(key) }), el('span', { class: 'small muted', text: desc }), extra || null);
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
    return el(
      'div',
      { class: 'modes' },
      card('mode_adventure', t('modeDesc_adventure', { n: totalStars(), max: BIOMES.length * ADV_LEVELS * 3 }), () => this.openPanel('adventure')),
      card('daily', d.done ? t('dailyDoneShort', { n: d.streak }) : t('dailyTarget', { n: d.target, b: d.reward }), () => g.startMode('daily')),
      card('mode_zen', t('modeDesc_zen'), () => g.startMode('zen')),
      card('mode_hardcore', t('modeDesc_hardcore'), () => g.startMode('hardcore')),
      card('mode_bot', t('modeDesc_bot'), () => g.startMode('bot'), botBtn),
      el('div', { class: 'mode-card' }, el('b', { text: t('mode_local') }), el('span', { class: 'small muted', text: t('modeDesc_local') }), localBtns),
    );
  }

  // ------------------------------------------------------------ adventure map
  adventureView() {
    const worlds = BIOMES.map((b, w) =>
      el(
        'div',
        { class: 'world' },
        el('b', { class: 'world-name', text: t('biome_' + b.id) }),
        el(
          'div',
          { class: 'levels' },
          Array.from({ length: ADV_LEVELS }, (_, l) => {
            const open = advUnlocked(w, l);
            const st = advStars(w, l);
            const btn = el(
              'button',
              { class: 'level' + (open ? '' : ' locked') + (l === ADV_LEVELS - 1 ? ' boss' : ''), disabled: !open },
              el('span', { text: l === ADV_LEVELS - 1 ? t('bossShort') : String(w * ADV_LEVELS + l + 1) }),
              el('span', { class: 'mini-stars' }, [0, 1, 2].map((i) => el('i', { class: i < st ? 'on' : '' }))),
            );
            btn.addEventListener('click', () => this.g.startMode('adventure', { world: w, level: l }));
            return btn;
          }),
        ),
      ),
    );
    return el('div', {}, el('p', { class: 'small muted', text: t('advHelp') }), el('div', { class: 'worlds' }, worlds));
  }

  // ------------------------------------------------------------ fossil album
  albumView() {
    const have = new Set(this.p.fossils);
    const total = allFossils().length;
    const rows = BIOMES.map((b) => {
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
      body = el('div', { class: 'xfer' }, el('p', { class: 'small', text: t('xferQrHelp') }), qrCanvas(code, 3), el('p', { class: 'small muted', text: t('xferCodeHelp') }), area, copy);
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
    const ms = this.p.missions.active.map((m) => {
      const prog = missionProgress(m, null);
      const pct = Math.round((Math.max(0, prog) / m.target) * 100);
      return el(
        'div',
        { class: 'mission' },
        el('p', { text: t('m_' + m.kind, { n: m.target }) }),
        m.scope === 'run' ? null : el('div', { class: 'bar' }, el('i', { style: `width:${pct}%` })),
        el('p', { class: 'mission-meta' }, m.scope === 'run' ? '' : `${Math.max(0, prog)}/${m.target}  `, bone(), ' +' + m.reward),
      );
    });
    const ach = ACHIEVEMENTS.map((a) => {
      const done = !!this.p.achievements[a.id];
      return el('div', { class: 'ach' + (done ? ' done' : '') }, el('span', { class: 'ach-mark' }), el('span', { text: t('a_' + a.id) }));
    });
    const count = Object.keys(this.p.achievements).length;
    return el(
      'div',
      {},
      el('h3', { text: t('missionsTitle') }),
      ms,
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
    const rows = ['best', 'games', 'distance', 'jumps', 'ducks', 'coins', 'obstacles', 'perfects', 'bestCombo', 'powerups', 'meteors', 'pounds', 'revives', 'dailies', 'eggs', 'bosses', 'botWins', 'time', 'mpGames', 'mpWins'].map((k) =>
      el('div', { class: 'stat' }, el('span', { text: t('st_' + k) }), el('b', { text: k === 'time' ? fmtTime(s[k]) : String(s[k]) })),
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
      toggle('sfx'),
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
      this.row(t('transfer'), t('open'), () => this.openPanel('transfer')),
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
        el('span', { text: `${r.name} (${r.n}/4)` }),
        r.st === 'race' || r.n >= 4
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
  mpResults(results, myId) {
    this.results = results;
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
    const MODES = ['race', 'sabotage', 'elimination'];
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
    const head = winner ? (winner.id === this.myId && r.length > 1 ? t('mpYouWon') : t('mpWinner', { name: winner.name })) : '';
    return el(
      'div',
      { class: 'lan' },
      el('h3', { class: 'winner', text: head }),
      el('ol', { class: 'top' }, r.map((p) => el('li', { class: p.id === this.myId ? 'me' : '' }, el('b', { text: pad5(p.sc) }), el('span', { text: p.name })))),
      this.lanIsHost
        ? el('button', { class: 'menu-btn primary', text: t('again'), disabled: this.lobby.length < 2, onclick: () => this.g.lanStart() })
        : el('p', { class: 'blink', text: t('mpWaitHost') }),
      el('button', { class: 'menu-btn', text: t('mpLeave'), onclick: () => this.leaveLanToMenu() }),
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
    const text = t('shareText');
    try {
      if (window.desktop && window.desktop.shareImage) {
        await window.desktop.shareImage(data);
        this.toast(t('shareSaved'), 'gold');
      } else if (Capacitor.getPlatform() === 'android') {
        await Share.shareImage({ data: data.split(',')[1], text });
      } else {
        const blob = await (await fetch(data)).blob();
        const file = new File([blob], 'another-dino.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], text });
        else if (navigator.clipboard && window.ClipboardItem) {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
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
        const r = await Updater.install({ url });
        handle.remove();
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

