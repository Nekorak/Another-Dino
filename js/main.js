import * as THREE from 'three';
import { VOX, voxelMaterial, rng } from './voxel.js';
import { createDino, DINO_BOXES, createPtero, createPet, boneGeometry, powerupGeometry, POWERUPS, glowMaterial, SKINS, HATS, setCustomSkin } from './models.js';
import { danceDino, THEMES, applyThemeVars } from './custom.js';
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
  earthGeometry,
} from './biomes.js';
import { Dust, Shatter, Weather, PostFX } from './effects.js';
import { Sfx } from './audio.js';
import { Music } from './music.js';
import { profile, save, loadGhost, saveGhost } from './save.js';
import { t, setLang } from './i18n.js';
import { ensureMissions, checkMissions, checkAchievements, ACHIEVEMENT_REWARD } from './missions.js';
import { powerTimeK, doubleBoneChance, powerGapK, upgradeLevel, addXp, dailyInfo, completeDaily, recordDaily, levelOf } from './progress.js';
import { createTransport } from './net.js';
import { levelDef, scoreLevel, saveLevel, BotBrain } from './modes.js';
import { Fireflies, platformGeometry, PLATFORM_W, GOLD_BONE_VALUE, goldMaterial, fishGeometry, FISH_BOX } from './extras.js';
import { Trail, Fireworks, fossilGeometry, missingFossil, addFossil, currentSeason, giveSeasonGift, seasonPropGeometry } from './collection.js';
import { LanSession } from './multiplayer.js';
import { UI } from './ui.js';
import { Recorder } from './replay.js';
import { addPassXp } from './rewards.js';
import { controlAt } from './controls.js';
import { encodeChallenge } from './transfer.js';

setCustomSkin(profile.customSkin); // the dino painted in the skin editor
const recorder = new Recorder(); // the last 10 seconds, for the replay after a game over

// ------------------------------------------------------------------ tuning
const START_SPEED = 13;
const MAX_SPEED = 28;
const ACCEL = 0.16;
const GRAVITY = 80;
const JUMP_V = 25;
const CUT_V = 9; // releasing jump early caps upward speed -> short hop
const MIN_JUMP_H = 1.5;
const FAST_FALL = 3.5;
const GLIDE_FALL = 3.2; // max falling speed while gliding
const SWIM_V = 9.5; // upward speed of one swimming stroke
const SWIM_TOP = 4.8; // the dino can't swim higher than this
const SPAWN_X = 42;
const DESPAWN_X = -16;
const NIGHT_EVERY = 700;
const NIGHT_LEN = 20;
const MINI_BOSS_EVERY = 2000; // endless modes: a short boss fight every 2000 points
const MINI_BOSS_TIME = 14;
const PIXEL_LEVELS = [110, 160, 240]; // render pixels along the short screen side
const BASE_POWER_TIME = { shield: 15, magnet: 10, slow: 6, double: 12, rocket: 5, giant: 6, rain: 6 };
const GHOST_STEP = 0.05;
const RIVAL_LANES = [-2.4, -4.8, -7.2, -9.6, -12, -14.4, -16.8]; // up to 7 other players in a LAN race
const LANES = [0, -3.2, -6.4, -9.6]; // lanes for local multiplayer and the robot rival
const REVIVE_COST = 50;
const REVIVE_TIME = 5;
const EVENT_TIME = { meteors: 8, trex: 9, bonus: 7 };

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const now = () => performance.now() / 1000;
const powerTime = () => {
  const k = powerTimeK();
  const out = {};
  for (const [id, v] of Object.entries(BASE_POWER_TIME)) out[id] = v * k;
  return out;
};

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
// one camera per player in local multiplayer (split screen)
const cams = [camera, ...[1, 2, 3].map(() => new THREE.PerspectiveCamera(40, 1, 0.1, 300))];
// Each lane's dino, obstacles and bones live on their own render layer (lane i = layer i + 1),
// so a split-screen view does not show the other players right in front of its camera.
const laneLayer = (obj, index) => obj.traverse((o) => o.layers.set(index + 1));
function setCameraLayers(count, split) {
  cams.forEach((c, i) => {
    c.layers.set(0);
    if (!split) {
      for (let k = 1; k <= 4; k++) c.layers.enable(k); // one view shows every lane
    } else {
      c.layers.enable(i + 1);
      // in two-player mode the top view also shows player 2's lane behind
      if (count === 2 && i === 0) c.layers.enable(2);
    }
  });
}
setCameraLayers(1, false);

const hemi = new THREE.HemisphereLight('#e6f6ff', '#d8b27a', 1.7);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff1d2', 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 80 });
sun.shadow.bias = -0.0015;
sun.shadow.camera.layers.enableAll();
sun.position.set(-4, 18, 12);
sun.target.position.set(6, 0, 0);
scene.add(sun, sun.target);
// the dino's lantern, used in the cave
const lanterns = [0, 1, 2, 3].map(() => {
  const l = new THREE.PointLight('#ffcf7a', 0, 18, 1.2);
  scene.add(l);
  return l;
});

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
pathTex.repeat.set(GROUND_W / (TEX * VOX), PATH_D / (TEX * VOX));
const paths = LANES.map((z) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(GROUND_W, PATH_D), pathMat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(40, 0.01, z);
  m.receiveShadow = true;
  scene.add(m);
  return m;
});
for (let i = 1; i < paths.length; i++) paths[i].visible = false;

// ocean behind the beach
const seaMat = new THREE.MeshLambertMaterial({ color: '#3f9fe0', transparent: true, opacity: 0, emissive: '#1f5fa0', emissiveIntensity: 0.3 });
const sea = new THREE.Mesh(new THREE.PlaneGeometry(GROUND_W, 60), seaMat);
sea.rotation.x = -Math.PI / 2;
sea.position.set(40, 0.04, -62);
scene.add(sea);

// ------------------------------------------------------------------ scenery
const season = currentSeason(); // halloween | christmas | newyear | null
const near = [];
const NEAR_Z = [[-22, -5], [-8, -5], [3, 9]];
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
  const sp = Math.random() < 0.22 ? seasonPropGeometry(season, p.seed + Math.floor(Math.random() * 6)) : null;
  p.mesh.geometry = sp || g.geo;
  p.mesh.material = !sp && g.glow ? glowMaterial : voxelMaterial;
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

const cloudMat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#ffffff', emissiveIntensity: 0.35, transparent: true });
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
const earth = new THREE.Mesh(earthGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, transparent: true, opacity: 0 }));
earth.position.set(20, 16, -90);
scene.add(earth);

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
const trail = new Trail(scene);
const fireworks = new Fireworks(scene);
const fireflies = new Fireflies(scene);
const flame = new Dust(scene, 40); // rocket exhaust
flame.setColor('#ff8a2a');
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
const BONUS_SKY = new THREE.Color('#ffd86a');
const SUNSET_SKY = new THREE.Color('#ff9a5a');
const SUNSET_SUN = new THREE.Color('#ffb070');
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
// biome features that fade in and out
const feat = { dark: 0, sea: 0, stars: 0, noClouds: 0, gravity: 1, jump: 1, swim: 0, water: 0 };
const env = { biome: 0, weatherOn: false, weatherTimer: 8 };

function featTarget(b) {
  return { dark: b.dark ? 1 : 0, sea: b.sea ? 1 : 0, stars: b.stars ? 1 : 0, noClouds: b.noClouds ? 1 : 0, gravity: b.gravity || 1, jump: b.jump || 1, swim: b.swim ? 1 : 0, water: b.water ? 1 : 0 };
}

function setBiome(i, instant) {
  env.biome = i;
  const b = BIOMES[i];
  dust.setColor(b.dust);
  weather.setType(b.weather);
  env.weatherOn = b.weatherAlways;
  env.weatherTimer = 14 + Math.random() * 10;
  if (instant) {
    for (const k of Object.keys(cur)) cur[k].copy(BC[i][k]);
    Object.assign(feat, featTarget(b));
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
const menuBiome = () => (THEMES[profile.theme] || THEMES.classic).biome;
setBiome(menuBiome(), true);
applyThemeVars(profile.theme);

// ------------------------------------------------------------------ materials (accessibility)
const highlightMat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#ff2a2a', emissiveIntensity: 0.45 });
const coinHighlightMat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#ffd23f', emissiveIntensity: 0.6 });
const obstacleMat = (glow) => (glow ? glowMaterial : profile.settings.highlight ? highlightMat : voxelMaterial);

// ------------------------------------------------------------------ players
function makePlayer(index, lane, skin, hat) {
  const p = {
    index,
    lane,
    skin,
    hat,
    dino: createDino(skin, hat),
    y: 0,
    vy: 0,
    onGround: true,
    ducking: false,
    legPhase: 0,
    jumpReleased: true,
    jumpBuffer: 0,
    airJumps: 0,
    inPit: false,
    fullJump: false,
    gliding: false,
    pounding: false,
    power: { shield: 0, magnet: 0, slow: 0, double: 0 },
    invuln: 0,
    input: { jump: false, duck: false },
    alive: true,
    final: 0,
    revived: false,
    bombs: 0,
    dustTimer: 0,
    shield: new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.75, 1),
      new THREE.MeshBasicMaterial({ color: '#4fc3ff', transparent: true, opacity: 0.28, depthWrite: false }),
    ),
  };
  p.dino.root.position.z = lane;
  p.shield.visible = false;
  laneLayer(p.dino.root, index);
  laneLayer(p.shield, index);
  scene.add(p.dino.root, p.shield);
  return p;
}

function removePlayer(p) {
  scene.remove(p.dino.root, p.shield);
}

const players = [makePlayer(0, 0, profile.skin, profile.hat)];
const player = players[0]; // the local player (solo, LAN, daily, and player 1 in 2P)

function rebuildDino(p, skin, hat) {
  const visible = p.dino.root.visible;
  scene.remove(p.dino.root);
  p.dino = createDino(skin, hat);
  p.dino.root.visible = visible;
  p.dino.root.position.z = p.lane;
  p.skin = skin;
  p.hat = hat;
  laneLayer(p.dino.root, p.index);
  scene.add(p.dino.root);
}

// pet that follows player 1
let pet = null;
function setPet(id) {
  if (pet) scene.remove(pet.root);
  pet = createPet(id);
  if (pet) scene.add(pet.root);
}
setPet(profile.pet);

let slowK = 1;
let speedBoost = 1;

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

// emotes float above a dino for two seconds
const emotes = [];
const emoteTex = new Map();
function emoteSprite(e) {
  if (!emoteTex.has(e)) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.font = '52px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(e, 32, 36);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    emoteTex.set(e, tex);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: emoteTex.get(e), depthWrite: false, fog: false, transparent: true }));
  s.scale.set(1.2, 1.2, 1);
  return s;
}
function showEmote(id, e) {
  const s = emoteSprite(e);
  scene.add(s);
  emotes.push({ s, id, t: 0 });
}

// ------------------------------------------------------------------ obstacles, coins, power-ups
const obstacles = [];
const coins = [];
const items = [];
let R = Math.random; // gameplay randomness (seeded in LAN races and the daily challenge)
let gapLeft = 0;
let nextPowerAt = 300;
let nextBombAt = 250;
let nextEventAt = 900;
let event = null; // { type, t }
let trex = null;
let boss = null; // adventure boss: { mesh, t, drop }
let tutorial = null;
let nextFossilAt = 600;
let nextBossAt = MINI_BOSS_EVERY;
let forceKind = null; // testing: always spawn this kind of obstacle
const weatherNotes = new Set(); // weather effects already announced this run

const boneGeo = boneGeometry();
const lanes = () => players.map((p) => p.lane);

// under the sea the flying enemies are fish
function createFish() {
  const root = new THREE.Group();
  const m = new THREE.Mesh(fishGeometry(), voxelMaterial);
  m.castShadow = true;
  root.add(m);
  return { root, wings: null, box: FISH_BOX };
}

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
    const m = new THREE.Mesh(c.geo, obstacleMat(c.glow));
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
  const b = BIOMES[env.biome].id === 'ocean' ? createFish() : createPtero();
  if (profile.settings.highlight) b.root.traverse((o) => o.isMesh && (o.material = highlightMat));
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

// a pterodactyl that swoops up and down: duck when it is high, jump when it is low
function zigBird() {
  const o = bird(1);
  o.zig = true;
  o.extra = 0;
  o.zigPh = R() * Math.PI * 2;
  return o;
}

// a cactus (or whatever grows in this world) hidden underground that shoots up when you get close
function riser(biomeId) {
  const o = groundObstacle(biomeId, true);
  o.rise = true;
  o.y = -2.6;
  return o;
}

function boulder(biomeId) {
  const root = new THREE.Group();
  const m = new THREE.Mesh(boulderGeometry(biomeId), obstacleMat(false));
  m.castShadow = true;
  m.position.y = BOULDER_RADIUS;
  root.add(m);
  const r = BOULDER_RADIUS;
  return { kind: 'boulder', root, spin: m, boxes: [{ x0: -r * 0.75, x1: r * 0.75, y0: 0, y1: r * 1.7 }], width: r * 2, y: 0, extra: 4, burst: '#8a7559' };
}

