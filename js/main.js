import * as THREE from 'three';
import { VOX, voxelMaterial } from './voxel.js';
import {
  createDino,
  createPtero,
  cactusGeometry,
  CACTUS_VARIANTS,
  rockGeometry,
  bushGeometry,
  mesaGeometry,
  cloudGeometry,
  moonMesh,
} from './models.js';
import { Sfx } from './audio.js';

// ------------------------------------------------------------------ text
const RO = (navigator.language || '').toLowerCase().startsWith('ro');
const TXT = RO
  ? {
      tap: 'Atinge ecranul pentru a începe',
      key: 'Apasă SPACE sau click pentru a începe',
      controlsKey: 'SPACE / ↑ sari · ↓ ghemuit · P pauză',
      jump: 'SARI',
      duck: 'JOS',
      record: 'RECORD NOU!',
      paused: 'PAUZĂ',
      resume: 'Atinge pentru a continua',
      again: 'Atinge pentru a juca din nou',
    }
  : {
      tap: 'Tap to start',
      key: 'Press SPACE or click to start',
      controlsKey: 'SPACE / ↑ jump · ↓ duck · P pause',
      jump: 'JUMP',
      duck: 'DUCK',
      record: 'NEW RECORD!',
      paused: 'PAUSED',
      resume: 'Tap to continue',
      again: 'Tap to play again',
    };

// ------------------------------------------------------------------ tuning
const START_SPEED = 13;
const MAX_SPEED = 32;
const ACCEL = 0.16;
const GRAVITY = 80;
const JUMP_V = 25;
const CUT_V = 9; // releasing jump early caps upward speed -> short hop
const MIN_JUMP_H = 1.5;
const FAST_FALL = 3.5;
const SPAWN_X = 42;
const DESPAWN_X = -16;
const NIGHT_EVERY = 700;
const NIGHT_LEN = 12;
const PIXEL_LEVELS = [110, 160, 240]; // render pixels along the short screen side

const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem('another-dino:' + k);
      return v == null ? d : JSON.parse(v);
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem('another-dino:' + k, JSON.stringify(v));
    } catch {
      /* private mode */
    }
  },
};

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

// ------------------------------------------------------------------ renderer
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.BasicShadowMap; // hard, pixelated shadows

const scene = new THREE.Scene();
const SKY_DAY = new THREE.Color('#9fdcff');
const SKY_NIGHT = new THREE.Color('#151c3d');
scene.background = SKY_DAY.clone();
scene.fog = new THREE.Fog(SKY_DAY.clone(), 40, 120);

const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 300);

const hemi = new THREE.HemisphereLight('#e6f6ff', '#d8b27a', 1.7);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff1d2', 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 80 });
sun.shadow.bias = -0.0015;
scene.add(sun, sun.target);

// ------------------------------------------------------------------ ground
function pixelTexture(size, paint) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  paint(g, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestMipmapNearestFilter;
  return t;
}

function speckle(g, size, base, dots, seed) {
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < size * size * 0.45; i++) {
    g.fillStyle = dots[Math.floor(r() * dots.length)];
    g.fillRect(Math.floor(r() * size), Math.floor(r() * size), 1, 1);
  }
}

const TEX = 32;
const sandTex = pixelTexture(TEX, (g, n) =>
  speckle(g, n, '#ecca8e', ['#e4bf81', '#f3d7a0', '#dcb377', '#e9c588', '#c9a06a'], 7),
);
const pathTex = pixelTexture(TEX, (g, n) => {
  speckle(g, n, '#d8b276', ['#cfa76b', '#e0bc82', '#c79e62', '#b48c58'], 11);
  // the classic horizon line, drawn as two darker grooves
  g.fillStyle = '#a98352';
  g.fillRect(0, 3, n, 1);
  g.fillRect(0, n - 4, n, 1);
});

