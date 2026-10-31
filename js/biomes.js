// The worlds the dino runs through, with their obstacles and scenery.
import { VOX, VoxelSet, buildGeometry, rng } from './voxel.js';

export const BIOME_LENGTH = 1000; // points per biome

// gravity / jump: multipliers (space has low gravity and a softer jump);
// dark: lit only by the dino's lantern; sea: ocean in the background;
// stars: stars visible all the time; noClouds: hide the clouds.
export const BIOMES = [
  { id: 'desert', sky: '#9fdcff', ground: '#f2cf94', path: '#dcb478', hemiGround: '#d8b27a', sun: '#fff1d2', cloud: '#ffffff', dust: '#e2bf86', weather: 'sand', weatherAlways: false },
  { id: 'jungle', sky: '#a4e4cf', ground: '#7db84a', path: '#a77f4c', hemiGround: '#5f9a3a', sun: '#fff7d6', cloud: '#f4fff8', dust: '#8a6a3e', weather: 'rain', weatherAlways: false },
  { id: 'beach', sky: '#8fd6ff', ground: '#f6e2a8', path: '#dcc690', hemiGround: '#e8d49a', sun: '#fff6dc', cloud: '#ffffff', dust: '#f0dca0', weather: 'none', weatherAlways: false, sea: true },
  { id: 'snow', sky: '#cfe2f2', ground: '#f4f8fc', path: '#cbd7e3', hemiGround: '#dfe8f2', sun: '#f4f8ff', cloud: '#ffffff', dust: '#ffffff', weather: 'snow', weatherAlways: true },
  { id: 'cave', sky: '#0e0c16', ground: '#4a4454', path: '#343040', hemiGround: '#2a2433', sun: '#8a7ab8', cloud: '#0e0c16', dust: '#5a5466', weather: 'drip', weatherAlways: true, dark: true, noClouds: true },
  { id: 'city', sky: '#b9c3c7', ground: '#767a6e', path: '#4a4d52', hemiGround: '#5f6358', sun: '#fff0dc', cloud: '#d8dcdf', dust: '#8a8d90', weather: 'dust', weatherAlways: false },
  { id: 'volcano', sky: '#e8946a', ground: '#4d3c3a', path: '#2f2727', hemiGround: '#6b3b2a', sun: '#ffb27a', cloud: '#6e5c5a', dust: '#3b3030', weather: 'embers', weatherAlways: true },
  { id: 'space', sky: '#05060f', ground: '#9a9ca3', path: '#7a7c83', hemiGround: '#55575e', sun: '#ffffff', cloud: '#05060f', dust: '#b0b2b8', weather: 'shooting', weatherAlways: true, gravity: 0.55, jump: 0.75, stars: true, noClouds: true },
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


function sandcastle(r) {
  const vs = new VoxelSet();
  const S = (x, y, z) => ((x + y + z) % 3 ? '#e9cf8f' : '#d9bb78');
  boxFill(vs, -2, 2, 0, 3, -2, 2, S);
  for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) boxFill(vs, x, x, 4, 5 + Math.floor(r() * 2), z, z, S);
  boxFill(vs, 0, 0, 4, 8, 0, 0, '#a08060');
  vs.set(1, 8, 0, '#ff4f5a');
  vs.set(1, 7, 0, '#ff4f5a');
  return { vs, armTop: 0, trunk: 2, burst: '#e9cf8f' };
}

function lifeguardPole(r) {
  const vs = new VoxelSet();
  const H = 16 + Math.floor(r() * 4);
  for (let y = 0; y < H; y++) boxFill(vs, 0, 1, y, y, 0, 1, Math.floor(y / 3) % 2 ? '#ffffff' : '#e0303a');
  boxFill(vs, 2, 5, H - 3, H - 1, 0, 0, '#ffd23f');
  boxFill(vs, -1, 2, 0, 0, -1, 2, '#c9a56a');
  return { vs, armTop: 0, trunk: 1, burst: '#e0303a' };
}

function stalagmite(r) {
  const vs = new VoxelSet();
  const n = 1 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const cx = i * 3 - (n - 1);
    const H = 6 + Math.floor(r() * 5);
    for (let y = 0; y < H; y++) {
      const w = y < H * 0.4 ? 1 : 0;
      boxFill(vs, cx - w, cx + w, y, y, -w, w, (x, yy) => ((x + yy) % 3 ? '#6e6780' : '#5a5468'));
    }
  }
  return { vs, armTop: 0, trunk: 2, burst: '#6e6780' };
}