function tumbleweed() {
  const root = new THREE.Group();
  const m = new THREE.Mesh(tumbleweedGeometry(), obstacleMat(false));
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
const pitRimHiMat = new THREE.MeshBasicMaterial({ color: '#ffd23f' });
function pit() {
  const w = 1.5 + R() * 0.8;
  const root = new THREE.Group();
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(w, PATH_D + 0.4), pitMat);
  hole.rotation.x = -Math.PI / 2;
  hole.position.set(w / 2, 0.02, 0);
  root.add(hole);
  for (const x of [-0.06, w + 0.06]) {
    const rim = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, PATH_D + 0.4), profile.settings.highlight ? pitRimHiMat : pitRimMat);
    rim.position.set(x, 0.04, 0);
    rim.receiveShadow = true;
    root.add(rim);
  }
  return { kind: 'pit', root, boxes: [], width: w, y: 0, extra: 0, pit: w };
}

// a wide hole with a floating slab that bobs up and down; land on it or jump the whole hole
function platform() {
  const w = 6.2 + R() * 1.2;
  const root = new THREE.Group();
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(w, PATH_D + 0.4), pitMat);
  hole.rotation.x = -Math.PI / 2;
  hole.position.set(w / 2, 0.02, 0);
  root.add(hole);
  for (const x of [-0.06, w + 0.06]) {
    const rim = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, PATH_D + 0.4), profile.settings.highlight ? pitRimHiMat : pitRimMat);
    rim.position.set(x, 0.04, 0);
    root.add(rim);
  }
  const slab = new THREE.Mesh(platformGeometry(), voxelMaterial);
  slab.castShadow = slab.receiveShadow = true;
  const sx0 = (w - PLATFORM_W) / 2;
  slab.position.set(sx0, 1.2, 0);
  root.add(slab);
  return { kind: 'platform', root, slab, boxes: [], width: w, y: 0, extra: 0, pit: w, sx0, sx1: sx0 + PLATFORM_W, base: 1.1 + R() * 0.3, amp: 0.65, ph: R() * 6, top: 1.2 };
}

// the platform the dino is standing over (feet inside the slab's length), or null
function platformUnder(p) {
  for (const o of obstacles) if (o.kind === 'platform' && o.x + o.sx0 < 0.5 && o.x + o.sx1 > -0.4) return o;
  return null;
}

// Every obstacle is drawn once per lane (two lanes in local two-player mode);
// animated parts of the copies follow the original.
function addObstacle(o, x = SPAWN_X) {
  o.x = x;
  o.passed = false;
  o.broken = new Set();
  o.views = [o.root];
  o.root.position.set(o.x, o.y, players[0].lane);
  laneLayer(o.root, 0);
  scene.add(o.root);
  for (let i = 1; i < players.length; i++) {
    const c = o.root.clone();
    c.position.z = players[i].lane;
    laneLayer(c, i);
    scene.add(c);
    o.views.push(c);
  }
  if (o.views.length > 1) {
    const a = [];
    const b = [];
    o.root.traverse((n) => a.push(n));
    o.views[1].traverse((n) => b.push(n));
    o.pairs = a.slice(1).map((n, k) => [n, b[k + 1]]);
  }
  obstacles.push(o);
  return o;
}

function removeObstacle(i) {
  for (const v of obstacles[i].views) scene.remove(v);
  obstacles.splice(i, 1);
}

function breakObstacle(o, laneIndex, power = 1.2) {
  o.broken.add(laneIndex);
  const v = o.views[laneIndex];
  if (v) v.visible = false;
  const z = players[laneIndex] ? players[laneIndex].lane : 0;
  const pieces = [];
  for (let k = 0; k < 40; k++) pieces.push({ x: o.x - 0.2 + Math.random() * (o.width + 0.4), y: o.y + Math.random() * 1.6, z: (Math.random() - 0.5) * 0.4, color: o.burst || '#888888' });
  shatter.burst(pieces, 0, 0, z, power);
}

function syncViews(o) {
  for (let i = 1; i < o.views.length; i++) {
    const v = o.views[i];
    v.position.x = o.root.position.x;
    v.position.y = o.root.position.y;
  }
  if (o.pairs) {
    for (const [a, b] of o.pairs) {
      b.position.copy(a.position);
      b.quaternion.copy(a.quaternion);
      b.visible = a.visible;
    }
  }
}

function addCoin(x, y, vy = 0, only = null) {
  // now and then a golden bone worth ten
  const gold = !tutorial && state === 'running' && Math.random() < 0.012;
  const mat = gold ? goldMaterial : profile.settings.highlight ? coinHighlightMat : voxelMaterial;
  if (adv) adv.bonesSpawned++;
  for (const p of players) {
    if (only && p !== only) continue;
    const m = new THREE.Mesh(boneGeo, mat);
    m.castShadow = true;
    m.position.set(x, y, p.lane);
    if (gold) m.scale.setScalar(1.25);
    laneLayer(m, p.index);
    scene.add(m);
    coins.push({ m, x, y, vy, owner: p.index, gold });
  }
}

function addItem(type, x, y, fossil) {
  for (const p of players) {
    const m = new THREE.Mesh(type === 'fossil' ? fossilGeometry(fossil) : powerupGeometry(type), type === 'fossil' ? voxelMaterial : glowMaterial);
    m.position.set(x, y, p.lane);
    laneLayer(m, p.index);
    scene.add(m);
    items.push({ m, type, x, y, t: 0, owner: p.index, fossil });
  }
}

function clearTrack() {
  while (obstacles.length) removeObstacle(0);
  for (const c of coins) scene.remove(c.m);
  coins.length = 0;
  for (const it of items) scene.remove(it.m);
  items.length = 0;
}

function coinWave(x0, len) {
  const phase = R() * 6;
  for (let x = x0; x < x0 + len; x += 0.9) addCoin(x, 1.4 + Math.sin(x * 0.5 + phase) * 1.1);
}

function finishLine() {
  // a chequered arch across the track
  const root = new THREE.Group();
  const mat1 = new THREE.MeshLambertMaterial({ color: '#ffffff' });
  const mat2 = new THREE.MeshLambertMaterial({ color: '#1b1b1b' });
  for (const z of [-1.9, 1.9]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.4, 0.3), mat1);
    post.position.set(0, 2.2, z);
    root.add(post);
  }
  for (let i = 0; i < 12; i++) {
    for (let j = 0; j < 2; j++) {
      const sq = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.32), (i + j) % 2 ? mat1 : mat2);
      sq.position.set(0, 4.2 + j * 0.32, -1.76 + i * 0.32);
      root.add(sq);
    }
  }
  return { kind: 'finish', root, boxes: [], width: 0.3, y: 0, extra: 0 };
}

function spawnNext() {
  const biomeId = BIOMES[env.biome].id;
  if (adv) {
    // the finish line, then nothing more
    const toFinish = (adv.finishAt ?? adv.length) - score;
    if (adv.finishSpawned) return void (gapLeft = 50);
    if (toFinish * (4 / 3) <= SPAWN_X + 2 && (!adv.boss || adv.bossDone)) {
      adv.finishSpawned = true;
      addObstacle(finishLine(), Math.max(4, toFinish / 0.75));
      gapLeft = 50;
      return;
    }
  }
  if (boss) {
    // during a boss fight only a few small obstacles, the rocks do the rest.
    // The fight lasts a fixed time, not a distance, so it must not use the track's
    // seeded randomness (that would make the rest of a shared track different).
    const trackR = R;
    R = Math.random;
    gapLeft = speed * 2.2;
    if (R() < 0.5) addObstacle(groundObstacle(biomeId, true));
    coinWave(SPAWN_X + 4, 6);
    R = trackR;
    return;
  }
  if (event && event.type === 'bonus') {
    // bonus zone: no obstacles, just waves of bones
    coinWave(SPAWN_X, 10);
    gapLeft = 11;
    return;
  }
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
    if (event && event.type === 'meteors') opts.push(['meteor', 2.5]);
    const solidFloor = biomeId === 'space' || biomeId === 'ocean';
    if (s > 350 && !solidFloor) opts.push(['pit', 0.12]);
    // moving obstacles
    if (s > 650) opts.push(['riser', 0.12]);
    if (s > 900) opts.push(['zig', 0.1]);
    if (s > 750 && !solidFloor) opts.push(['platform', 0.07]);
    if (biomeId === 'ocean') opts.push(['bird', 0.4], ['zig', 0.25]); // fish and jellyfish
    let pick = R() * opts.reduce((a, b) => a + b[1], 0);
    let kind = forceKind || 'ground';
    if (forceKind) pick = Infinity;
    for (const [k, w] of opts) {
      if ((pick -= w) <= 0) {
        kind = k;
        break;
      }
    }
    const make = { bird: () => bird(), boulder: () => boulder(biomeId), tumble: tumbleweed, meteor, pit, ground: () => groundObstacle(biomeId), riser: () => riser(biomeId), zig: zigBird, platform };
    o = make[kind]();
  }
  addObstacle(o);
  // low gravity means longer jumps, so space gets wider gaps
  const air = feat.gravity < 1 ? 1.35 : 1;
  const gap = o.width + speed * (0.72 * air + R() * 0.85) + R() * 2 + o.extra * 0.6 + (o.tutorial ? 10 : 0);
  gapLeft = gap;

  // bones: an arc over ground obstacles and pits, or a line in the gap after
  const roll = R();
  if (o.kind === 'platform') {
    // a reward for whoever lands on the slab
    for (let x = o.sx0 + 0.3; x < o.sx1; x += 0.8) addCoin(SPAWN_X + x, o.base + o.amp + 1.3);
  } else if ((o.kind === 'ground' || o.kind === 'pit') && roll < 0.3) {
    const cx = SPAWN_X + o.width / 2;
    for (let k = -3; k <= 3; k++) addCoin(cx + k * 0.95, 1.1 + 2.6 * (1 - (k / 3.6) ** 2));
  } else if (roll < 0.65 || o.tutorial) {
    const x0 = SPAWN_X + o.width + 2.5;
    const x1 = SPAWN_X + gap - 3;
    for (let x = x0; x < x1 && x < x0 + 8; x += 0.95) addCoin(x, 0.75);
  }
  // bones up high for whoever is flying with the rocket
  if (players.some((p) => p.alive && p.power.rocket > 1)) for (let x = SPAWN_X; x < SPAWN_X + gap - 1; x += 1.2) addCoin(x, 4.4);
  // a power-up roughly every 300-600 points, floating in the gap
  if (!tutorial && rules().powerups && score > nextPowerAt && gap > o.width + 5) {
    nextPowerAt = score + (300 + R() * 300) * powerGapK();
    addItem(POWERUPS[Math.floor(R() * POWERUPS.length)], SPAWN_X + o.width + gap * 0.5, 1.1);
  } else if (!tutorial && mode !== 'lan' && !isLocal() && score > nextFossilAt && gap > o.width + 5) {
    // a rare fossil for the album
    nextFossilAt = score + 700 + R() * 600;
    const id = mode === 'challenge' ? null : missingFossil(biomeId, Math.random); // depends on the album, so not seeded
    if (id) addItem('fossil', SPAWN_X + o.width + gap * 0.5, 1.6, id);
  } else if (mode === 'lan' && lanMode === 'sabotage' && score > nextBombAt && gap > o.width + 5) {
    nextBombAt = score + 220 + R() * 120;
    addItem('bomb', SPAWN_X + o.width + gap * 0.5, 1.1);
  }
}

function collides(p, o) {
  const boxes = p.ducking ? DINO_BOXES.duck : DINO_BOXES.stand;
  const k = VOX * p.giantK; // the giant power-up makes the dino (and its hitbox) bigger
  for (const b of boxes) {
    const ax0 = b.x0 * k;
    const ax1 = b.x1 * k;
    const ay0 = p.y + b.y0 * k;
    const ay1 = p.y + b.y1 * k;
    for (const c of o.boxes) {
      if (ax0 < o.x + c.x1 && ax1 > o.x + c.x0 && ay0 < o.y + c.y1 && ay1 > o.y + c.y0) return true;
    }
  }
  return false;
}

// vertical room between the dino and an obstacle it is passing (for "perfect" jumps)
function clearance(p, o) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const c of o.boxes) {
    lo = Math.min(lo, o.y + c.y0);
    hi = Math.max(hi, o.y + c.y1);
  }
  const top = p.y + (p.ducking ? 1.7 : 2.9) * p.giantK;
  if (p.y >= hi) return p.y - hi;
  if (lo >= top) return lo - top;
  return 99;
}

// true when both feet are over a hole
function overPit() {
  for (const o of obstacles) if ((o.kind === 'pit' || o.kind === 'platform') && o.x < -0.55 && o.x + o.pit > 0.05) return true;
  return false;
}

// ------------------------------------------------------------------ state
const sfx = new Sfx();
const music = new Music(sfx);
let state = 'menu'; // menu | countdown | running | paused | dying | revive | over | spectate
let mode = 'solo'; // solo | daily | zen | hardcore | adventure | bot | local | lan
let localCount = 2;
const isLocal = () => mode === 'local';
const isSplit = () => mode === 'local' && players.length > 1;
let lanMode = 'race';
let speed = START_SPEED;
let score = 0; // distance of the world (= the score of everyone still running)
let time = 0;
let runTime = 0;
let deathTimer = 0;
let reviveTimer = 0;
let nightTimer = 0;
let night = 0;
let lastMilestone = 0;
let lastNight = 0;
let shake = 0;
let scroll = 0;
let countdown = 0;
let run = newRunStats();
let checkTimer = 0;
let daily = null;

const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const isApp = !!(window.desktop || (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()));

function newRunStats() {
  return { score: 0, jumps: 0, coins: 0, obstacles: 0, ducks: 0, powerups: 0, biome: 1, meteors: 0, perfects: 0 };
}

