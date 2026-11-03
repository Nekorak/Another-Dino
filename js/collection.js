// Things to collect and show off: fossils (the album), trails and seasonal events.
import * as THREE from 'three';
import { VOX, VoxelSet, buildGeometry, rng } from './voxel.js';
import { BIOMES } from './biomes.js';
import { profile, save } from './save.js';

// ------------------------------------------------------------------ fossils
// three per world: a skull, a claw and a tooth, tinted by the world they were found in
export const FOSSIL_KINDS = ['skull', 'claw', 'tooth'];
export const FOSSIL_TINT = {
  desert: '#e9d6a8',
  jungle: '#c9b48a',
  beach: '#f3e2c4',
  snow: '#d8e8f4',
  cave: '#c8b8e8',
  city: '#c4c0b8',
  volcano: '#e8a070',
  space: '#d0d4e0',
  ocean: '#cfe8e0',
  candy: '#ffe0f0',
};
export const FOSSIL_WORLD_REWARD = 100;

export const fossilId = (biomeId, k) => `${biomeId}-${k}`;
export const allFossils = () => BIOMES.flatMap((b) => FOSSIL_KINDS.map((_, k) => fossilId(b.id, k)));

const FOSSIL_ART = {
  skull: ['  #####  ', ' ####### ', '##.###.##', '#########', ' ####### ', ' # # # # '],
  claw: ['   ##', '  ## ', ' ##  ', '###  ', '##   ', '#    '],
  tooth: [' ### ', '#####', '#####', ' ### ', ' # # ', ' # # '],
};

export function fossilPixels(id) {
  const [biomeId, k] = id.split('-');
  const art = FOSSIL_ART[FOSSIL_KINDS[Number(k)]];
  const tint = FOSSIL_TINT[biomeId] || '#e9d6a8';
  const out = [];
  art.forEach((row, r) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === ' ') continue;
      out.push({ x, y: art.length - 1 - r, color: row[x] === '.' ? '#3b3326' : tint });
    }
  });
  return out;
}

const fossilGeo = new Map();
export function fossilGeometry(id) {
  if (!fossilGeo.has(id)) {
    const vs = new VoxelSet();
    for (const p of fossilPixels(id)) for (let z = 0; z <= 1; z++) vs.set(p.x, p.y, z, p.color);
    fossilGeo.set(id, buildGeometry(vs, [4, 3, 1], { scale: VOX * 1.4, jitter: 0.04 }));
  }
  return fossilGeo.get(id);
}

// a fossil of this world the player does not have yet (or null)
export function missingFossil(biomeId, r = Math.random) {
  const missing = FOSSIL_KINDS.map((_, k) => fossilId(biomeId, k)).filter((id) => !profile.fossils.includes(id));
  return missing.length ? missing[Math.floor(r() * missing.length)] : null;
}

// returns { worldDone: bool, allDone: bool }
export function addFossil(id) {
  if (profile.fossils.includes(id)) return { worldDone: false, allDone: false };
  profile.fossils.push(id);
  const biomeId = id.split('-')[0];
  const worldDone = FOSSIL_KINDS.every((_, k) => profile.fossils.includes(fossilId(biomeId, k)));
  if (worldDone) profile.coins += FOSSIL_WORLD_REWARD;
  const allDone = allFossils().every((f) => profile.fossils.includes(f));
  if (allDone && !profile.owned.skin.includes('fossil')) profile.owned.skin.push('fossil');
  save();
  return { worldDone, allDone };
}

// ------------------------------------------------------------------ trails
export const TRAILS = {
  none: { price: 0 },
  bubbles: { price: 150, colors: ['#bfe8ff', '#8fd3ff', '#ffffff'], motion: 'float' },
  sparkles: { price: 200, colors: ['#fff6a0', '#ffffff', '#ffd23f'], motion: 'twinkle' },
  hearts: { price: 200, colors: ['#ff6fa8', '#ff4f7a', '#ffd6e6'], motion: 'float' },
  rainbow: { price: 250, colors: ['#ff4f5a', '#ff9a2a', '#ffd23f', '#5fd35a', '#3f8fff', '#9a5ad8'], motion: 'line' },
  fire: { price: 300, colors: ['#ff3b1a', '#ff8a1a', '#ffd23f'], motion: 'rise' },
  // season pass, tier 20
  confetti: { pass: true, colors: ['#ff4f8a', '#4fc3ff', '#ffd23f', '#5fd35a', '#c86fff', '#ffffff'], motion: 'twinkle' },
};