function crystals(r) {
  const vs = new VoxelSet();
  const cols = [['#7fe8ff', '#3fb8e8'], ['#d08cff', '#9a5ad8']];
  const n = 3 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const [c1, c2] = cols[Math.floor(r() * 2)];
    const cx = Math.floor((r() - 0.5) * 3);
    const cz = Math.floor((r() - 0.5) * 3);
    const H = 9 + Math.floor(r() * 9);
    const lean = (r() - 0.5) * 0.5;
    for (let y = 0; y < H; y++) {
      const x = cx + Math.round(lean * y);
      const w = y < H - 3 ? 1 : 0;
      boxFill(vs, x - w, x + w, y, y, cz - w, cz + w, (xx, yy) => (yy > H - 3 ? '#ffffff' : (xx + yy) % 2 ? c1 : c2));
    }
  }
  return { vs, armTop: 0, trunk: 2, burst: '#7fe8ff', glow: true };
}

function cones(r) {
  const vs = new VoxelSet();
  const n = 1 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const cx = i * 4 - (n - 1) * 2;
    boxFill(vs, cx - 2, cx + 2, 0, 0, -2, 2, '#2a2a2a');
    for (let y = 1; y < 8; y++) {
      const w = y < 3 ? 1 : 0;
      boxFill(vs, cx - w, cx + w, y, y, -w, w, y === 3 || y === 5 ? '#ffffff' : '#ff7a1a');
    }
  }
  return { vs, armTop: 0, trunk: 2, burst: '#ff7a1a' };
}

function crates(r) {
  const vs = new VoxelSet();
  const n = 2 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const y0 = i * 5;
    const ox = i % 2 ? 1 : 0;
    boxFill(vs, -2 + ox, 2 + ox, y0, y0 + 4, -2, 2, (x, y, z) => {
      const edge = (Math.abs(x - ox) === 2 ? 1 : 0) + (y === y0 || y === y0 + 4 ? 1 : 0) + (Math.abs(z) === 2 ? 1 : 0);
      return edge >= 2 ? '#7a5228' : (x + y) % 2 ? '#b4834a' : '#a8763e';
    });
  }
  return { vs, armTop: 0, trunk: 3, burst: '#b4834a' };
}

function moonRock(r) {
  const vs = new VoxelSet();
  blob(vs, 0, 0, 0, 2.5 + r(), 2.2 + r() * 1.5, 2.5, (x, y, z) => ((x * 3 + y + z * 5) % 7 === 0 ? '#6e7076' : r() < 0.5 ? '#a4a6ad' : '#8e9097'));
  for (const v of [...vs.map.values()]) if (v.y < 0) vs.set(v.x, v.y, v.z, null);
  return { vs, armTop: 0, trunk: 2, burst: '#a4a6ad' };
}

function alienPlant(r) {
  const vs = new VoxelSet();
  const H = 14 + Math.floor(r() * 6);
  for (let y = 0; y < H; y++) boxFill(vs, 0, 1, y, y, 0, 1, y % 4 === 3 ? '#e0a0ff' : '#7a3aa8');
  for (let k = 0; k < 3; k++) {
    const y = 5 + k * 4;
    const d = k % 2 ? 1 : -1;
    for (let i = 1; i <= 3; i++) vs.set(d > 0 ? 1 + i : -i, y + (i === 3 ? 1 : 0), 0, '#9a5ad8');
  }
  blob(vs, 0.5, H + 1, 0.5, 2, 1.6, 2, '#ff6fd8');
  return { vs, armTop: H - 6, trunk: 1, burst: '#ff6fd8', glow: true };
}