// gameplay rules for each mode
const RULES = {
  solo: { revive: true, powerups: true, bones: 1, missions: true, record: true },
  daily: { revive: true, powerups: true, bones: 1, missions: true, record: true },
  zen: { revive: false, powerups: true, bones: 0.25, missions: false, record: false, noDeath: true },
  hardcore: { revive: false, powerups: false, bones: 2, missions: true, record: true },
  adventure: { revive: true, powerups: true, bones: 1, missions: true, record: false },
  bot: { revive: false, powerups: true, bones: 1, missions: true, record: true },
  local: { revive: false, powerups: true, bones: 1, missions: false, record: false },
  lan: { revive: false, powerups: true, bones: 1, missions: true, record: true },
  challenge: { revive: false, powerups: true, bones: 1, missions: true, record: true },
};
const rules = () => RULES[mode] || RULES.solo;

function resetPlayer(p) {
  Object.assign(p, {
    y: 0,
    vy: 0,
    onGround: true,
    ducking: false,
    jumpBuffer: 0,
    jumpReleased: true,
    airJumps: 0,
    inPit: false,
    fullJump: false,
    gliding: false,
    pounding: false,
    invuln: 0,
    alive: true,
    final: 0,
    finalPts: 0,
    revived: false,
    bombs: 0,
    points: 0,
    chain: 0,
    slip: 0,
    giantK: 1,
    plat: null,
  });
  p.input.jump = p.input.duck = false;
  for (const k of Object.keys(p.power)) p.power[k] = 0;
  p.dino.root.visible = true;
  p.dino.root.position.set(0, 0, p.lane);
  p.dino.root.scale.setScalar(1);
  for (const m of p.dino.deadMeshes) m.visible = false;
  p.brain = mode === 'bot' && p.index === 1 ? new BotBrain(profile.settings.botLevel) : null;
}

function setPlayerCount(n) {
  while (players.length > n) removePlayer(players.pop());
  const extraSkins = ['red', 'blue', 'pink', 'gold'].filter((k) => k !== profile.skin);
  while (players.length < n) {
    const i = players.length;
    players.push(makePlayer(i, LANES[i], mode === 'bot' ? 'robot' : extraSkins[i - 1], 'none'));
  }
  // the robot always wears its own skin; local players get distinct colours
  if (players[1]) {
    const want = mode === 'bot' ? 'robot' : extraSkins[0];
    if (players[1].skin !== want) rebuildDino(players[1], want, 'none');
  }
  paths.forEach((m, i) => (m.visible = i < n));
  setCameraLayers(n, mode === 'local' && n > 1);
}

// combo multiplier: x1 .. x5, one step every 10 obstacles in a row (perfect jumps count double)
const comboMult = (p) => 1 + Math.min(4, Math.floor(p.chain / 10));

let adv = null; // adventure level being played

