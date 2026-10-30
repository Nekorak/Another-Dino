// Voxel models. Everything is built once and the geometries are reused.
import * as THREE from 'three';
import { VOX, VoxelSet, voxelMesh, buildGeometry, voxelMaterial, extrude, rng } from './voxel.js';

const C = {
  body: '#5fae3e',
  bodyDark: '#467f2c',
  belly: '#cfe39a',
  eye: '#ffffff',
  pupil: '#1b1b1b',
  mouth: '#2b4a1c',
  foot: '#3b6b26',
};

// ---------------------------------------------------------------- Dino
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

const LEG = [
  'GGG  ',
  'GGG  ',
  ' GG  ',
  ' GG  ',
  ' FFFF',
];

const LEG_H = LEG.length;

function dinoColor(ch, z, half) {
  switch (ch) {
    case 'A':
      return z === -3 || z === 3 ? C.body : null;
    case 'B':
      return Math.abs(z) <= 1 ? C.belly : C.body;
    case 'W':
      return z === -half || z === half ? C.eye : C.body;
    case 'K':
      return z === -half || z === half ? C.pupil : C.body;
    case 'M':
      return C.mouth;
    case 'F':
      return C.foot;
    default:
      return C.body;
  }
}

function dinoBody(grid, headFromX, headRows, originX, deadEye) {
  const vs = new VoxelSet();
  const H = grid.length;
  const half = (x, r) => (r <= headRows && x >= headFromX ? 2 : x <= 2 ? 1 : x <= 5 ? 2 : 3);
  extrude(vs, grid, null, {
    depth: (ch, x, y) => {
      const h = half(x, H - 1 - y);
      return [-h, h];
    },
    color: (ch, x, y, z) => dinoColor(ch, z, half(x, H - 1 - y)),
    dy: LEG_H,
  });
  // Spine ridge: darken the top-most voxel of each column on the centre line.
  for (const v of vs.map.values()) {
    if (v.z === 0 && !vs.has(v.x, v.y + 1, v.z) && v.color === C.body) v.color = C.bodyDark;
  }
  const body = voxelMesh(vs, [originX, 0, 0.5]);

  // "X" eyes shown on game over.
  const dead = new VoxelSet();
  const [ex, ey] = deadEye;
  const X = [[0, 2], [2, 2], [1, 1], [0, 0], [2, 0]];
  for (const z of [-3, 3]) for (const [a, b] of X) dead.set(ex + a, ey + b, z, '#1b1b1b');
  const deadMesh = voxelMesh(dead, [originX, 0, 0.5], { jitter: 0 });
  deadMesh.visible = false;
  return { body, deadMesh };
}

function legGeometry(zFrom, zTo) {
  const vs = new VoxelSet();
  extrude(vs, LEG, null, {
    depth: () => [zFrom, zTo],
    color: (ch) => (ch === 'F' ? C.foot : C.body),
  });
  return buildGeometry(vs, [1, LEG_H, 0.5]);
}

export function createDino() {
  const root = new THREE.Group();

  // Standing: origin column 11, eye at cols 14-15 / rows 2-3.
  const stand = new THREE.Group();
  const s = dinoBody(DINO_STAND, 12, 8, 11, [13, LEG_H + 20 - 1 - 4]);
  stand.add(s.body, s.deadMesh);

  // Ducking: origin column 15 so the legs stay at the same spot.
  const duck = new THREE.Group();
  const d = dinoBody(DINO_DUCK, 20, 5, 15, [21, LEG_H + 10 - 1 - 4]);
  duck.add(d.body, d.deadMesh);
  duck.visible = false;

  const legs = [];
  for (const [z0, z1] of [[-2, -1], [1, 2]]) {
    const leg = new THREE.Mesh(legGeometry(z0, z1), voxelMaterial);
    leg.castShadow = leg.receiveShadow = true;
    leg.position.set(-4 * VOX, LEG_H * VOX, 0);
    root.add(leg);
    legs.push(leg);
  }

  root.add(stand, duck);
  return {
    root,
    stand,
    duck,
    legs,
    deadMeshes: [s.deadMesh, d.deadMesh],
    // Hitboxes in voxel units, relative to the origin (feet, centre).
    boxes: {
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
    },
  };
}

// ------------------------------------------------------------ Cactus
const CACTUS = ['#3f8f3a', '#2f6e2c', '#56a84a'];

function cactusVoxels(r, H, armChance) {
  const vs = new VoxelSet();
  let xMin = -1;
  let xMax = 1;
  let armTop = 0; // top of arms that stick out along the run direction
  const put = (x, y, z) => {
    const rib = (x + z + 100) % 2 === 0;
    let c = rib ? CACTUS[0] : CACTUS[1];
    if (r() < 0.05) c = CACTUS[2];
    vs.set(x, y, z, c);
    xMin = Math.min(xMin, x);
    xMax = Math.max(xMax, x);
    if (Math.abs(x) > 1) armTop = Math.max(armTop, y + 1);
  };
  for (let y = 0; y < H; y++) {
    for (let x = -1; x <= 1; x++)
      for (let z = -1; z <= 1; z++) {
        if (y === H - 1 && x !== 0 && z !== 0) continue; // rounded top
        put(x, y, z);
      }
  }
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const used = new Set();
  const nArms = H > 8 ? (r() < armChance ? 1 + (r() < 0.5 ? 1 : 0) : 0) : 0;
  for (let i = 0; i < nArms; i++) {
    let di = Math.floor(r() * 4);
    while (used.has(di)) di = (di + 1) % 4;
    used.add(di);
    const [ax, az] = dirs[di];
    const ya = Math.floor(H * (0.3 + r() * 0.25));
    const up = 2 + Math.floor(r() * Math.max(1, H * 0.35));
    // Horizontal stub out of the trunk (2x2 section)...
    for (let d = 2; d <= 3; d++)
      for (let t = 0; t <= 1; t++)
        for (let k = 0; k <= 1; k++) put(ax !== 0 ? ax * d : t, ya + k, az !== 0 ? az * d : t);
    // ...then the arm turns upwards.
    for (let y = ya; y < ya + up; y++)
      for (let t = 0; t <= 1; t++)
        for (let s = 0; s <= 1; s++) {
          const x = ax !== 0 ? ax * (3 + s) : t;
          const z = az !== 0 ? az * (3 + s) : t;
          if (y === ya + up - 1 && s === 1 && t === 1) continue;
          put(x, y, z);
        }
  }
  if (r() < 0.35) vs.set(0, H, 0, r() < 0.5 ? '#ff6fa8' : '#ffd23f');
  return { vs, xMin, xMax, armTop };
}

