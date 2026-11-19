// Home-made tracks from the level editor. A track is a row of slots, each holding one
// piece (an obstacle, bones, a power-up or nothing). It travels as a short text, so it
// fits in a QR code:  ANOTHERDINO-LV;v=1;n=My track;w=2;s=1;t=c.lm..pr;sum=1a2b3c4d
import { profile, save } from './save.js';
import { BIOMES } from './biomes.js';
import { weekInfo } from './missions.js';

const HEADER = 'ANOTHERDINO-LV';
export const MAX_SLOTS = 60;
export const MAX_LEVELS = 20;
// piece id -> emoji for the editor (the game builds the real thing)
export const PIECES = {
  '.': '·',
  c: '🌵',
  C: '🌲',
  l: '🐦',
  m: '🦅',
  z: '〰️',
  r: '🪨',
  p: '🕳️',
  f: '🟫',
  o: '🦴',
  u: '⭐',
};
export const SPEEDS = [11, 14, 18]; // slow | normal | fast (start speed)

function fnv(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

const cleanName = (n) => String(n || '').replace(/[;=]/g, '').trim().slice(0, 18);
const cleanTrack = (t) => [...String(t || '')].filter((ch) => PIECES[ch]).slice(0, MAX_SLOTS).join('');

export function newLevel() {
  return { name: '', w: 0, s: 1, t: '.'.repeat(24) };
}

// the track without the empty slots at the end
export const trimmed = (lv) => cleanTrack(lv.t).replace(/\.+$/, '');
export const pieceCount = (lv) => [...trimmed(lv)].filter((ch) => ch !== '.' && ch !== 'o' && ch !== 'u').length;

export function encodeLevel(lv) {
  const body = `${HEADER};v=1;n=${cleanName(lv.name)};w=${lv.w | 0};s=${lv.s | 0};t=${trimmed(lv)}`;
  return body + ';sum=' + fnv(body);
}

// a short id for a track (same pieces, world and speed = same id, whatever the name)
export const levelId = (lv) => fnv(`${lv.w | 0}|${lv.s | 0}|${trimmed(lv)}`);

export const isLevel = (text) => String(text || '').trim().startsWith(HEADER + ';');

// throws an Error whose message is an i18n key
export function decodeLevel(text) {
  const clean = String(text || '').trim();
  if (!isLevel(clean)) throw new Error('xferBadCode');
  const i = clean.lastIndexOf(';sum=');
  if (i < 0 || fnv(clean.slice(0, i)) !== clean.slice(i + 5)) throw new Error('xferBadSum');
  const vars = {};
  for (const part of clean.slice(HEADER.length + 1, i).split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0) vars[part.slice(0, eq)] = part.slice(eq + 1);
  }
  const lv = {
    name: cleanName(vars.n),
    w: Math.max(0, Math.min(BIOMES.length - 1, Number(vars.w) | 0)),
    s: Math.max(0, Math.min(SPEEDS.length - 1, Number(vars.s) | 0)),
    t: cleanTrack(vars.t),
  };
  if (!pieceCount(lv)) throw new Error('lvEmpty');
  return lv;
}

// saves a track in the list: at index `at` (an edited track), else in place of the one with
// the same id, else on top; returns its index
export function storeLevel(lv, from = '', at = -1) {
  const id = levelId(lv);
  const entry = { name: cleanName(lv.name), w: lv.w, s: lv.s, t: trimmed(lv), from };
  if (at >= 0 && at < profile.levels.length) {
    profile.levels[at] = entry;
    save();
    return at;
  }
  at = profile.levels.findIndex((x) => levelId(x) === id);
  if (at >= 0) profile.levels[at] = { ...entry, from: profile.levels[at].from || from };
  else {
    profile.levels.unshift(entry);
    if (profile.levels.length > MAX_LEVELS) profile.levels.length = MAX_LEVELS;
  }
  save();
  return at >= 0 ? at : 0;
}

export function deleteLevel(i) {
  profile.levels.splice(i, 1);
  save();
}

// stars on a track: the best result; tracks received from friends give bones for new stars
export function saveLevelStars(lv, stars) {
  const id = levelId(lv);
  const before = profile.levelStars[id] || 0;
  if (stars > before) profile.levelStars[id] = stars;
  const own = !lv.from;
  // only real tracks from friends pay (not your own, not a two-cactus one)
  const reward = own || pieceCount(lv) < 8 ? 0 : Math.max(0, stars - before) * 15;
  if (before === 0) profile.stats.levelsWon = (profile.stats.levelsWon || 0) + 1;
  profile.coins += reward;
  save();
  return reward;
}

// ------------------------------------------------------------------ track of the week
// Every week one track is the challenge: picked from the tracks friends sent you (or, with
// none yet, from a few made by us). The first finish of the week pays WEEKLY_TRACK_REWARD.
export const WEEKLY_TRACK_REWARD = 100;
const HOUSE_TRACKS = [
  { name: 'Dino Rush', w: 0, s: 1, t: 'c..l..c.o..r...m..cc..p..o..C..z...c.u..l..p..C..m..o..rc' },
  { name: 'Jungle Jump', w: 1, s: 1, t: 'C..m..c..p..o.z..c..l..C.u..r..p..m..c.o..C..z..p..cc' },
  { name: 'Snow Slide', w: 3, s: 0, t: 'c...l...C..o..p...m..c..r..u..z...C..l..p..c..o..mC' },
  { name: 'Lava Run', w: 6, s: 2, t: 'c..m..r..p..c.o..z..C..l..f...c..u..m..r..p..C.o..zc' },
  { name: 'Moon Walk', w: 7, s: 1, t: 'c..l..m..C..o..z..c..r..u..m..c..l..C..o..zc' },
];
export function weeklyTrack() {
  const wk = weekInfo();
  const sent = profile.levels.filter((lv) => lv.from === 'qr' && pieceCount(lv) >= 8);
  const pool = sent.length ? sent : HOUSE_TRACKS;
  const lv = pool[wk.seed % pool.length];
  const W = profile.weeklyTrack;
  return { lv: { ...lv, from: lv.from || 'week' }, week: wk.id, daysLeft: wk.daysLeft, done: W.week === wk.id && W.done };
}
export const weeklyTrackOpen = () => !weeklyTrack().done;
// call when a track is finished; returns the bones for the track of the week (0 if not it)
export function finishWeeklyTrack(lv) {
  const w = weeklyTrack();
  if (w.done || levelId(lv) !== levelId(w.lv)) return 0;
  profile.weeklyTrack = { week: w.week, done: true };
  profile.coins += WEEKLY_TRACK_REWARD;
  save();
  return WEEKLY_TRACK_REWARD;
}