const GROUND_W = 220;
const GROUND_D = 110;
const PATH_D = 3.6;
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(GROUND_W, GROUND_D),
  new THREE.MeshLambertMaterial({ map: sandTex }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.set(40, 0, -GROUND_D / 2 + 25);
ground.receiveShadow = true;
sandTex.repeat.set(GROUND_W / (TEX * VOX), GROUND_D / (TEX * VOX));
scene.add(ground);

const path = new THREE.Mesh(new THREE.PlaneGeometry(GROUND_W, PATH_D), new THREE.MeshLambertMaterial({ map: pathTex }));
path.rotation.x = -Math.PI / 2;
path.position.set(40, 0.01, 0);
path.receiveShadow = true;
pathTex.repeat.set(GROUND_W / (TEX * VOX), PATH_D / (TEX * VOX));
scene.add(path);

// ------------------------------------------------------------------ scenery
const props = [];
function addProp(mesh, opts) {
  mesh.castShadow = opts.shadow !== false;
  mesh.receiveShadow = true;
  scene.add(mesh);
  const p = { mesh, ...opts };
  placeProp(p, opts.x0 + Math.random() * opts.span);
  props.push(p);
  return p;
}
function placeProp(p, x) {
  p.mesh.position.x = x;
  if (p.zRange) {
    const [a, b] = p.zRange[Math.floor(Math.random() * p.zRange.length)];
    p.mesh.position.z = lerp(a, b, Math.random());
  }
  if (p.yRange) p.mesh.position.y = lerp(p.yRange[0], p.yRange[1], Math.random());
  p.mesh.rotation.y = p.spin ? Math.floor(Math.random() * 4) * (Math.PI / 2) : 0;
}

const NEAR_Z = [[-22, -3], [-8, -3], [3, 9]];
for (let i = 0; i < 36; i++) {
  const k = i % 3;
  const geo = k === 0 ? rockGeometry(i + 1) : k === 1 ? bushGeometry(i + 50) : cactusGeometry('small', i % CACTUS_VARIANTS).geo;
  const m = new THREE.Mesh(geo, voxelMaterial);
  if (k === 2) m.scale.setScalar(0.8);
  addProp(m, { x0: -24, span: 92, zRange: NEAR_Z, parallax: 1, spin: true });
}
for (let i = 0; i < 9; i++) {
  const m = new THREE.Mesh(mesaGeometry(300 + i), voxelMaterial);
  addProp(m, { x0: -70, span: 190, zRange: [[-85, -60]], parallax: 0.12, shadow: false });
}
const cloudMat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#ffffff', emissiveIntensity: 0.35 });
for (let i = 0; i < 9; i++) {
  const m = new THREE.Mesh(cloudGeometry(900 + i), cloudMat);
  addProp(m, { x0: -40, span: 130, zRange: [[-40, -12]], yRange: [10, 18], parallax: 0.22, drift: 0.6, shadow: false });
}

const moon = moonMesh();
moon.position.set(34, 11, -80);
scene.add(moon);

const stars = (() => {
  const pts = [];
  for (let i = 0; i < 260; i++) {
    const a = Math.random() * Math.PI * 2;
    const e = 0.08 + Math.random() * 1.3;
    const r = 140;
    pts.push(Math.cos(a) * Math.cos(e) * r + 20, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const m = new THREE.PointsMaterial({ color: '#fff9e0', size: 1.5, sizeAttenuation: false, transparent: true, fog: false });
  return new THREE.Points(g, m);
})();
scene.add(stars);

// ------------------------------------------------------------------ dust
const dustGeo = new THREE.BoxGeometry(VOX, VOX, VOX);
const dustMat = new THREE.MeshLambertMaterial({ color: '#e2bf86' });
const dust = [];
for (let i = 0; i < 40; i++) {
  const m = new THREE.Mesh(dustGeo, dustMat);
  m.visible = false;
  scene.add(m);
  dust.push({ m, life: 0, vx: 0, vy: 0, vz: 0 });
}
let dustIdx = 0;
function puff(x, y, z, vx, vy, vz) {
  const d = dust[dustIdx++ % dust.length];
  d.m.position.set(x, y, z);
  d.vx = vx;
  d.vy = vy;
  d.vz = vz;
  d.life = 0.45;
  d.m.visible = true;
}

// ------------------------------------------------------------------ player
const dino = createDino();
scene.add(dino.root);
const player = { y: 0, vy: 0, onGround: true, ducking: false, legPhase: 0, jumpReleased: true, jumpBuffer: 0 };

// ------------------------------------------------------------------ obstacles
const obstacles = [];

function spawnCactusGroup() {
  const large = Math.random() < 0.45;
  const maxN = Math.min(3, 1 + Math.floor((speed - START_SPEED) / 3.5));
  const n = 1 + Math.floor(Math.random() * maxN);
  const root = new THREE.Group();
  const boxes = [];
  let cursor = 0; // in voxels
  for (let i = 0; i < n; i++) {
    const c = cactusGeometry(large ? 'large' : 'small', Math.floor(Math.random() * CACTUS_VARIANTS));
    const cx = cursor - c.xMin;
    const m = new THREE.Mesh(c.geo, voxelMaterial);
    m.castShadow = m.receiveShadow = true;
    m.position.x = cx * VOX;
    root.add(m);
    boxes.push({ x0: (cx - 1) * VOX, x1: (cx + 1) * VOX, y0: 0, y1: (c.H - 0.5) * VOX });
    if (c.armTop > 0) boxes.push({ x0: (cx + c.xMin) * VOX, x1: (cx + c.xMax) * VOX, y0: 0, y1: c.armTop * VOX });
    cursor = cx + c.xMax + 2;
  }
  return { root, boxes, width: cursor * VOX, y: 0, extra: 0 };
}

function spawnBird() {
  const b = createPtero();
  const heights = [0.75, 2.05, 3.35];
  const y = heights[Math.floor(Math.random() * heights.length)];
  const { x0, x1, y0, y1 } = b.box;
  return {
    root: b.root,
    wings: b.wings,
    boxes: [{ x0: x0 * VOX, x1: x1 * VOX, y0: y0 * VOX, y1: y1 * VOX }],
    width: (x1 - x0) * VOX,
    y,
    extra: Math.random() < 0.5 ? 0 : 2.5,
    flap: Math.random() * 6,
  };
}

let gapLeft = 0;
function spawnObstacle() {
  const o = score > 280 && Math.random() < 0.3 ? spawnBird() : spawnCactusGroup();
  o.x = SPAWN_X;
  o.root.position.set(o.x, o.y, 0);
  scene.add(o.root);
  obstacles.push(o);
  gapLeft = o.width + speed * (0.72 + Math.random() * 0.85) + Math.random() * 2;
}

function clearObstacles() {
  for (const o of obstacles) scene.remove(o.root);
  obstacles.length = 0;
}

function collides() {
  const boxes = player.ducking ? dino.boxes.duck : dino.boxes.stand;
  for (const o of obstacles) {
    if (o.x > 8 || o.x < -8) continue;
    for (const b of boxes) {
      const ax0 = b.x0 * VOX;
      const ax1 = b.x1 * VOX;
      const ay0 = player.y + b.y0 * VOX;
      const ay1 = player.y + b.y1 * VOX;
      for (const c of o.boxes) {
        if (ax0 < o.x + c.x1 && ax1 > o.x + c.x0 && ay0 < o.y + c.y1 && ay1 > o.y + c.y0) return true;
      }
    }
  }
  return false;
}

// ------------------------------------------------------------------ state
const sfx = new Sfx();
sfx.muted = store.get('muted', false);
let pixelLevel = clamp(store.get('pixel', 1), 0, PIXEL_LEVELS.length - 1);
let state = 'title';
let speed = START_SPEED;
let score = 0;
let hi = store.get('hi', 0);
let time = 0;
let deathTime = 0;
let nightTimer = 0;
let night = 0;
let lastMilestone = 0;
let lastNight = 0;
let shake = 0;
let dustTimer = 0;
const input = { jump: false, duck: false };

const ui = {
  score: $('score'),
  hi: $('hi'),
  title: $('title'),
  over: $('over'),
  paused: $('paused'),
  hints: $('hints'),
  record: $('record'),
};
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
$('start-msg').textContent = isTouch ? TXT.tap : TXT.key;
// on touch screens the hint zones explain the controls
$('controls-msg').textContent = isTouch ? '' : TXT.controlsKey;
$('hint-jump').textContent = TXT.jump;
$('hint-duck').textContent = TXT.duck;
$('paused-title').textContent = TXT.paused;
$('paused-msg').textContent = TXT.resume;
$('again-msg').textContent = TXT.again;
if (!isTouch) ui.hints.classList.add('hidden');

const pad = (n) => String(Math.floor(n)).padStart(5, '0');
let shownScore = -1;
function drawScore() {
  const s = Math.floor(score);
  if (s !== shownScore) {
    shownScore = s;
    ui.score.textContent = pad(s);
  }
}
ui.hi.textContent = 'HI ' + pad(hi);

function show(el, on) {
  el.classList.toggle('hidden', !on);
}

function resetRun() {
  clearObstacles();
  speed = START_SPEED;
  score = 0;
  lastMilestone = 0;
  lastNight = 0;
  nightTimer = 0;
  gapLeft = 14;
  Object.assign(player, { y: 0, vy: 0, onGround: true, ducking: false, jumpBuffer: 0, jumpReleased: true });
  for (const m of dino.deadMeshes) m.visible = false;
}

function start() {
  resetRun();
  state = 'running';
  show(ui.title, false);
  show(ui.over, false);
  show(ui.paused, false);
  show(ui.hints, false);
  ui.score.classList.remove('flash');
}

function gameOver() {
  state = 'over';
  deathTime = time;
  shake = 0.35;
  sfx.hit();
  if (navigator.vibrate) navigator.vibrate(90);
  for (const m of dino.deadMeshes) m.visible = true;
  const s = Math.floor(score);
  const isRecord = s > hi;
  if (isRecord) {
    hi = s;
    store.set('hi', hi);
    ui.hi.textContent = 'HI ' + pad(hi);
  }
  ui.record.textContent = isRecord && s > 0 ? TXT.record : '';
  setTimeout(() => state === 'over' && show(ui.over, true), 250);
}

function setPaused(p) {
  if (p && state === 'running') {
    state = 'paused';
    show(ui.paused, true);
  } else if (!p && state === 'paused') {
    state = 'running';
    show(ui.paused, false);
    input.jump = input.duck = false;
  }
}

// ------------------------------------------------------------------ input
function doJump() {
  player.vy = JUMP_V;
  player.onGround = false;
  player.jumpReleased = !input.jump;
  player.jumpBuffer = 0;
  sfx.jump();
  for (let i = 0; i < 5; i++) puff(-0.4 + Math.random() * 0.5, 0.05, (Math.random() - 0.5) * 0.8, -speed * 0.6, 1 + Math.random() * 2, (Math.random() - 0.5) * 2);
}

// returns true if the press was consumed by a menu (start / restart / resume)
function menuPress() {
  sfx.unlock();
  if (state === 'title') {
    start();
    return true;
  }
  if (state === 'over') {
    if (time - deathTime > 0.45) start();
    return true;
  }
  if (state === 'paused') {
    setPaused(false);
    return true;
  }
  return false;
}

function jumpDown() {
  if (menuPress()) return;
  input.jump = true;
  if (player.onGround) doJump();
  else player.jumpBuffer = 0.14;
}
function jumpUp() {
  input.jump = false;
  player.jumpReleased = true;
}
function duckDown() {
  if (menuPress()) return;
  input.duck = true;
}
function duckUp() {
  input.duck = false;
}

const touchLayer = $('touch');
const pointers = new Map();
touchLayer.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (state !== 'running') {
    menuPress();
    return;
  }
  const zone = e.pointerType !== 'mouse' && e.clientX < innerWidth * 0.4 ? 'duck' : 'jump';
  pointers.set(e.pointerId, { zone, y0: e.clientY });
  try {
    touchLayer.setPointerCapture(e.pointerId);
  } catch {
    /* ignore */
  }
  if (zone === 'duck') duckDown();
  else jumpDown();
});
touchLayer.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId);
  if (p && p.zone === 'jump' && e.clientY - p.y0 > 36) {
    p.zone = 'duck';
    jumpUp();
    duckDown();
  }
});
function pointerEnd(e) {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  pointers.delete(e.pointerId);
  const still = [...pointers.values()].some((q) => q.zone === p.zone);
  if (still) return;
  if (p.zone === 'duck') duckUp();
  else jumpUp();
}
touchLayer.addEventListener('pointerup', pointerEnd);
touchLayer.addEventListener('pointercancel', pointerEnd);
touchLayer.addEventListener('contextmenu', (e) => e.preventDefault());