function resetRun(seed) {
  stopDance();
  clearTrack();
  shatter.clear();
  trail.clear();
  fireworks.clear();
  endEvent(true);
  endBoss(true);
  R = seed != null ? rng(seed) : Math.random;
  speed = adv ? adv.startSpeed : START_SPEED;
  score = 0;
  runTime = 0;
  lastMilestone = 0;
  lastNight = 0;
  nightTimer = 0;
  gapLeft = 14;
  nextPowerAt = (250 + R() * 150) * powerGapK();
  nextBombAt = 200 + R() * 100;
  nextEventAt = 900 + R() * 600;
  nextFossilAt = 350 + R() * 500;
  nextBossAt = MINI_BOSS_EVERY;
  slowK = 1;
  speedBoost = 1;
  for (const p of players) resetPlayer(p);
  if (upgradeLevel('shieldStart') && rules().powerups) for (const p of players) p.power.shield = powerTime().shield;
  run = newRunStats();
  ghostRec = [];
  ghostClock = 0;
  const startBiome = adv ? adv.world : 0;
  if (env.biome !== startBiome) setBiome(startBiome, true);
  tutorial = mode === 'solo' && !profile.tutorial ? { plan: ['cactus', 'bird'], freeze: null, done: false } : null;
  run.hadTutorial = !!tutorial;
  recorder.clear();
  weatherNotes.clear();
  ui.setRunCoins(0);
  ui.setScore(0);
  ui.setCombo(1, false);
  ui.setPowerups(player.power, powerTime());
  ui.setBombs(mode === 'lan' && lanMode === 'sabotage' ? 0 : null);
  ui.spectate(null);
  ui.advProgress(adv ? 0 : null);
  ui.bossBar(null);
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

let runSeed = 0; // every run has a seed, so any solo run can be sent as a QR challenge
let challenge = null; // { seed, score, name }: the friend's score to beat
let challengeable = null; // { seed, score } of the run that just ended
function startRun(seed) {
  runSeed = seed ?? (Math.random() * 2 ** 31) >>> 0;
  resetRun(runSeed);
  setupGhost();
  state = 'running';
  ui.hideScreens();
  ui.setPlaying(true, mode);
  music.biome = env.biome;
  music.start();
}

// m: solo | daily | zen | hardcore | adventure | bot | local
function startMode(m, opts = {}) {
  sfx.unlock();
  if (lan) leaveLan();
  mode = m;
  daily = m === 'daily' ? dailyInfo() : null;
  if (m === 'challenge') challenge = { seed: opts.seed >>> 0, score: opts.score || 0, name: opts.name || '?' };
  else challenge = null;
  challengeable = null;
  adv = m === 'adventure' ? { ...levelDef(opts.world, opts.level), bonesSpawned: 0, hits: 0, bossDone: false, finishSpawned: false } : null;
  if (m === 'local') localCount = clamp(opts.count || localCount, 2, 4);
  clearRivals();
  setPlayerCount(m === 'local' ? localCount : m === 'bot' ? 2 : 1);
  startRun(daily ? daily.seed : adv ? adv.seed : challenge ? challenge.seed : null);
  if (challenge) ui.toast(t('chBeat', { name: challenge.name, n: challenge.score }), 'gold');
  if (daily) ui.toast(t('dailyGoal', { n: daily.target }), 'gold');
  if (adv) ui.toast(t('advLevelTitle', { w: t('biome_' + adv.biome), n: adv.level + 1 }), 'biome');
  if (m === 'zen' || m === 'hardcore') ui.toast(t('mode_' + m), 'gold');
  if (m === 'bot') ui.toast(t('botStart', { lvl: t('bot_' + profile.settings.botLevel) }), 'gold');
}

const startSolo = () => startMode('solo');
const startDaily = () => startMode('daily');
const startLocal2 = (count = 2) => startMode('local', { count });

function restart() {
  if (mode === 'adventure' && adv) startMode('adventure', { world: adv.world, level: adv.level });
  else if (mode === 'lan') return;
  else startMode(mode, { count: localCount, ...(challenge || {}) });
}

function killPlayer(p, o) {
  if (rules().noDeath) return zenBump(p, o);
  p.alive = false;
  p.final = score;
  p.finalPts = p.points;
  p.shield.visible = false;
  if (o) {
    p.dino.root.visible = false;
    shatter.burst(p.dino.pieces, 0, p.y, p.lane, 1, 1.5);
  } else {
    for (const m of p.dino.deadMeshes) m.visible = true;
  }
  sfx.hit();
  vibrate([60, 40, 90]);
  shake = 0.45;
  if (mode === 'bot' && p.index === 1 && player.alive) ui.toast(t('botDown'), 'gold');
  if (players.some((q) => q.alive && !q.brain)) return; // someone (human) is still running
  state = 'dying';
  deathTimer = 0.9;
  music.stop(0.4);
}

// zen mode: nothing can stop you; a hit only breaks the obstacle and slows you down
function zenBump(p, o) {
  if (o) breakObstacle(o, p.index);
  if (p.y < 0 || p.inPit) {
    p.y = 0;
    p.vy = JUMP_V * feat.jump;
    p.inPit = false;
  }
  p.invuln = 0.6;
  p.chain = 0;
  speed = Math.max(START_SPEED, speed * 0.85);
  sfx.shieldBreak();
}

function canRevive() {
  return rules().revive && !player.revived && profile.coins >= REVIVE_COST;
}

function offerRevive() {
  state = 'revive';
  reviveTimer = REVIVE_TIME;
  ui.showRevive(REVIVE_COST, REVIVE_TIME);
}

function acceptRevive() {
  if (state !== 'revive' || profile.coins < REVIVE_COST) return;
  profile.coins -= REVIVE_COST;
  profile.stats.revives++;
  save();
  const p = player;
  p.revived = true;
  p.alive = true;
  p.chain = 0;
  if (adv) adv.hits++;
  Object.assign(p, { y: 0, vy: 0, onGround: true, inPit: false, gliding: false, pounding: false, ducking: false });
  p.dino.root.visible = true;
  for (const m of p.dino.deadMeshes) m.visible = false;
  p.invuln = 2.5;
  // clear the track around the dino so the second chance is fair
  for (let i = obstacles.length - 1; i >= 0; i--) if (obstacles[i].x < 20 && obstacles[i].kind !== 'finish') removeObstacle(i);
  gapLeft = Math.max(gapLeft, 8);
  ui.hideRevive();
  state = 'running';
  sfx.powerup();
  music.start();
}

function declineRevive() {
  if (state !== 'revive') return;
  ui.hideRevive();
  finishRun();
}

// shared bookkeeping at the end of any run; returns the numbers for the result screen
function recordRun(pts) {
  const s = Math.floor(pts);
  const st = profile.stats;
  const R2 = rules();
  st.games++;
  st.distance += s;
  st.time += Math.round(runTime);
  st.maxBiome = Math.max(st.maxBiome, run.biome - 1);
  st.perfects += run.perfects;
  st.bestCombo = Math.max(st.bestCombo, run.bestCombo || 0);
  const isRecord = R2.record && s > st.best;
  if (isRecord) st.best = s;
  if (s > 0 && R2.record) {
    profile.top.push({ s, d: Date.now(), lan: mode === 'lan', daily: mode === 'daily', mode });
    profile.top.sort((a, b) => b.s - a.s);
    profile.top.length = Math.min(profile.top.length, 10);
  }
  if (mode === 'solo' && isRecord && ghostRec.length > 20) {
    ghost = { samples: ghostRec, score: Math.floor(player.final || score), skin: profile.skin, hat: profile.hat };
    saveGhost(ghost);
  }
  if (mode === 'daily') recordDaily(s);
  run.score = s;
  const missionsDone = R2.missions ? checkMissions(run) : [];
  const xp = addXp((s / 10 + run.coins * 2 + missionsDone.length * 20) * (mode === 'zen' ? 0.5 : 1));
  addPassXp(xp.gained); // the same XP fills the season pass
  const ach = checkAchievements();
  save();
  ui.setHi(st.best);
  return { s, isRecord, missionsDone, xp, ach };
}

function celebrate({ missionsDone, xp, ach }) {
  if (missionsDone.length) sfx.reward();
  for (const l of xp.levelUps) ui.toast(t('levelUp', { n: l }), 'gold');
  for (const id of xp.unlocked) ui.toast(t('skinUnlocked', { name: t('skin_' + id) }), 'gold');
  for (const a of ach) ui.toast(t('achievementDone', { name: t('a_' + a.id), n: ACHIEVEMENT_REWARD }), 'gold');
}

function finishRun() {
  state = 'over';
  const p = player;
  const pts = isLocal() ? Math.max(...players.map((q) => (q.alive ? q.points : q.finalPts))) : p.alive ? p.points : p.finalPts;
  const res = recordRun(pts);
  let botResult = null;
  if (mode === 'bot') {
    const bot = players[1];
    const won = !bot.alive && bot.final < p.final;
    if (won) {
      const reward = 25 * (profile.settings.botLevel + 1);
      profile.coins += reward;
      profile.stats.botWins++;
      save();
      botResult = { won, reward };
    } else botResult = { won: false, reward: 0 };
  }
  // QR challenge: did we beat the friend? Any solo run (without the tutorial) can be sent on.
  let chResult = null;
  if (challenge) {
    const won = pts > challenge.score;
    chResult = { won, name: challenge.name, target: challenge.score, reward: won ? 40 : 0 };
    if (won) {
      profile.coins += 40;
      profile.stats.challengesWon = (profile.stats.challengesWon || 0) + 1;
      save();
    }
  }
  challengeable = (mode === 'solo' && !run.hadTutorial) || mode === 'challenge' ? { seed: runSeed, score: Math.floor(pts) } : null;
  music.sting();
  ui.showOver({
    challenge: chResult,
    canChallenge: !!challengeable,
    score: res.s,
    record: res.isRecord && res.s > 0,
    coins: run.coins,
    missions: res.missionsDone,
    lan: mode === 'lan',
    xp: Math.floor(res.xp.gained),
    local2: isLocal() ? players.map((q) => ({ name: 'P' + (q.index + 1), sc: Math.floor(q.alive ? q.points : q.finalPts) })) : null,
    daily: mode === 'daily' ? dailyInfo() : null,
    bot: botResult,
    mode,
  });
  celebrate(res);
  // a new record: the dino pulls itself together and dances
  if (res.isRecord && res.s > 0 && mode !== 'lan' && !isLocal()) {
    player.y = 0;
    player.inPit = false;
    startDance();
  }
  // in a LAN race, keep watching the others until everyone is out
  if (mode === 'lan' && lan && lan.others().some((r) => r.a)) {
    state = 'spectate';
    music.start();
    setTimeout(() => state === 'spectate' && ui.hideOver(), 2500); // then just watch
  }
}

// adventure: crossing the finish line
function winLevel() {
  state = 'won';
  const s = scoreLevel(adv.bonesTaken || 0, adv.bonesSpawned, adv.hits);
  const reward = saveLevel(adv.world, adv.level, s);
  if (adv.boss) profile.stats.bosses++;
  const res = recordRun(player.points);
  sfx.reward();
  music.stop(0.6);
  startDance();
  ui.showWin({ stars: s, reward, adv, coins: adv.bonesTaken || 0, spawned: adv.bonesSpawned, hits: adv.hits, xp: Math.floor(res.xp.gained) });
  celebrate(res);
}

function setPaused(on) {
  if (mode === 'lan') return;
  if (on && state === 'running') {
    state = 'paused';
    music.stop(0.1);
    ui.showPaused(true, mode);
  } else if (!on && (state === 'paused' || state === 'photo')) {
    if (state === 'photo') ui.photoMode(false);
    state = 'running';
    ui.showPaused(false);
    for (const p of players) p.input.jump = p.input.duck = false;
    music.start();
  }
}

// zen has no game over: the player ends the run from the pause screen
function endZen() {
  if (state !== 'paused') return;
  ui.showPaused(false);
  player.final = score;
  player.finalPts = player.points;
  player.alive = false;
  finishRun();
}

// the menu plays the theme's song once the audio is unlocked (after the first tap)
function menuMusic() {
  if (state !== 'menu' || !profile.settings.menuMusic || !profile.settings.music) return;
  music.biome = (THEMES[profile.theme] || THEMES.classic).song;
  music.rate = 0.92;
  music.start();
}
addEventListener('pointerdown', () => state === 'menu' && !music.playing && (sfx.unlock(), menuMusic()), { capture: true });

// ------------------------------------------------------------------ victory dance
let dance = null; // { id, t, until }
function startDance(until) {
  const d = player.dino;
  d.root.visible = true;
  for (const m of d.deadMeshes) m.visible = false;
  player.ducking = false;
  d.stand.visible = true;
  d.duck.visible = false;
  dance = { id: profile.dance, t: 0, until };
}
function stopDance() {
  if (!dance) return;
  dance = null;
  const r = player.dino.root;
  r.rotation.set(0, 0, 0);
  r.scale.setScalar(player.giantK || 1);
  r.position.x = 0;
}

function toMenu() {
  if (lan) leaveLan();
  mode = 'solo';
  state = 'menu';
  daily = null;
  adv = null;
  clearTrack();
  shatter.clear();
  trail.clear();
  fireworks.clear();
  clearRivals();
  endEvent(true);
  endBoss(true);
  if (ghostDino) scene.remove(ghostDino.root);
  ghostDino = null;
  tutorial = null;
  setPlayerCount(1);
  resetPlayer(player);
  player.shield.visible = false;
  stopDance();
  if (env.biome !== menuBiome()) setBiome(menuBiome(), true);
  music.stop(0.2);
  setTimeout(menuMusic, 300);
  ui.hideRevive();
  ui.photoMode(false);
  ui.setPlaying(false);
  ui.showMenu();
}

// ------------------------------------------------------------------ events
function startEvent() {
  const types = ['meteors', 'trex', 'bonus'];
  const type = types[Math.floor(R() * types.length)];
  event = { type, t: EVENT_TIME[type] };
  ui.toast(t('ev_' + type), type === 'bonus' ? 'gold' : 'red');
  if (type === 'trex') {
    trex = createDino('trex', 'none');
    trex.root.scale.setScalar(2.6);
    trex.root.position.set(-26, 0, -6.5);
    scene.add(trex.root);
    sfx.boom();
    shake = 0.3;
  }
}

function endEvent(silent) {
  if (event && event.type === 'trex' && trex && !silent) trex.leaving = true;
  else if (trex) {
    scene.remove(trex.root);
    trex = null;
  }
  event = null;
  speedBoost = 1;
  nextEventAt = score + 1200 + R() * 600;
}

// ------------------------------------------------------------------ adventure boss
// a giant pterodactyl that circles above the track and drops burning rocks
function startBoss(dur = adv ? adv.bossTime : MINI_BOSS_TIME) {
  const b = createPtero();
  b.root.scale.setScalar(3.4);
  b.root.position.set(30, 7, -3);
  b.root.rotation.y = 0;
  scene.add(b.root);
  boss = { ...b, t: dur, dur, drop: 1.5, phase: 0, mini: !adv };
  ui.toast(t(adv ? 'bossArrives' : 'miniBossArrives'), 'red');
  ui.bossBar(1);
  sfx.boom();
  shake = 0.4;
}

function endBoss(silent) {
  if (!boss) return;
  if (silent) {
    scene.remove(boss.root);
    boss = null;
    ui.bossBar(null);
    return;
  }
  boss.leaving = true;
}

function updateBoss(dt) {
  if (!boss) return;
  boss.phase += dt;
  const a = Math.sin(boss.phase * 7) * 0.9;
  boss.wings[0].pivot.rotation.x = -a;
  boss.wings[1].pivot.rotation.x = a;
  if (boss.leaving) {
    boss.root.position.x += dt * 18;
    boss.root.position.y += dt * 4;
    if (boss.root.position.x > 70) endBoss(true);
    return;
  }
  boss.root.position.x += (12 + Math.sin(boss.phase * 0.7) * 4 - boss.root.position.x) * Math.min(1, dt * 1.2);
  boss.root.position.y = 7 + Math.sin(boss.phase * 1.3) * 0.8;
  boss.t -= dt;
  boss.drop -= dt;
  ui.bossBar(Math.max(0, boss.t / boss.dur));
  if (boss.drop <= 0 && boss.t > 1.5) {
    boss.drop = 1.1 + Math.random() * 0.7;
    // far enough ahead that the red warning is visible before the rock lands
    addObstacle(meteor(), 32 + Math.random() * 8);
  }
  if (boss.t <= 0) {
    const mini = boss.mini;
    if (adv) adv.bossDone = true;
    endBoss(false);
    ui.bossBar(null);
    sfx.reward();
    if (mini) {
      // survived the mini-boss: a handful of bones
      nextBossAt = score + MINI_BOSS_EVERY;
      giveBone(player, 25);
      run.miniBosses = (run.miniBosses || 0) + 1;
      ui.toast(t('miniBossDone', { n: 25 }), 'gold');
    } else ui.toast(t('bossDefeated'), 'gold');
  }
}

function updateEvent(dt) {
  if (!event) {
    if (!tutorial && !adv && !boss && score > nextEventAt && (mode !== 'lan' || lanMode !== 'elimination')) startEvent();
  } else {
    event.t -= dt;
    if (event.type === 'trex') speedBoost = 1.15;
    if (event.t <= 0) endEvent(false);
  }
  if (trex) {
    const tx = trex.leaving ? -40 : -1.5;
    trex.root.position.x += (tx - trex.root.position.x) * Math.min(1, dt * (trex.leaving ? 0.8 : 1.5));
    animateDino(trex, { y: 0, ducking: false, legPhase: (trex.phase = (trex.phase || 0) + dt * 7), vy: 0 }, 0, true);
    trex.legs[0].rotation.z = Math.sin(trex.phase) * 0.7;
    trex.legs[1].rotation.z = -Math.sin(trex.phase) * 0.7;
    if (Math.sin(trex.phase) > 0.98) shake = Math.max(shake, 0.06);
    if (trex.leaving && trex.root.position.x < -36) {
      scene.remove(trex.root);
      trex = null;
    }
  }
}

// ------------------------------------------------------------------ input
function vibrate(pattern) {
  if (profile.settings.vibration && navigator.vibrate) navigator.vibrate(pattern);
}

function doJump(p) {
  p.vy = JUMP_V * feat.jump;
  p.onGround = false;
  p.plat = null;
  p.jumpReleased = !p.input.jump;
  p.jumpBuffer = 0;
  p.airJumps = 0;
  p.gliding = false;
  p.pounding = false;
  if (p === player) {
    run.jumps++;
    profile.stats.jumps++;
  }
  sfx.jump();
  for (let i = 0; i < 5; i++) dust.puff(-0.4 + Math.random() * 0.5, 0.05, p.lane + (Math.random() - 0.5) * 0.8, -speed * 0.6, 1 + Math.random() * 2, (Math.random() - 0.5) * 2);
}

function tutorialRelease(action) {
  if (tutorial && tutorial.freeze === action) {
    tutorial.freeze = null;
    ui.tutorial(null);
  }
}

function canRestart() {
  return state === 'over' && mode !== 'lan' && now() - ui.overShownAt > 0.5;
}

function jumpDown(p = player) {
  if (state === 'over') {
    if (canRestart()) restart();
    return;
  }
  if (state === 'revive') return acceptRevive();
  if (state === 'paused') return setPaused(false);
  if (state !== 'running' || !p.alive) return;
  p.input.jump = true;
  const tutorialJump = !!(tutorial && tutorial.freeze === 'jump');
  tutorialRelease('jump');
  if (p.inPit && p.y < 0) return;
  if (p.onGround && p.slip > 0) {
    p.jumpBuffer = p.slip + 0.1; // jumps as soon as the slide on the ice ends
    return;
  }
  if (feat.swim > 0.5 && !p.inPit) {
    // under the sea every tap is a stroke upwards
    p.onGround = false;
    p.plat = null;
    p.vy = Math.max(p.vy, SWIM_V);
    p.jumpReleased = true;
    p.fullJump = true;
    p.gliding = false;
    sfx.tone(520, 0.06, { to: 760, type: 'triangle', vol: 0.04 });
    for (let i = 0; i < 3; i++) dust.puff(-0.3, p.y + 0.6, p.lane + (Math.random() - 0.5) * 0.5, -speed * 0.2, 1 + Math.random(), (Math.random() - 0.5) * 1.5);
    if (p === player) {
      run.jumps++;
      profile.stats.jumps++;
    }
  } else if (p.onGround) {
    doJump(p);
    p.fullJump = tutorialJump; // a quick tap in the tutorial still clears the cactus
  } else if (p.power.double > 0 && p.airJumps === 0 && !p.inPit) {
    p.airJumps = 1;
    p.vy = JUMP_V * 0.85 * feat.jump;
    p.jumpReleased = false;
    p.gliding = false;
    sfx.doubleJump();
    for (let i = 0; i < 8; i++) dust.puff((Math.random() - 0.5) * 0.8, p.y + 0.2, p.lane + (Math.random() - 0.5) * 0.8, -speed * 0.3, -1 - Math.random(), (Math.random() - 0.5) * 3);
  } else if (!p.inPit) {
    // second press in the air: glide while the button is held
    p.gliding = true;
    p.jumpBuffer = 0.14;
  }
}
function jumpUp(p = player) {
  p.input.jump = false;
  p.jumpReleased = true;
  p.gliding = false;
}
function duckDown(p = player) {
  if (state === 'paused') return setPaused(false);
  if (state === 'revive') return declineRevive();
  if (state !== 'running' || !p.alive) return;
  p.input.duck = true;
  p.gliding = false;
  if (!p.onGround && !p.inPit && p.y > 0.6) p.pounding = true; // ground pound
  tutorialRelease('duck');
}
function duckUp(p = player) {
  p.input.duck = false;
}

const touchLayer = $('touch');
const pointers = new Map();
// which player a touch belongs to: top/bottom halves for 2 players, quarters for 3-4
function touchPlayer(x, y) {
  if (!isSplit()) return player;
  const bottom = y > innerHeight / 2;
  if (players.length === 2) return players[bottom ? 1 : 0];
  return players[(bottom ? 2 : 0) + (x > innerWidth / 2 ? 1 : 0)] || player;
}
touchLayer.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  sfx.unlock();
  if (state === 'photo') return photoPointer('down', e);
  if (state !== 'running') {
    if (state === 'paused') setPaused(false);
    else if (canRestart()) restart();
    return;
  }
  const p = touchPlayer(e.clientX, e.clientY);
  let zone;
  if (isSplit()) {
    // zones are measured inside that player's own part of the screen
    const quarter = players.length > 2;
    const localX = quarter ? (e.clientX % (innerWidth / 2)) / (innerWidth / 2) : e.clientX / innerWidth;
    const leftHalf = localX < (profile.settings.lefty ? 0.6 : 0.4);
    const duckSide = profile.settings.lefty ? !leftHalf : leftHalf;
    zone = e.pointerType !== 'mouse' && duckSide ? 'duck' : 'jump';
  } else if (e.pointerType === 'mouse') zone = 'jump';
  else {
    // the player's own layout: a movable border between the zones, or placed buttons
    zone = controlAt(e.clientX, e.clientY, profile.settings.lefty);
    if (!zone) return;
    const b = document.getElementById('ctl-' + zone);
    if (b) b.classList.add('down');
  }
  pointers.set(e.pointerId, { zone, y0: e.clientY, p, swipe: !isSplit() && profile.settings.controls.mode !== 'buttons' });
  try {
    touchLayer.setPointerCapture(e.pointerId);
  } catch {
    /* ignore */
  }
  if (zone === 'duck') duckDown(p);
  else jumpDown(p);
});
touchLayer.addEventListener('pointermove', (e) => {
  if (state === 'photo') return photoPointer('move', e);
  const q = pointers.get(e.pointerId);
  if (q && q.zone === 'jump' && q.swipe !== false && e.clientY - q.y0 > 36) {
    q.zone = 'duck';
    jumpUp(q.p);
    duckDown(q.p);
  }
});
function pointerEnd(e) {
  if (state === 'photo') photoPointer('up', e);
  const q = pointers.get(e.pointerId);
  if (!q) return;
  pointers.delete(e.pointerId);
  if ([...pointers.values()].some((o) => o.zone === q.zone && o.p === q.p)) return;
  const b = document.getElementById('ctl-' + q.zone);
  if (b) b.classList.remove('down');
  if (q.zone === 'duck') duckUp(q.p);
  else jumpUp(q.p);
}
touchLayer.addEventListener('pointerup', pointerEnd);
touchLayer.addEventListener('pointercancel', pointerEnd);
touchLayer.addEventListener('contextmenu', (e) => e.preventDefault());

