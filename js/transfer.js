// Moving progress between devices without a server.
// The progress is written as a readable list of variables, for example
//   ANOTHERDINO;v=1;bones=540;xp=1903;skins=classic,red;hats=none,party;...;sum=1a2b3c4d
// That text is shown as a QR code (scan it with the other device's camera), can be
// copied and pasted, or is sent over the local network (Wi-Fi / hotspot) with a PIN.
import { profile, save } from './save.js';
import { SKINS, HATS, PETS } from './models.js';
import { TRAILS, allFossils } from './collection.js';
import { ACHIEVEMENTS } from './missions.js';
import { UPGRADES } from './progress.js';
import qrcode from 'qrcode';

const HEADER = 'ANOTHERDINO';
const STAT_KEYS = [
  'games', 'distance', 'jumps', 'ducks', 'coins', 'best', 'time', 'powerups', 'obstacles', 'meteors', 'maxBiome',
  'mpGames', 'mpWins', 'revives', 'dailies', 'pounds', 'eggs', 'perfects', 'bestCombo', 'botWins', 'bosses',
];

function fnv(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// fossils as a bit string in hex (24 fossils -> 6 hex digits)
function fossilsToHex() {
  const ids = allFossils();
  let bits = '';
  for (const id of ids) bits += profile.fossils.includes(id) ? '1' : '0';
  let hex = '';
  for (let i = 0; i < bits.length; i += 4) hex += parseInt(bits.slice(i, i + 4).padEnd(4, '0'), 2).toString(16);
  return hex;
}

function hexToFossils(hex) {
  const ids = allFossils();
  const out = [];
  let bits = '';
  for (const ch of hex) bits += parseInt(ch, 16).toString(2).padStart(4, '0');
  ids.forEach((id, i) => bits[i] === '1' && out.push(id));
  return out;
}

export function encodeProgress() {
  const p = profile;
  const adv = Object.entries(p.adventure)
    .map(([k, v]) => `${k}:${v}`)
    .join(',');
  const fields = [
    ['v', 1],
    ['name', (p.name || '').replace(/[;=,]/g, '')],
    ['bones', p.coins],
    ['xp', p.xp],
    ['skins', p.owned.skin.join(',')],
    ['hats', p.owned.hat.join(',')],
    ['pets', p.owned.pet.join(',')],
    ['trails', p.owned.trail.join(',')],
    ['wear', [p.skin, p.hat, p.pet, p.trail].join(',')],
    ['up', Object.keys(UPGRADES).map((k) => p.upgrades[k] || 0).join(',')],
    ['stats', STAT_KEYS.map((k) => p.stats[k] || 0).join(',')],
    ['ach', Object.keys(p.achievements).join(',')],
    ['fossils', fossilsToHex()],
    ['adv', adv],
    ['daily', `${p.daily.streak || 0},${p.daily.done || ''}`],
    ['missions', p.missions.done || 0],
    ['tut', p.tutorial ? 1 : 0],
  ];
  const body = HEADER + ';' + fields.map(([k, v]) => `${k}=${v}`).join(';');
  return body + ';sum=' + fnv(body);
}

// returns the parsed variables, or throws an Error whose message is an i18n key
export function decodeProgress(text) {
  const clean = String(text || '').trim();
  if (!clean.startsWith(HEADER + ';')) throw new Error('xferBadCode');
  const i = clean.lastIndexOf(';sum=');
  if (i < 0 || fnv(clean.slice(0, i)) !== clean.slice(i + 5)) throw new Error('xferBadSum');
  const vars = {};
  for (const part of clean.slice(HEADER.length + 1, i).split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0) vars[part.slice(0, eq)] = part.slice(eq + 1);
  }
  const list = (k) => (vars[k] ? vars[k].split(',').filter(Boolean) : []);
  const num = (v) => Math.max(0, Math.floor(Number(v) || 0));
  const stats = {};
  list('stats').forEach((v, k) => STAT_KEYS[k] && (stats[STAT_KEYS[k]] = num(v)));
  const up = {};
  list('up').forEach((v, k) => {
    const id = Object.keys(UPGRADES)[k];
    if (id) up[id] = Math.min(UPGRADES[id].cost.length, num(v));
  });
  const adventure = {};
  for (const e of list('adv')) {
    const [k, v] = e.split(':');
    if (/^\d+-\d+$/.test(k)) adventure[k] = Math.min(3, num(v));
  }
  const [streak, done] = (vars.daily || '0,').split(',');
  const wear = list('wear');
  return {
    name: vars.name || '',
    bones: num(vars.bones),
    xp: num(vars.xp),
    skins: list('skins').filter((id) => SKINS[id]),
    hats: list('hats').filter((id) => HATS[id]),
    pets: list('pets').filter((id) => PETS[id]),
    trails: list('trails').filter((id) => TRAILS[id]),
    wear: { skin: wear[0], hat: wear[1], pet: wear[2], trail: wear[3] },
    upgrades: up,
    stats,
    achievements: list('ach').filter((id) => ACHIEVEMENTS.some((a) => a.id === id)),
    fossils: hexToFossils(vars.fossils || ''),
    adventure,
    daily: { streak: num(streak), done: done || '' },
    missions: num(vars.missions),
    tutorial: vars.tut === '1',
  };
}

