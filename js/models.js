// Voxel models for the dino (skins + hats), pterodactyl, coins and power-ups.
// Geometries are built once and reused.
import * as THREE from 'three';
import { VOX, VoxelSet, buildGeometry, voxelMaterial, extrude } from './voxel.js';

// ---------------------------------------------------------------- skins
export const SKINS = {
  classic: { price: 0, body: '#5fae3e', dark: '#467f2c', belly: '#cfe39a', eye: '#ffffff', pupil: '#1b1b1b', mouth: '#2b4a1c', foot: '#3b6b26' },
  red: { price: 100, body: '#d9483b', dark: '#a8322a', belly: '#f6c2ae', eye: '#ffffff', pupil: '#1b1b1b', mouth: '#5a1a14', foot: '#86271f' },
  blue: { price: 150, body: '#3f7fd9', dark: '#2c5ea6', belly: '#c4e2ff', eye: '#ffffff', pupil: '#1b1b1b', mouth: '#16305a', foot: '#24508e' },
  pink: { price: 200, body: '#f27db5', dark: '#c45a8d', belly: '#ffe0ef', eye: '#ffffff', pupil: '#1b1b1b', mouth: '#6e2148', foot: '#a8457a' },
  gold: { price: 500, body: '#e8b923', dark: '#b38b12', belly: '#fff1a8', eye: '#ffffff', pupil: '#1b1b1b', mouth: '#6e520a', foot: '#9a760c', shiny: true },
  shadow: { price: 600, body: '#2d2740', dark: '#1b1728', belly: '#5d4c85', eye: '#d58bff', pupil: '#ffffff', mouth: '#120f1c', foot: '#16121f' },
  skeleton: { price: 800, body: '#ebe5d2', dark: '#b9b09a', belly: '#d2c9b1', eye: '#1b1b1b', pupil: '#e04040', mouth: '#3a3a3a', foot: '#a89f88', pattern: 'ribs' },
  robot: { price: 1000, body: '#a9b4c0', dark: '#6d7884', belly: '#d3dbe3', eye: '#ff3b30', pupil: '#ffd2cf', mouth: '#38404a', foot: '#56606b', pattern: 'panels' },
};

export const HATS = {
  none: { price: 0 },
  party: { price: 100 },
  cowboy: { price: 150 },
  shades: { price: 200 },
  tophat: { price: 250 },
  headphones: { price: 300 },
  crown: { price: 750 },
};

// ---------------------------------------------------------------- dino grids
// Facing +x. 'A' arm (only on the outer layers), 'B' belly, 'W'/'K' eye, 'M' mouth.
const DINO_STAND = [
  '             GGGGGGGG ',
  '            GGGGGGGGGG',
  '            GGWWGGGGGG',
  '            GGWKGGGGGG',
  '            GGGGGGGGGG',
  '            GGGGGGGGGG',
  '            GGGGGMMMMM',
  '            GGGGGGGGG ',
  '            GGGGG     ',
  'G          GGGGGGGG   ',
  'G         GGGGGGGAA   ',
  'GG       GGGGGGGB A   ',
  'GGG     GGGGGGGBB     ',
  'GGGG   GGGGGGGBBB     ',
  'GGGGGGGGGGGGGBBBB     ',
  ' GGGGGGGGGGGBBBB      ',
  '  GGGGGGGGGGGBB       ',
  '   GGGGGGGGGGG        ',
  '    GGGGGGGGG         ',
  '     GGGGGGG          ',
];

const DINO_DUCK = [
  '                     GGGGGGGG ',
  '                    GGGGGGGGGG',
  'GG                  GGWWGGGGGG',
  ' GGGG   GGGGGGGGGGGGGGWKGGGGGG',
  '  GGGGGGGGGGGGGGGGGGGGGGGGGGGG',
  '   GGGGGGGGGGGGGGGGGGGGGGMMMMM',
  '    GGGGGGGGGGGGBBBBBGGGGGGGG ',
  '     GGGGGGGGGGGBBBBBAA       ',
  '      GGGGGGGGGGGGBB  A       ',
  '        GGGGGGGGGG            ',
];

const LEG = ['GGG  ', 'GGG  ', ' GG  ', ' GG  ', ' FFFF'];
const LEG_H = LEG.length;

// Where hats sit (voxel units, relative to the dino origin): top-centre of the head.
const HEAD = {
  stand: { x: 6, y: LEG_H + 20, eyeX: 4 },
  duck: { x: 10, y: LEG_H + 10, eyeX: 8 },
};

