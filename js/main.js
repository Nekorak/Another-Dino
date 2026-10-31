import * as THREE from 'three';
import { VOX, voxelMaterial, rng } from './voxel.js';
import { createDino, DINO_BOXES, createPtero, boneGeometry, powerupGeometry, POWERUPS, glowMaterial, SKINS, HATS } from './models.js';
import {
  BIOMES,
  BIOME_LENGTH,
  biomeAt,
  obstacleGeometry,
  OBSTACLE_VARIANTS,
  boulderGeometry,
  BOULDER_RADIUS,
  tumbleweedGeometry,
  meteorGeometry,
  nearPropGeometry,
  NEAR_KINDS,
  farGeometry,
  cloudGeometry,
  moonGeometry,
} from './biomes.js';
import { Dust, Shatter, Weather, PostFX } from './effects.js';
import { Sfx } from './audio.js';
import { Music } from './music.js';
import { profile, save, loadGhost, saveGhost } from './save.js';
import { t, setLang } from './i18n.js';
import { ensureMissions, checkMissions, checkAchievements, ACHIEVEMENT_REWARD } from './missions.js';
import { createTransport } from './net.js';
import { LanSession } from './multiplayer.js';
import { UI } from './ui.js';

// ------------------------------------------------------------------ tuning
const START_SPEED = 13;
const MAX_SPEED = 28;
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
const POWER_TIME = { shield: 15, magnet: 10, slow: 6, double: 12 };
const GHOST_STEP = 0.05;
const RIVAL_LANES = [-2.4, -4.8, -7.2];

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const now = () => performance.now() / 1000;

setLang(profile.settings.lang);
ensureMissions();

// ------------------------------------------------------------------ renderer
const canvas = $('game');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
} catch (err) {
  document.body.classList.add('no-webgl');
  $('fatal').textContent = t('noWebgl');
  throw err;
}
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.BasicShadowMap; // hard, pixelated shadows
const post = new PostFX(renderer);

const scene = new THREE.Scene();
scene.background = new THREE.Color();
scene.fog = new THREE.Fog('#ffffff', 40, 120);
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 300);

const hemi = new THREE.HemisphereLight('#e6f6ff', '#d8b27a', 1.7);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff1d2', 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 80 });
sun.shadow.bias = -0.0015;
sun.position.set(-4, 18, 12);
sun.target.position.set(6, 0, 0);
scene.add(sun, sun.target);

// ------------------------------------------------------------------ ground
function pixelTexture(size, paint) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  paint(c.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapNearestFilter;
  return tex;
}

function speckle(g, size, base, dots, seed) {
  const r = rng(seed);
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < size * size * 0.45; i++) {
    g.fillStyle = dots[Math.floor(r() * dots.length)];
    g.fillRect(Math.floor(r() * size), Math.floor(r() * size), 1, 1);
  }
}

// Neutral textures; each biome tints them through the material colour.
const TEX = 32;
const groundTex = pixelTexture(TEX, (g, n) => speckle(g, n, '#f2f2f2', ['#e6e6e6', '#ffffff', '#dadada', '#ededed', '#c8c8c8'], 7));
const pathTex = pixelTexture(TEX, (g, n) => {
  speckle(g, n, '#f0f0f0', ['#e2e2e2', '#fafafa', '#d6d6d6', '#c4c4c4'], 11);
  g.fillStyle = '#b0b0b0';
  g.fillRect(0, 3, n, 1);
  g.fillRect(0, n - 4, n, 1);
});
const GROUND_W = 220;
const GROUND_D = 110;
const PATH_D = 3.6;
const groundMat = new THREE.MeshLambertMaterial({ map: groundTex });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(GROUND_W, GROUND_D), groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.set(40, 0, -GROUND_D / 2 + 25);
ground.receiveShadow = true;
groundTex.repeat.set(GROUND_W / (TEX * VOX), GROUND_D / (TEX * VOX));
scene.add(ground);
const pathMat = new THREE.MeshLambertMaterial({ map: pathTex });
const path = new THREE.Mesh(new THREE.PlaneGeometry(GROUND_W, PATH_D), pathMat);
path.rotation.x = -Math.PI / 2;
path.position.set(40, 0.01, 0);
path.receiveShadow = true;
pathTex.repeat.set(GROUND_W / (TEX * VOX), PATH_D / (TEX * VOX));
scene.add(path);

// ------------------------------------------------------------------ scenery
const near = [];
const NEAR_Z = [[-22, -3], [-8, -3], [3, 9]];
for (let i = 0; i < 36; i++) {
  const m = new THREE.Mesh(undefined, voxelMaterial);
  m.castShadow = m.receiveShadow = true;
  m.position.x = -24 + Math.random() * 92;
  scene.add(m);
  near.push({ mesh: m, seed: i + 1, x0: -24, span: 92 });
}
function placeNear(p, x, biomeId) {
  const kind = Math.floor(Math.random() * NEAR_KINDS);
  const g = nearPropGeometry(biomeId, kind, p.seed % 12);
  p.mesh.geometry = g.geo;
  p.mesh.material = g.glow ? glowMaterial : voxelMaterial;
  p.mesh.position.x = x;
  const [a, b] = NEAR_Z[Math.floor(Math.random() * NEAR_Z.length)];
  p.mesh.position.z = lerp(a, b, Math.random());
  p.mesh.rotation.y = Math.floor(Math.random() * 4) * (Math.PI / 2);
}

const far = [];
for (let i = 0; i < 9; i++) {
  const m = new THREE.Mesh(undefined, voxelMaterial);
  scene.add(m);
  far.push({ mesh: m, seed: 300 + i, biome: -1, x0: -70, span: 190, delay: 0 });
  m.position.set(-70 + Math.random() * 190, 0, lerp(-85, -60, Math.random()));
}

const cloudMat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#ffffff', emissiveIntensity: 0.35 });
const clouds = [];
for (let i = 0; i < 9; i++) {
  const m = new THREE.Mesh(cloudGeometry(900 + i), cloudMat);
  scene.add(m);
  m.position.set(-40 + Math.random() * 130, 10 + Math.random() * 8, lerp(-40, -12, Math.random()));
  clouds.push(m);
}

const moon = new THREE.Mesh(moonGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, transparent: true }));
moon.position.set(34, 11, -80);
scene.add(moon);

const stars = (() => {
  const pts = [];
  for (let i = 0; i < 260; i++) {
    const a = Math.random() * Math.PI * 2;
    const e = 0.08 + Math.random() * 1.3;
    pts.push(Math.cos(a) * Math.cos(e) * 140 + 20, Math.sin(e) * 140, Math.sin(a) * Math.cos(e) * 140);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color: '#fff9e0', size: 1.5, sizeAttenuation: false, transparent: true, fog: false }));
})();
scene.add(stars);

const dust = new Dust(scene);
const shatter = new Shatter(scene);
const weather = new Weather(scene);

