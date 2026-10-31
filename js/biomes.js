// The four worlds the dino runs through, with their obstacles and scenery.
import { VOX, VoxelSet, buildGeometry, rng } from './voxel.js';

export const BIOME_LENGTH = 1000; // points per biome

export const BIOMES = [
  {
    id: 'desert',
    sky: '#9fdcff',
    ground: '#f2cf94',
    path: '#dcb478',
    hemiGround: '#d8b27a',
    sun: '#fff1d2',
    cloud: '#ffffff',
    dust: '#e2bf86',
    weather: 'sand',
    weatherAlways: false,
  },
  {
    id: 'jungle',
    sky: '#a4e4cf',
    ground: '#7db84a',
    path: '#a77f4c',
    hemiGround: '#5f9a3a',
    sun: '#fff7d6',
    cloud: '#f4fff8',
    dust: '#8a6a3e',
    weather: 'rain',
    weatherAlways: false,
  },
  {
    id: 'snow',
    sky: '#cfe2f2',
    ground: '#f4f8fc',
    path: '#cbd7e3',
    hemiGround: '#dfe8f2',
    sun: '#f4f8ff',
    cloud: '#ffffff',
    dust: '#ffffff',
    weather: 'snow',
    weatherAlways: true,
  },
  {
    id: 'volcano',
    sky: '#e8946a',
    ground: '#4d3c3a',
    path: '#2f2727',
    hemiGround: '#6b3b2a',
    sun: '#ffb27a',
    cloud: '#6e5c5a',
    dust: '#3b3030',
    weather: 'embers',
    weatherAlways: true,
  },
];

export const biomeAt = (score) => Math.floor(score / BIOME_LENGTH) % BIOMES.length;

// ------------------------------------------------------------------ helpers
function boxFill(vs, x0, x1, y0, y1, z0, z1, color) {
  for (let x = x0; x <= x1; x++)
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++) vs.set(x, y, z, typeof color === 'function' ? color(x, y, z) : color);
}

function blob(vs, cx, cy, cz, rx, ry, rz, color) {
  for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++) {
        const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2;
        if (d <= 1) vs.set(x, y, z, typeof color === 'function' ? color(x, y, z) : color);
      }
}

function extent(vs) {
  let xMin = 0;
  let xMax = 0;
  let H = 0;
  for (const v of vs.map.values()) {
    xMin = Math.min(xMin, v.x);
    xMax = Math.max(xMax, v.x);
    H = Math.max(H, v.y + 1);
  }
  return { xMin, xMax, H };
}

const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

// ------------------------------------------------------------------ obstacles
// Each returns { vs, H, xMin, xMax, armTop } in voxels; the trunk box covers |x| <= trunk.
function cactus(r, large) {
  const C = ['#3f8f3a', '#2f6e2c', '#56a84a'];
  const H = large ? 15 + Math.floor(r() * 6) : 8 + Math.floor(r() * 4);
  const vs = new VoxelSet();
  let armTop = 0;
  const put = (x, y, z) => {
    let c = (x + z + 100) % 2 === 0 ? C[0] : C[1];
    if (r() < 0.05) c = C[2];
    vs.set(x, y, z, c);
    if (Math.abs(x) > 1) armTop = Math.max(armTop, y + 1);
  };
  for (let y = 0; y < H; y++)
    for (let x = -1; x <= 1; x++)
      for (let z = -1; z <= 1; z++) if (!(y === H - 1 && x !== 0 && z !== 0)) put(x, y, z);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const used = new Set();
  const nArms = H > 8 ? (r() < (large ? 0.9 : 0.5) ? 1 + (r() < 0.5 ? 1 : 0) : 0) : 0;
  for (let i = 0; i < nArms; i++) {
    let di = Math.floor(r() * 4);
    while (used.has(di)) di = (di + 1) % 4;
    used.add(di);
    const [ax, az] = dirs[di];
    const ya = Math.floor(H * (0.3 + r() * 0.25));
    const up = 2 + Math.floor(r() * Math.max(1, H * 0.35));
    for (let d = 2; d <= 3; d++)
      for (let t = 0; t <= 1; t++) for (let k = 0; k <= 1; k++) put(ax ? ax * d : t, ya + k, az ? az * d : t);
    for (let y = ya; y < ya + up; y++)
      for (let t = 0; t <= 1; t++)
        for (let s = 0; s <= 1; s++) if (!(y === ya + up - 1 && s === 1 && t === 1)) put(ax ? ax * (3 + s) : t, y, az ? az * (3 + s) : t);
  }
  if (r() < 0.35) vs.set(0, H, 0, r() < 0.5 ? '#ff6fa8' : '#ffd23f');
  return { vs, armTop, trunk: 1, burst: C[0] };
}