const JUMP_KEYS = new Set(['Space', 'ArrowUp', 'KeyW']);
const DUCK_KEYS = new Set(['ArrowDown', 'KeyS']);
addEventListener('keydown', (e) => {
  if (JUMP_KEYS.has(e.code) || DUCK_KEYS.has(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (JUMP_KEYS.has(e.code)) jumpDown();
  else if (DUCK_KEYS.has(e.code)) duckDown();
  else if (e.code === 'KeyP' || e.code === 'Escape') setPaused(state === 'running');
});
addEventListener('keyup', (e) => {
  if (JUMP_KEYS.has(e.code)) jumpUp();
  else if (DUCK_KEYS.has(e.code)) duckUp();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) setPaused(true);
});
addEventListener('blur', () => setPaused(true));

// HUD buttons
const btnSound = $('btn-sound');
const btnPixel = $('btn-pixel');
function refreshButtons() {
  btnSound.classList.toggle('off', sfx.muted);
  btnPixel.textContent = 'PX' + (pixelLevel + 1);
}
refreshButtons();
function onButton(el, fn) {
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    fn();
    el.blur();
  });
}
onButton($('btn-pause'), () => {
  sfx.unlock();
  if (state === 'running') setPaused(true);
  else if (state === 'paused') setPaused(false);
});
onButton(btnSound, () => {
  sfx.unlock();
  sfx.muted = !sfx.muted;
  store.set('muted', sfx.muted);
  refreshButtons();
});
onButton(btnPixel, () => {
  pixelLevel = (pixelLevel + 1) % PIXEL_LEVELS.length;
  store.set('pixel', pixelLevel);
  refreshButtons();
  resize();
});
const btnFs = $('btn-fs');
if (document.fullscreenEnabled || document.webkitFullscreenEnabled) {
  onButton(btnFs, () => {
    const el = document.documentElement;
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else {
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      Promise.resolve(req.call(el, { navigationUI: 'hide' })).catch(() => {});
    }
  });
} else {
  btnFs.remove();
}
onButton($('btn-restart'), () => {
  sfx.unlock();
  if (state === 'over') start();
});