// ------------------------------------------------------------------ biome colours
const BC = BIOMES.map((b) => ({
  sky: new THREE.Color(b.sky),
  ground: new THREE.Color(b.ground),
  path: new THREE.Color(b.path),
  hemiGround: new THREE.Color(b.hemiGround),
  sun: new THREE.Color(b.sun),
  cloud: new THREE.Color(b.cloud),
}));
const NIGHT_SKY = new THREE.Color('#151c3d');
const NIGHT_SKY_VOLCANO = new THREE.Color('#2a1414');
const RAIN_SKY = new THREE.Color('#7f8c96');
const STORM_SKY = new THREE.Color('#e0bd85');
const MOON_LIGHT = new THREE.Color('#9fb4ff');
const HEMI_SKY = new THREE.Color('#e6f6ff');
const cur = {
  sky: new THREE.Color(),
  ground: new THREE.Color(),
  path: new THREE.Color(),
  hemiGround: new THREE.Color(),
  sun: new THREE.Color(),
  cloud: new THREE.Color(),
};
const env = { biome: 0, weatherOn: false, weatherTimer: 8 };

function setBiome(i, instant) {
  env.biome = i;
  const b = BIOMES[i];
  dust.setColor(b.dust);
  weather.setType(b.weather);
  env.weatherOn = b.weatherAlways;
  env.weatherTimer = 14 + Math.random() * 10;
  if (instant) {
    for (const k of Object.keys(cur)) cur[k].copy(BC[i][k]);
    for (const p of near) placeNear(p, p.mesh.position.x, b.id);
    for (const p of far) {
      p.biome = i;
      p.mesh.geometry = farGeometry(b.id, p.seed);
      p.mesh.position.y = 0;
    }
    weather.intensity = env.weatherOn ? 1 : 0;
  } else {
    far.forEach((p, k) => (p.delay = k * 0.25 + Math.random() * 0.5));
  }
}
setBiome(0, true);

// ------------------------------------------------------------------ player
let dino = createDino(profile.skin, profile.hat);
scene.add(dino.root);
function rebuildDino(skin, hat) {
  const visible = dino.root.visible;
  scene.remove(dino.root);
  dino = createDino(skin, hat);
  dino.root.visible = visible;
  scene.add(dino.root);
}

const player = { y: 0, vy: 0, onGround: true, ducking: false, legPhase: 0, jumpReleased: true, jumpBuffer: 0, airJumps: 0, inPit: false };
const power = { shield: 0, magnet: 0, slow: 0, double: 0 };
let invuln = 0;
let slowK = 1;

const shieldMesh = new THREE.Mesh(
  new THREE.IcosahedronGeometry(1.75, 1),
  new THREE.MeshBasicMaterial({ color: '#4fc3ff', transparent: true, opacity: 0.28, depthWrite: false }),
);
shieldMesh.visible = false;
scene.add(shieldMesh);

// ------------------------------------------------------------------ ghost & rivals
const ghostMat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.38, depthWrite: false });
let ghost = loadGhost(); // { samples: [[y*100, duck, score]...], score, skin, hat }
let ghostDino = null;
let ghostRec = [];
let ghostClock = 0;

function makeLabel(text) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 40;
  const g = c.getContext('2d');
  g.font = '18px "Press Start 2P", monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = 'rgba(0,0,0,0.45)';
  const w = Math.min(250, g.measureText(text).width + 16);
  g.fillRect(128 - w / 2, 2, w, 36);
  g.fillStyle = '#ffffff';
  g.fillText(text, 128, 22);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, fog: false }));
  s.scale.set(3.2, 0.5, 1);
  return s;
}

const rivals = new Map(); // id -> { dino, label, x, lane, p }
function clearRivals() {
  for (const r of rivals.values()) scene.remove(r.dino.root, r.label);
  rivals.clear();
}

// ------------------------------------------------------------------ obstacles, coins, power-ups
const obstacles = [];
const coins = [];
const items = [];
let R = Math.random; // gameplay randomness (seeded in LAN races so everyone gets the same track)
let gapLeft = 0;
let nextPowerAt = 300;
let tutorial = null;

const boneGeo = boneGeometry();

function groundObstacle(biomeId, forceSmall) {
  const large = !forceSmall && R() < 0.45;
  const maxN = Math.min(3, 1 + Math.floor((speed - START_SPEED) / 3.5));
  const n = 1 + Math.floor(R() * maxN);
  const root = new THREE.Group();
  const boxes = [];
  let cursor = 0;
  let burst = '#3f8f3a';
  for (let i = 0; i < n; i++) {
    const c = obstacleGeometry(biomeId, large ? 1 : 0, Math.floor(R() * OBSTACLE_VARIANTS));
    const cx = cursor - c.xMin;
    const m = new THREE.Mesh(c.geo, voxelMaterial);
    m.castShadow = m.receiveShadow = true;
    m.position.x = cx * VOX;
    root.add(m);
    boxes.push({ x0: (cx - c.trunk) * VOX, x1: (cx + c.trunk) * VOX, y0: 0, y1: (c.H - 0.5) * VOX });
    if (c.armTop > 0) boxes.push({ x0: (cx + c.xMin) * VOX, x1: (cx + c.xMax) * VOX, y0: 0, y1: c.armTop * VOX });
    cursor = cx + c.xMax + 2;
    burst = c.burst;
  }
  return { kind: 'ground', root, boxes, width: cursor * VOX, y: 0, extra: 0, burst };
}

function bird(heightIndex) {
  const b = createPtero();
  const heights = [0.75, 2.05, 3.35];
  const hi = heightIndex ?? Math.floor(R() * 3);
  const { x0, x1, y0, y1 } = b.box;
  return {
    kind: 'bird',
    mid: hi === 1,
    root: b.root,
    wings: b.wings,
    boxes: [{ x0: x0 * VOX, x1: x1 * VOX, y0: y0 * VOX, y1: y1 * VOX }],
    width: (x1 - x0) * VOX,
    y: heights[hi],
    extra: heightIndex != null || R() < 0.5 ? 0 : 2.5,
    flap: R() * 6,
    burst: '#8a5aa0',
  };
}

function boulder(biomeId) {
  const root = new THREE.Group();
  const m = new THREE.Mesh(boulderGeometry(biomeId), voxelMaterial);
  m.castShadow = true;
  m.position.y = BOULDER_RADIUS;
  root.add(m);
  const r = BOULDER_RADIUS;
  return { kind: 'boulder', root, spin: m, boxes: [{ x0: -r * 0.75, x1: r * 0.75, y0: 0, y1: r * 1.7 }], width: r * 2, y: 0, extra: 4, burst: '#8a7559' };
}

function tumbleweed() {
  const root = new THREE.Group();
  const m = new THREE.Mesh(tumbleweedGeometry(), voxelMaterial);
  m.castShadow = true;
  m.position.y = 0.5;
  root.add(m);
  return { kind: 'tumble', root, spin: m, boxes: [{ x0: -0.4, x1: 0.4, y0: 0.15, y1: 0.95 }], width: 1, y: 0, extra: 3, phase: 0, burst: '#b08a4f' };
}