function skinColor(s, ch, x, y, z, half) {
  let c;
  switch (ch) {
    case 'A':
      return z === -3 || z === 3 ? s.body : null;
    case 'B':
      c = Math.abs(z) <= 1 ? s.belly : s.body;
      if (s.pattern === 'ribs' && c === s.belly && y % 2 === 0) c = s.dark;
      return c;
    case 'W':
      return z === -half || z === half ? s.eye : s.body;
    case 'K':
      return z === -half || z === half ? s.pupil : s.body;
    case 'M':
      return s.mouth;
    case 'F':
      return s.foot;
    default:
      c = s.body;
      if (s.pattern === 'panels' && ((x + y) % 5 === 0 || y % 6 === 0)) c = s.dark;
      if (s.pattern === 'ribs' && x > 3 && x < 12 && y > 9 && y < 18 && x % 2 === 0) c = s.dark;
      return c;
  }
}

function bodyVoxels(grid, headFromX, headRows, skin) {
  const vs = new VoxelSet();
  const H = grid.length;
  const half = (x, r) => (r <= headRows && x >= headFromX ? 2 : x <= 2 ? 1 : x <= 5 ? 2 : 3);
  extrude(vs, grid, null, {
    depth: (ch, x, y) => {
      const h = half(x, H - 1 - y);
      return [-h, h];
    },
    color: (ch, x, y, z) => skinColor(skin, ch, x, y + LEG_H, z, half(x, H - 1 - y)),
    dy: LEG_H,
  });
  // darker ridge along the spine
  for (const v of vs.map.values()) {
    if (v.z === 0 && !vs.has(v.x, v.y + 1, v.z) && v.color === skin.body) v.color = skin.dark;
  }
  return vs;
}

function deadEyeGeometry(ex, ey, originX) {
  const dead = new VoxelSet();
  const X = [[0, 2], [2, 2], [1, 1], [0, 0], [2, 0]];
  for (const z of [-3, 3]) for (const [a, b] of X) dead.set(ex + a, ey + b, z, '#1b1b1b');
  return buildGeometry(dead, [originX, 0, 0.5], { jitter: 0 });
}

function legGeometry(skin, z0, z1) {
  const vs = new VoxelSet();
  extrude(vs, LEG, null, { depth: () => [z0, z1], color: (ch) => (ch === 'F' ? skin.foot : skin.body) });
  return buildGeometry(vs, [1, LEG_H, 0.5]);
}

// ---------------------------------------------------------------- hats
// Built around the top-centre of the head (x=0 centre, y=0 top surface, z centred).
function hatVoxels(id) {
  const vs = new VoxelSet();
  const box = (x0, x1, y0, y1, z0, z1, c) => {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) vs.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c);
  };
  switch (id) {
    case 'party':
      for (let i = 0; i < 6; i++) {
        const r = 2 - Math.floor(i / 2);
        box(-1 - r, -1 + r, i, i, -r, r, i % 2 ? '#ffd23f' : '#ff4f9a');
      }
      vs.set(-1, 6, 0, '#4fd1ff');
      break;
    case 'cowboy':
      box(-5, 3, 0, 0, -4, 4, '#8a5a2b');
      box(-3, 1, 1, 3, -2, 2, '#a06a35');
      box(-3, 1, 1, 1, -2, 2, '#3b2412');
      box(-2, 0, 3, 3, -1, 1, '#8a5a2b');
      break;
    case 'tophat':
      box(-4, 2, 0, 0, -3, 3, '#1f1f24');
      box(-3, 1, 1, 6, -2, 2, '#2a2a31');
      box(-3, 1, 1, 1, -2, 2, '#c8303a');
      break;
    case 'crown':
      box(-3, 2, 0, 1, -2, 2, '#f2c230');
      for (const [x, z] of [[-3, -2], [2, -2], [-3, 2], [2, 2], [0, -2], [0, 2], [-3, 0], [2, 0]]) vs.set(x, 2, z, '#ffd94f');
      vs.set(0, 1, -3, '#e0304a');
      vs.set(0, 1, 3, '#3a7bff');
      vs.set(3, 1, 0, '#2ec27e');
      break;
    case 'headphones':
      box(-3, -2, 0, 0, -4, 4, '#2b2b33');
      box(-4, -1, -5, -2, -4, -4, '#e04848');
      box(-4, -1, -5, -2, 4, 4, '#e04848');
      box(-3, -2, -2, -1, -4, -4, '#2b2b33');
      box(-3, -2, -2, -1, 4, 4, '#2b2b33');
      break;
    case 'shades':
      box(-4, -1, -4, -3, -3, -3, (x, y) => (x === -1 && y === -3 ? '#8fd3ff' : '#111114'));
      box(-4, -1, -4, -3, 3, 3, (x, y) => (x === -1 && y === -3 ? '#8fd3ff' : '#111114'));
      box(-6, -6, -3, -3, -3, 3, '#111114');
      box(-5, -5, -3, -3, -3, -3, '#111114');
      box(-5, -5, -3, -3, 3, 3, '#111114');
      break;
    default:
      return null;
  }
  return vs;
}

