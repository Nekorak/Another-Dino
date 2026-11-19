// Everything the game remembers between sessions, kept in localStorage.
const KEY = 'another-dino:profile';
const GHOST_KEY = 'another-dino:ghost';

function defaults() {
  return {
    v: 1,
    coins: 0,
    owned: { skin: ['classic'], hat: ['none'], pet: ['none'], trail: ['none'], dance: ['hop'], theme: ['classic'] },
    skin: 'classic',
    hat: 'none',
    pet: 'none',
    trail: 'none',
    dance: 'hop', // victory dance on a record or a finished level
    theme: 'classic', // menu colours, scenery and music
    // the dino painted in the skin editor
    customSkin: { body: '#5fae3e', dark: '#467f2c', belly: '#cfe39a', eye: '#ffffff', pupil: '#1b1b1b', mouth: '#2b4a1c', foot: '#3b6b26', paint: {} },
    chest: { last: '', streak: 0 }, // daily chest: last day it was opened, days in a row
    pass: { season: '', xp: 0, claimed: [] }, // free season pass
    challenges: { made: 0, beaten: 0 }, // QR challenges
    fossils: [], // ids like 'desert-1'
    adventure: {}, // 'world-level' -> stars (1..3)
    seasonGifts: [], // seasons whose free hat was already given
    xp: 0,
    upgrades: { duration: 0, shieldStart: 0, bones: 0, luck: 0 },
    daily: { date: '', best: 0, done: '', streak: 0 },
    name: '',
    tutorial: false,
    settings: {
      lang: 'auto',
      music: true,
      sfx: true,
      vibration: true,
      lefty: false,
      style: 'normal',
      pixel: 1,
      ghost: true,
      quality: 'auto',
      highlight: false,
      bigText: false,
      keyJump: 'Space',
      keyDuck: 'ArrowDown',
      seasons: true,
      botLevel: 1,
      menuMusic: true,
      musicVol: 100, // percent
      sfxVol: 100,
      menuSong: -1, // jukebox pick for the menu, -1: the theme's song
      // v1.6
      shake: true, // the screen shakes on hits
      autoPause: true, // pause when the window loses focus
      showFps: false,
      colorblind: false, // blue instead of red/green for warnings and signals
      reduceFx: false, // no shaking, no flashes, no slow-motion freezes
      oneButton: false, // only jump: the dino ducks by itself
      // on-screen controls: 'zones' (left/right halves) or movable 'buttons'
      controls: { mode: 'zones', split: 0.4, jump: { x: 0.86, y: 0.78, s: 1 }, duck: { x: 0.14, y: 0.78, s: 1 } },
    },
    stats: {
      games: 0,
      distance: 0,
      jumps: 0,
      ducks: 0,
      coins: 0,
      best: 0,
      time: 0,
      powerups: 0,
      obstacles: 0,
      meteors: 0,
      maxBiome: 0,
      mpGames: 0,
      mpWins: 0,
      revives: 0,
      dailies: 0,
      pounds: 0,
      eggs: 0,
      perfects: 0,
      bestCombo: 0,
      botWins: 0,
      bosses: 0,
      goldBones: 0,
      miniBosses: 0,
      chests: 0,
      tournaments: 0,
      challengesWon: 0,
      coopGames: 0,
      coopBest: 0,
      teamBosses: 0, // v1.6: bosses beaten together in LAN co-op
      seasonRuns: 0, // v1.6: runs in the world of the season (normal mode)
      seasonBest: 0,
      rushes: 0, // v1.6: boss rushes finished
      levelsWon: 0,
      levelsMade: 0,
      photos: 0,
      weeklies: 0,
    },
    top: [],
    missions: { active: [], done: 0 },
    weekly: { week: '', list: [], bonus: false }, // weekly missions (bigger, longer)
    achievements: {},
    medals: {}, // stat -> 1 bronze | 2 silver | 3 gold
    petXp: {}, // pet id -> distance run together (pets grow with it)
    levels: [], // tracks made in the level editor or received by QR: { name, w, s, t, from }
    levelStars: {}, // level code hash -> best stars
    // v1.5
    seen: { init: false, ach: 0, fossils: 0, shop: 0, unlocks: [] }, // red dots and step-by-step unlocks
    weeklyTrack: { week: '', done: false }, // the track of the week
    storySeen: [], // adventure: worlds whose story page was shown
    coopTop: [], // co-op: the best teams on this device { s, names, d }
    mutator: { date: '', best: 0 }, // rule of the day: best score today
    // v1.6
    seasonRun: { key: '', best: 0, runs: 0 },
    bossRush: { best: 0, time: 0 }, // most bosses in a row, best time for all of them
    advHard: false, // Adventure+ switched on
    advCrowns: {}, // Adventure+: levels won with three stars ("3-1": 1)
    advTimes: {}, // best time per level ("3-1", and "3-1h" in Adventure+)
    bossKills: {}, // bestiary: boss kind -> times beaten
    obsBiome: {}, // bestiary: world -> obstacles passed there
    dailyShop: { date: '', bought: [] }, // the offers of the day already bought // the season run: best score of this season (key: year + season)
  };
}

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode or full storage: keep playing without saving */
  }
}

// Fill in what an older version did not save and replace values of the wrong type
// (a damaged save must never turn the bone counter into text).
function sanitize(base, p) {
  const out = p && typeof p === 'object' && !Array.isArray(p) ? p : {};
  for (const k of Object.keys(base)) {
    const b = base[k];
    const v = out[k];
    if (v === undefined || v === null) out[k] = b;
    else if (typeof b === 'number') out[k] = typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || b;
    else if (typeof b === 'string' || typeof b === 'boolean') out[k] = typeof v === typeof b ? v : b;
    else if (Array.isArray(b)) out[k] = Array.isArray(v) ? v : b;
    else if (b && typeof b === 'object') {
      // open-ended maps (achievements, adventure stars, paint) have empty defaults: keep any object
      out[k] = Object.keys(b).length ? sanitize(b, v) : v && typeof v === 'object' && !Array.isArray(v) ? v : b;
    }
  }
  return out;
}

function load() {
  const base = defaults();
  const p = read(KEY);
  if (!p) {
    // carry over data from the first version of the game
    const hi = read('another-dino:hi');
    if (typeof hi === 'number') base.stats.best = hi;
    const muted = read('another-dino:muted');
    if (muted === true) base.settings.sfx = false;
    const pixel = read('another-dino:pixel');
    if (typeof pixel === 'number') base.settings.pixel = pixel;
    return base;
  }
  if (typeof p !== 'object' || Array.isArray(p)) return base;
  return sanitize(base, p);
}

export const profile = load();
// the settings as on a fresh install (Settings > Default settings)
export const SETTING_DEFAULTS = defaults().settings;

export function save() {
  write(KEY, profile);
}

export function loadGhost() {
  return read(GHOST_KEY);
}

export function saveGhost(g) {
  write(GHOST_KEY, g);
}

export function resetProgress() {
  const fresh = defaults();
  fresh.settings = profile.settings;
  for (const k of Object.keys(profile)) delete profile[k];
  Object.assign(profile, fresh);
  save();
  saveGhost(null);
}