// keyboard in local multiplayer: P1 W/S (or Space), P2 arrows, P3 I/K, P4 numpad 8/5
const LOCAL_KEYS = [
  { jump: ['KeyW', 'Space'], duck: ['KeyS'] },
  { jump: ['ArrowUp'], duck: ['ArrowDown'] },
  { jump: ['KeyI'], duck: ['KeyK'] },
  { jump: ['Numpad8'], duck: ['Numpad5', 'Numpad2'] },
];
function keyTarget(code) {
  const s = profile.settings;
  if (isLocal()) {
    for (let i = 0; i < players.length; i++) {
      const k = LOCAL_KEYS[i];
      if (k.jump.includes(code) || (i === 0 && code === s.keyJump)) return [players[i], 'jump'];
      if (k.duck.includes(code) || (i === 0 && code === s.keyDuck)) return [players[i], 'duck'];
    }
    return null;
  }
  if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW' || code === s.keyJump) return [player, 'jump'];
  if (code === 'ArrowDown' || code === 'KeyS' || code === s.keyDuck) return [player, 'duck'];
  return null;
}
const EMOTE_KEYS = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 };
addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (ui.capturingKey()) {
    e.preventDefault();
    ui.capturedKey(e.code);
    return;
  }
  const tgt = keyTarget(e.code);
  if (tgt) e.preventDefault();
  if (e.repeat) return;
  sfx.unlock();
  if (e.code === 'Escape' && ui.panelOpen()) return ui.closePanel();
  if (state === 'photo') {
    if (e.code === 'Escape' || e.code === 'KeyP') endPhoto();
    return;
  }
  if (state === 'menu') {
    if (!ui.panelOpen() && (e.code === 'Space' || e.code === 'Enter')) startSolo();
    return;
  }
  if (mode === 'lan' && e.code === 'KeyE') return lanAttack();
  if (mode === 'lan' && e.code in EMOTE_KEYS) return lanEmote(EMOTES[EMOTE_KEYS[e.code]]);
  if (tgt) {
    if (tgt[1] === 'jump') jumpDown(tgt[0]);
    else duckDown(tgt[0]);
  } else if (e.code === 'KeyP' || e.code === 'Escape') setPaused(state === 'running');
});
addEventListener('keyup', (e) => {
  const tgt = keyTarget(e.code);
  if (!tgt) return;
  if (tgt[1] === 'jump') jumpUp(tgt[0]);
  else duckUp(tgt[0]);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) setPaused(true);
});
addEventListener('blur', () => setPaused(true));

// gamepads: A / up = jump, B / down = duck, X = send a boulder (LAN), Start = pause.
// In local multiplayer pad 1 is player 1, pad 2 is player 2, and so on.
const padState = [{}, {}, {}, {}];
function pollGamepads() {
  const gps = navigator.getGamepads ? [...navigator.getGamepads()].filter((g) => g && g.connected) : [];
  gps.slice(0, isLocal() ? players.length : 1).forEach((gp, i) => {
    const p = isLocal() ? players[i] : player;
    if (!p) return;
    const st = padState[i];
    const b = (k) => !!(gp.buttons[k] && gp.buttons[k].pressed);
    const ay = gp.axes[1] ?? 0;
    const j = b(0) || b(12) || ay < -0.6;
    const d = b(1) || b(13) || ay > 0.6;
    const x = b(2);
    const s = b(9);
    if (j && !st.j) {
      sfx.unlock();
      if (state === 'menu' && !ui.panelOpen()) startSolo();
      else jumpDown(p);
    }
    if (!j && st.j) jumpUp(p);
    if (d && !st.d) duckDown(p);
    if (!d && st.d) duckUp(p);
    if (x && !st.x && mode === 'lan') lanAttack();
    if (s && !st.s) {
      if (state === 'running' || state === 'paused') setPaused(state === 'running');
      else if (canRestart()) restart();
    }
    Object.assign(st, { j, d, x, s });
  });
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
const camFocus = new THREE.Vector3(); // shifts the view to the player being watched (spectating)
let shopBlend = 0;
let pixelCap = 2;

function resize() {
  const w = innerWidth;
  const h = innerHeight;
  const level = Math.min(profile.settings.pixel, pixelCap);
  const scale = Math.max(1, Math.min(w, h) / PIXEL_LEVELS[level]);
  renderer.setSize(Math.round(w / scale), Math.round(h / scale), false);
  camera.aspect = w / h;
  if (isSplit()) {
    const vps = viewports(players.length, w, h);
    vps.forEach(([, , vw, vh], i) => (cams[i].aspect = vw / vh));
  }
}
addEventListener('resize', resize);

function placeCamera(cam, aspect, p, focus, dt) {
  const k = clamp((aspect - 0.7) / (1.35 - 0.7), 0, 1); // 0 = portrait, 1 = landscape
  camPos.lerpVectors(RIG.tall.pos, RIG.wide.pos, k);
  camLook.lerpVectors(RIG.tall.look, RIG.wide.look, k);
  // On less wide screens (16:9 monitors) slide the side view so the dino stays fully in frame.
  const halfW = Math.tan(THREE.MathUtils.degToRad(RIG.wide.fov / 2)) * aspect * 12.6;
  const dx = Math.min(0, halfW * 0.62 - RIG.wide.look.x) * k;
  camPos.x += dx;
  camLook.x += dx;
  let fov = lerp(RIG.tall.fov, RIG.wide.fov, k);
  if (cam === camera && shopBlend > 0) {
    const e = shopBlend * shopBlend * (3 - 2 * shopBlend);
    shopPos.lerpVectors(RIG.shopTall.pos, RIG.shopWide.pos, k);
    shopLook.lerpVectors(RIG.shopTall.look, RIG.shopWide.look, k);
    camPos.lerp(shopPos, e);
    camLook.lerp(shopLook, e);
    fov = lerp(fov, lerp(RIG.shopTall.fov, RIG.shopWide.fov, k), e);
  }
  camPos.add(focus);
  camLook.add(focus);
  const py = p && p.alive ? Math.max(0, p.y) : 0;
  camLook.y += py * 0.25;
  camPos.y += py * 0.12;
  cam.fov = fov + ((speed - START_SPEED) / (MAX_SPEED - START_SPEED)) * 5;
  if (shake > 0) {
    const s = shake * 0.6;
    camPos.x += (Math.random() - 0.5) * s;
    camPos.y += (Math.random() - 0.5) * s;
  }
  cam.position.copy(camPos);
  cam.lookAt(camLook);
  cam.updateProjectionMatrix();
}

function updateCamera(dt) {
  shopBlend += clamp((ui.panelOpen() === 'shop' ? 1 : 0) - shopBlend, -dt * 3, dt * 3);
  shake = Math.max(0, shake - dt);
  // spectating in LAN: follow the best player still running
  let fx = 0;
  let fz = 0;
  if (state === 'spectate') {
    let best = null;
    for (const r of rivals.values()) if (r.alive && (!best || r.x > best.x)) best = r;
    if (best) {
      fx = best.x;
      fz = best.lane;
      ui.spectate(best.name);
    }
  }
  camFocus.x += (fx - camFocus.x) * Math.min(1, dt * 3);
  camFocus.z += (fz - camFocus.z) * Math.min(1, dt * 3);
  if (state === 'photo') return photoCamera();
  if (isSplit()) {
    resize();
    players.forEach((p, i) => placeCamera(cams[i], cams[i].aspect, p, new THREE.Vector3(0, 0, p.lane), dt));
  } else {
    placeCamera(camera, camera.aspect, player, camFocus, dt);
  }
}

// ------------------------------------------------------------------ photo mode
// From the pause screen: drag to orbit around the dino, pinch / wheel to zoom.
const photo = { yaw: 0.5, pitch: 0.35, dist: 9, drag: null, pinch: null };
function photoCamera() {
  const target = new THREE.Vector3(0.4, Math.max(0, player.y) + 1.4, player.lane);
  const cp = Math.cos(photo.pitch);
  camera.position.set(target.x + Math.sin(photo.yaw) * cp * photo.dist, target.y + Math.sin(photo.pitch) * photo.dist, target.z + Math.cos(photo.yaw) * cp * photo.dist);
  camera.lookAt(target);
  camera.fov = 45;
  camera.updateProjectionMatrix();
}
function startPhoto() {
  if (state !== 'paused') return;
  state = 'photo';
  Object.assign(photo, { yaw: 0.6, pitch: 0.3, dist: 9 });
  ui.showPaused(false);
  ui.photoMode(true);
}
function endPhoto() {
  if (state !== 'photo') return;
  state = 'paused';
  ui.photoMode(false);
  ui.showPaused(true, mode);
}
function photoPointer(type, e) {
  if (type === 'down') photo.drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
  if (type === 'move' && photo.drag && photo.drag.id === e.pointerId) {
    photo.yaw -= (e.clientX - photo.drag.x) * 0.008;
    photo.pitch = clamp(photo.pitch + (e.clientY - photo.drag.y) * 0.006, 0.02, 1.35);
    photo.drag.x = e.clientX;
    photo.drag.y = e.clientY;
  }
  if (type === 'up') photo.drag = null;
}
addEventListener(
  'wheel',
  (e) => {
    if (state === 'photo') photo.dist = clamp(photo.dist * (e.deltaY > 0 ? 1.1 : 0.9), 3, 30);
  },
  { passive: true },
);
addEventListener('touchmove', (e) => {
  if (state !== 'photo' || e.touches.length !== 2) return;
  const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
  if (photo.pinch) photo.dist = clamp(photo.dist * (photo.pinch / d), 3, 30);
  photo.pinch = d;
});
addEventListener('touchend', () => (photo.pinch = null));

// the photo, without the HUD, with a small watermark
async function photoImage() {
  render();
  const shot = canvas.toDataURL('image/png');
  const img = new Image();
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
    img.src = shot;
  });
  const k = Math.max(1, Math.round(1200 / img.width));
  const c = document.createElement('canvas');
  c.width = img.width * k;
  c.height = img.height * k;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(img, 0, 0, c.width, c.height);
  g.font = `${Math.round(c.height / 32)}px "Press Start 2P", monospace`;
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.textAlign = 'right';
  g.fillText('ANOTHER DINO', c.width - 16, c.height - 16);
  return c.toDataURL('image/png');
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

  // colours and features drift towards the current biome
  const k = 1 - Math.exp(-dt * 0.45);
  for (const key of Object.keys(cur)) cur[key].lerp(BC[env.biome][key], k);
  const ft = featTarget(BIOMES[env.biome]);
  for (const key of Object.keys(feat)) feat[key] += (ft[key] - feat[key]) * Math.min(1, dt * 0.8);

  // weather: some biomes have it all the time, others in spells
  if (!BIOMES[env.biome].weatherAlways && state === 'running') {
    env.weatherTimer -= dt;
    if (env.weatherTimer <= 0) {
      env.weatherOn = !env.weatherOn && BIOMES[env.biome].weather !== 'none';
      env.weatherTimer = env.weatherOn ? 8 + Math.random() * 8 : 14 + Math.random() * 16;
    }
  }
  weather.target = env.weatherOn ? 1 : 0;
  weather.update(dt, v, time);
  const storm = weather.type === 'sand' ? weather.intensity : 0;
  const rain = weather.type === 'rain' ? weather.intensity : 0;
  const bonus = event && event.type === 'bonus' ? 1 : 0;
  bonusTint += (bonus - bonusTint) * Math.min(1, dt * 2);

  // day / night
  nightTimer = Math.max(0, nightTimer - (state === 'running' ? dt : 0));
  night += clamp((nightTimer > 0 ? 1 : 0) - night, -dt / 4, dt / 4); // dusk and dawn take a few seconds
  const nightSky = env.biome === 6 ? NIGHT_SKY_VOLCANO : NIGHT_SKY;
  const n = night * (1 - feat.dark) * (1 - feat.stars); // no extra night in the cave or in space
  const dusk = Math.sin(Math.PI * clamp(n, 0, 1)) * (1 - feat.stars); // orange sky on the way into the night and out of it
  scene.background.copy(cur.sky).lerp(SUNSET_SKY, dusk * 0.55).lerp(RAIN_SKY, rain * 0.35).lerp(STORM_SKY, storm * 0.45).lerp(nightSky, n * n).lerp(BONUS_SKY, bonusTint * 0.5);
  scene.fog.color.copy(scene.background);
  scene.fog.near = lerp(lerp(lerp(40, 12, storm), 8, feat.dark), 16, feat.water);
  scene.fog.far = lerp(lerp(lerp(120, 50, storm), 42, feat.dark), 70, feat.water);
  groundMat.color.copy(cur.ground);
  pathMat.color.copy(cur.path);
  hemi.groundColor.copy(cur.hemiGround);
  const dim = 1 - feat.dark * 0.82;
  hemi.intensity = lerp(1.7, 0.45, n) * (1 - rain * 0.2) * dim;
  hemi.color.copy(HEMI_SKY).lerp(nightSky, n * 0.3);
  sun.intensity = lerp(2.6, 0.9, n) * (1 - rain * 0.35) * dim;
  sun.color.copy(cur.sun).lerp(SUNSET_SUN, dusk * 0.6).lerp(MOON_LIGHT, n * n);
  fireflies.update(dt, v, BIOMES[env.biome].id === 'space' ? 0 : Math.max(clamp((n - 0.4) / 0.4, 0, 1), feat.dark * 0.8));
  cloudMat.color.copy(cur.cloud);
  cloudMat.emissiveIntensity = lerp(0.35, 0.02, n);
  cloudMat.opacity = 1 - feat.noClouds;
  for (const c of clouds) c.visible = feat.noClouds < 0.99;
  const starK = Math.max(n, feat.stars);
  stars.material.opacity = starK;
  stars.visible = starK > 0.01;
  moon.material.opacity = n;
  moon.visible = n > 0.01;
  earth.material.opacity = feat.stars;
  earth.visible = feat.stars > 0.01;
  seaMat.opacity = feat.sea * 0.92;
  sea.visible = feat.sea > 0.01;
  players.forEach((p, i) => {
    const l = lanterns[i];
    l.intensity = feat.dark * 45 * (p.alive ? 1 : 0.3);
    l.position.set(0.9, p.y + 2.6, p.lane + 1.2);
  });
  for (let i = players.length; i < lanterns.length; i++) lanterns[i].intensity = 0;
  document.body.classList.toggle('night', n > 0.5 || feat.dark > 0.5 || feat.stars > 0.5 || (env.biome === 6 && n > 0.2));

  dust.update(dt, v);
  flame.update(dt, v);
  shatter.update(dt, v);
}
let bonusTint = 0;