const OBSTACLE_GEN = {
  desert: [(r) => cactus(r, false), (r) => cactus(r, true)],
  jungle: [stump, bamboo],
  snow: [iceSpikes, snowman],
  volcano: [obsidian, lavaPillar],
  beach: [sandcastle, lifeguardPole],
  cave: [stalagmite, crystals],
  city: [cones, crates],
  space: [moonRock, alienPlant],
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
    obstacleCache.set(key, { geo: buildGeometry(o.vs, [0.5, 0, 0.5]), ...ext, armTop: o.armTop, trunk: o.trunk, burst: o.burst, glow: !!o.glow });
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
            : biomeId === 'cave' || biomeId === 'city'
              ? ['#6a6470', '#55505c', '#7a7480']
              : biomeId === 'space'
                ? ['#a4a6ad', '#8e9097', '#6e7076']
                : biomeId === 'beach'
                  ? ['#ffffff', '#ff4f5a', '#3f8fff']
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


function shells(r) {
  const vs = new VoxelSet();
  const cols = ['#ffd6e0', '#ffffff', '#ffb27a', '#f6e2a8'];
  for (let i = 0; i < 4; i++) {
    const x = Math.floor((r() - 0.5) * 6);
    const z = Math.floor((r() - 0.5) * 6);
    const c = pick(r, cols);
    vs.set(x, 0, z, c);
    vs.set(x + 1, 0, z, c);
  }
  return vs;
}

function umbrella(r) {
  const vs = new VoxelSet();
  const cols = [['#ff4f5a', '#ffffff'], ['#3f8fff', '#ffd23f'], ['#2ec27e', '#ffffff']][Math.floor(r() * 3)];
  for (let y = 0; y < 14; y++) vs.set(0, y, 0, '#e8e2cf');
  for (let x = -5; x <= 5; x++)
    for (let z = -5; z <= 5; z++) {
      const d = Math.abs(x) + Math.abs(z);
      if (d > 6) continue;
      const y = 14 - Math.floor(d / 2.5);
      vs.set(x, y, z, Math.floor(Math.atan2(z, x) * 2.5 + 8) % 2 ? cols[0] : cols[1]);
    }
  boxFill(vs, 2, 5, 0, 0, -1, 1, '#4fc3ff');
  return vs;
}

function beachBall(r) {
  const vs = new VoxelSet();
  const cols = ['#ff4f5a', '#ffffff', '#3f8fff', '#ffd23f'];
  blob(vs, 0, 2, 0, 2.2, 2.2, 2.2, (x, y, z) => cols[(Math.floor(Math.atan2(z, x) * 1.3 + 8) + (y > 3 ? 1 : 0)) % 4]);
  return vs;
}

function glowMushrooms(r) {
  const vs = new VoxelSet();
  const n = 2 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const x = Math.floor((r() - 0.5) * 6);
    const z = Math.floor((r() - 0.5) * 6);
    const h = 1 + Math.floor(r() * 3);
    for (let y = 0; y < h; y++) vs.set(x, y, z, '#c8c0d8');
    const c = r() < 0.5 ? '#5fffd0' : '#c88cff';
    boxFill(vs, x - 1, x + 1, h, h, z - 1, z + 1, c);
    vs.set(x, h + 1, z, c);
  }
  return { vs, glow: true };
}

function caveCrystal(r) {
  return { vs: crystals(r).vs, glow: true };
}

function lamp(r) {
  const vs = new VoxelSet();
  const H = 18 + Math.floor(r() * 4);
  const bent = r() < 0.4;
  for (let y = 0; y < H; y++) vs.set(bent && y > H * 0.6 ? 1 : 0, y, 0, '#4a4e55');
  boxFill(vs, 0, 3, H, H, 0, 0, '#4a4e55');
  boxFill(vs, 2, 3, H - 1, H - 1, 0, 0, '#ffe8a0');
  return vs;
}

function ruinWall(r) {
  const vs = new VoxelSet();
  const W = 5 + Math.floor(r() * 5);
  for (let x = -W; x <= W; x++) {
    const h = 4 + Math.floor(r() * 8) - Math.abs(x) % 3;
    for (let y = 0; y < h; y++) vs.set(x, y, 0, (x + y) % 4 === 0 ? '#8a7a70' : y % 2 ? '#a89888' : '#9a8a7c');
    if (r() < 0.4) vs.set(x, h, 0, '#5a9a3a');
  }
  return vs;
}

function wreck(r) {
  const vs = new VoxelSet();
  const body = pick(r, ['#8a4a3a', '#5a6a7a', '#7a7a4a']);
  boxFill(vs, -6, 6, 1, 4, -3, 3, body);
  boxFill(vs, -3, 3, 5, 7, -3, 3, (x, y, z) => (Math.abs(z) === 3 || Math.abs(x) === 3 ? '#9fb0c0' : body));
  for (const x of [-4, 4]) for (const z of [-3, 3]) vs.set(x, 0, z, '#1b1b1b');
  vs.set(2, 8, 1, '#5a9a3a');
  return vs;
}

function crater(r) {
  const vs = new VoxelSet();
  const R = 3 + r() * 3;
  for (let x = -8; x <= 8; x++)
    for (let z = -8; z <= 8; z++) {
      const d = Math.hypot(x, z);
      if (d > R - 1 && d < R + 1) vs.set(x, 0, z, r() < 0.5 ? '#8e9097' : '#7a7c83');
      if (d >= R - 0.5 && d < R + 0.5 && r() < 0.4) vs.set(x, 1, z, '#a4a6ad');
    }
  return vs;
}