function meteor() {
  const root = new THREE.Group();
  const rock = new THREE.Mesh(meteorGeometry(), glowMaterial);
  rock.castShadow = true;
  const warn = new THREE.Mesh(
    new THREE.RingGeometry(0.45, 0.8, 12),
    new THREE.MeshBasicMaterial({ color: '#ff3b30', transparent: true, opacity: 0.6, depthWrite: false }),
  );
  warn.rotation.x = -Math.PI / 2;
  warn.position.y = 0.03;
  root.add(rock, warn);
  return { kind: 'meteor', root, rock, warn, armed: false, fall: 1.15, boxes: [{ x0: -0.32, x1: 0.32, y0: 0, y1: 0.7 }], width: 1, y: 0, extra: 0, burst: '#ff9a2a' };
}

const pitMat = new THREE.MeshBasicMaterial({ color: '#0d0907' });
const pitRimMat = new THREE.MeshLambertMaterial({ color: '#6b5a44' });
function pit() {
  const w = 1.5 + R() * 0.8;
  const root = new THREE.Group();
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(w, PATH_D + 0.4), pitMat);
  hole.rotation.x = -Math.PI / 2;
  hole.position.set(w / 2, 0.02, 0);
  root.add(hole);
  for (const x of [-0.06, w + 0.06]) {
    const rim = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, PATH_D + 0.4), pitRimMat);
    rim.position.set(x, 0.04, 0);
    rim.receiveShadow = true;
    root.add(rim);
  }
  return { kind: 'pit', root, boxes: [], width: w, y: 0, extra: 0, pit: w };
}

function addObstacle(o, x = SPAWN_X) {
  o.x = x;
  o.passed = false;
  o.root.position.set(o.x, o.y, 0);
  scene.add(o.root);
  obstacles.push(o);
  return o;
}

function removeObstacle(i) {
  scene.remove(obstacles[i].root);
  obstacles.splice(i, 1);
}

function addCoin(x, y) {
  const m = new THREE.Mesh(boneGeo, voxelMaterial);
  m.castShadow = true;
  m.position.set(x, y, 0);
  scene.add(m);
  coins.push({ m, x, y });
}

function addItem(type, x, y) {
  const m = new THREE.Mesh(powerupGeometry(type), glowMaterial);
  m.position.set(x, y, 0);
  scene.add(m);
  items.push({ m, type, x, y, t: 0 });
}

function clearTrack() {
  while (obstacles.length) removeObstacle(0);
  for (const c of coins) scene.remove(c.m);
  coins.length = 0;
  for (const it of items) scene.remove(it.m);
  items.length = 0;
}

function spawnNext() {
  const biomeId = BIOMES[env.biome].id;
  let o;
  if (tutorial && tutorial.plan.length) {
    const step = tutorial.plan.shift();
    o = step === 'bird' ? bird(1) : groundObstacle(biomeId, true);
    o.tutorial = step === 'bird' ? 'duck' : 'jump';
  } else {
    const s = score;
    const opts = [['ground', 1]];
    if (s > 280) opts.push(['bird', 0.32]);
    if (s > 400) opts.push(['boulder', 0.12]);
    if (s > 150 && biomeId === 'desert') opts.push(['tumble', 0.16]);
    if (s > 500) opts.push(['meteor', biomeId === 'volcano' ? 0.4 : 0.06]);
    if (s > 350) opts.push(['pit', 0.12]);
    let pick = R() * opts.reduce((a, b) => a + b[1], 0);
    let kind = 'ground';
    for (const [k, w] of opts) {
      if ((pick -= w) <= 0) {
        kind = k;
        break;
      }
    }
    const make = { bird: () => bird(), boulder: () => boulder(biomeId), tumble: tumbleweed, meteor, pit, ground: () => groundObstacle(biomeId) };
    o = make[kind]();
  }
  addObstacle(o);
  const gap = o.width + speed * (0.72 + R() * 0.85) + R() * 2 + o.extra * 0.6 + (o.tutorial ? 10 : 0);
  gapLeft = gap;

  // coins: an arc over ground obstacles and pits, or a line in the gap after
  const roll = R();
  if ((o.kind === 'ground' || o.kind === 'pit') && roll < 0.3) {
    const cx = SPAWN_X + o.width / 2;
    for (let k = -3; k <= 3; k++) addCoin(cx + k * 0.95, 1.1 + 2.6 * (1 - (k / 3.6) ** 2));
  } else if (roll < 0.65 || o.tutorial) {
    const x0 = SPAWN_X + o.width + 2.5;
    const x1 = SPAWN_X + gap - 3;
    for (let x = x0; x < x1 && x < x0 + 8; x += 0.95) addCoin(x, 0.75);
  }
  // a power-up roughly every 300-600 points, floating in the gap
  if (!tutorial && score > nextPowerAt && gap > o.width + 5) {
    nextPowerAt = score + 300 + R() * 300;
    addItem(POWERUPS[Math.floor(R() * POWERUPS.length)], SPAWN_X + o.width + gap * 0.5, 1.1);
  }
}

function collides(o) {
  const boxes = player.ducking ? DINO_BOXES.duck : DINO_BOXES.stand;
  for (const b of boxes) {
    const ax0 = b.x0 * VOX;
    const ax1 = b.x1 * VOX;
    const ay0 = player.y + b.y0 * VOX;
    const ay1 = player.y + b.y1 * VOX;
    for (const c of o.boxes) {
      if (ax0 < o.x + c.x1 && ax1 > o.x + c.x0 && ay0 < o.y + c.y1 && ay1 > o.y + c.y0) return true;
    }
  }
  return false;
}

// true when both feet are over a hole
function overPit() {
  for (const o of obstacles) if (o.kind === 'pit' && o.x < -0.55 && o.x + o.pit > 0.05) return true;
  return false;
}

// ------------------------------------------------------------------ state
const sfx = new Sfx();
const music = new Music(sfx);
let state = 'menu'; // menu | countdown | running | paused | dying | over
let mode = 'solo'; // solo | lan
let speed = START_SPEED;
let score = 0;
let time = 0;
let runTime = 0;
let deathTimer = 0;
let nightTimer = 0;
let night = 0;
let lastMilestone = 0;
let lastNight = 0;
let shake = 0;
let dustTimer = 0;
let scroll = 0;
let countdown = 0;
let run = newRunStats();
let checkTimer = 0;
const input = { jump: false, duck: false };

const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const isApp = !!(window.desktop || (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()));

function newRunStats() {
  return { score: 0, jumps: 0, coins: 0, obstacles: 0, ducks: 0, powerups: 0, biome: 1, meteors: 0 };
}

function resetRun(seed) {
  clearTrack();
  shatter.clear();
  R = seed != null ? rng(seed) : Math.random;
  speed = START_SPEED;
  score = 0;
  runTime = 0;
  lastMilestone = 0;
  lastNight = 0;
  nightTimer = 0;
  gapLeft = 14;
  nextPowerAt = 250 + R() * 150;
  slowK = 1;
  invuln = 0;
  for (const k of Object.keys(power)) power[k] = 0;
  Object.assign(player, { y: 0, vy: 0, onGround: true, ducking: false, jumpBuffer: 0, jumpReleased: true, airJumps: 0, inPit: false });
  input.jump = input.duck = false;
  dino.root.visible = true;
  for (const m of dino.deadMeshes) m.visible = false;
  run = newRunStats();
  ghostRec = [];
  ghostClock = 0;
  if (env.biome !== 0) setBiome(0, true);
  tutorial = mode === 'solo' && !profile.tutorial ? { plan: ['cactus', 'bird'], freeze: null, done: false } : null;
  ui.setRunCoins(0);
  ui.setScore(0);
  ui.setPowerups(power, POWER_TIME);
}

