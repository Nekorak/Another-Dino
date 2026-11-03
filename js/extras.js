// World extras: fireflies at night, moving platforms, the golden bone.
import * as THREE from 'three';
import { VOX, VoxelSet, buildGeometry } from './voxel.js';

// ------------------------------------------------------------------ fireflies
// Little glowing dots that drift around the track when night falls.
export class Fireflies {
  constructor(scene, count = 46) {
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), new THREE.MeshBasicMaterial({ color: '#d8ff6a', fog: false, transparent: true }), count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    scene.add(this.mesh);
    this.flies = [];
    for (let i = 0; i < count; i++) this.flies.push(this.spawn({}, true));
    this.tmp = new THREE.Object3D();
  }
  spawn(f, anywhere) {
    f.x = anywhere ? -14 + Math.random() * 60 : 46 + Math.random() * 6;
    f.y = 0.4 + Math.random() * 3.2;
    f.z = -12 + Math.random() * 18;
    f.ph = Math.random() * 10;
    f.sp = 0.6 + Math.random() * 0.8;
    return f;
  }
  // k: 0 = day, 1 = full night
  update(dt, v, k) {
    this.mesh.visible = k > 0.02;
    if (!this.mesh.visible) return;
    this.mesh.material.opacity = k;
    const t = this.tmp;
    this.flies.forEach((f, i) => {
      f.ph += dt * f.sp;
      f.x -= v * dt * 0.9 + Math.sin(f.ph * 1.3) * dt * 0.6;
      f.y += Math.sin(f.ph * 2.1) * dt * 0.5;
      f.z += Math.cos(f.ph * 1.7) * dt * 0.5;
      if (f.x < -16) this.spawn(f, false);
      t.position.set(f.x, f.y, f.z);
      // blink: every fly glows on and off at its own rhythm
      t.scale.setScalar(Math.sin(f.ph * 3) > -0.2 ? 1 : 0.25);
      t.updateMatrix();
      this.mesh.setMatrixAt(i, t.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ moving platform
// A wide hole with a floating stone slab in the middle that bobs up and down.
// The dino can land on the slab (only from above) or jump the whole hole.
export const PLATFORM_W = 2.6;
export const PLATFORM_H = 0.4;

let slabGeo = null;
export function platformGeometry() {
  if (slabGeo) return slabGeo;
  const vs = new VoxelSet();
  const L = Math.round(PLATFORM_W / VOX);
  const H = Math.round(PLATFORM_H / VOX);
  const D = Math.round(3.2 / VOX);
  for (let x = 0; x < L; x++)
    for (let y = 0; y < H; y++)
      for (let z = 0; z < D; z++) {
        const top = y === H - 1;
        const c = top ? ((x + z) % 3 ? '#7fb05a' : '#6a9a48') : (x + y + z) % 4 ? '#8a7a66' : '#6f6252';
        vs.set(x, y, z, c);
      }
  // moss hanging under the edges
  for (let x = 0; x < L; x += 3) vs.set(x, -1, (x * 7) % D, '#5a8a3a');
  slabGeo = buildGeometry(vs, [0, H, D / 2]); // local y = 0 is the top surface
  return slabGeo;
}

// ------------------------------------------------------------------ golden bone
export const GOLD_BONE_VALUE = 10;
export const goldMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, color: '#ffd23f', emissive: '#7a4a00', emissiveIntensity: 0.6 });

// ------------------------------------------------------------------ fish (the "pterodactyls" under the sea)
// facing -x like the pterodactyl, so it swims towards the dino
const FISH = [
  '     OOO        ',
  '   OOWWOO   O   ',
  ' OOKWOOWOO OO   ',
  'OOOWOOWOOOOOO   ',
  ' OOOWOOWOO OO   ',
  '   OOWWOO   O   ',
  '     OOO        ',
];
const FISH_COL = { O: '#ff7a1a', W: '#ffffff', K: '#1b1b1b' };
export const FISH_BOX = { x0: -8, x1: 5, y0: 0, y1: 7 }; // voxels, like the pterodactyl's box

let fishGeo = null;
export function fishGeometry() {
  if (fishGeo) return fishGeo;
  const vs = new VoxelSet();
  const H = FISH.length;
  FISH.forEach((row, r) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === ' ') continue;
      const y = H - 1 - r;
      const thick = x < 10 ? 2 : 0; // body is round, the tail is flat
      for (let z = -thick; z <= thick; z++) vs.set(x, y, z, ch === 'K' && Math.abs(z) !== thick ? FISH_COL.O : FISH_COL[ch]);
    }
  });
  fishGeo = buildGeometry(vs, [8, 0, 0.5]);
  return fishGeo;
}