function landingPuff(p) {
  for (let i = 0; i < 8; i++)
    dust.puff(-0.6 + Math.random() * 1.2, p.y + 0.05, p.lane + (Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 3, 1 + Math.random() * 1.5, (Math.random() - 0.5) * 3);
}

function shieldRescue(p) {
  p.power.shield = 0;
  sfx.shieldBreak();
  ui.toast(t('shieldSaved'), 'shield');
  p.vy = JUMP_V * 1.05 * feat.jump;
  p.y = 0;
  p.inPit = false;
  p.invuln = 0.6;
}

// ground pound: landing hard breaks the obstacles right in front of the dino
function shockwave(p) {
  let broke = 0;
  for (const o of obstacles) {
    if (o.broken.has(p.index) || !['ground', 'boulder', 'tumble', 'meteor'].includes(o.kind)) continue;
    if (o.x > -0.8 && o.x < 3.4) {
      breakObstacle(o, p.index, 1.4);
      broke++;
    }
  }
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    dust.puff(Math.cos(a) * 0.4, 0.08, p.lane + Math.sin(a) * 0.4, Math.cos(a) * 7, 1.5, Math.sin(a) * 7);
  }
  shake = Math.max(shake, 0.22);
  sfx.boom();
  if (broke && p === player) {
    profile.stats.pounds += broke;
    run.obstacles += broke;
  }
}

function note(key) {
  if (weatherNotes.has(key)) return;
  weatherNotes.add(key);
  ui.toast(t(key), 'gold');
}

function land(p) {
  p.vy = 0;
  p.onGround = true;
  p.inPit = false;
  p.fullJump = false;
  p.gliding = false;
  if (p.pounding) shockwave(p);
  p.pounding = false;
  landingPuff(p);
  // snow world: icy ground, the dino slides a moment before it can jump again
  if (BIOMES[env.biome].id === 'snow') {
    p.slip = 0.2;
    note('weatherIce');
  }
  if (p.jumpBuffer > 0 && p.slip <= 0) doJump(p);
}

function updatePlayer(p, dt) {
  if (!p.alive) return;
  p.slip = Math.max(0, p.slip - dt);
  if (p.power.rocket > 0) {
    // the rocket carries the dino high above everything
    p.rocketing = true;
    p.y += (4.4 - p.y) * Math.min(1, dt * 5);
    Object.assign(p, { vy: 0, onGround: false, inPit: false, gliding: false, pounding: false, ducking: false });
    if (dt > 0) for (let k = 0; k < 2; k++) flame.puff(-0.9, p.y + 0.9, p.lane + (Math.random() - 0.5) * 0.3, -speed * 0.4 - 6, -2 - Math.random() * 2, (Math.random() - 0.5) * 1.5);
    return;
  }
  if (p.rocketing) {
    p.rocketing = false;
    p.invuln = Math.max(p.invuln, 0.8); // a moment to land safely
  }
  const giant = p.power.giant > 0;
  if (p.plat) {
    // riding the moving slab, until it slides out from under the feet
    const o = p.plat;
    if (p.onGround && obstacles.includes(o) && o.x + o.sx0 < 0.5 && o.x + o.sx1 > -0.4) p.y = o.top;
    else {
      p.plat = null;
      if (p.onGround) {
        p.onGround = false;
        p.vy = 0;
      }
    }
  }
  if (p.onGround && !p.plat && !giant && overPit()) {
    p.onGround = false;
    p.inPit = true;
    p.vy = 0;
  }
  if (!p.onGround) {
    let g = GRAVITY * feat.gravity;
    if (p.input.duck) g *= FAST_FALL;
    if (p.gliding && p.input.jump && p.vy < 0 && !p.inPit) {
      g *= 0.22;
      p.vy = Math.max(p.vy, -GLIDE_FALL);
      if (Math.random() < 0.3) dust.puff(-0.6, p.y + 1.2, p.lane + (Math.random() - 0.5) * 0.6, -speed * 0.4, 0.4, 0);
    }
    if (p.jumpReleased && !p.fullJump && p.vy > CUT_V * feat.jump && p.y > MIN_JUMP_H) p.vy = CUT_V * feat.jump;
    p.vy -= g * dt;
    if (feat.swim > 0.5) p.vy = Math.max(p.vy, p.input.duck ? -14 : -5.5); // water slows the fall
    const prevY = p.y;
    p.y += p.vy * dt;
    if (feat.swim > 0.5 && p.y > SWIM_TOP) {
      p.y = SWIM_TOP;
      p.vy = Math.min(p.vy, 0);
    }
    const pl = p.vy <= 0 && !p.inPit ? platformUnder(p) : null;
    if (pl && p.y <= pl.top && prevY >= pl.top - 0.3) {
      // landed on a moving platform (only from above)
      p.y = pl.top;
      p.plat = pl;
      land(p);
    } else if (p.y <= 0) {
      const holeBelow = !giant && overPit();
      if (holeBelow || (p.inPit && p.y < -0.05)) {
        // falling into a pit (or hitting its far wall after it scrolled past)
        p.inPit = true;
        if (p.y < -1.3 || !holeBelow) {
          if (p.power.shield > 0) shieldRescue(p);
          else return killPlayer(p, null);
        }
      } else {
        p.y = 0;
        land(p);
      }
    }
  }
  if (p.onGround && p.jumpBuffer > 0 && p.slip <= 0 && p.input.jump) doJump(p);
  p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);
  if (p.slip > 0 && dt > 0) dust.puff(0.4, 0.05, p.lane + (Math.random() - 0.5) * 0.6, -speed * 0.2, 0.3, (Math.random() - 0.5) * 2);
  const wasDucking = p.ducking;
  p.ducking = p.onGround && p.input.duck;
  if (p.ducking && !wasDucking && p === player) profile.stats.ducks++;

  p.dustTimer -= dt;
  if (p.onGround && p.dustTimer <= 0 && dt > 0) {
    p.dustTimer = p.ducking ? 0.03 : 0.07;
    // belly slide throws sparks forward, running kicks dust back
    if (p.ducking) dust.puff(0.8 + Math.random() * 0.6, 0.06, p.lane + (Math.random() - 0.5) * 0.6, -speed * 0.5, 0.8 + Math.random() * 1.5, (Math.random() - 0.5) * 2);
    else dust.puff(-0.5, 0.05, p.lane + (Math.random() - 0.5) * 0.6, -speed * 0.3 - Math.random() * 2, 0.6 + Math.random(), Math.random() - 0.5);
  }
}

function animateDino(d, p, dt, moving) {
  const r = d.root;
  r.position.y = p.y;
  d.stand.visible = !p.ducking;
  d.duck.visible = !!p.ducking;
  if (moving) {
    if ((p.onGround ?? p.y <= 0.001) && !p.inPit) {
      p.legPhase = (p.legPhase || 0) + dt * speed * slowK * 1.15;
      const a = Math.sin(p.legPhase) * 0.75;
      d.legs[0].rotation.z = a;
      d.legs[1].rotation.z = -a;
      r.position.y += Math.abs(Math.cos(p.legPhase)) * 0.06;
      r.rotation.z = 0;
    } else {
      d.legs[0].rotation.z = 0.5;
      d.legs[1].rotation.z = -0.25;
      r.rotation.z = p.gliding ? -0.12 : p.pounding ? -0.35 : clamp((p.vy || 0) * 0.008, -0.2, 0.2);
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
    if (o.zig) {
      o.zigPh += dt * 2.1;
      o.y = 2.05 + Math.sin(o.zigPh) * 1.25;
      o.root.position.y = o.y + Math.sin(o.flap) * 0.05;
    }
    if (o.rise) {
      // the ground trembles, then the obstacle shoots up
      if (o.x < 24 && !o.rumbled) {
        o.rumbled = true;
        for (let k = 0; k < 12; k++) dust.puff(o.x + Math.random() * o.width, 0.1, players[0].lane + (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 2);
      }
      if (o.x < 16 && o.y < 0) {
        o.y = Math.min(0, o.y + dt * 10);
        if (o.y === 0) sfx.tone(140, 0.12, { to: 260, vol: 0.06 });
      }
      o.root.position.y = o.y;
    }
    if (o.kind === 'platform') {
      o.ph += dt * 1.5;
      o.top = o.base + Math.sin(o.ph) * o.amp;
      o.slab.position.y = o.top;
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
    syncViews(o);
    if (o.kind === 'finish' && adv && o.x < 0.4 && player.alive && state === 'running') {
      winLevel();
      return;
    }
    // track how close each dino gets while passing the obstacle
    if (o.boxes.length && o.x < 1.4 && o.x + o.width > -0.8) {
      o.minClear = o.minClear || {};
      for (const p of players) if (p.alive && !o.broken.has(p.index)) o.minClear[p.index] = Math.min(o.minClear[p.index] ?? 99, clearance(p, o));
    }
    if (o.tutorial && tutorial && !tutorial.freeze && o.x < (o.tutorial === 'jump' ? 5.2 : 6.5)) {
      tutorial.freeze = o.tutorial;
      o.tutorial = null;
      ui.tutorial(tutorial.freeze);
    }
    if (!o.passed && o.x + o.width < -1) {
      o.passed = true;
      if (o.kind !== 'finish') {
        for (const p of players) {
          if (!p.alive || o.broken.has(p.index)) continue;
          const before = comboMult(p);
          p.chain++;
          const close = o.minClear && o.minClear[p.index] !== undefined && o.minClear[p.index] < 0.5;
          if (close) {
            p.chain += 1;
            if (p === player) {
              run.perfects++;
              ui.perfect();
            }
          }
          if (p === player) {
            run.bestCombo = Math.max(run.bestCombo || 0, comboMult(p));
            if (comboMult(p) > before) {
              sfx.point();
              ui.setCombo(comboMult(p), true);
            }
          }
        }
      }
      if (player.alive && o.kind !== 'finish') {
        run.obstacles++;
        profile.stats.obstacles++;
        if (o.kind === 'bird' && o.mid && player.ducking) run.ducks++;
        if (o.kind === 'meteor') {
          run.meteors++;
          profile.stats.meteors++;
        }
      }
      if (tutorial && !tutorial.plan.length && o.kind === 'bird') {
        profile.tutorial = true;
        save();
        ui.toast(t('tutCoins'), 'gold');
        setTimeout(() => ui.toast(t('abilitiesHint'), 'gold'), 2600);
        tutorial = null;
      }
    }
    if (o.x < DESPAWN_X) removeObstacle(i);
  }
  gapLeft -= v * dt;
  if (gapLeft <= 0) spawnNext();
}

function hitCheck(p) {
  if (!p.alive || p.invuln > 0 || p.power.rocket > 0) return;
  for (let i = 0; i < obstacles.length; i++) {
    const o = obstacles[i];
    if (o.x > 8 || o.x + o.width < -2 || o.broken.has(p.index)) continue;
    if (o.kind === 'meteor' && !o.armed) continue;
    if (!o.boxes.length || !collides(p, o)) continue;
    if (p.power.giant > 0) {
      // the giant just walks through everything
      breakObstacle(o, p.index, 1.6);
      shake = Math.max(shake, 0.15);
      sfx.boom();
      continue;
    }
    if (adv && p === player) adv.hits++;
    p.chain = 0;
    if (p === player) ui.setCombo(1, false);
    if (p.power.shield > 0) {
      p.power.shield = 0;
      p.invuln = 0.8;
      sfx.shieldBreak();
      vibrate(40);
      breakObstacle(o, p.index);
      ui.toast(t('shieldSaved'), 'shield');
      return;
    }
    killPlayer(p, o);
    return;
  }
}

function giveBone(p, value = 1) {
  let n = value * (Math.random() < doubleBoneChance() ? 2 : 1) * rules().bones;
  n = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0); // zen counts a quarter of the bones
  if (p === player || isLocal()) {
    run.coins += n;
    profile.coins += n;
    profile.stats.coins += n;
    ui.setRunCoins(run.coins);
  }
  sfx.coin();
}

function updatePickups(dt, v) {
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i];
    const p = players[c.owner];
    c.x -= v * dt;
    if (c.vy) {
      // bone rain: falling bones settle at running height
      c.y += c.vy * dt;
      if (c.y <= 0.75) {
        c.y = 0.75;
        c.vy = 0;
      }
    }
    if (p && p.alive && p.power.magnet > 0 && c.x < 12 && c.x > -2) {
      const dx = 0.3 - c.x;
      const dy = p.y + 1.4 - c.y;
      const d = Math.hypot(dx, dy) || 1;
      const step = Math.min(d, 22 * dt);
      c.x += (dx / d) * step;
      c.y += (dy / d) * step;
    }
    c.m.position.set(c.x, c.y, p ? p.lane : 0);
    c.m.rotation.y += dt * (c.gold ? 7 : 4);
    // the baby pterodactyl catches bones a bit above and ahead of the dino
    const reach = p === player && pet && pet.kind === 'ptera' ? 1.4 : 0;
    const top = p ? p.y + (p.ducking ? 1.7 : 2.9) * p.giantK + reach : 0;
    const front = 1.3 * (p ? p.giantK : 1);
    if (p && p.alive && state === 'running' && c.x > -0.8 && c.x < front + reach * 0.4 && c.y > p.y - 0.2 && c.y < top) {
      scene.remove(c.m);
      coins.splice(i, 1);
      if (adv && p === player) adv.bonesTaken = (adv.bonesTaken || 0) + 1;
      if (c.gold) {
        giveBone(p, GOLD_BONE_VALUE);
        if (p === player) {
          run.goldBones = (run.goldBones || 0) + 1;
          profile.stats.goldBones = (profile.stats.goldBones || 0) + 1;
          ui.toast(t('goldBone', { n: GOLD_BONE_VALUE }), 'gold');
          sfx.reward();
        }
        for (let k = 0; k < 10; k++) dust.puff(0.3, c.y, p.lane, (Math.random() - 0.5) * 6, Math.random() * 4, (Math.random() - 0.5) * 4);
      } else giveBone(p);
    } else if (c.x < DESPAWN_X) {
      scene.remove(c.m);
      coins.splice(i, 1);
    }
  }
  const pt = powerTime();
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    const p = players[it.owner];
    it.t += dt;
    it.x -= v * dt;
    it.m.position.set(it.x, it.y + Math.sin(it.t * 3) * 0.15, p ? p.lane : 0);
    it.m.rotation.y += dt * 2.5;
    const top = p ? p.y + (p.ducking ? 1.7 : 2.9) * p.giantK : 0;
    if (p && p.alive && state === 'running' && it.x > -0.9 && it.x < 1.4 * p.giantK && it.y > p.y - 0.4 && it.y < top + 0.2) {
      scene.remove(it.m);
      items.splice(i, 1);
      if (it.type === 'fossil') {
        if (p !== player) continue;
        const r = addFossil(it.fossil);
        sfx.reward();
        ui.toast(t('fossilFound', { name: t('fossil_' + it.fossil.split('-')[1]), world: t('biome_' + it.fossil.split('-')[0]) }), 'gold');
        if (r.worldDone) ui.toast(t('fossilWorldDone', { n: 100 }), 'gold');
        if (r.allDone) ui.toast(t('skinUnlocked', { name: t('skin_fossil') }), 'gold');
        continue;
      }
      if (it.type === 'bomb') {
        p.bombs = Math.min(3, p.bombs + 1);
        ui.setBombs(p.bombs);
        sfx.powerup();
        continue;
      }
      p.power[it.type] = pt[it.type];
      if (p === player) {
        run.powerups++;
        profile.stats.powerups++;
      }
      sfx.powerup();
      vibrate(25);
      ui.toast((isLocal() ? 'P' + (p.index + 1) + ': ' : '') + t('pu_' + it.type), it.type);
    } else if (it.x < DESPAWN_X) {
      scene.remove(it.m);
      items.splice(i, 1);
    }
  }
}