function setupGhost() {
  if (ghostDino) scene.remove(ghostDino.root);
  ghostDino = null;
  if (mode === 'solo' && profile.settings.ghost && ghost && ghost.samples && ghost.samples.length > 20) {
    ghostDino = createDino(ghost.skin || 'classic', ghost.hat || 'none', ghostMat);
    ghostDino.root.position.z = RIVAL_LANES[0];
    scene.add(ghostDino.root);
  }
}

function startRun(seed) {
  resetRun(seed);
  if (mode === 'solo') setupGhost();
  state = 'running';
  ui.hideScreens();
  ui.setPlaying(true);
  music.biome = 0;
  music.start();
}

function startSolo() {
  sfx.unlock();
  mode = 'solo';
  clearRivals();
  startRun(null);
}

function die(o) {
  state = 'dying';
  deathTimer = 0.9;
  shake = 0.45;
  sfx.hit();
  music.stop(0.4);
  vibrate([60, 40, 90]);
  if (o) {
    dino.root.visible = false;
    shatter.burst(dino.pieces, 0, player.y, 0, 1, 1.5);
  } else {
    for (const m of dino.deadMeshes) m.visible = true;
  }
  shieldMesh.visible = false;
}

function finishRun() {
  state = 'over';
  const s = Math.floor(score);
  const st = profile.stats;
  st.games++;
  st.distance += s;
  st.time += Math.round(runTime);
  st.maxBiome = Math.max(st.maxBiome, run.biome - 1);
  const isRecord = s > st.best;
  if (isRecord) st.best = s;
  if (s > 0) {
    profile.top.push({ s, d: Date.now(), lan: mode === 'lan' });
    profile.top.sort((a, b) => b.s - a.s);
    profile.top.length = Math.min(profile.top.length, 10);
  }
  if (mode === 'solo' && isRecord && ghostRec.length > 20) {
    ghost = { samples: ghostRec, score: s, skin: profile.skin, hat: profile.hat };
    saveGhost(ghost);
  }
  run.score = s;
  const missionsDone = checkMissions(run);
  const ach = checkAchievements();
  save();
  ui.setHi(st.best);
  music.sting();
  ui.showOver({ score: s, record: isRecord && s > 0, coins: run.coins, missions: missionsDone, lan: mode === 'lan' });
  if (missionsDone.length) sfx.reward();
  for (const a of ach) ui.toast(t('achievementDone', { name: t('a_' + a.id), n: ACHIEVEMENT_REWARD }), 'gold');
}

function setPaused(p) {
  if (mode === 'lan') return;
  if (p && state === 'running') {
    state = 'paused';
    music.stop(0.1);
    ui.showPaused(true);
  } else if (!p && state === 'paused') {
    state = 'running';
    ui.showPaused(false);
    input.jump = input.duck = false;
    music.start();
  }
}

function toMenu() {
  if (lan) leaveLan();
  mode = 'solo';
  state = 'menu';
  clearTrack();
  shatter.clear();
  clearRivals();
  if (ghostDino) scene.remove(ghostDino.root);
  ghostDino = null;
  tutorial = null;
  Object.assign(player, { y: 0, vy: 0, onGround: true, ducking: false, inPit: false });
  for (const k of Object.keys(power)) power[k] = 0;
  shieldMesh.visible = false;
  dino.root.visible = true;
  for (const m of dino.deadMeshes) m.visible = false;
  if (env.biome !== 0) setBiome(0, true);
  music.stop(0.2);
  ui.setPlaying(false);
  ui.showMenu();
}

// ------------------------------------------------------------------ input
function vibrate(pattern) {
  if (profile.settings.vibration && navigator.vibrate) navigator.vibrate(pattern);
}

function doJump() {
  player.vy = JUMP_V;
  player.onGround = false;
  player.jumpReleased = !input.jump;
  player.jumpBuffer = 0;
  player.airJumps = 0;
  run.jumps++;
  profile.stats.jumps++;
  sfx.jump();
  for (let i = 0; i < 5; i++) dust.puff(-0.4 + Math.random() * 0.5, 0.05, (Math.random() - 0.5) * 0.8, -speed * 0.6, 1 + Math.random() * 2, (Math.random() - 0.5) * 2);
}

function tutorialRelease(action) {
  if (tutorial && tutorial.freeze === action) {
    tutorial.freeze = null;
    ui.tutorial(null);
  }
}

function canRestart() {
  return state === 'over' && mode === 'solo' && now() - ui.overShownAt > 0.5;
}

function jumpDown() {
  if (state === 'over') {
    if (canRestart()) startSolo();
    return;
  }
  if (state === 'paused') return setPaused(false);
  if (state !== 'running') return;
  input.jump = true;
  const tutorialJump = !!(tutorial && tutorial.freeze === 'jump');
  tutorialRelease('jump');
  if (player.inPit && player.y < 0) return;
  if (player.onGround) {
    doJump();
    player.fullJump = tutorialJump; // a quick tap in the tutorial still clears the cactus
  }
  else if (power.double > 0 && player.airJumps === 0 && !player.inPit) {
    player.airJumps = 1;
    player.vy = JUMP_V * 0.85;
    player.jumpReleased = false;
    sfx.doubleJump();
    for (let i = 0; i < 8; i++) dust.puff((Math.random() - 0.5) * 0.8, player.y + 0.2, (Math.random() - 0.5) * 0.8, -speed * 0.3, -1 - Math.random(), (Math.random() - 0.5) * 3);
  } else player.jumpBuffer = 0.14;
}
function jumpUp() {
  input.jump = false;
  player.jumpReleased = true;
}
function duckDown() {
  if (state === 'paused') return setPaused(false);
  if (state !== 'running') return;
  input.duck = true;
  tutorialRelease('duck');
}
function duckUp() {
  input.duck = false;
}

const touchLayer = $('touch');
const pointers = new Map();
touchLayer.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  sfx.unlock();
  if (state !== 'running') {
    if (state === 'paused') setPaused(false);
    else if (canRestart()) startSolo();
    return;
  }
  const leftHalf = e.clientX < innerWidth * (profile.settings.lefty ? 0.6 : 0.4);
  const duckSide = profile.settings.lefty ? !leftHalf : leftHalf;
  const zone = e.pointerType !== 'mouse' && duckSide ? 'duck' : 'jump';
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
  if ([...pointers.values()].some((q) => q.zone === p.zone)) return;
  if (p.zone === 'duck') duckUp();
  else jumpUp();
}
touchLayer.addEventListener('pointerup', pointerEnd);
touchLayer.addEventListener('pointercancel', pointerEnd);
touchLayer.addEventListener('contextmenu', (e) => e.preventDefault());