export class Trail {
  constructor(scene, max = 160) {
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(VOX * 1.2, VOX * 1.2, VOX * 1.2), new THREE.MeshBasicMaterial(), max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.layers.set(1);
    scene.add(this.mesh);
    this.parts = [];
    this.max = max;
    this.tmp = new THREE.Object3D();
    this.color = new THREE.Color();
    this.acc = 0;
    this.k = 0;
  }
  // x/y/z: where the dino's tail is; v: world speed
  update(dt, id, x, y, z, v, emitting) {
    const def = TRAILS[id];
    if (def && def.colors && emitting) {
      this.acc += dt;
      while (this.acc > 0.025) {
        this.acc -= 0.025;
        if (this.parts.length >= this.max) this.parts.shift();
        const c = def.colors[this.k++ % def.colors.length];
        this.parts.push({ x, y: y + (Math.random() - 0.5) * 0.3, z: z + (Math.random() - 0.5) * 0.3, life: 0.9, c, motion: def.motion, ph: Math.random() * 6 });
      }
    }
    const t = this.tmp;
    let i = 0;
    for (let n = this.parts.length - 1; n >= 0; n--) {
      const p = this.parts[n];
      p.life -= dt;
      if (p.life <= 0) {
        this.parts.splice(n, 1);
        continue;
      }
      p.x -= v * dt;
      if (p.motion === 'rise') p.y += dt * 1.6;
      if (p.motion === 'float') p.y += Math.sin(p.ph + p.life * 8) * dt * 0.8 + dt * 0.4;
      const s = p.motion === 'twinkle' ? (Math.sin(p.ph + p.life * 25) > 0 ? 1 : 0.3) * p.life : p.life;
      t.position.set(p.x, p.y, p.z);
      t.rotation.set(p.ph, p.ph, 0);
      t.scale.setScalar(Math.max(0.01, s));
      t.updateMatrix();
      this.mesh.setMatrixAt(i, t.matrix);
      this.mesh.setColorAt(i, this.color.set(p.c));
      i++;
    }
    this.mesh.count = i;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  clear() {
    this.parts.length = 0;
    this.mesh.count = 0;
  }
}

// ------------------------------------------------------------------ seasons
// Halloween and Christmas follow the calendar; ?season=halloween|christmas|newyear forces one (testing).
export function currentSeason(date = new Date()) {
  const forced = new URLSearchParams(location.search).get('season');
  if (forced) return forced === 'none' ? null : forced;
  if (!profile.settings.seasons) return null;
  const m = date.getMonth() + 1;
  const d = date.getDate();
  if ((m === 12 && d >= 30) || (m === 1 && d <= 2)) return 'newyear';
  if ((m === 12 && d >= 15) || (m === 1 && d <= 6)) return 'christmas';
  if ((m === 10 && d >= 20) || (m === 11 && d <= 5)) return 'halloween';
  return null;
}

export const SEASON_HAT = { halloween: 'pumpkin', christmas: 'santa', newyear: 'santa' };

// gives the seasonal hat once per season; returns the hat id if it was just given
export function giveSeasonGift(season) {
  if (!season) return null;
  const hat = SEASON_HAT[season];
  const key = season + '-' + new Date().getFullYear();
  if (profile.seasonGifts.includes(key)) return null;
  profile.seasonGifts.push(key);
  // Christmas and New Year give the same hat: only announce it the first time
  const fresh = !profile.owned.hat.includes(hat);
  if (fresh) profile.owned.hat.push(hat);
  save();
  return fresh ? hat : null;
}

function box(vs, x0, x1, y0, y1, z0, z1, c) {
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) vs.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c);
}

function pumpkin(r) {
  const vs = new VoxelSet();
  const R = 2.5 + r() * 1.2;
  for (let x = -4; x <= 4; x++)
    for (let y = 0; y <= 6; y++)
      for (let z = -4; z <= 4; z++) {
        if ((x / R) ** 2 + ((y - 2.6) / (R * 0.85)) ** 2 + (z / R) ** 2 > 1) continue;
        vs.set(x, y, z, Math.abs(x) % 2 ? '#ff8a1a' : '#e8700a');
      }
  // carved face on the front (+x) glowing yellow
  for (const [y, z] of [[3, -1], [3, 1], [1, -1], [1, 0], [1, 1]]) {
    for (let x = 4; x >= 0; x--) {
      if (vs.has(x, y, z)) {
        vs.set(x, y, z, '#ffe066');
        break;
      }
    }
  }
  box(vs, 0, 0, 5, 6, 0, 0, '#4a7a2a');
  for (const v of [...vs.map.values()]) if (v.y < 0) vs.set(v.x, v.y, v.z, null);
  return vs;
}

