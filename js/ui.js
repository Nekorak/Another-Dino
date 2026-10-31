// All menus, panels and HUD elements (plain DOM on top of the 3D canvas).
import { t, LANGS } from './i18n.js';
import { SKINS, HATS, PETS, POWERUP_COLOR, hatPixels, petPixels } from './models.js';
import { UPGRADES, nextUpgradeCost, buyUpgrade, upgradeLevel, levelProgress, dailyInfo, EGG_PRICE, openEgg, eggPoolSize } from './progress.js';
import { save, resetProgress } from './save.js';
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

function hatIcon(id) {
  return pixelIcon(hatPixels(id));
}

function petIcon(id) {
  return pixelIcon(petPixels(id));
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

    const menu = $('menu-buttons');
    const items = [
      ['play', () => g.startSolo(), 'primary'],
      ['daily', () => g.startDaily()],
      ['twoPlayers', () => g.startLocal2()],
      ['multiplayer', () => this.openPanel('lan')],
      ['shop', () => this.openPanel('shop')],
      ['missions', () => this.openPanel('missions')],
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
    for (const id of ['menu', 'over', 'paused']) $(id).classList.add('hidden');
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
  showPaused(on) {
    $('paused').classList.toggle('hidden', !on);
  }
  showOver({ score, record, coins, missions, lan, xp, local2, daily }) {
    this.overShownAt = performance.now() / 1000;
    $('over-score').textContent = pad5(score);
    $('over-record').textContent = record ? t('record') : '';
    $('over-xp').textContent = xp ? t('xpGained', { n: xp }) : '';
    const extra = $('over-extra');
    extra.replaceChildren();
    if (local2) {
      const [a, b] = local2;
      const head = a.sc === b.sc ? t('draw') : t('mpWinner', { name: a.sc > b.sc ? a.name : b.name });
      extra.append(el('p', { class: 'winner', text: head }), el('p', { text: `${a.name} ${pad5(a.sc)}   ${b.name} ${pad5(b.sc)}` }));
    }
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
    if (name === 'shop') this.preview = { skin: this.p.skin, hat: this.p.hat, pet: this.p.pet };
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
    if (was === 'shop' && (this.preview.skin !== this.p.skin || this.preview.hat !== this.p.hat || this.preview.pet !== this.p.pet)) this.g.previewDino(this.p.skin, this.p.hat, this.p.pet);
    if (!silent) this.menuInfo();
    if (was === 'lan' && !silent) this.g.lanLeave();
    if (!silent && this.g.state === 'menu') $('menu').classList.remove('hidden');
  }
  renderPanel() {
    const titles = { shop: 'shop', missions: 'missions', stats: 'stats', settings: 'settings', lan: 'mpTitle' };
    $('panel-title').textContent = t(titles[this.panel]);
    this.setCoins();
    const body = $('panel-body');
    const render = { shop: () => this.shopView(), missions: () => this.missionsView(), stats: () => this.statsView(), settings: () => this.settingsView(), lan: () => this.lanViewEl() }[this.panel];
    const scroll = body.scrollTop;
    body.replaceChildren(render());
    body.scrollTop = scroll;
  }

  // ------------------------------------------------------------ shop
  shopView() {
    const p = this.p;
    const TABS = { skin: 'shopSkins', hat: 'shopHats', pet: 'shopPets', upgrade: 'shopUpgrades' };
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
    const list = { skin: SKINS, hat: HATS, pet: PETS }[kind];
    const owned = p.owned[kind];
    const grid = el('div', { class: 'cards' });
    grid.append(this.eggCard());
    for (const [id, item] of Object.entries(list)) {
      if (item.hidden) continue;
      const have = owned.includes(id);
      const status = id === p[kind] ? t('equipped') : have ? t('owned') : null;
      const icon = kind === 'skin' ? dinoIcon(id) : kind === 'hat' ? hatIcon(id) : petIcon(id);
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
      } else {
        this.toast(t('notEnough'), 'red');
      }
    }
    this.g.previewDino(this.preview.skin, this.preview.hat, this.preview.pet);
    this.renderPanel();
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
    const rows = ['best', 'games', 'distance', 'jumps', 'ducks', 'coins', 'obstacles', 'powerups', 'meteors', 'pounds', 'revives', 'dailies', 'eggs', 'time', 'mpGames', 'mpWins'].map((k) =>
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
  async share() {
    let data;
    try {
      data = await this.g.recordImage();
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