const JUMP_KEYS = new Set(['Space', 'ArrowUp', 'KeyW']);
const DUCK_KEYS = new Set(['ArrowDown', 'KeyS']);
addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (JUMP_KEYS.has(e.code) || DUCK_KEYS.has(e.code)) e.preventDefault();
  if (e.repeat) return;
  sfx.unlock();
  if (e.code === 'Escape' && ui.panelOpen()) return ui.closePanel();
  if (state === 'menu') {
    if (!ui.panelOpen() && (e.code === 'Space' || e.code === 'Enter')) startSolo();
    return;
  }
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

// gamepad: A / d-pad up = jump, B / d-pad down / stick down = duck, Start = pause
const pad = { jump: false, duck: false, start: false };
function pollGamepad() {
  const gps = navigator.getGamepads ? navigator.getGamepads() : [];
  let gp = null;
  for (const g of gps) if (g && g.connected) gp = g;
  if (!gp) return;
  const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
  const ay = gp.axes[1] ?? 0;
  const j = b(0) || b(12) || ay < -0.6;
  const d = b(1) || b(13) || ay > 0.6;
  const s = b(9);
  if (j && !pad.jump) {
    sfx.unlock();
    if (state === 'menu' && !ui.panelOpen()) startSolo();
    else jumpDown();
  }
  if (!j && pad.jump) jumpUp();
  if (d && !pad.duck) duckDown();
  if (!d && pad.duck) duckUp();
  if (s && !pad.start) {
    if (state === 'running' || state === 'paused') setPaused(state === 'running');
    else if (canRestart()) startSolo();
  }
  Object.assign(pad, { jump: j, duck: d, start: s });
}

// ------------------------------------------------------------------ camera
const RIG = {
  // landscape: side view like the original; portrait: high 3/4 view looking down the track
  wide: { pos: new THREE.Vector3(2.6, 4.4, 12), look: new THREE.Vector3(6.2, 1.6, 0), fov: 40 },
  tall: { pos: new THREE.Vector3(-7, 10, 4.5), look: new THREE.Vector3(7, 0, -0.5), fov: 60 },
  // close-up used while browsing the shop
  shopWide: { pos: new THREE.Vector3(2.2, 2.8, 9.4), look: new THREE.Vector3(4.6, 1.4, 0), fov: 40 },
  shopTall: { pos: new THREE.Vector3(3.6, 3.4, 12.5), look: new THREE.Vector3(1.0, -0.9, 0), fov: 45 },
};
const camPos = new THREE.Vector3();
const camLook = new THREE.Vector3();
const shopPos = new THREE.Vector3();
const shopLook = new THREE.Vector3();
let shopBlend = 0;

function resize() {
  const w = innerWidth;
  const h = innerHeight;
  const scale = Math.max(1, Math.min(w, h) / PIXEL_LEVELS[profile.settings.pixel]);
  renderer.setSize(Math.round(w / scale), Math.round(h / scale), false);
  camera.aspect = w / h;
}
addEventListener('resize', resize);

function updateCamera(dt) {
  const k = clamp((camera.aspect - 0.7) / (1.35 - 0.7), 0, 1); // 0 = portrait, 1 = landscape
  camPos.lerpVectors(RIG.tall.pos, RIG.wide.pos, k);
  camLook.lerpVectors(RIG.tall.look, RIG.wide.look, k);
  // On less wide screens (16:9 monitors) slide the side view so the dino stays fully in frame.
  const halfW = Math.tan(THREE.MathUtils.degToRad(RIG.wide.fov / 2)) * camera.aspect * 12.6;
  const dx = Math.min(0, halfW * 0.62 - RIG.wide.look.x) * k;
  camPos.x += dx;
  camLook.x += dx;
  let fov = lerp(RIG.tall.fov, RIG.wide.fov, k);

  shopBlend += clamp((ui.panelOpen() === 'shop' ? 1 : 0) - shopBlend, -dt * 3, dt * 3);
  if (shopBlend > 0) {
    const e = shopBlend * shopBlend * (3 - 2 * shopBlend);
    shopPos.lerpVectors(RIG.shopTall.pos, RIG.shopWide.pos, k);
    shopLook.lerpVectors(RIG.shopTall.look, RIG.shopWide.look, k);
    camPos.lerp(shopPos, e);
    camLook.lerp(shopLook, e);
    fov = lerp(fov, lerp(RIG.shopTall.fov, RIG.shopWide.fov, k), e);
  }
  camLook.y += player.y * 0.25;
  camPos.y += player.y * 0.12;
  camera.fov = fov + ((speed - START_SPEED) / (MAX_SPEED - START_SPEED)) * 5;
  if (shake > 0) {
    shake = Math.max(0, shake - dt);
    const s = shake * 0.6;
    camPos.x += (Math.random() - 0.5) * s;
    camPos.y += (Math.random() - 0.5) * s;
  }
  camera.position.copy(camPos);
  camera.lookAt(camLook);
  camera.updateProjectionMatrix();
}

// ------------------------------------------------------------------ per-frame updates
function updateWorld(dt, v) {
  scroll += v * dt;
  const rep = TEX * VOX;
  groundTex.offset.x = (scroll / rep) % 1;
  pathTex.offset.x = (scroll / rep) % 1;
  const biomeId = BIOMES[env.biome].id;

  for (const p of near) {
    p.mesh.position.x -= v * dt;
    if (p.mesh.position.x < p.x0) placeNear(p, p.mesh.position.x + p.span, biomeId);
  }
  // far scenery sinks into the ground and rises again as the new biome
  for (const p of far) {
    p.mesh.position.x -= v * 0.12 * dt;
    if (p.mesh.position.x < p.x0) {
      p.mesh.position.x += p.span;
      p.mesh.position.z = lerp(-85, -60, Math.random());
    }
    if (p.biome !== env.biome) {
      p.delay -= dt;
      if (p.delay <= 0) {
        p.mesh.position.y -= dt * 8;
        if (p.mesh.position.y < -14) {
          p.biome = env.biome;
          p.mesh.geometry = farGeometry(biomeId, p.seed);
        }
      }
    } else if (p.mesh.position.y < 0) p.mesh.position.y = Math.min(0, p.mesh.position.y + dt * 8);
  }
  for (const c of clouds) {
    c.position.x -= (v * 0.22 + 0.6) * dt;
    if (c.position.x < -40) c.position.x += 130;
  }

  // colours drift towards the current biome
  const k = 1 - Math.exp(-dt * 0.45);
  for (const key of Object.keys(cur)) cur[key].lerp(BC[env.biome][key], k);

  // weather: some biomes have it all the time, others in spells
  if (!BIOMES[env.biome].weatherAlways && state === 'running') {
    env.weatherTimer -= dt;
    if (env.weatherTimer <= 0) {
      env.weatherOn = !env.weatherOn;
      env.weatherTimer = env.weatherOn ? 8 + Math.random() * 8 : 14 + Math.random() * 16;
    }
  }
  weather.target = env.weatherOn ? 1 : 0;
  weather.update(dt, v, time);
  const storm = weather.type === 'sand' ? weather.intensity : 0;
  const rain = weather.type === 'rain' ? weather.intensity : 0;

  // day / night
  nightTimer = Math.max(0, nightTimer - (state === 'running' ? dt : 0));
  night += clamp((nightTimer > 0 ? 1 : 0) - night, -dt / 1.5, dt / 1.5);
  const nightSky = env.biome === 3 ? NIGHT_SKY_VOLCANO : NIGHT_SKY;
  scene.background.copy(cur.sky).lerp(RAIN_SKY, rain * 0.35).lerp(STORM_SKY, storm * 0.45).lerp(nightSky, night);
  scene.fog.color.copy(scene.background);
  scene.fog.near = lerp(40, 12, storm);
  scene.fog.far = lerp(120, 50, storm);
  groundMat.color.copy(cur.ground);
  pathMat.color.copy(cur.path);
  hemi.groundColor.copy(cur.hemiGround);
  hemi.intensity = lerp(1.7, 0.45, night) * (1 - rain * 0.2);
  hemi.color.copy(HEMI_SKY).lerp(nightSky, night * 0.3);
  sun.intensity = lerp(2.6, 0.9, night) * (1 - rain * 0.35);
  sun.color.copy(cur.sun).lerp(MOON_LIGHT, night);
  cloudMat.color.copy(cur.cloud);
  cloudMat.emissiveIntensity = lerp(0.35, 0.02, night);
  stars.material.opacity = night;
  stars.visible = night > 0.01;
  moon.material.opacity = night;
  moon.visible = night > 0.01;
  document.body.classList.toggle('night', night > 0.5 || (env.biome === 3 && night > 0.2));

  dust.update(dt, v);
  shatter.update(dt, v);
}