function stump(r) {
  const vs = new VoxelSet();
  const H = 5 + Math.floor(r() * 3);
  for (let y = 0; y < H; y++)
    for (let x = -2; x <= 2; x++)
      for (let z = -2; z <= 2; z++) {
        if (Math.abs(x) === 2 && Math.abs(z) === 2) continue;
        const top = y === H - 1;
        const ring = top && Math.abs(x) < 2 && Math.abs(z) < 2;
        vs.set(x, y, z, ring ? ((x + z) % 2 ? '#d6ad73' : '#c49a62') : (x + y) % 3 ? '#7a5230' : '#5f3f24');
      }
  for (let i = 0; i < 5; i++) vs.set(Math.floor(r() * 5) - 2, H, Math.floor(r() * 5) - 2, '#4f9a32');
  if (r() < 0.6) {
    blob(vs, 3, 2, 1, 1.2, 0.8, 1.2, '#e0453a');
    vs.set(3, 1, 1, '#f3e7d0');
  }
  return { vs, armTop: 0, trunk: 2, burst: '#7a5230' };
}

function bamboo(r) {
  const vs = new VoxelSet();
  const stalks = [[-2, 0], [1, -1], [0, 2]].slice(0, 2 + Math.floor(r() * 2));
  for (const [sx, sz] of stalks) {
    const H = 14 + Math.floor(r() * 7);
    for (let y = 0; y < H; y++) boxFill(vs, sx, sx + 1, y, y, sz, sz + 1, y % 5 === 4 ? '#a7d65a' : (sx + y) % 2 ? '#6fae3a' : '#5f9a32');
    for (let i = 0; i < 4; i++) {
      const ly = H - 1 - Math.floor(r() * 6);
      const dz = r() < 0.5 ? -1 : 1;
      for (let k = 1; k <= 3; k++) vs.set(sx + (r() < 0.5 ? 0 : 1), ly - (k > 2 ? 1 : 0), sz + dz * k, '#3f8a2a');
    }
  }
  return { vs, armTop: 0, trunk: 2, burst: '#6fae3a' };
}

function iceSpikes(r) {
  const vs = new VoxelSet();
  const n = 2 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const cx = Math.floor((r() - 0.5) * 3);
    const cz = Math.floor((r() - 0.5) * 4);
    const H = 6 + Math.floor(r() * 5);
    for (let y = 0; y < H; y++) {
      const w = y < H * 0.5 ? 1 : 0;
      boxFill(vs, cx - w, cx + w, y, y, cz - w, cz + w, (x, yy) => (yy > H - 3 ? '#ffffff' : (x + yy) % 2 ? '#9fe3ff' : '#7fd0f2'));
    }
  }
  return { vs, armTop: 0, trunk: 2, burst: '#9fe3ff' };
}