function updatePowers(dt) {
  let slow = false;
  for (const p of players) {
    for (const k of Object.keys(p.power)) if (p.power[k] > 0) p.power[k] = Math.max(0, p.power[k] - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    if (p.alive && p.power.slow > 0) slow = true;
    p.shield.visible = p.power.shield > 0 && p.dino.root.visible && p.alive;
    if (p.shield.visible) {
      p.shield.position.set(0.35, p.y + (p.ducking ? 1.0 : 1.45), p.lane);
      p.shield.rotation.y += dt;
      const blink = p.power.shield < 3 && Math.sin(time * 20) < 0 ? 0.3 : 1;
      p.shield.material.opacity = 0.28 * blink;
      p.shield.scale.set(p.ducking ? 1.25 : 1, p.ducking ? 0.65 : 1, 1);
    }
    // giant: grow and shrink smoothly
    const gk = p.power.giant > 0 ? 1.8 : 1;
    p.giantK += (gk - p.giantK) * Math.min(1, dt * 4);
    p.dino.root.scale.setScalar(p.giantK);
    // bone rain: bones fall from the sky just ahead of the dino
    if (p.alive && p.power.rain > 0 && dt > 0) {
      p.rainT = (p.rainT || 0) - dt;
      if (p.rainT <= 0) {
        p.rainT = 0.12;
        addCoin(3 + Math.random() * 13, 9, -7, p);
      }
    }
    // blink while invulnerable after a second chance
    if (p.alive && p.revived && p.invuln > 0) p.dino.root.visible = Math.sin(time * 30) > -0.3;
    else if (p.alive) p.dino.root.visible = true;
  }
  slowK += clamp((slow ? 0.6 : 1) - slowK, -dt * 2, dt * 2);
  ui.setPowerups(player.power, powerTime());
}

function updatePet(dt) {
  if (!pet) return;
  const p = player;
  const tt = time;
  if (pet.kind === 'ptera') {
    pet.root.position.set(-0.6 + Math.sin(tt * 1.3) * 0.3, Math.max(0, p.y) + 3.4 + Math.sin(tt * 3) * 0.2, p.lane + 0.9);
    const a = Math.sin(tt * 12) * 0.9;
    pet.wings[0].pivot.rotation.x = -a;
    pet.wings[1].pivot.rotation.x = a;
    pet.root.rotation.y = Math.PI; // faces the same way as the dino
  } else {
    const hop = pet.kind === 'chick' ? Math.abs(Math.sin(tt * 10)) * 0.25 : 0;
    pet.root.position.set(pet.kind === 'turtle' ? -1.9 : -1.4, hop, p.lane + 1.1);
    pet.root.rotation.z = pet.kind === 'turtle' ? Math.sin(tt * 8) * 0.05 : 0;
  }
  pet.root.visible = p.dino.root.visible || state === 'menu';
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

function updateEmotes(dt) {
  for (let i = emotes.length - 1; i >= 0; i--) {
    const em = emotes[i];
    em.t += dt;
    let x = 0.4;
    let y = player.y + 3.6;
    let z = player.lane;
    if (lan && em.id !== lan.me.id) {
      const r = rivals.get(em.id);
      if (!r) {
        em.t = 9;
      } else {
        x = r.x + 0.4;
        y = r.p.y + 4.3;
        z = r.lane;
      }
    }
    em.s.position.set(x, y + em.t * 0.6, z);
    em.s.material.opacity = Math.max(0, 1 - Math.max(0, em.t - 1.4) / 0.6);
    if (em.t > 2) {
      scene.remove(em.s);
      emotes.splice(i, 1);
    }
  }
}

// ------------------------------------------------------------------ seasons
// New Year (and Christmas nights): fireworks over the track
let fireworkT = 2;
function updateSeason(dt) {
  fireworks.update(dt);
  if (!season || state === 'menu' || state === 'photo') return;
  const show = season === 'newyear' || (season === 'christmas' && night > 0.5);
  if (!show) return;
  fireworkT -= dt;
  if (fireworkT > 0) return;
  fireworkT = 1.2 + Math.random() * 1.8;
  fireworks.burst(isSplit() ? cams[0] : camera);
  sfx.tone(180 + Math.random() * 120, 0.25, { to: 60, type: 'triangle', vol: 0.05 });
}

// ------------------------------------------------------------------ LAN
let lan = null;
const transport = createTransport();
const EMOTES = ['😂', '🔥', '👋', '😱'];

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
    lobby: (list, isHost) => ui.mpLobby(list, isHost, session.me.id, session.mode),
    start: (seed, m) => beginCountdown(seed, m),
    end: (results, tour) => {
      const st = profile.stats;
      if (tour && tour.done && tour.table.length > 1 && tour.table[0].id === session.me.id) {
        st.tournaments = (st.tournaments || 0) + 1;
        profile.coins += 150;
        ui.toast(t('tourBonus', { n: 150 }), 'gold');
      }
      st.mpGames++;
      const won = results.length > 1 && results[0].id === session.me.id;
      if (won) st.mpWins++;
      if (won && lanMode === 'elimination') {
        profile.coins += 100;
        ui.toast(t('elimBonus', { n: 100 }), 'gold');
      }
      for (const a of checkAchievements()) ui.toast(t('achievementDone', { name: t('a_' + a.id), n: ACHIEVEMENT_REWARD }), 'gold');
      save();
      if (state === 'spectate') state = 'over';
      ui.spectate(null);
      music.stop(0.3);
      ui.mpResults(results, session.me.id, tour);
    },
    attack: (by) => {
      if (state !== 'running' || mode !== 'lan') return;
      addObstacle(boulder(BIOMES[env.biome].id), 34);
      ui.toast(t('mpAttacked', { name: session.nameOf(by) }), 'red');
      sfx.boom();
    },
    emote: (id, e) => showEmote(id, e),
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

function lanAttack() {
  if (!lan || mode !== 'lan' || lanMode !== 'sabotage' || state !== 'running' || player.bombs <= 0) return;
  player.bombs--;
  ui.setBombs(player.bombs);
  lan.attack();
  ui.toast(t('mpAttackSent'), 'gold');
}

function lanEmote(e) {
  if (!lan || mode !== 'lan') return;
  lan.emote(e);
}

function beginCountdown(seed, m) {
  mode = 'lan';
  lanMode = m || 'race';
  daily = null;
  sfx.unlock();
  setPlayerCount(1);
  resetRun(seed);
  clearRivals();
  if (ghostDino) {
    scene.remove(ghostDino.root);
    ghostDino = null;
  }
  let lane = 0;
  for (const p of lan.lobby) {
    if (p.id === lan.me.id || lane >= RIVAL_LANES.length) continue;
    const d = createDino(SKINS[p.skin] && p.skin !== 'custom' ? p.skin : 'classic', HATS[p.hat] ? p.hat : 'none');
    const label = makeLabel(p.name);
    d.root.position.z = RIVAL_LANES[lane];
    scene.add(d.root, label);
    rivals.set(p.id, { dino: d, label, name: p.name, x: 0, lane: RIVAL_LANES[lane], alive: true, p: { y: 0, vy: 0, ducking: false, legPhase: Math.random() * 6 } });
    lane++;
  }
  state = 'countdown';
  countdown = 3.999;
  ui.hideScreens();
  ui.setPlaying(true, 'lan', lanMode);
  ui.countdown('3');
  ui.toast(t('lanMode_' + lanMode), 'gold');
  sfx.beep();
}

function updateRivals(dt) {
  if (!lan || mode !== 'lan') return;
  const states = new Map(lan.others().map((s) => [s.id, s]));
  for (const [id, r] of rivals) {
    const s = states.get(id);
    if (!s) continue;
    r.alive = !!s.a;
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
  const meAlive = player.alive && (state === 'running' || state === 'countdown');
  const mine = meAlive ? score : player.final;
  const myPts = meAlive ? player.points : player.finalPts;
  // the scoreboard shows points (with combos); positions on the track use distance
  const list = [{ id: lan.me.id, name: lan.me.name, sc: Math.floor(myPts), a: meAlive }];
  for (const s of states.values()) list.push({ id: s.id, name: lan.nameOf(s.id), sc: s.pt ?? s.sc, a: !!s.a });
  ui.mpHud(list.sort((a, b) => b.sc - a.sc), lan.me.id);
  if (['running', 'over', 'dying', 'spectate'].includes(state)) lan.sendState({ sc: mine, pt: myPts, y: player.alive ? player.y : 0, d: player.ducking, a: meAlive });
  // my own dino stays where it fell while the camera follows the others
  if (!player.alive) player.dino.root.position.x = clamp((player.final - score) / 0.75, -30, 40);
}

// ------------------------------------------------------------------ quality
// 2 = high, 1 = medium, 0 = low. "Auto" starts high and steps down when the frame rate drops.
let quality = 2;
const fps = { frames: 0, t: 0 };
function applyQuality() {
  const q = profile.settings.quality === 'auto' ? quality : { high: 2, medium: 1, low: 0 }[profile.settings.quality] ?? 2;
  sun.castShadow = q > 0;
  const size = q === 2 ? 1024 : 512;
  if (sun.shadow.mapSize.x !== size) {
    sun.shadow.mapSize.set(size, size);
    if (sun.shadow.map) {
      sun.shadow.map.dispose();
      sun.shadow.map = null;
    }
  }
  weather.setDensity([0.3, 0.6, 1][q]);
  near.forEach((p, i) => (p.mesh.visible = q === 2 || i % (q === 1 ? 3 : 2) !== 0));
  pixelCap = q === 0 ? 0 : 2;
  resize();
}
function trackFps(dt) {
  if (profile.settings.quality !== 'auto' || state !== 'running' || quality === 0) return;
  fps.frames++;
  fps.t += dt;
  if (fps.t >= 4) {
    if (fps.frames / fps.t < 40) {
      quality--;
      applyQuality();
    }
    fps.frames = 0;
    fps.t = 0;
  }
}

// ------------------------------------------------------------------ main update
// the computer rival presses and releases buttons like a player would
function driveBot(p) {
  if (!p.brain || !p.alive) return;
  const want = p.brain.think(p, obstacles, speed);
  if (want === 'jump' && !p.input.jump && p.onGround) jumpDown(p);
  if (want !== 'jump' && p.input.jump && p.vy < 6) jumpUp(p);
  if (want === 'duck' && !p.input.duck) duckDown(p);
  if (want !== 'duck' && p.input.duck) duckUp(p);
}

function update(rawDt) {
  time += rawDt;
  pollGamepads();
  trackFps(rawDt);
  let dt = rawDt;
  if (state === 'dying') {
    dt = rawDt * 0.25; // slow motion while the dino shatters
    deathTimer -= rawDt;
    if (deathTimer <= 0) {
      if (canRevive()) offerRevive();
      else finishRun();
    }
  }
  if (state === 'revive') {
    reviveTimer -= rawDt;
    ui.reviveTick(Math.ceil(reviveTimer));
    if (reviveTimer <= 0) declineRevive();
  }
  const frozen = !!(tutorial && tutorial.freeze);
  let v = 0;
  const live = state === 'running' || state === 'spectate';
  if (live && !frozen) {
    const accel = mode === 'lan' && lanMode === 'elimination' ? ACCEL * 2.5 : ACCEL;
    speed = Math.min(MAX_SPEED, speed + accel * dt);
    // sandstorm: gusts of wind push the world faster and slower
    const storm = weather.type === 'sand' ? weather.intensity : 0;
    if (storm > 0.5) note('weatherWind');
    if (feat.swim > 0.5 && state === 'running') note('swimHint');
    const gust = 1 + storm * 0.14 * Math.sin(time * 1.7);
    v = speed * slowK * speedBoost * gust;
    runTime += dt;
    const ds = v * dt * 0.75;
    score += ds;
    for (const p of players) if (p.alive) p.points += ds * comboMult(p);
    if (player.alive) run.score = player.points;
    const m = Math.floor(score / 100);
    if (m > lastMilestone) {
      lastMilestone = m;
      if (state === 'running') {
        sfx.point();
        ui.flashScore();
        if (pet && pet.kind === 'turtle' && player.alive) giveBone(player); // the turtle brings a bone every 100 points
      }
    }
    const n = Math.floor(score / NIGHT_EVERY);
    if (n > lastNight) {
      lastNight = n;
      nightTimer = NIGHT_LEN;
    }
    // adventure levels stay in their world; the endless modes move on every 1000 points
    const b = adv ? adv.world : biomeAt(score);
    if (b !== env.biome) {
      setBiome(b, false);
      run.biome = Math.max(run.biome, Math.floor(score / BIOME_LENGTH) + 1);
      music.biome = b;
      ui.toast(t('biome_' + BIOMES[b].id), 'biome');
    }
    if (adv) {
      if (adv.boss && !boss && !adv.bossDone && score >= adv.bossAt) startBoss();
      if (adv.bossDone && adv.finishAt == null) adv.finishAt = score + 160;
      const total = adv.boss ? (adv.finishAt ?? adv.length) : adv.length;
      ui.advProgress(clamp(score / total, 0, 1));
    } else if (!boss && !event && !tutorial && mode !== 'lan' && score >= nextBossAt && state === 'running') startBoss();
    updateBoss(dt);
    if (daily && player.alive && player.points >= daily.target && !daily.rewarded) {
      daily.rewarded = true;
      const reward = completeDaily();
      if (reward) {
        sfx.reward();
        ui.toast(t('dailyDone', { n: reward }), 'gold');
      }
    }
    music.rate = 1 + ((speed - START_SPEED) / (MAX_SPEED - START_SPEED)) * 0.15;
    updateEvent(dt);
    for (const p of players) driveBot(p);
    for (const p of players) updatePlayer(p, dt);
    updateObstacles(dt, v);
    updatePickups(dt, v);
    if (state === 'running') for (const p of players) hitCheck(p);
    updatePowers(dt);
    checkTimer -= dt;
    if (checkTimer <= 0 && player.alive && rules().missions) {
      checkTimer = 0.5;
      for (const md of checkMissions(run)) {
        sfx.reward();
        ui.toast(t('missionDone', { n: md.reward }), 'gold');
      }
    }
    ui.setScore(player.alive ? player.points : player.finalPts);
    ui.setCombo(comboMult(player), false);
    if (challenge)
      ui.mpHud(
        [
          { id: 'ch', name: challenge.name, sc: challenge.score, a: true },
          { id: 'me', name: profile.name || 'Dino', sc: Math.floor(player.alive ? player.points : player.finalPts), a: player.alive },
        ].sort((a, b) => b.sc - a.sc),
        'me',
      );
    else if (isLocal() || mode === 'bot')
      ui.mpHud(
        players.map((p) => ({ id: 'p' + p.index, name: p.brain ? t('botName') : 'P' + (p.index + 1), sc: Math.floor(p.alive ? p.points : p.finalPts), a: p.alive })),
        'p0',
      );
  } else if (state === 'running' && frozen) {
    updatePlayer(player, 0); // tutorial pause: the world waits, the player can still act
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

  for (const p of players) {
    if (p.alive || state === 'menu') animateDino(p.dino, p, dt, live && !frozen && p.alive);
    // a fallen dino stays where it fell while the world keeps moving for the others
    else if (mode !== 'lan') p.dino.root.position.x = clamp((p.final - score) / 0.75, -30, 40);
  }
  if (state === 'menu') {
    player.dino.root.position.y = Math.abs(Math.sin(time * 2.2)) * 0.08;
    player.dino.root.rotation.y = shopBlend * Math.sin(time * 0.8) * 0.6;
  } else player.dino.root.rotation.y = 0;
  if (dance) {
    dance.t += rawDt;
    danceDino(player.dino, dance.id, dance.t);
    if (dance.until && dance.t > dance.until) stopDance();
  }
  // the trail streams from the tail of player 1
  const tp = player;
  trail.update(dt, profile.trail, -1.3 * tp.giantK, tp.y + 1.2 * tp.giantK, tp.lane, v, live && tp.alive && !frozen && tp.dino.root.visible);
  updatePet(dt);
  updateGhost(dt);
  updateRivals(rawDt);
  updateEmotes(rawDt);
  updateSeason(rawDt);
  updateWorld(dt, v);
  updateCamera(rawDt);
}

// viewports for split screen: 2 players stacked, 3-4 players in a 2x2 grid
function viewports(n, w, h) {
  if (n === 2) {
    const hh = Math.floor(h / 2);
    return [
      [0, h - hh, w, hh],
      [0, 0, w, h - hh],
    ];
  }
  const hw = Math.floor(w / 2);
  const hh = Math.floor(h / 2);
  return [
    [0, h - hh, hw, hh],
    [hw, h - hh, w - hw, hh],
    [0, 0, hw, h - hh],
    [hw, 0, w - hw, h - hh],
  ].slice(0, n);
}

function render() {
  if (isSplit()) {
    const size = renderer.getSize(new THREE.Vector2());
    const vps = viewports(players.length, size.x, size.y);
    renderer.setScissorTest(true);
    if (players.length === 3) {
      // the empty quarter just shows the sky colour
      renderer.setViewport(0, 0, size.x, size.y);
      renderer.setScissor(Math.floor(size.x / 2), 0, size.x, Math.floor(size.y / 2));
      renderer.setClearColor(scene.background);
      renderer.clear();
    }
    vps.forEach(([x, y, w, h], i) => {
      renderer.setViewport(x, y, w, h);
      renderer.setScissor(x, y, w, h);
      renderer.render(scene, cams[i]);
    });
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, size.x, size.y);
    return;
  }
  post.render(scene, camera);
}

let last = performance.now();
function frame(t0) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (t0 - last) / 1000);
  last = t0;
  update(dt);
  render();
  // keep recording a moment after the crash so the replay shows it
  if (state === 'running' || state === 'dying' || state === 'won') recorder.capture(canvas, dt, player.alive ? player.points : player.finalPts);
}

// ------------------------------------------------------------------ share the record
// Renders the current frame and lays the score over it, as a PNG data URL.
async function recordImage(scoreValue) {
  render();
  const shot = canvas.toDataURL('image/png');
  const img = new Image();
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
    img.src = shot;
  });
  const W = 1200;
  const H = 630;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  const k = Math.max(W / img.width, H / img.height);
  g.drawImage(img, (W - img.width * k) / 2, (H - img.height * k) / 2, img.width * k, img.height * k);
  g.fillStyle = 'rgba(20, 16, 10, 0.55)';
  g.fillRect(0, H - 190, W, 190);
  g.fillRect(0, 0, W, 90);
  g.fillStyle = '#ffffff';
  g.textBaseline = 'middle';
  g.font = '34px "Press Start 2P", monospace';
  g.fillText('ANOTHER DINO', 32, 46);
  g.font = '20px "Press Start 2P", monospace';
  g.textAlign = 'right';
  g.fillText(t('levelShort', { n: levelOf() }), W - 32, 46);
  g.textAlign = 'left';
  g.fillStyle = '#ffd23f';
  g.font = '64px "Press Start 2P", monospace';
  g.fillText(String(Math.floor(scoreValue)).padStart(5, '0'), 32, H - 112);
  g.fillStyle = '#ffffff';
  g.font = '20px "Press Start 2P", monospace';
  g.fillText(t('shareLine', { world: t('biome_' + BIOMES[env.biome].id) }), 32, H - 44);
  return c.toDataURL('image/png');
}

