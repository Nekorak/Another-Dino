// Personalisation: victory dances, menu themes and the data behind the skin editor.
import { DINO_STAND } from './models.js';

// ------------------------------------------------------------------ victory dances
// Played on a new record (the dino comes back together for it) and on a finished level.
export const DANCES = {
  hop: { price: 0 },
  spin: { price: 150 },
  wiggle: { price: 200 },
  flip: { price: 250 },
  moonwalk: { price: 300 },
  disco: { price: 400 },
};

// d: a dino from createDino; t: seconds since the dance started
export function danceDino(d, id, t) {
  const r = d.root;
  const legs = d.legs;
  const hop = (k = 1) => Math.abs(Math.sin(t * 6 * k)) * 0.5;
  r.rotation.set(0, 0, 0);
  r.scale.setScalar(1);
  legs[0].rotation.z = legs[1].rotation.z = 0;
  switch (id) {
    case 'spin':
      r.position.y = hop(0.5) * 1.4;
      r.rotation.y = t * 7;
      break;
    case 'wiggle':
      r.position.y = hop() * 0.3;
      r.rotation.x = Math.sin(t * 10) * 0.35;
      r.rotation.z = Math.sin(t * 5) * 0.12;
      legs[0].rotation.z = Math.sin(t * 10) * 0.6;
      legs[1].rotation.z = -Math.sin(t * 10) * 0.6;
      break;
    case 'flip': {
      // a backflip every 1.4 seconds
      const k = (t % 1.4) / 1.4;
      const air = k < 0.6 ? k / 0.6 : 1;
      r.position.y = k < 0.6 ? Math.sin(air * Math.PI) * 2.6 : 0;
      r.rotation.z = k < 0.6 ? air * Math.PI * 2 : 0;
      legs[0].rotation.z = legs[1].rotation.z = k < 0.6 ? 0.8 : 0;
      break;
    }
    case 'moonwalk': {
      // glides backwards and forwards while the legs keep walking
      r.position.x = Math.sin(t * 1.6) * 1.2;
      r.position.y = 0;
      const a = Math.sin(t * 9) * 0.7;
      legs[0].rotation.z = a;
      legs[1].rotation.z = -a;
      r.rotation.z = -0.08;
      break;
    }
    case 'disco':
      r.position.y = hop(1.2) * 0.6;
      r.rotation.y = Math.sin(t * 3) * 0.9;
      r.rotation.z = Math.sin(t * 6) * 0.15;
      r.scale.setScalar(1 + Math.abs(Math.sin(t * 6)) * 0.12);
      legs[0].rotation.z = Math.sin(t * 12) * 0.5;
      legs[1].rotation.z = Math.cos(t * 12) * 0.5;
      break;
    default:
      r.position.y = hop();
      legs[0].rotation.z = legs[1].rotation.z = r.position.y > 0.1 ? 0.5 : 0;
  }
}

// ------------------------------------------------------------------ menu themes
// colours of the menus, the world shown behind them and the menu music
export const THEMES = {
  classic: { price: 0, biome: 0, song: 0, vars: {} },
  jungle: {
    price: 200,
    biome: 1,
    song: 1,
    vars: { '--sheet': 'rgba(236, 248, 224, 0.95)', '--sheet-ink': '#23401c', '--line': '#2f5a24', '--accent': '#e8a823', '--accent-ink': '#2a1c00' },
  },
  frost: {
    price: 200,
    biome: 3,
    song: 3,
    vars: { '--sheet': 'rgba(238, 247, 255, 0.95)', '--sheet-ink': '#1e3a5a', '--line': '#24456a', '--accent': '#3f8fd9', '--accent-ink': '#ffffff' },
  },
  candy: {
    price: 250,
    biome: 2,
    song: 2,
    vars: { '--sheet': 'rgba(255, 240, 247, 0.95)', '--sheet-ink': '#5a1f3e', '--line': '#6a2448', '--accent': '#ff6fa8', '--accent-ink': '#ffffff' },
  },
  lava: {
    price: 300,
    biome: 6,
    song: 6,
    vars: { '--sheet': 'rgba(42, 24, 22, 0.95)', '--sheet-ink': '#ffe8d0', '--line': '#ffb070', '--accent': '#ff6a2a', '--accent-ink': '#2a0e00' },
  },
  space: {
    price: 350,
    biome: 7,
    song: 7,
    vars: { '--sheet': 'rgba(20, 26, 51, 0.95)', '--sheet-ink': '#e8ecff', '--line': '#9fb4ff', '--accent': '#9a5ad8', '--accent-ink': '#ffffff' },
  },
};

const ALL_VARS = [...new Set(Object.values(THEMES).flatMap((th) => Object.keys(th.vars)))];

export function applyThemeVars(id) {
  const th = THEMES[id] || THEMES.classic;
  const root = document.documentElement.style;
  for (const v of ALL_VARS) root.removeProperty(v);
  for (const [k, v] of Object.entries(th.vars)) root.setProperty(k, v);
  document.body.dataset.theme = id;
}

// ------------------------------------------------------------------ skin editor
export const EDITOR_GRID = DINO_STAND; // 22 x 20 side view of the standing dino
export const EDITOR_PALETTE = [
  '#1b1b1b', '#ffffff', '#8a8a8a', '#3b3326',
  '#e0303a', '#ff8a1a', '#ffd23f', '#5fae3e',
  '#2e7a3a', '#3fc3a8', '#3f8fd9', '#24456a',
  '#9a5ad8', '#ff6fa8', '#f6c2ae', '#8a5a3a',
];
// what each part of the dino is, for the colour slots of the editor
export const EDITOR_SLOTS = ['body', 'belly', 'eye', 'pupil', 'mouth', 'foot'];
const CELL_SLOT = { G: 'body', A: 'body', B: 'belly', W: 'eye', K: 'pupil', M: 'mouth' };

// the colour shown in the editor for one cell (null = empty)
export function editorCell(skin, x, r) {
  const ch = EDITOR_GRID[r][x];
  if (!ch || ch === ' ') return null;
  return skin.paint[x + ',' + r] || skin[CELL_SLOT[ch]] || skin.body;
}

// a darker shade of a colour for the spine ridge
export function darker(hex, k = 0.72) {
  const n = parseInt(hex.slice(1), 16);
  const c = (s) => Math.round(((n >> s) & 255) * k);
  return '#' + [16, 8, 0].map((s) => c(s).toString(16).padStart(2, '0')).join('');
}