// ------------------------------------------------------------------ camera
const RIG = {
  // landscape: side view like the original; portrait: high 3/4 view looking down the track
  wide: { pos: new THREE.Vector3(2.6, 4.4, 12), look: new THREE.Vector3(6.2, 1.6, 0), fov: 40 },
  tall: { pos: new THREE.Vector3(-7, 10, 4.5), look: new THREE.Vector3(7, 0, -0.5), fov: 60 },
};
const camPos = new THREE.Vector3();
const camLook = new THREE.Vector3();

function resize() {
  const w = innerWidth;
  const h = innerHeight;
  const scale = Math.max(1, Math.min(w, h) / PIXEL_LEVELS[pixelLevel]);
  renderer.setSize(Math.round(w / scale), Math.round(h / scale), false);
  camera.aspect = w / h;
}
addEventListener('resize', resize);
resize();

function updateCamera(dt) {
  const t = clamp((camera.aspect - 0.7) / (1.35 - 0.7), 0, 1); // 0 = portrait, 1 = landscape
  camPos.lerpVectors(RIG.tall.pos, RIG.wide.pos, t);
  camLook.lerpVectors(RIG.tall.look, RIG.wide.look, t);
  camLook.y += player.y * 0.25;
  camPos.y += player.y * 0.12;
  const speedT = (speed - START_SPEED) / (MAX_SPEED - START_SPEED);
  camera.fov = lerp(RIG.tall.fov, RIG.wide.fov, t) + speedT * 5;
  if (shake > 0) {
    shake = Math.max(0, shake - dt);
    const k = shake * 0.6;
    camPos.x += (Math.random() - 0.5) * k;
    camPos.y += (Math.random() - 0.5) * k;
  }
  camera.position.copy(camPos);
  camera.lookAt(camLook);
  camera.updateProjectionMatrix();
}