// ------------------------------------------------------------------ QR challenge
// "Beat my score on this exact track": the seed of the run and the score to beat.
const CH_HEADER = 'ANOTHERDINO-CH';
export const isChallenge = (text) => String(text || '').trim().startsWith(CH_HEADER + ';');

export function encodeChallenge({ seed, score, name, skin }) {
  const body = `${CH_HEADER};v=1;seed=${seed >>> 0};score=${Math.floor(score)};name=${String(name || '').replace(/[;=]/g, '').slice(0, 16)};skin=${skin || 'classic'}`;
  return body + ';sum=' + fnv(body);
}

export function decodeChallenge(text) {
  const clean = String(text || '').trim();
  if (!isChallenge(clean)) throw new Error('xferBadCode');
  const i = clean.lastIndexOf(';sum=');
  if (i < 0 || fnv(clean.slice(0, i)) !== clean.slice(i + 5)) throw new Error('xferBadSum');
  const vars = {};
  for (const part of clean.slice(CH_HEADER.length + 1, i).split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0) vars[part.slice(0, eq)] = part.slice(eq + 1);
  }
  const seed = Number(vars.seed);
  if (!Number.isFinite(seed)) throw new Error('xferBadCode');
  return { seed: seed >>> 0, score: Math.max(0, Math.floor(Number(vars.score) || 0)), name: vars.name || '?', skin: SKINS[vars.skin] ? vars.skin : 'classic' };
}

// Merge never loses anything: numbers take the larger value, collections are joined.
export function mergeProgress(d) {
  const p = profile;
  p.coins = Math.max(p.coins, d.bones);
  p.xp = Math.max(p.xp, d.xp);
  for (const [kind, items] of [['skin', d.skins], ['hat', d.hats], ['pet', d.pets], ['trail', d.trails]]) {
    for (const id of items) if (!p.owned[kind].includes(id)) p.owned[kind].push(id);
    const w = d.wear[kind];
    if (w && p.owned[kind].includes(w)) p[kind] = w;
  }
  for (const [k, v] of Object.entries(d.upgrades)) p.upgrades[k] = Math.max(p.upgrades[k] || 0, v);
  for (const [k, v] of Object.entries(d.stats)) p.stats[k] = Math.max(p.stats[k] || 0, v);
  for (const id of d.achievements) if (!p.achievements[id]) p.achievements[id] = Date.now();
  for (const id of d.fossils) if (!p.fossils.includes(id)) p.fossils.push(id);
  for (const [k, v] of Object.entries(d.adventure)) p.adventure[k] = Math.max(p.adventure[k] || 0, v);
  if (d.daily.streak > (p.daily.streak || 0)) Object.assign(p.daily, d.daily);
  p.missions.done = Math.max(p.missions.done || 0, d.missions);
  if (d.tutorial) p.tutorial = true;
  if (!p.name && d.name) p.name = d.name;
  save();
}

// ------------------------------------------------------------------ QR
// the library's default byte encoder keeps only the low 8 bits of every character,
// which breaks names written in Cyrillic or with diacritics; jsQR reads UTF-8 back
qrcode.stringToBytes = (s) => Array.from(new TextEncoder().encode(s));

export function qrCanvas(text, px = 4) {
  const q = qrcode(0, 'L');
  q.addData(text, 'Byte');
  q.make();
  const n = q.getModuleCount();
  const quiet = 4;
  const c = document.createElement('canvas');
  c.width = c.height = (n + quiet * 2) * px;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#000000';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) g.fillRect((x + quiet) * px, (y + quiet) * px, px, px);
  c.className = 'qr';
  return c;
}

let jsqrLoading = null;
function loadJsQR() {
  if (window.jsQR) return Promise.resolve(window.jsQR);
  if (!jsqrLoading) {
    jsqrLoading = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'vendor/jsQR.js';
      s.onload = () => res(window.jsQR);
      s.onerror = () => rej(new Error('xferNoScanner'));
      document.head.append(s);
    });
  }
  return jsqrLoading;
}

export async function readQrFromImage(file) {
  const jsQR = await loadJsQR();
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
      img.src = url;
    });
    const scale = Math.min(1, 1200 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0, c.width, c.height);
    const data = g.getImageData(0, 0, c.width, c.height);
    const hit = jsQR(data.data, c.width, c.height);
    if (!hit) throw new Error('xferNoQrInImage');
    return hit.data;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Live camera scanner. onResult(text) is called once with the first QR found.