function snowman(r) {
  const vs = new VoxelSet();
  const S = (x, y, z) => ((x + y + z) % 4 === 0 ? '#e6eef6' : '#ffffff');
  blob(vs, 0, 3.5, 0, 4, 3.8, 4, S);
  blob(vs, 0, 9.5, 0, 3, 3, 3, S);
  blob(vs, 0, 14, 0, 2.4, 2.4, 2.4, S);
  for (const z of [-1, 1]) vs.set(-2, 15, z, '#1b1b1b');
  for (let x = -5; x <= -3; x++) vs.set(x, 14, 0, '#ff8a2a');
  for (const y of [8, 10]) vs.set(-3, y, 0, '#1b1b1b');
  boxFill(vs, -2, 2, 16, 16, -2, 2, '#1f1f24');
  boxFill(vs, -1, 1, 17, 19, -1, 1, '#2a2a31');
  if (r() < 0.7) for (let z = -3; z <= 3; z++) vs.set(0, 12, z, '#e0304a');
  return { vs, armTop: 0, trunk: 3, burst: '#ffffff' };
}

function obsidian(r) {
  const vs = new VoxelSet();
  const n = 2 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const cx = i * 2 - n + 1;
    const H = 6 + Math.floor(r() * 5);
    const lean = (r() - 0.5) * 0.4;
    for (let y = 0; y < H; y++) {
      const x = cx + Math.round(lean * y);
      const w = y < H - 2 ? 1 : 0;
      boxFill(vs, x - w, x + w, y, y, -w, w, (xx, yy) => (yy >= H - 2 ? '#ff7a2a' : (xx + yy) % 3 ? '#2a2233' : '#45385a'));
    }
  }
  return { vs, armTop: 0, trunk: 2, burst: '#45385a' };
}

function lavaPillar(r) {
  const vs = new VoxelSet();
  const H = 15 + Math.floor(r() * 6);
  for (let y = 0; y < H; y++) {
    const w = y > H - 3 ? 1 : 2;
    for (let x = -w; x <= w; x++)
      for (let z = -w; z <= w; z++) {
        if (Math.abs(x) === 2 && Math.abs(z) === 2) continue;
        const crack = (x * 7 + y * 3 + z * 5) % 11 === 0 || (y % 6 === 2 && Math.abs(x) === w);
        vs.set(x, y, z, crack ? '#ff8c1a' : (x + y + z) % 2 ? '#3a2e2e' : '#4a3a38');
      }
  }
  vs.set(0, H, 0, '#ffcf3a');
  return { vs, armTop: 0, trunk: 2, burst: '#ff8c1a' };
}

const OBSTACLE_GEN = {
  desert: [(r) => cactus(r, false), (r) => cactus(r, true)],
  jungle: [stump, bamboo],
  snow: [iceSpikes, snowman],
  volcano: [obsidian, lavaPillar],
};

export const OBSTACLE_VARIANTS = 6;
const obstacleCache = new Map();

// size: 0 small, 1 large
export function obstacleGeometry(biomeId, size, index) {
  const key = `${biomeId}:${size}:${index}`;
  if (!obstacleCache.has(key)) {
    const r = rng(1000 + index * 77 + size * 5000 + biomeId.length * 131);
    const o = OBSTACLE_GEN[biomeId][size](r);
    const ext = extent(o.vs);
    obstacleCache.set(key, { geo: buildGeometry(o.vs, [0.5, 0, 0.5]), ...ext, armTop: o.armTop, trunk: o.trunk, burst: o.burst });
  }
  return obstacleCache.get(key);
}

// ------------------------------------------------------------------ moving hazards
let boulderGeo = {};
export function boulderGeometry(biomeId) {
  if (!boulderGeo[biomeId]) {
    const vs = new VoxelSet();
    const cols =
      biomeId === 'snow'
        ? ['#ffffff', '#e8f0f8', '#d8e4ee']
        : biomeId === 'volcano'
          ? ['#3a2e2e', '#2a2222', '#ff7a2a']
          : biomeId === 'jungle'
            ? ['#7d7a6a', '#5e8a3a', '#6b6858']
            : ['#a08a6e', '#8a7559', '#b59d7f'];
    const r = rng(biomeId.length * 991);
    blob(vs, 0, 0, 0, 5.2, 5.2, 4, () => cols[Math.floor(r() * 3)]);
    boulderGeo[biomeId] = buildGeometry(vs, [0, 0, 0]);
  }
  return boulderGeo[biomeId];
}
export const BOULDER_RADIUS = 5.2 * VOX;