// ------------------------------------------------------------------ loop
const tmpColor = new THREE.Color();
let scroll = 0;

function updateWorld(dt) {
  const v = state === 'running' ? speed : 0;
  scroll += v * dt;
  const rep = TEX * VOX;
  sandTex.offset.x = (scroll / rep) % 1;
  pathTex.offset.x = (scroll / rep) % 1;

  for (const p of props) {
    p.mesh.position.x -= (v * p.parallax + (p.drift || 0)) * dt;
    if (p.mesh.position.x < p.x0) placeProp(p, p.mesh.position.x + p.span);
  }

  for (const d of dust) {
    if (d.life <= 0) continue;
    d.life -= dt;
    d.vy -= 9 * dt;
    d.m.position.x += (d.vx - v * 0.2) * dt;
    d.m.position.y = Math.max(0.05, d.m.position.y + d.vy * dt);
    d.m.position.z += d.vz * dt;
    d.m.scale.setScalar(Math.max(0.01, d.life / 0.45));
    if (d.life <= 0) d.m.visible = false;
  }

  // day / night
  nightTimer = Math.max(0, nightTimer - (state === 'running' ? dt : 0));
  const target = nightTimer > 0 ? 1 : 0;
  night += clamp(target - night, -dt / 1.5, dt / 1.5);
  scene.background.lerpColors(SKY_DAY, SKY_NIGHT, night);
  scene.fog.color.copy(scene.background);
  hemi.intensity = lerp(1.7, 0.45, night);
  hemi.color.lerpColors(tmpColor.set('#e6f6ff'), SKY_NIGHT, night * 0.3);
  sun.intensity = lerp(2.6, 0.9, night);
  sun.color.lerpColors(tmpColor.set('#fff1d2'), new THREE.Color('#9fb4ff'), night);
  cloudMat.emissiveIntensity = lerp(0.35, 0.02, night);
  stars.material.opacity = night;
  stars.visible = night > 0.01;
  moon.material.opacity = night;
  moon.visible = night > 0.01;
  document.body.classList.toggle('night', night > 0.5);
}