function landingPuff() {
  for (let i = 0; i < 8; i++)
    dust.puff(-0.6 + Math.random() * 1.2, 0.05, (Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 3, 1 + Math.random() * 1.5, (Math.random() - 0.5) * 3);
}

function shieldRescue() {
  power.shield = 0;
  sfx.shieldBreak();
  ui.toast(t('shieldSaved'), 'shield');
  player.vy = JUMP_V * 1.05;
  player.y = 0;
  player.inPit = false;
  invuln = 0.6;
}

function updatePlayer(dt) {
  if (player.onGround && overPit()) {
    player.onGround = false;
    player.inPit = true;
    player.vy = 0;
  }
  if (!player.onGround) {
    let g = GRAVITY;
    if (input.duck) g *= FAST_FALL;
    if (player.jumpReleased && !player.fullJump && player.vy > CUT_V && player.y > MIN_JUMP_H) player.vy = CUT_V;
    player.vy -= g * dt;
    player.y += player.vy * dt;
    if (player.y <= 0) {
      const holeBelow = overPit();
      if (holeBelow || (player.inPit && player.y < -0.05)) {
        // falling into a pit (or hitting its far wall after it scrolled past)
        player.inPit = true;
        if (player.y < -1.3 || !holeBelow) {
          if (power.shield > 0) shieldRescue();
          else return die(null);
        }
      } else {
        player.y = 0;
        player.vy = 0;
        player.onGround = true;
        player.inPit = false;
        player.fullJump = false;
        landingPuff();
        if (player.jumpBuffer > 0) doJump();
      }
    }
  }
  player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);
  const wasDucking = player.ducking;
  player.ducking = player.onGround && input.duck;
  if (player.ducking && !wasDucking) profile.stats.ducks++;

  dustTimer -= dt;
  if (player.onGround && dustTimer <= 0 && dt > 0) {
    dustTimer = 0.07;
    dust.puff(-0.5, 0.05, (Math.random() - 0.5) * 0.6, -speed * 0.3 - Math.random() * 2, 0.6 + Math.random(), Math.random() - 0.5);
  }
}

function animateDino(d, p, dt, moving) {
  const r = d.root;
  r.position.y = p.y;
  d.stand.visible = !p.ducking;
  d.duck.visible = !!p.ducking;
  if (moving) {
    if (p.y <= 0.001 && !p.inPit) {
      p.legPhase = (p.legPhase || 0) + dt * speed * slowK * 1.15;
      const a = Math.sin(p.legPhase) * 0.75;
      d.legs[0].rotation.z = a;
      d.legs[1].rotation.z = -a;
      r.position.y += Math.abs(Math.cos(p.legPhase)) * 0.06;
      r.rotation.z = 0;
    } else {
      d.legs[0].rotation.z = 0.5;
      d.legs[1].rotation.z = -0.25;
      r.rotation.z = clamp((p.vy || 0) * 0.008, -0.2, 0.2);
    }
  } else {
    d.legs[0].rotation.z = d.legs[1].rotation.z = 0;
    r.rotation.z = 0;
  }
}

function updateObstacles(dt, v) {
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    o.x -= (v + o.extra * slowK) * dt;
    o.root.position.x = o.x;
    if (o.wings) {
      o.flap += dt * 9;
      const a = Math.sin(o.flap) * 0.9;
      o.wings[0].pivot.rotation.x = -a;
      o.wings[1].pivot.rotation.x = a;
      o.root.position.y = o.y + Math.sin(o.flap) * 0.05;
    }
    if (o.kind === 'boulder') o.spin.rotation.z += ((v + o.extra) * dt) / BOULDER_RADIUS;
    if (o.kind === 'tumble') {
      o.phase += dt * 5.5;
      o.y = Math.abs(Math.sin(o.phase)) * 0.9;
      o.root.position.y = o.y;
      o.spin.rotation.z += ((v + o.extra) * dt) / 0.5;
    }
    if (o.kind === 'meteor' && !o.armed) {
      o.fall -= dt;
      const f = Math.max(0, o.fall);
      o.rock.position.set(f * 9, 0.4 + f * 14, f * -2);
      o.rock.rotation.x += dt * 4;
      o.warn.material.opacity = 0.35 + 0.35 * Math.sin(time * 18);
      if (f <= 0) {
        o.armed = true;
        o.warn.visible = false;
        o.rock.position.set(0, 0.32, 0);
        sfx.boom();
        shake = Math.max(shake, 0.15);
        for (let k = 0; k < 14; k++) dust.puff(o.x + (Math.random() - 0.5), 0.1, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 6, 2 + Math.random() * 3, (Math.random() - 0.5) * 6);
      }
    }
    if (o.tutorial && tutorial && !tutorial.freeze && o.x < (o.tutorial === 'jump' ? 5.2 : 6.5)) {
      tutorial.freeze = o.tutorial;
      o.tutorial = null;
      ui.tutorial(tutorial.freeze);
    }
    if (!o.passed && o.x + o.width < -1) {
      o.passed = true;
      run.obstacles++;
      profile.stats.obstacles++;
      if (o.kind === 'bird' && o.mid && player.ducking) run.ducks++;
      if (o.kind === 'meteor') {
        run.meteors++;
        profile.stats.meteors++;
      }
      if (tutorial && !tutorial.plan.length && o.kind === 'bird') {
        profile.tutorial = true;
        save();
        ui.toast(t('tutCoins'), 'gold');
        tutorial = null;
      }
    }
    if (o.x < DESPAWN_X) removeObstacle(i);
  }
  gapLeft -= v * dt;
  if (gapLeft <= 0) spawnNext();
}