let tumbleGeo = null;
export function tumbleweedGeometry() {
  if (tumbleGeo) return tumbleGeo;
  const vs = new VoxelSet();
  const r = rng(77);
  for (let i = 0; i < 260; i++) {
    const a = r() * Math.PI * 2;
    const b = Math.acos(r() * 2 - 1);
    const rad = 3 + r() * 1.6;
    vs.set(Math.round(Math.sin(b) * Math.cos(a) * rad), Math.round(Math.cos(b) * rad), Math.round(Math.sin(b) * Math.sin(a) * rad), r() < 0.5 ? '#b08a4f' : '#8d6a38');
  }
  tumbleGeo = buildGeometry(vs, [0, 0, 0]);
  return tumbleGeo;
}

let meteorGeo = null;
export function meteorGeometry() {
  if (meteorGeo) return meteorGeo;
  const vs = new VoxelSet();
  const r = rng(5);
  blob(vs, 0, 0, 0, 3.4, 3.2, 3.2, (x, y) => (r() < 0.25 ? '#ff9a2a' : y > 1 ? '#5a3a30' : '#3a2620'));
  meteorGeo = buildGeometry(vs, [0, 0, 0]);
  return meteorGeo;
}

// ------------------------------------------------------------------ near scenery
function rock(r, cols) {
  const vs = new VoxelSet();
  const n = 1 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) blob(vs, Math.floor((r() - 0.5) * 4), 0, Math.floor((r() - 0.5) * 4), 1.5 + r() * 2, 1.4 + r() * 1.5, 1.5 + r() * 2, () => pick(r, cols));
  for (const v of [...vs.map.values()]) if (v.y < 0) vs.set(v.x, v.y, v.z, null);
  return vs;
}

function bush(r, cols) {
  const vs = new VoxelSet();
  for (let i = 0; i < 6; i++) {
    let x = 0;
    let z = 0;
    const ax = (r() - 0.5) * 1.6;
    const az = (r() - 0.5) * 1.6;
    for (let y = 0; y < 3 + r() * 3; y++) {
      vs.set(Math.round(x), y, Math.round(z), pick(r, cols));
      x += ax;
      z += az;
    }
  }
  return vs;
}

function miniCactus(r) {
  return cactus(r, false).vs;
}

function fern(r) {
  const vs = new VoxelSet();
  const cols = ['#3f8a2a', '#5aa53a', '#2f6e22'];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + r();
    for (let k = 0; k < 5; k++) vs.set(Math.round(Math.cos(a) * k * 0.9), Math.round(k * 0.9 - k * k * 0.12), Math.round(Math.sin(a) * k * 0.9), pick(r, cols));
  }
  if (r() < 0.4) vs.set(0, 3, 0, r() < 0.5 ? '#ff5a8a' : '#ffd23f');
  return vs;
}

function palm(r) {
  const vs = new VoxelSet();
  const H = 16 + Math.floor(r() * 8);
  let x = 0;
  const lean = (r() - 0.5) * 0.25;
  for (let y = 0; y < H; y++) {
    x += lean;
    const rx = Math.round(x);
    boxFill(vs, rx, rx + 1, y, y, 0, 1, y % 3 ? '#9a7040' : '#7a5530');
  }
  const tx = Math.round(x);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    for (let k = 1; k < 7; k++) vs.set(tx + Math.round(Math.cos(a) * k), H - Math.round((k * k) / 12), Math.round(Math.sin(a) * k), k % 2 ? '#3f9a2a' : '#56b33a');
  }
  vs.set(tx, H - 1, 1, '#6a4a2a');
  return vs;
}

function pine(r) {
  const vs = new VoxelSet();
  const H = 12 + Math.floor(r() * 8);
  boxFill(vs, 0, 0, 0, 3, 0, 0, '#6a4a2a');
  for (let y = 3; y < H; y++) {
    const w = Math.max(0, Math.round(((H - y) / (H - 3)) * 4 - (y % 3 === 0 ? 1 : 0)));
    for (let x = -w; x <= w; x++)
      for (let z = -w; z <= w; z++) {
        if (Math.abs(x) + Math.abs(z) > w + 1) continue;
        const snowy = !vs.has(x, y + 1, z) && (y % 3 === 1 || y === H - 1);
        vs.set(x, y, z, snowy ? '#ffffff' : (x + y + z) % 2 ? '#2f6a4a' : '#255a3e');
      }
  }
  return vs;
}