// Front view of a hat as pixels, for the shop cards.
export function hatPixels(id) {
  const vs = hatVoxels(id);
  if (!vs) return [];
  const best = new Map();
  for (const v of vs.map.values()) {
    const k = v.x + ',' + v.y;
    const b = best.get(k);
    if (!b || v.z > b.z) best.set(k, v);
  }
  return [...best.values()];
}

const hatCache = new Map();
function hatGeometry(id) {
  if (!hatCache.has(id)) {
    const vs = hatVoxels(id);
    hatCache.set(id, vs ? buildGeometry(vs, [0, 0, 0.5]) : null);
  }
  return hatCache.get(id);
}

// ---------------------------------------------------------------- dino
const dinoCache = new Map();
function dinoGeometries(skinId) {
  if (dinoCache.has(skinId)) return dinoCache.get(skinId);
  const skin = SKINS[skinId] || SKINS.classic;
  const standVs = bodyVoxels(DINO_STAND, 12, 8, skin);
  const duckVs = bodyVoxels(DINO_DUCK, 20, 5, skin);
  const g = {
    stand: buildGeometry(standVs, [11, 0, 0.5]),
    duck: buildGeometry(duckVs, [15, 0, 0.5]),
    standDead: deadEyeGeometry(13, LEG_H + 20 - 1 - 4, 11),
    duckDead: deadEyeGeometry(21, LEG_H + 10 - 1 - 4, 15),
    legs: [legGeometry(skin, -2, -1), legGeometry(skin, 1, 2)],
    // coarse voxel list used for the shatter effect
    pieces: piecesFrom(standVs, [11, 0, 0.5]),
  };
  dinoCache.set(skinId, g);
  return g;
}

function piecesFrom(vs, origin) {
  const groups = new Map();
  for (const v of vs.map.values()) {
    const k = `${v.x >> 1},${v.y >> 1},${v.z >> 1}`;
    if (!groups.has(k)) groups.set(k, { x: 0, y: 0, z: 0, n: 0, color: v.color });
    const g = groups.get(k);
    g.x += v.x;
    g.y += v.y;
    g.z += v.z;
    g.n++;
  }
  return [...groups.values()].map((g) => ({
    x: (g.x / g.n + 0.5 - origin[0]) * VOX,
    y: (g.y / g.n + 0.5 - origin[1]) * VOX,
    z: (g.z / g.n + 0.5 - origin[2]) * VOX,
    color: g.color,
  }));
}

export function createDino(skinId = 'classic', hatId = 'none', material = voxelMaterial) {
  const g = dinoGeometries(skinId);
  const mk = (geo) => {
    const m = new THREE.Mesh(geo, material);
    m.castShadow = material === voxelMaterial;
    m.receiveShadow = material === voxelMaterial;
    return m;
  };
  const root = new THREE.Group();
  const stand = new THREE.Group();
  const duck = new THREE.Group();
  const standDead = mk(g.standDead);
  const duckDead = mk(g.duckDead);
  standDead.visible = duckDead.visible = false;
  stand.add(mk(g.stand), standDead);
  duck.add(mk(g.duck), duckDead);
  duck.visible = false;

  const hat = hatGeometry(hatId);
  if (hat) {
    for (const [grp, h] of [[stand, HEAD.stand], [duck, HEAD.duck]]) {
      const m = mk(hat);
      m.position.set(h.x * VOX, h.y * VOX, 0);
      grp.add(m);
    }
  }

  const legs = g.legs.map((geo) => {
    const leg = mk(geo);
    leg.position.set(-4 * VOX, LEG_H * VOX, 0);
    root.add(leg);
    return leg;
  });
  root.add(stand, duck);
  return { root, stand, duck, legs, deadMeshes: [standDead, duckDead], pieces: g.pieces, skin: SKINS[skinId] || SKINS.classic };
}

// Hitboxes in voxel units, relative to the origin (feet, centre).
export const DINO_BOXES = {
  stand: [
    { x0: 2, x1: 10, y0: 16, y1: 24 },
    { x0: -6, x1: 6, y0: 5, y1: 15 },
    { x0: -5, x1: 0, y0: 0.5, y1: 5 },
  ],
  duck: [
    { x0: 6, x1: 14, y0: 9, y1: 14 },
    { x0: -10, x1: 6, y0: 5, y1: 10 },
    { x0: -5, x1: 0, y0: 0.5, y1: 5 },
  ],
};

