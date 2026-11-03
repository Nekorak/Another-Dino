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
      // on-screen controls: 'zones' (left/right halves) or movable 'buttons'
      controls: { mode: 'zones', split: 0.5, jump: { x: 0.86, y: 0.78, s: 1 }, duck: { x: 0.14, y: 0.78, s: 1 } },
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
    },
    top: [],
    missions: { active: [], done: 0 },
    achievements: {},
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
  for (const k of Object.keys(base)) {
    if (p[k] === undefined) p[k] = base[k];
    else if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) p[k] = { ...base[k], ...p[k] };
  }
  return p;
}

export const profile = load();

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