function snowPile(r) {
  const vs = new VoxelSet();
  blob(vs, 0, 0, 0, 2.5 + r() * 2, 1.5 + r(), 2 + r() * 2, (x, y) => (y > 0 ? '#ffffff' : '#e6eef6'));
  for (const v of [...vs.map.values()]) if (v.y < 0) vs.set(v.x, v.y, v.z, null);
  return vs;
}

function lavaPool(r) {
  const vs = new VoxelSet();
  const rx = 3 + r() * 3;
  const rz = 2 + r() * 2;
  for (let x = -7; x <= 7; x++)
    for (let z = -5; z <= 5; z++) {
      const d = (x / rx) ** 2 + (z / rz) ** 2;
      if (d <= 1) vs.set(x, 0, z, d < 0.5 ? '#ffcf3a' : '#ff7a1a');
      else if (d <= 1.6) vs.set(x, 0, z, '#2a2020');
    }
  return vs;
}

function deadTree(r) {
  const vs = new VoxelSet();
  const H = 6 + Math.floor(r() * 5);
  for (let y = 0; y < H; y++) vs.set(0, y, 0, '#2a2020');
  for (let i = 0; i < 3; i++) {
    const y0 = 3 + Math.floor(r() * (H - 3));
    const dx = r() < 0.5 ? -1 : 1;
    const dz = r() < 0.5 ? -1 : 1;
    for (let k = 1; k < 4; k++) vs.set(dx * k, y0 + k, r() < 0.5 ? dz * Math.floor(k / 2) : 0, '#2a2020');
  }
  return vs;
}

const NEAR_GEN = {
  desert: [
    (r) => rock(r, ['#9c8b74', '#8a7a65', '#b3a189']),
    (r) => bush(r, ['#a57c45', '#8d6838', '#c29455']),
    miniCactus,
  ],
  jungle: [fern, palm, (r) => rock(r, ['#7d7a6a', '#5e8a3a', '#6b6858'])],
  snow: [pine, snowPile, (r) => rock(r, ['#8e98a3', '#ffffff', '#a8b2bc'])],
  volcano: [(r) => rock(r, ['#3a2e2e', '#2a2222', '#4a3a38']), lavaPool, deadTree],
};

const nearCache = new Map();
// returns { geo, glow } — glow props (lava) are drawn unlit so they shine at night
export function nearPropGeometry(biomeId, kind, seed) {
  const key = `${biomeId}:${kind}:${seed}`;
  if (!nearCache.has(key)) {
    const vs = NEAR_GEN[biomeId][kind](rng(seed * 31 + kind * 7 + biomeId.length));
    nearCache.set(key, { geo: buildGeometry(vs, [0.5, 0, 0.5]), glow: biomeId === 'volcano' && kind === 1 });
  }
  return nearCache.get(key);
}
export const NEAR_KINDS = 3;

// ------------------------------------------------------------------ far scenery (5x voxels)
function mesa(r) {
  const MESA = ['#c96f4a', '#b65f3e', '#dc8b5f', '#a9553a'];
  const vs = new VoxelSet();
  const W = 8 + Math.floor(r() * 10);
  const D = 4 + Math.floor(r() * 4);
  const H = 4 + Math.floor(r() * 7);
  for (let x = -W; x <= W; x++)
    for (let z = -D; z <= D; z++) {
      const edge = Math.max(Math.abs(x) - W + 3, Math.abs(z) - D + 2, 0);
      const h = H - edge * (1 + Math.floor(r() * 2)) - (r() < 0.15 ? 1 : 0);
      for (let y = 0; y < h; y++) vs.set(x, y, z, MESA[(y + (r() < 0.1 ? 1 : 0)) % MESA.length]);
    }
  return vs;
}