function hitCheck() {
  if (invuln > 0) return;
  for (let i = 0; i < obstacles.length; i++) {
    const o = obstacles[i];
    if (o.x > 8 || o.x + o.width < -2) continue;
    if (o.kind === 'meteor' && !o.armed) continue;
    if (!o.boxes.length || !collides(o)) continue;
    if (power.shield > 0) {
      power.shield = 0;
      invuln = 0.8;
      sfx.shieldBreak();
      vibrate(40);
      shatter.burstBox(o.x - 0.3, o.x + o.width, o.y, o.y + 1.5, 40, o.burst || '#888888', 1.2);
      ui.toast(t('shieldSaved'), 'shield');
      removeObstacle(i);
      return;
    }
    die(o);
    return;
  }
}

function updatePickups(dt, v) {
  const top = player.y + (player.ducking ? 1.7 : 2.9);
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i];
    c.x -= v * dt;
    if (power.magnet > 0 && c.x < 12 && c.x > -2) {
      const dx = 0.3 - c.x;
      const dy = player.y + 1.4 - c.y;
      const d = Math.hypot(dx, dy) || 1;
      const step = Math.min(d, 22 * dt);
      c.x += (dx / d) * step;
      c.y += (dy / d) * step;
    }
    c.m.position.set(c.x, c.y, 0);
    c.m.rotation.y += dt * 4;
    if (c.x > -0.8 && c.x < 1.3 && c.y > player.y - 0.2 && c.y < top) {
      scene.remove(c.m);
      coins.splice(i, 1);
      run.coins++;
      profile.coins++;
      profile.stats.coins++;
      sfx.coin();
      ui.setRunCoins(run.coins);
    } else if (c.x < DESPAWN_X) {
      scene.remove(c.m);
      coins.splice(i, 1);
    }
  }
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    it.t += dt;
    it.x -= v * dt;
    it.m.position.set(it.x, it.y + Math.sin(it.t * 3) * 0.15, 0);
    it.m.rotation.y += dt * 2.5;
    if (it.x > -0.9 && it.x < 1.4 && it.y > player.y - 0.4 && it.y < top + 0.2) {
      scene.remove(it.m);
      items.splice(i, 1);
      power[it.type] = POWER_TIME[it.type];
      run.powerups++;
      profile.stats.powerups++;
      sfx.powerup();
      vibrate(25);
      ui.toast(t('pu_' + it.type), it.type);
    } else if (it.x < DESPAWN_X) {
      scene.remove(it.m);
      items.splice(i, 1);
    }
  }
}

function updatePowers(dt) {
  for (const k of Object.keys(power)) if (power[k] > 0) power[k] = Math.max(0, power[k] - dt);
  invuln = Math.max(0, invuln - dt);
  slowK += clamp((power.slow > 0 ? 0.6 : 1) - slowK, -dt * 2, dt * 2);
  shieldMesh.visible = power.shield > 0 && dino.root.visible;
  if (shieldMesh.visible) {
    shieldMesh.position.set(0.35, player.y + (player.ducking ? 1.0 : 1.45), 0);
    shieldMesh.rotation.y += dt;
    const blink = power.shield < 3 && Math.sin(time * 20) < 0 ? 0.3 : 1;
    shieldMesh.material.opacity = 0.28 * blink;
    shieldMesh.scale.set(player.ducking ? 1.25 : 1, player.ducking ? 0.65 : 1, 1);
  }
  ui.setPowerups(power, POWER_TIME);
}

function updateGhost(dt) {
  if (state === 'running') {
    ghostClock += dt;
    while (ghostClock >= GHOST_STEP) {
      ghostClock -= GHOST_STEP;
      if (ghostRec.length < 12000) ghostRec.push([Math.round(player.y * 100), player.ducking ? 1 : 0, Math.floor(score)]);
    }
  }
  if (!ghostDino) return;
  const smp = ghost.samples;
  const idx = Math.floor(runTime / GHOST_STEP);
  const alive = idx < smp.length;
  const s = smp[Math.min(idx, smp.length - 1)];
  const gs = alive ? s[2] : ghost.score;
  const gp = ghostDino.p || (ghostDino.p = { legPhase: 0 });
  gp.y = alive ? Math.max(0, s[0] / 100) : 0;
  gp.ducking = alive && s[1] === 1;
  gp.vy = 0;
  ghostDino.root.position.x = clamp((gs - score) / 0.75, -30, 40);
  for (const m of ghostDino.deadMeshes) m.visible = !alive;
  animateDino(ghostDino, gp, dt, alive && state === 'running');
}

// ------------------------------------------------------------------ LAN
let lan = null;
const transport = createTransport();

function myLanInfo() {
  if (!profile.name) profile.name = 'Dino-' + Math.floor(1000 + Math.random() * 9000);
  save();
  return { id: Math.random().toString(36).slice(2, 10), name: profile.name, skin: profile.skin, hat: profile.hat };
}

async function openLan() {
  if (!transport) return false;
  if (lan) return true;
  const session = new LanSession(transport, myLanInfo(), {
    rooms: (list) => ui.mpRooms(list),
    lobby: (players, isHost) => ui.mpLobby(players, isHost, session.me.id),
    start: (seed) => beginCountdown(seed),
    end: (results) => {
      const st = profile.stats;
      st.mpGames++;
      if (results.length > 1 && results[0].id === session.me.id) st.mpWins++;
      for (const a of checkAchievements()) ui.toast(t('achievementDone', { name: t('a_' + a.id), n: ACHIEVEMENT_REWARD }), 'gold');
      save();
      ui.mpResults(results, session.me.id);
    },
    error: (code) => {
      ui.toast(t(code === 'hostLost' ? 'mpHostLost' : code), 'red');
      toMenu();
    },
    closed: () => {
      ui.toast(t('mpClosed'), 'red');
      toMenu();
    },
  });
  try {
    await session.open();
  } catch (err) {
    ui.toast(t('mpPortError', { msg: (err && err.message) || String(err) }), 'red');
    return false;
  }
  lan = session;
  return true;
}

function leaveLan() {
  if (!lan) return;
  const l = lan;
  lan = null;
  l.close();
  clearRivals();
}

function beginCountdown(seed) {
  mode = 'lan';
  sfx.unlock();
  resetRun(seed);
  clearRivals();
  if (ghostDino) {
    scene.remove(ghostDino.root);
    ghostDino = null;
  }
  let lane = 0;
  for (const p of lan.lobby) {
    if (p.id === lan.me.id || lane >= RIVAL_LANES.length) continue;
    const d = createDino(SKINS[p.skin] ? p.skin : 'classic', HATS[p.hat] ? p.hat : 'none');
    const label = makeLabel(p.name);
    d.root.position.z = RIVAL_LANES[lane];
    scene.add(d.root, label);
    rivals.set(p.id, { dino: d, label, x: 0, lane: RIVAL_LANES[lane], p: { y: 0, vy: 0, ducking: false, legPhase: Math.random() * 6 } });
    lane++;
  }
  state = 'countdown';
  countdown = 3.999;
  ui.hideScreens();
  ui.setPlaying(true);
  ui.countdown('3');
  sfx.beep();
}