function updatePlayer(dt) {
  if (!player.onGround) {
    let g = GRAVITY;
    if (input.duck) g *= FAST_FALL;
    if (player.jumpReleased && player.vy > CUT_V && player.y > MIN_JUMP_H) player.vy = CUT_V;
    player.vy -= g * dt;
    player.y += player.vy * dt;
    if (player.y <= 0) {
      player.y = 0;
      player.vy = 0;
      player.onGround = true;
      for (let i = 0; i < 8; i++)
        puff(-0.6 + Math.random() * 1.2, 0.05, (Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 3, 1 + Math.random() * 1.5, (Math.random() - 0.5) * 3);
      if (player.jumpBuffer > 0) doJump();
    }
  }
  player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);
  player.ducking = player.onGround && input.duck;

  dustTimer -= dt;
  if (player.onGround && dustTimer <= 0) {
    dustTimer = 0.07;
    puff(-0.5, 0.05, (Math.random() - 0.5) * 0.6, -speed * 0.3 - Math.random() * 2, 0.6 + Math.random(), (Math.random() - 0.5));
  }
}

function animateDino(dt) {
  const r = dino.root;
  r.position.y = player.y;
  dino.stand.visible = !player.ducking;
  dino.duck.visible = player.ducking;
  if (state === 'running') {
    if (player.onGround) {
      player.legPhase += dt * speed * 1.15;
      const a = Math.sin(player.legPhase) * 0.75;
      dino.legs[0].rotation.z = a;
      dino.legs[1].rotation.z = -a;
      r.position.y += Math.abs(Math.cos(player.legPhase)) * 0.06;
    } else {
      dino.legs[0].rotation.z = 0.5;
      dino.legs[1].rotation.z = -0.25;
    }
    r.rotation.z = player.onGround ? 0 : clamp(player.vy * 0.008, -0.2, 0.2);
  } else if (state === 'title') {
    dino.legs[0].rotation.z = dino.legs[1].rotation.z = 0;
    r.position.y = Math.abs(Math.sin(time * 2.2)) * 0.08;
    r.rotation.z = 0;
  }
}

function updateObstacles(dt) {
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    o.x -= (speed + o.extra) * dt;
    o.root.position.x = o.x;
    if (o.wings) {
      o.flap += dt * 9;
      const a = Math.sin(o.flap) * 0.9;
      o.wings[0].pivot.rotation.x = -a;
      o.wings[1].pivot.rotation.x = a;
      o.root.position.y = o.y + Math.sin(o.flap) * 0.05;
    }
    if (o.x < DESPAWN_X) {
      scene.remove(o.root);
      obstacles.splice(i, 1);
    }
  }
  gapLeft -= speed * dt;
  if (gapLeft <= 0) spawnObstacle();
}

function update(dt) {
  time += dt;
  if (state === 'running') {
    speed = Math.min(MAX_SPEED, speed + ACCEL * dt);
    score += speed * dt * 0.75;
    const m = Math.floor(score / 100);
    if (m > lastMilestone) {
      lastMilestone = m;
      sfx.point();
      ui.score.classList.remove('flash');
      void ui.score.offsetWidth;
      ui.score.classList.add('flash');
    }
    const n = Math.floor(score / NIGHT_EVERY);
    if (n > lastNight) {
      lastNight = n;
      nightTimer = NIGHT_LEN;
    }
    updatePlayer(dt);
    updateObstacles(dt);
    if (collides()) gameOver();
    drawScore();
  }
  animateDino(dt);
  updateWorld(dt);
  sun.target.position.set(6, 0, 0);
  sun.position.set(-4, 18, 12);
  updateCamera(dt);
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
drawScore();

if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !/localhost|127\.0\.0\.1/.test(location.hostname)) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

// handy for debugging from the console
window.__dino = {
  get state() { return state; },
  get score() { return score; },
  get speed() { return speed; },
  start,
  player,
  obstacles,
  RIG,
};