// ------------------------------------------------------------------ settings & UI
function applySettings() {
  const s = profile.settings;
  setLang(s.lang);
  sfx.muted = !s.sfx;
  music.setEnabled(s.music);
  if (s.music && state === 'running') music.start();
  post.setMode(s.style);
  document.body.classList.toggle('big-text', !!s.bigText);
  if (s.quality !== 'auto') quality = 2;
  applyQuality();
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
  emotes: EMOTES,
  startSolo,
  startDaily,
  startLocal2,
  toMenu,
  applySettings,
  setPaused,
  acceptRevive,
  declineRevive,
  restart,
  get state() {
    return state;
  },
  get mode() {
    return mode;
  },
  previewDance: (id) => {
    if (state !== 'menu') return;
    startDance(3.2);
    dance.id = id;
  },
  applyTheme: (id) => {
    applyThemeVars(id);
    const th = THEMES[id] || THEMES.classic;
    if (state === 'menu') {
      if (env.biome !== th.biome) setBiome(th.biome, false);
      music.biome = th.song;
    }
  },
  setCustomSkin: (def) => setCustomSkin(def),
  menuMusic: () => (profile.settings.menuMusic ? menuMusic() : state === 'menu' && music.stop(0.2)),
  previewDino: (skin, hat, petId) => {
    rebuildDino(player, skin, hat);
    if (petId !== undefined && petId !== null) setPet(petId);
  },
  recordImage: () => recordImage(isLocal() ? Math.max(...players.map((q) => (q.alive ? q.points : q.finalPts))) : player.alive ? player.points : player.finalPts),
  photoImage,
  replay: recorder,
  challengeCode: () => (challengeable ? encodeChallenge({ seed: challengeable.seed, score: challengeable.score, name: profile.name || 'Dino', skin: profile.skin }) : null),
  startPhoto,
  endPhoto,
  endZen,
  startMode,
  get adv() {
    return adv;
  },
  get transport() {
    return transport;
  },
  get season() {
    return season;
  },
  setTrail: () => {},
  lanOpen: openLan,
  lanHost: () => lan && lan.host(),
  lanBrowse: () => lan && lan.browse(),
  lanJoin: (room) => lan && lan.join(room.addr, room.port),
  lanJoinIp: (ip) => lan && lan.join(ip.trim()),
  lanStart: () => lan && lan.startRace(),
  lanSetMode: (m) => lan && lan.setMode(m),
  lanAttack,
  lanEmote,
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
// seasonal event: a free hat and a greeting
if (season) {
  const gift = giveSeasonGift(season);
  setTimeout(() => {
    ui.toast(t('season_' + season), 'gold');
    if (gift) ui.toast(t('seasonGift', { name: t('hat_' + gift) }), 'gold');
  }, 900);
}

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
  get event() {
    return event;
  },
  get power() {
    return player.power;
  },
  get quality() {
    return quality;
  },
  start: startSolo,
  startDaily,
  startLocal2,
  startEvent,
  startMode,
  get adv() {
    return adv;
  },
  get boss() {
    return boss;
  },
  player,
  players,
  obstacles,
  coins,
  items,
  profile,
  game,
  RIG,
  night: (on) => (nightTimer = on ? 999 : 0),
  force: (k) => (forceKind = k),
  set nextBossAt(v) {
    nextBossAt = v;
  },
};