function updateRivals(dt) {
  if (!lan || mode !== 'lan') return;
  const states = new Map(lan.others().map((s) => [s.id, s]));
  for (const [id, r] of rivals) {
    const s = states.get(id);
    if (!s) continue;
    const tx = clamp((s.sc - score) / 0.75, -30, 40);
    r.x += (tx - r.x) * Math.min(1, dt * 8);
    const ny = r.p.y + (s.y - r.p.y) * Math.min(1, dt * 18);
    r.p.vy = (ny - r.p.y) / Math.max(dt, 0.001);
    r.p.y = ny;
    r.p.ducking = !!s.d && r.p.y < 0.05;
    r.dino.root.position.x = r.x;
    for (const m of r.dino.deadMeshes) m.visible = !s.a;
    animateDino(r.dino, r.p, dt, !!s.a && state !== 'countdown');
    r.label.position.set(r.x + 0.4, r.p.y + 3.6, r.lane);
  }
  const meAlive = state === 'running' || state === 'countdown';
  const list = [{ id: lan.me.id, name: lan.me.name, sc: Math.floor(score), a: meAlive }];
  for (const s of states.values()) list.push({ id: s.id, name: lan.nameOf(s.id), sc: s.sc, a: !!s.a });
  ui.mpHud(list.sort((a, b) => b.sc - a.sc), lan.me.id);
  if (state === 'running' || state === 'over' || state === 'dying') lan.sendState({ sc: score, y: player.y, d: player.ducking, a: state === 'running' });
}

// ------------------------------------------------------------------ main update
function update(rawDt) {
  time += rawDt;
  pollGamepad();
  let dt = rawDt;
  if (state === 'dying') {
    dt = rawDt * 0.25; // slow motion while the dino shatters
    deathTimer -= rawDt;
    if (deathTimer <= 0) finishRun();
  }
  const frozen = !!(tutorial && tutorial.freeze);
  let v = 0;
  if (state === 'running' && !frozen) {
    speed = Math.min(MAX_SPEED, speed + ACCEL * dt);
    v = speed * slowK;
    runTime += dt;
    score += v * dt * 0.75;
    run.score = score;
    const m = Math.floor(score / 100);
    if (m > lastMilestone) {
      lastMilestone = m;
      sfx.point();
      ui.flashScore();
    }
    const n = Math.floor(score / NIGHT_EVERY);
    if (n > lastNight) {
      lastNight = n;
      nightTimer = NIGHT_LEN;
    }
    const b = biomeAt(score);
    if (b !== env.biome) {
      setBiome(b, false);
      run.biome = Math.max(run.biome, Math.floor(score / BIOME_LENGTH) + 1);
      music.biome = b;
      ui.toast(t('biome_' + BIOMES[b].id), 'biome');
    }
    music.rate = 1 + ((speed - START_SPEED) / (MAX_SPEED - START_SPEED)) * 0.15;
    updatePlayer(dt);
    if (state === 'running') {
      updateObstacles(dt, v);
      updatePickups(dt, v);
      hitCheck();
    }
    updatePowers(dt);
    checkTimer -= dt;
    if (checkTimer <= 0) {
      checkTimer = 0.5;
      for (const md of checkMissions(run)) {
        sfx.reward();
        ui.toast(t('missionDone', { n: md.reward }), 'gold');
      }
    }
    ui.setScore(score);
  } else if (state === 'running' && frozen) {
    updatePlayer(0); // tutorial pause: the world waits, the player can still act
  } else if (state === 'countdown') {
    countdown -= rawDt;
    if (countdown <= 0) {
      ui.countdown(null);
      state = 'running';
      music.biome = 0;
      music.start();
      sfx.beep(true);
    } else if (String(Math.ceil(countdown)) !== ui.countdownText()) {
      ui.countdown(String(Math.ceil(countdown)));
      sfx.beep();
    }
  }

  animateDino(dino, player, dt, state === 'running' && !frozen);
  if (state === 'menu') {
    dino.root.position.y = Math.abs(Math.sin(time * 2.2)) * 0.08;
    dino.root.rotation.y = shopBlend * Math.sin(time * 0.8) * 0.6;
  } else dino.root.rotation.y = 0;
  updateGhost(dt);
  updateRivals(rawDt);
  updateWorld(dt, v);
  updateCamera(rawDt);
}

let last = performance.now();
function frame(t0) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (t0 - last) / 1000);
  last = t0;
  update(dt);
  post.render(scene, camera);
}

// ------------------------------------------------------------------ settings & UI
function applySettings() {
  const s = profile.settings;
  setLang(s.lang);
  sfx.muted = !s.sfx;
  music.setEnabled(s.music);
  if (s.music && state === 'running') music.start();
  post.setMode(s.style);
  resize();
  if (!s.ghost && ghostDino) {
    scene.remove(ghostDino.root);
    ghostDino = null;
  }
  ui.refreshTexts();
}

const game = {
  isTouch,
  isApp,
  lanAvailable: !!transport,
  profile,
  startSolo,
  toMenu,
  applySettings,
  setPaused,
  get state() {
    return state;
  },
  get mode() {
    return mode;
  },
  previewDino: rebuildDino,
  lanOpen: openLan,
  lanHost: () => lan && lan.host(),
  lanBrowse: () => lan && lan.browse(),
  lanJoin: (room) => lan && lan.join(room.addr, room.port),
  lanJoinIp: (ip) => lan && lan.join(ip.trim()),
  lanStart: () => lan && lan.startRace(),
  lanLeave: leaveLan,
  lanAddresses: () => (transport ? transport.addresses() : Promise.resolve([])),
  lanSetName(name) {
    profile.name = name.slice(0, 12) || profile.name;
    save();
    if (lan) lan.setMe({ name: profile.name });
  },
  lanSetLook() {
    if (lan) lan.setMe({ skin: profile.skin, hat: profile.hat });
  },
  get lan() {
    return lan;
  },
  unlockAudio: () => sfx.unlock(),
  sfx,
};

const ui = new UI(game);
resize();
applySettings();
ui.setHi(profile.stats.best);
ui.showMenu();
requestAnimationFrame(frame);
ui.checkUpdates();

if ('serviceWorker' in navigator && location.protocol === 'https:' && !isApp && location.hostname !== 'localhost') {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

// handy for debugging and automated tests
window.__dino = {
  get state() {
    return state;
  },
  get score() {
    return score;
  },
  set score(v) {
    score = v;
  },
  get speed() {
    return speed;
  },
  get biome() {
    return env.biome;
  },
  power,
  start: startSolo,
  player,
  obstacles,
  coins,
  items,
  profile,
  game,
  RIG,
  night: (on) => (nightTimer = on ? 999 : 0),
};
