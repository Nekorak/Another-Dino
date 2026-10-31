// Everything the game remembers between sessions, kept in localStorage.
const KEY = 'another-dino:profile';
const GHOST_KEY = 'another-dino:ghost';

function defaults() {
  return {
    v: 1,
    coins: 0,
    owned: { skin: ['classic'], hat: ['none'], pet: ['none'] },
    skin: 'classic',
    hat: 'none',
    pet: 'none',
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