function moonFlag(r) {
  const vs = new VoxelSet();
  for (let y = 0; y < 12; y++) vs.set(0, y, 0, '#e8e8ee');
  // the game's own flag: a little green dino head on yellow
  boxFill(vs, 1, 6, 8, 11, 0, 0, (x, y) => ((x === 3 || x === 4) && (y === 9 || y === 10) ? '#5fae3e' : x === 5 && y === 10 ? '#5fae3e' : '#ffd23f'));
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
  volcano: [(r) => rock(r, ['#3a2e2e', '#2a2222', '#4a3a38']), (r) => ({ vs: lavaPool(r), glow: true }), deadTree],
  beach: [shells, umbrella, beachBall, palm],
  cave: [glowMushrooms, caveCrystal, (r) => rock(r, ['#4a4454', '#3a3444', '#5a5466'])],
  city: [lamp, ruinWall, wreck],
  space: [crater, moonFlag, (r) => rock(r, ['#8e9097', '#a4a6ad', '#7a7c83'])],
};

const nearCache = new Map();
// returns { geo, glow } — glow props (lava) are drawn unlit so they shine at night
export function nearPropGeometry(biomeId, kind, seed) {
  const key = `${biomeId}:${kind}:${seed}`;
  if (!nearCache.has(key)) {
    const gens = NEAR_GEN[biomeId];
    const out = gens[kind % gens.length](rng(seed * 31 + kind * 7 + biomeId.length));
    const vs = out instanceof VoxelSet ? out : out.vs;
    nearCache.set(key, { geo: buildGeometry(vs, [0.5, 0, 0.5]), glow: !(out instanceof VoxelSet) && !!out.glow });
  }
  return nearCache.get(key);
}
export const NEAR_KINDS = 4;

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


function island(r) {
  const vs = new VoxelSet();
  const W = 5 + r() * 6;
  blob(vs, 0, 0, 0, W, 2 + r() * 2, 3 + r() * 2, (x, y) => (y > 1 ? '#5ea83a' : '#f0dca0'));
  const x0 = Math.round((r() - 0.5) * W);
  for (let y = 1; y < 6; y++) vs.set(x0, y, 0, '#9a7040');
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0]]) vs.set(x0 + dx, 6, dz, '#3f9a2a');
  for (const v of [...vs.map.values()]) if (v.y < 0) vs.set(v.x, v.y, v.z, null);
  return vs;
}

function caveColumn(r) {
  const vs = new VoxelSet();
  const H = 12 + Math.floor(r() * 6);
  for (let y = 0; y < H; y++) {
    const w = 1 + Math.round(Math.abs(Math.sin(y * 0.4 + r())) * 2);
    boxFill(vs, -w, w, y, y, -w, w, (x, yy) => ((x + yy) % 3 ? '#2e2a38' : '#3a3546'));
  }
  if (r() < 0.6) boxFill(vs, 2, 3, 2, 4, 0, 1, '#7fe8ff');
  return vs;
}

function tower(r) {
  const vs = new VoxelSet();
  const W = 3 + Math.floor(r() * 3);
  const H = 10 + Math.floor(r() * 14);
  for (let y = 0; y < H; y++)
    for (let x = -W; x <= W; x++) {
      const broken = y > H - 4 && r() < 0.45;
      if (broken) continue;
      for (const z of [-2, 2]) vs.set(x, y, z, y % 2 && x % 2 ? (r() < 0.2 ? '#ffe8a0' : '#3a4048') : '#8a9098');
      if (Math.abs(x) === W) for (let z = -1; z <= 1; z++) vs.set(x, y, z, '#7a8088');
    }
  return vs;
}

function moonRidge(r) {
  const vs = new VoxelSet();
  const W = 8 + r() * 8;
  const H = 3 + r() * 4;
  blob(vs, 0, 0, 0, W, H, 4, (x, y) => (y > H - 1.5 ? '#c4c6cc' : (x + y) % 2 ? '#8e9097' : '#7a7c83'));
  for (const v of [...vs.map.values()]) if (v.y < 0) vs.set(v.x, v.y, v.z, null);
  return vs;
}

const FAR_GEN = { desert: mesa, jungle: hill, beach: island, snow: peak, cave: caveColumn, city: tower, volcano: volcanoCone, space: moonRidge };
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

// The Earth hanging in the sky of the space world.
export function earthGeometry() {
  const vs = new VoxelSet();
  const r = rng(3);
  for (let x = -7; x <= 7; x++)
    for (let y = -7; y <= 7; y++) {
      if (x * x + y * y > 49) continue;
      const land = Math.sin(x * 0.8 + r() * 0.6) + Math.cos(y * 0.7) > 0.9;
      vs.set(x, y, 0, land ? (r() < 0.3 ? '#ffffff' : '#3fa04a') : r() < 0.08 ? '#ffffff' : '#2f6fd8');
    }
  return buildGeometry(vs, [0.5, 0.5, 0.5], { scale: VOX * 8, jitter: 0.02 });
}