const cactusCache = { small: [], large: [] };

export function cactusGeometry(size, index) {
  const list = cactusCache[size];
  if (!list[index]) {
    const r = rng(1000 + index * 77 + (size === 'large' ? 5000 : 0));
    const H = size === 'large' ? 15 + Math.floor(r() * 6) : 8 + Math.floor(r() * 4);
    const { vs, xMin, xMax, armTop } = cactusVoxels(r, H, size === 'large' ? 0.9 : 0.5);
    list[index] = { geo: buildGeometry(vs, [0.5, 0, 0.5]), H, xMin, xMax, armTop };
  }
  return list[index];
}

export const CACTUS_VARIANTS = 6;

// ------------------------------------------------------------ Pterodactyl
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
    depth: (ch, x, y) => {
      const r = H - 1 - y;
      if (ch === 'O' || r === 0 || x >= 17) return [0, 0];
      return [-1, 1];
    },
    color: (ch, x, y, z) => (ch === 'W' ? (Math.abs(z) === 1 ? PC.W : PC.P) : PC[ch]),
  });
  const body = buildGeometry(vs, [9, 0, 0.5]);

  const wing = (sign) => {
    const w = new VoxelSet();
    for (let d = 0; d <= 8; d++) {
      const x0 = 8 + Math.floor(d * 0.35);
      const x1 = 15 - Math.floor(d * 0.55);
      for (let x = x0; x <= x1; x++) w.set(x, 0, sign * d, x === x0 ? PC.P : PC.L);
    }
    return buildGeometry(w, [9, 0, sign > 0 ? 0 : 1]);
  };
  pteroGeo = { body, right: wing(1), left: wing(-1) };
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

// ------------------------------------------------------------ Scenery
export function rockGeometry(seed) {
  const r = rng(seed);
  const vs = new VoxelSet();
  const cols = ['#9c8b74', '#8a7a65', '#b3a189'];
  const n = 1 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const cx = Math.floor((r() - 0.5) * 4);
    const cz = Math.floor((r() - 0.5) * 4);
    const rad = 1.2 + r() * 2;
    for (let x = -4; x <= 4; x++)
      for (let y = 0; y <= 4; y++)
        for (let z = -4; z <= 4; z++) {
          const dx = x - cx;
          const dz = z - cz;
          if (dx * dx + y * y * 1.8 + dz * dz <= rad * rad) vs.set(x, y, z, cols[Math.floor(r() * 3)]);
        }
  }
  return buildGeometry(vs, [0.5, 0, 0.5]);
}

export function bushGeometry(seed) {
  const r = rng(seed);
  const vs = new VoxelSet();
  const cols = ['#a57c45', '#8d6838', '#c29455'];
  for (let i = 0; i < 6; i++) {
    let x = 0;
    let z = 0;
    const ax = (r() - 0.5) * 1.6;
    const az = (r() - 0.5) * 1.6;
    for (let y = 0; y < 3 + r() * 3; y++) {
      vs.set(Math.round(x), y, Math.round(z), cols[Math.floor(r() * 3)]);
      x += ax;
      z += az;
    }
  }
  return buildGeometry(vs, [0.5, 0, 0.5]);
}

const MESA = ['#c96f4a', '#b65f3e', '#dc8b5f', '#a9553a'];
export function mesaGeometry(seed) {
  const r = rng(seed);
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
  return buildGeometry(vs, [0.5, 0, 0.5], { scale: VOX * 5 });
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
    for (let x = cx - w; x <= cx + w; x++)
      for (let y = 0; y < h; y++) for (let z = -d; z <= d; z++) vs.set(x, y, z, '#ffffff');
  }
  return buildGeometry(vs, [0.5, 0, 0.5], { scale: VOX * 4, jitter: 0.02 });
}

export function moonMesh() {
  const vs = new VoxelSet();
  for (let x = -6; x <= 6; x++)
    for (let y = -6; y <= 6; y++) {
      const inA = x * x + y * y <= 36;
      const inB = (x - 3) * (x - 3) + (y - 1) * (y - 1) <= 26;
      if (inA && !inB) vs.set(x, y, 0, (x + y) % 5 === 0 ? '#e9e4b4' : '#fbf8dc');
    }
  const m = new THREE.Mesh(
    buildGeometry(vs, [0.5, 0.5, 0.5], { scale: VOX * 6, jitter: 0.02 }),
    new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, transparent: true }),
  );
  return m;
}
