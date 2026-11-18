// A different boss in every world: the giant pterodactyl in other colours (flyers) or a
// voxel beast walking along the track (crab, mammoth). attack: how it fights
//   drop: burning rocks fall on the track (with a red warning ring)
//   roll: it sends boulders rolling along the track
//   swim: it sends fish at different heights (jump or duck)
import * as THREE from 'three';
import { VoxelSet, buildGeometry, voxelMaterial } from './voxel.js';
import { createPtero } from './models.js';

const FLYERS = {
  desert: { pal: null, attack: 'drop' },
  jungle: { pal: { P: '#2f9a48', L: '#e8483b', O: '#ffd23f', F: '#1f6a30' }, attack: 'drop' }, // a giant parrot
  cave: { pal: { P: '#3a2f4a', L: '#6b5a85', O: '#c8c0d8', W: '#ff3b30', F: '#231c2e' }, attack: 'drop' }, // a giant bat
  volcano: { pal: { P: '#b8281f', L: '#ff8a3a', O: '#ffd23f', W: '#ffe066', F: '#6e140f' }, attack: 'drop' }, // a fire dragon
  candy: { pal: { P: '#ff6fa8', L: '#fff0f7', O: '#7fd3ff', W: '#ffffff', F: '#c4457a' }, attack: 'drop' }, // a gummy pterodactyl
  season: { pal: { P: '#e8ecf4', L: '#ffffff', O: '#9fe3ff', W: '#3a2a5a', F: '#b8c0d0' }, attack: 'drop' }, // a ghost pterodactyl
};
export const BOSS_KIND = { desert: 'ptero', jungle: 'parrot', beach: 'crab', snow: 'mammoth', cave: 'bat', city: 'robot', volcano: 'dragon', space: 'ufo', ocean: 'octopus', candy: 'gummy', season: 'ghost' };

function box(vs, x0, x1, y0, y1, z0, z1, c) {
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) vs.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c);
}

const cache = new Map();
function geo(kind, make) {
  if (!cache.has(kind)) cache.set(kind, make());
  return cache.get(kind);
}

function crab() {
  const vs = new VoxelSet();
  const R = '#e0442f';
  const D = '#a82a1c';
  box(vs, -7, 7, 3, 7, -5, 5, (x, y) => (y === 3 ? D : R)); // shell
  box(vs, -5, 5, 8, 8, -4, 4, R);
  for (const z of [-2, 2]) {
    box(vs, 4, 4, 8, 11, z, z, D); // eye stalks
    vs.set(4, 12, z, '#ffffff');
    vs.set(5, 12, z, '#1b1b1b');
  }
  for (const z of [-7, 7]) {
    box(vs, 7, 12, 5, 8, z - 1, z + 1, R); // claws
    box(vs, 12, 14, 8, 10, z - 1, z + 1, R);
    box(vs, 12, 14, 4, 6, z - 1, z + 1, D);
  }
  for (const x of [-6, -3, 0, 3]) for (const z of [-6, 6]) box(vs, x, x, 0, 3, z, z, D); // legs
  return buildGeometry(vs, [0, 0, 0.5]);
}

function mammoth() {
  const vs = new VoxelSet();
  const B = '#7a5236';
  const D = '#5a3a24';
  box(vs, -10, 8, 8, 20, -6, 6, (x, y, z) => ((x + y + z) % 5 === 0 ? D : B)); // shaggy body
  box(vs, 6, 14, 12, 22, -5, 5, B); // head
  box(vs, 14, 16, 4, 15, -1, 1, D); // trunk
  for (const z of [-4, 4]) {
    box(vs, 14, 18, 9, 10, z, z, '#f4ecd8'); // tusks
    box(vs, 18, 19, 11, 12, z, z, '#f4ecd8');
    vs.set(13, 19, z, '#1b1b1b'); // eyes
  }
  for (const x of [-8, -4, 2, 6]) for (const z of [-4, 4]) box(vs, x, x + 2, 0, 8, z - 1, z + 1, D); // legs
  return buildGeometry(vs, [0, 0, 0.5]);
}