// ---------------------------------------------------------------- pterodactyl
const PTERO = [
  '   PPPPPP          ',
  '  PPPPP            ',
  'OOOPWPPP     PPPP  ',
  '  PPPPPPPPPPPPPPPPP',
  '      PPPPPPPPPPP  ',
  '        PPPPPP     ',
  '         F  F      ',
];
const PC = { P: '#8a5aa0', L: '#c094d6', O: '#f0a63a', W: '#ffe066', F: '#5d3a70' };

let pteroGeo = null;
function pteroGeometries() {
  if (pteroGeo) return pteroGeo;
  const vs = new VoxelSet();
  const H = PTERO.length;
  extrude(vs, PTERO, PC, {
    depth: (ch, x, y) => (ch === 'O' || H - 1 - y === 0 || x >= 17 ? [0, 0] : [-1, 1]),
    color: (ch, x, y, z) => (ch === 'W' ? (Math.abs(z) === 1 ? PC.W : PC.P) : PC[ch]),
  });
  const wing = (sign) => {
    const w = new VoxelSet();
    for (let d = 0; d <= 8; d++) {
      const x0 = 8 + Math.floor(d * 0.35);
      const x1 = 15 - Math.floor(d * 0.55);
      for (let x = x0; x <= x1; x++) w.set(x, 0, sign * d, x === x0 ? PC.P : PC.L);
    }
    return buildGeometry(w, [9, 0, sign > 0 ? 0 : 1]);
  };
  pteroGeo = { body: buildGeometry(vs, [9, 0, 0.5]), right: wing(1), left: wing(-1) };
  return pteroGeo;
}

export function createPtero() {
  const g = pteroGeometries();
  const root = new THREE.Group();
  const body = new THREE.Mesh(g.body, voxelMaterial);
  body.castShadow = true;
  root.add(body);
  const wings = [];
  for (const [geo, side] of [[g.right, 1], [g.left, -1]]) {
    const pivot = new THREE.Group();
    pivot.position.set(0, 4 * VOX, side * 1.5 * VOX);
    const m = new THREE.Mesh(geo, voxelMaterial);
    m.castShadow = true;
    pivot.add(m);
    root.add(pivot);
    wings.push({ pivot, side });
  }
  return { root, wings, box: { x0: -8, x1: 8, y0: 1, y1: 6 } };
}

// ---------------------------------------------------------------- coins & power-ups
export const glowMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });

let boneGeo = null;
export function boneGeometry() {
  if (boneGeo) return boneGeo;
  const vs = new VoxelSet();
  const W = '#fbf6e6';
  const S = '#ded5bb';
  // a cartoon bone: shaft with two round knobs at each end
  for (let x = -3; x <= 3; x++) for (let z = 0; z <= 1; z++) vs.set(x, 0, z, W);
  for (const x of [-5, -4, 4, 5])
    for (const y of [-1, 1])
      for (let z = 0; z <= 1; z++) vs.set(x, y, z, Math.abs(x) === 5 ? S : W);
  for (const x of [-4, 4]) for (let z = 0; z <= 1; z++) vs.set(x, 0, z, W);
  boneGeo = buildGeometry(vs, [0.5, 0.5, 1], { jitter: 0.02, scale: VOX * 1.3 });
  return boneGeo;
}

export const POWERUPS = ['shield', 'magnet', 'slow', 'double'];
export const POWERUP_COLOR = { shield: '#4fc3ff', magnet: '#ff5a5a', slow: '#b388ff', double: '#ffd23f' };

const puCache = new Map();
export function powerupGeometry(type) {
  if (puCache.has(type)) return puCache.get(type);
  const vs = new VoxelSet();
  const put = (x, y, c) => {
    vs.set(x, y, 0, c);
    vs.set(x, y, 1, c);
  };
  const c = POWERUP_COLOR[type];
  const art = {
    shield: [' ##### ', '#######', '##+#+##', '#######', ' ##### ', '  ###  ', '   #   '],
    magnet: ['##   ##', '##   ##', '##   ##', '##   ##', '##   ##', '#######', ' ##### '],
    slow: ['#######', ' ##### ', '  ###  ', '   #   ', '  ###  ', ' ##### ', '#######'],
    double: ['   #   ', '  ###  ', ' ##### ', '   #   ', '  ###  ', ' ##### ', '#######'],
  }[type];
  art.forEach((row, r) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === ' ') continue;
      let col = c;
      if (row[x] === '+') col = '#ffffff';
      if (type === 'magnet' && r === 0) col = '#e8eef3';
      put(x, art.length - 1 - r, col);
    }
  });
  const geo = buildGeometry(vs, [3.5, 3.5, 1], { jitter: 0.03 });
  puCache.set(type, geo);
  return geo;
}