function hill(r) {
  const vs = new VoxelSet();
  const W = 7 + r() * 8;
  const H = 3 + r() * 5;
  blob(vs, 0, 0, 0, W, H, 4 + r() * 3, (x, y) => (y >= H - 1.5 ? '#5ea83a' : (x + y) % 2 ? '#4f9632' : '#3f8a2a'));
  for (let i = 0; i < 6; i++) {
    const x = Math.round((r() - 0.5) * W * 1.4);
    const top = Math.round(H * Math.sqrt(Math.max(0, 1 - (x / W) ** 2)));
    for (let y = top; y < top + 2; y++) vs.set(x, y, 0, '#2f7a22');
  }
  for (const v of [...vs.map.values()]) if (v.y < 0) vs.set(v.x, v.y, v.z, null);
  return vs;
}

function peak(r) {
  const vs = new VoxelSet();
  const H = 8 + Math.floor(r() * 8);
  for (let y = 0; y < H; y++) {
    const w = Math.round(((H - y) / H) * (H * 0.9));
    for (let x = -w; x <= w; x++)
      for (let z = -Math.ceil(w / 2); z <= Math.ceil(w / 2); z++) {
        if (Math.abs(x) + Math.abs(z) > w) continue;
        vs.set(x, y, z, y > H * 0.6 || (y > H * 0.45 && r() < 0.5) ? '#ffffff' : (x + y) % 3 ? '#7f8ea0' : '#6a7a8e');
      }
  }
  return vs;
}

function volcanoCone(r) {
  const vs = new VoxelSet();
  const H = 7 + Math.floor(r() * 6);
  for (let y = 0; y < H; y++) {
    const w = Math.round(((H - y) / H) * H * 1.1) + 1;
    for (let x = -w; x <= w; x++)
      for (let z = -Math.ceil(w / 2); z <= Math.ceil(w / 2); z++) {
        if (Math.abs(x) + Math.abs(z) > w) continue;
        const crater = y >= H - 1 && Math.abs(x) < 2;
        const flow = Math.abs(x - Math.round((H - y) * 0.3)) < 1 && y > H * 0.3;
        vs.set(x, y, z, crater ? '#ffcf3a' : flow ? '#ff7a1a' : (x + y) % 2 ? '#3a2e2e' : '#2a2222');
      }
  }
  return vs;
}

const FAR_GEN = { desert: mesa, jungle: hill, snow: peak, volcano: volcanoCone };
const farCache = new Map();
export function farGeometry(biomeId, seed) {
  const key = `${biomeId}:${seed}`;
  if (!farCache.has(key)) farCache.set(key, buildGeometry(FAR_GEN[biomeId](rng(seed)), [0.5, 0, 0.5], { scale: VOX * 5 }));
  return farCache.get(key);
}

export function cloudGeometry(seed) {
  const r = rng(seed);
  const vs = new VoxelSet();
  const n = 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const cx = Math.floor((r() - 0.5) * 10);
    const w = 3 + Math.floor(r() * 4);
    const h = 1 + Math.floor(r() * 3);
    const d = 2 + Math.floor(r() * 3);
    boxFill(vs, cx - w, cx + w, 0, h - 1, -d, d, '#ffffff');
  }
  return buildGeometry(vs, [0.5, 0, 0.5], { scale: VOX * 4, jitter: 0.02 });
}

export function moonGeometry() {
  const vs = new VoxelSet();
  for (let x = -6; x <= 6; x++)
    for (let y = -6; y <= 6; y++) {
      const inA = x * x + y * y <= 36;
      const inB = (x - 3) * (x - 3) + (y - 1) * (y - 1) <= 26;
      if (inA && !inB) vs.set(x, y, 0, (x + y) % 5 === 0 ? '#e9e4b4' : '#fbf8dc');
    }
  return buildGeometry(vs, [0.5, 0.5, 0.5], { scale: VOX * 6, jitter: 0.02 });
}