function robot() {
  const vs = new VoxelSet();
  const G = '#9aa6b2';
  const D = '#5d6873';
  box(vs, -6, 6, 0, 8, -5, 5, G); // body
  box(vs, -4, 4, -3, -1, -3, 3, D); // belly
  for (const z of [-3, 3]) box(vs, 6, 6, 4, 6, z - 1, z + 1, '#ff3b30'); // eyes
  box(vs, -1, 1, 9, 11, -1, 1, D); // mast
  return { body: buildGeometry(vs, [0, 0, 0.5]), rotor: (() => {
    const r = new VoxelSet();
    box(r, -12, 12, 0, 0, -1, 1, '#2a2f36');
    box(r, -1, 1, 0, 0, -12, 12, '#2a2f36');
    return buildGeometry(r, [0, 0, 0.5]);
  })() };
}

function ufo() {
  const vs = new VoxelSet();
  for (let x = -12; x <= 12; x++)
    for (let z = -12; z <= 12; z++) {
      const r = Math.hypot(x, z);
      if (r <= 12) vs.set(x, 2, z, r > 10 ? '#ffd23f' : '#b9c2cc');
      if (r <= 9) vs.set(x, 3, z, '#8f99a5');
      if (r <= 6) vs.set(x, 1, z, '#6c7682');
      if (r <= 5) box(vs, x, x, 4, 4 + Math.round(Math.sqrt(Math.max(0, 25 - r * r))) , z, z, (xx, y) => (y > 6 ? '#bfefff' : '#6fdc5a'));
    }
  vs.set(4, 7, -1, '#1b1b1b');
  vs.set(4, 7, 1, '#1b1b1b');
  return buildGeometry(vs, [0, 0, 0.5]);
}

function octopus() {
  const vs = new VoxelSet();
  const P = '#9a5ad8';
  const D = '#6e3aa8';
  for (let x = -6; x <= 6; x++)
    for (let y = 6; y <= 18; y++)
      for (let z = -6; z <= 6; z++) if (Math.hypot(x, (y - 12) * 0.9, z) <= 6.5) vs.set(x, y, z, (x + y) % 4 ? P : D);
  for (const z of [-2, 2]) {
    box(vs, 6, 6, 12, 13, z - 1, z, '#ffffff');
    vs.set(7, 12, z, '#1b1b1b');
  }
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    for (let s = 0; s < 8; s++) {
      const r = 4 + s * 0.8;
      vs.set(Math.round(Math.cos(a) * r), 6 - s, Math.round(Math.sin(a) * r), s % 2 ? D : P);
    }
  }
  return buildGeometry(vs, [0, 0, 0.5]);
}

// returns { root, wings, rotor, kind, attack, ground, scale }
export function createBoss(biomeId) {
  const kind = BOSS_KIND[biomeId] || 'ptero';
  const f = FLYERS[biomeId];
  if (f || !BOSS_KIND[biomeId]) {
    const b = createPtero(f ? f.pal : null);
    b.root.scale.setScalar(3.4);
    return { ...b, kind, attack: f ? f.attack : 'drop', ground: false };
  }
  const root = new THREE.Group();
  const add = (g) => {
    const m = new THREE.Mesh(g, voxelMaterial);
    m.castShadow = true;
    root.add(m);
    return m;
  };
  if (kind === 'crab') {
    add(geo('crab', crab));
    root.scale.setScalar(2.4);
    return { root, wings: null, kind, attack: 'roll', ground: true };
  }
  if (kind === 'mammoth') {
    add(geo('mammoth', mammoth));
    root.scale.setScalar(2.2);
    return { root, wings: null, kind, attack: 'roll', ground: true };
  }
  if (kind === 'robot') {
    const g = geo('robot', robot);
    add(g.body);
    const rotor = add(g.rotor);
    rotor.position.y = 12 * 0.12;
    root.scale.setScalar(2.6);
    return { root, wings: null, rotor, kind, attack: 'drop', ground: false };
  }
  if (kind === 'ufo') {
    add(geo('ufo', ufo));
    root.scale.setScalar(2.4);
    return { root, wings: null, kind, attack: 'drop', ground: false };
  }
  add(geo('octopus', octopus));
  root.scale.setScalar(2.3);
  return { root, wings: null, kind, attack: 'swim', ground: false };
}