function xmasTree(r) {
  const vs = new VoxelSet();
  const H = 12 + Math.floor(r() * 6);
  box(vs, 0, 0, 0, 2, 0, 0, '#6a4a2a');
  const lights = ['#ff4f5a', '#ffd23f', '#3f8fff', '#ffffff'];
  for (let y = 3; y < H; y++) {
    const w = Math.round(((H - y) / (H - 3)) * 4);
    for (let x = -w; x <= w; x++)
      for (let z = -w; z <= w; z++) {
        if (Math.abs(x) + Math.abs(z) > w + 1) continue;
        const edge = Math.abs(x) + Math.abs(z) >= w;
        vs.set(x, y, z, edge && r() < 0.18 ? lights[Math.floor(r() * 4)] : (x + y + z) % 2 ? '#2f7a4a' : '#256a3e');
      }
  }
  vs.set(0, H, 0, '#ffd23f');
  return vs;
}

function gifts(r) {
  const vs = new VoxelSet();
  const n = 1 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const c = ['#e0303a', '#3f8fff', '#2ec27e', '#ffd23f'][Math.floor(r() * 4)];
    const ox = i * 4 - n * 2;
    const h = 2 + Math.floor(r() * 2);
    box(vs, ox, ox + 2, 0, h, -1, 1, (x, y, z) => (x === ox + 1 || z === 0 ? '#ffffff' : c));
  }
  return vs;
}

const seasonCache = new Map();
// returns a voxel geometry for a seasonal decoration, or null
export function seasonPropGeometry(season, seed) {
  if (!season) return null;
  const key = season + ':' + (seed % 6);
  if (!seasonCache.has(key)) {
    const r = rng(seed * 13 + 7);
    const vs = season === 'halloween' ? pumpkin(r) : seed % 2 ? xmasTree(r) : gifts(r);
    seasonCache.set(key, buildGeometry(vs, [0.5, 0, 0.5]));
  }
  return seasonCache.get(key);
}

// New Year fireworks: short-lived glowing sparks. Bursts are placed through the camera
// (a point in the upper part of the screen), so they show in portrait and landscape alike.
const FW_COLORS = ['#ff4f5a', '#ffd23f', '#4fc3ff', '#5fd35a', '#ff6fd8', '#ffffff'];
export class Fireworks {
  constructor(scene, max = 240) {
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshBasicMaterial({ fog: false }), max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.parts = [];
    this.max = max;
    this.tmp = new THREE.Object3D();
    this.color = new THREE.Color();
    this.v = new THREE.Vector3();
  }
  burst(camera) {
    // a random spot in the top half of the screen, 22-34 units away
    this.v.set((Math.random() - 0.5) * 1.3, 0.35 + Math.random() * 0.45, 0.5).unproject(camera).sub(camera.position).normalize();
    const d = 22 + Math.random() * 12;
    const ox = camera.position.x + this.v.x * d;
    const oy = camera.position.y + this.v.y * d;
    const oz = camera.position.z + this.v.z * d;
    const c = FW_COLORS[Math.floor(Math.random() * FW_COLORS.length)];
    const c2 = Math.random() < 0.4 ? FW_COLORS[Math.floor(Math.random() * FW_COLORS.length)] : c;
    for (let i = 0; i < 40; i++) {
      if (this.parts.length >= this.max) this.parts.shift();
      // even spread on a sphere
      const u = Math.random() * 2 - 1;
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      const s = 4.5 + Math.random() * 1.5;
      this.parts.push({ x: ox, y: oy, z: oz, vx: r * Math.cos(a) * s, vy: u * s, vz: r * Math.sin(a) * s, life: 1.3 + Math.random() * 0.4, c: i % 3 ? c : c2 });
    }
  }
  update(dt) {
    const t = this.tmp;
    let i = 0;
    for (let n = this.parts.length - 1; n >= 0; n--) {
      const p = this.parts[n];
      p.life -= dt;
      if (p.life <= 0) {
        this.parts.splice(n, 1);
        continue;
      }
      const drag = Math.exp(-2.2 * dt);
      p.vx *= drag;
      p.vy = p.vy * drag - 2.5 * dt;
      p.vz *= drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      t.position.set(p.x, p.y, p.z);
      t.rotation.set(0, 0, 0);
      t.scale.setScalar(Math.min(1, p.life * 1.4) * (p.life < 0.5 && Math.random() < 0.3 ? 0.2 : 1));
      t.updateMatrix();
      this.mesh.setMatrixAt(i, t.matrix);
      this.mesh.setColorAt(i, this.color.set(p.c));
      i++;
    }
    this.mesh.count = i;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  clear() {
    this.parts.length = 0;
    this.mesh.count = 0;
  }
}
