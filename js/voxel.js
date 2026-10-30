// Tiny voxel mesher: only exposed faces are emitted, with per-vertex
// ambient occlusion and a little colour jitter for a hand-made pixel look.
import * as THREE from 'three';

export const VOX = 0.12; // size of one voxel in world units

const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 1, 0], [0, 1, 1], [0, 0, 1]] },
  { n: [0, 1, 0], c: [[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]] },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { n: [0, 0, -1], c: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]] },
];

// Make every quad wind counter-clockwise when seen from outside.
for (const f of FACES) {
  const [a, b, c] = f.c;
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const cr = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  if (cr[0] * f.n[0] + cr[1] * f.n[1] + cr[2] * f.n[2] < 0) f.c.reverse();
}

const AO = [0.5, 0.68, 0.84, 1];

function hash3(x, y, z) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export class VoxelSet {
  constructor() {
    this.map = new Map();
  }
  key(x, y, z) {
    return x + ',' + y + ',' + z;
  }
  set(x, y, z, color) {
    if (color == null) this.map.delete(this.key(x, y, z));
    else this.map.set(this.key(x, y, z), { x, y, z, color });
  }
  has(x, y, z) {
    return this.map.has(this.key(x, y, z));
  }
  get size() {
    return this.map.size;
  }
}

const colorCache = new Map();
function toColor(hex) {
  let c = colorCache.get(hex);
  if (!c) {
    c = new THREE.Color(hex);
    colorCache.set(hex, c);
  }
  return c;
}

// origin: voxel coordinate that ends up at the mesh's local (0,0,0)
export function buildGeometry(vs, origin = [0, 0, 0], { jitter = 0.07, scale = VOX } = {}) {
  const pos = [];
  const nor = [];
  const col = [];
  const idx = [];
  const [ox, oy, oz] = origin;

  for (const v of vs.map.values()) {
    const base = toColor(v.color);
    const j = 1 + (hash3(v.x, v.y, v.z) - 0.5) * 2 * jitter;
    for (const f of FACES) {
      const [nx, ny, nz] = f.n;
      if (vs.has(v.x + nx, v.y + ny, v.z + nz)) continue;
      const start = pos.length / 3;
      for (const c of f.c) {
        // AO: look at the three voxels touching this corner on the outside.
        const t = [];
        for (let a = 0; a < 3; a++) if (f.n[a] === 0) t.push(a);
        const s0 = [0, 0, 0];
        const s1 = [0, 0, 0];
        s0[t[0]] = c[t[0]] ? 1 : -1;
        s1[t[1]] = c[t[1]] ? 1 : -1;
        const px = v.x + nx;
        const py = v.y + ny;
        const pz = v.z + nz;
        const a1 = vs.has(px + s0[0], py + s0[1], pz + s0[2]) ? 1 : 0;
        const a2 = vs.has(px + s1[0], py + s1[1], pz + s1[2]) ? 1 : 0;
        const a3 = vs.has(px + s0[0] + s1[0], py + s0[1] + s1[1], pz + s0[2] + s1[2]) ? 1 : 0;
        const ao = a1 && a2 ? 0 : 3 - (a1 + a2 + a3);
        const k = AO[ao] * j;
        pos.push((v.x + c[0] - ox) * scale, (v.y + c[1] - oy) * scale, (v.z + c[2] - oz) * scale);
        nor.push(nx, ny, nz);
        col.push(base.r * k, base.g * k, base.b * k);
      }
      idx.push(start, start + 1, start + 2, start, start + 2, start + 3);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

export const voxelMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });

export function voxelMesh(vs, origin, opts) {
  const m = new THREE.Mesh(buildGeometry(vs, origin, opts), voxelMaterial);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Extrude a 2D pixel-art grid (rows top->bottom) into voxels.
// depth(ch, x, y) -> [zMin, zMax]; color(ch, x, y, z) -> hex, or null to leave a hole
export function extrude(vs, grid, palette, { depth, color, dx = 0, dy = 0, dz = 0 } = {}) {
  const h = grid.length;
  for (let r = 0; r < h; r++) {
    const row = grid[r];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === ' ' || ch === '.') continue;
      const y = h - 1 - r;
      const [z0, z1] = depth ? depth(ch, x, y) : [0, 0];
      for (let z = z0; z <= z1; z++) {
        const c = color ? color(ch, x, y, z) : palette[ch];
        if (c != null) vs.set(x + dx, y + dy, z + dz, c);
      }
    }
  }
  return vs;
}

// Deterministic PRNG so generated props are reproducible.
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}