export class CameraScanner {
  constructor(video, onResult, onError) {
    this.video = video;
    this.onResult = onResult;
    this.onError = onError;
    this.stream = null;
    this.running = false;
    this.canvas = document.createElement('canvas');
  }
  async start() {
    try {
      const jsQR = await loadJsQR();
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      this.video.srcObject = this.stream;
      await this.video.play();
      this.running = true;
      const g = this.canvas.getContext('2d', { willReadFrequently: true });
      const tick = () => {
        if (!this.running) return;
        const v = this.video;
        if (v.videoWidth) {
          const scale = Math.min(1, 640 / v.videoWidth);
          this.canvas.width = Math.round(v.videoWidth * scale);
          this.canvas.height = Math.round(v.videoHeight * scale);
          g.drawImage(v, 0, 0, this.canvas.width, this.canvas.height);
          const img = g.getImageData(0, 0, this.canvas.width, this.canvas.height);
          const hit = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
          if (hit && hit.data.startsWith(HEADER)) {
            this.stop();
            this.onResult(hit.data);
            return;
          }
        }
        requestAnimationFrame(tick);
      };
      tick();
    } catch (err) {
      this.stop();
      this.onError(err && err.name === 'NotAllowedError' ? 'xferCameraDenied' : err && err.message && err.message.startsWith('xfer') ? err.message : 'xferNoCamera');
    }
  }
  stop() {
    this.running = false;
    if (this.stream) for (const t of this.stream.getTracks()) t.stop();
    this.stream = null;
  }
}

// ------------------------------------------------------------------ LAN
// The receiver shows a PIN and announces itself; the sender picks it from the list,
// types the PIN and sends the same text as the QR code, in pieces.
export const SYNC_PORT = 47778;
const CHUNK = 900;

export class LanSync {
  constructor(transport, on) {
    this.t = transport;
    this.on = on; // { devices(list), received(text, from), sent(), error(key) }
    this.id = Math.random().toString(36).slice(2, 10);
    this.devices = new Map();
    this.parts = new Map();
    this.timer = null;
  }
  async start() {
    await this.t.start(SYNC_PORT, (m) => this.receive(m));
  }
  async stop() {
    clearInterval(this.timer);
    this.timer = null;
    await this.t.stop();
  }
  pack(m) {
    return JSON.stringify({ ...m, app: 'ad-sync', from: this.id });
  }
  // receiving side
  wait(name) {
    this.role = 'receive';
    this.pin = String(1000 + Math.floor(Math.random() * 9000));
    const ad = () => this.t.broadcast(SYNC_PORT, this.pack({ t: 'wait', name }));
    ad();
    this.timer = setInterval(ad, 1000);
    return this.pin;
  }
  // sending side
  browse() {
    this.role = 'send';
    this.timer = setInterval(() => {
      const now = Date.now();
      for (const [k, d] of this.devices) if (now - d.seen > 3500) this.devices.delete(k);
      this.on.devices([...this.devices.values()]);
    }, 1000);
  }
  send(device, pin, text) {
    this.answered = false; // one toast per attempt, although every packet is sent three times
    const a = (this.attempt = Math.random().toString(36).slice(2, 8)); // late replies to an older attempt are ignored
    const n = Math.ceil(text.length / CHUNK);
    const msgs = [];
    for (let i = 0; i < n; i++) msgs.push(this.pack({ t: 'data', a, pin, i, n, d: text.slice(i * CHUNK, (i + 1) * CHUNK) }));
    // UDP can drop packets, so everything is sent three times
    for (let r = 0; r < 3; r++) setTimeout(() => msgs.forEach((m) => this.t.send(device.addr, device.port, m)), r * 250);
  }
  receive({ data, address, port }) {
    let m;
    try {
      m = JSON.parse(data);
    } catch {
      return;
    }
    if (!m || m.app !== 'ad-sync' || m.from === this.id) return;
    if (this.role === 'send' && m.t === 'wait') {
      this.devices.set(m.from, { id: m.from, name: String(m.name).slice(0, 16), addr: address, port, seen: Date.now() });
      this.on.devices([...this.devices.values()]);
    } else if (this.role === 'send' && (m.t === 'ok' || m.t === 'badpin')) {
      if (this.answered || m.a !== this.attempt) return;
      this.answered = true;
      if (m.t === 'ok') this.on.sent();
      else this.on.error('xferBadPin');
    } else if (this.role === 'receive' && m.t === 'data') {
      if (String(m.pin) !== this.pin) {
        this.t.send(address, port, this.pack({ t: 'badpin', a: m.a }));
        return;
      }
      const key = m.from;
      if (!this.parts.has(key)) this.parts.set(key, new Array(m.n));
      const arr = this.parts.get(key);
      arr[m.i] = m.d;
      if (arr.filter((x) => x != null).length === m.n && !this.done) {
        this.done = true;
        this.t.send(address, port, this.pack({ t: 'ok', a: m.a }));
        this.on.received(arr.join(''));
      }
    }
  }
}
