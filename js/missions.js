// Missions (3 active at a time, replaced when done) and permanent achievements.
import { profile, save } from './save.js';
import { levelOf } from './progress.js';
import { SKINS, HATS } from './models.js';
import { allFossils } from './collection.js';
import { BIOMES } from './biomes.js';

// skins and hats that were bought (gifts from levels, seasons and the album do not count)
const bought = () => profile.owned.skin.filter((id) => SKINS[id]?.price > 0).length + profile.owned.hat.filter((id) => HATS[id]?.price > 0).length;

// scope 'run': counted within one run; 'total': counted since the mission was given
const TEMPLATES = [
  { kind: 'score', scope: 'run', base: 500, reward: 40 },
  { kind: 'jumps', scope: 'run', base: 25, reward: 30 },
  { kind: 'coins', scope: 'run', base: 20, reward: 30 },
  { kind: 'obstacles', scope: 'run', base: 20, reward: 35 },
  { kind: 'ducks', scope: 'run', base: 4, reward: 35 },
  { kind: 'powerups', scope: 'run', base: 2, reward: 40 },
  { kind: 'biome', scope: 'run', base: 2, reward: 60, max: 6 },
  { kind: 'coinsTotal', scope: 'total', base: 100, reward: 50 },
  { kind: 'games', scope: 'total', base: 5, reward: 40 },
  { kind: 'distance', scope: 'total', base: 3000, reward: 60 },
];

const STAT_FOR = { coinsTotal: 'coins', games: 'games', distance: 'distance' };

function makeMission() {
  const level = profile.missions.done;
  const activeKinds = new Set(profile.missions.active.map((m) => m.kind));
  const options = TEMPLATES.filter((t) => !activeKinds.has(t.kind));
  const t = options[Math.floor(Math.random() * options.length)];
  let target = Math.round(t.base * (1 + level * 0.15));
  if (t.max) target = Math.min(t.max, t.base + Math.floor(level / 4));
  if (target > 50) target = Math.round(target / 10) * 10;
  const m = { kind: t.kind, scope: t.scope, target, reward: Math.round(t.reward * (1 + level * 0.1)) };
  if (t.scope === 'total') m.start = profile.stats[STAT_FOR[t.kind]];
  return m;
}

// a mission you don't like can be swapped for another one, for a few bones
export const REROLL_PRICE = 25;
export function rerollMission(i) {
  const m = profile.missions.active[i];
  if (!m || profile.coins < REROLL_PRICE) return false;
  profile.coins -= REROLL_PRICE;
  // made while the old one is still in the list, so it is always a different kind
  profile.missions.active[i] = makeMission();
  save();
  return true;
}

export function ensureMissions() {
  while (profile.missions.active.length < 3) profile.missions.active.push(makeMission());
}

export function missionProgress(m, run) {
  if (m.scope === 'total') return Math.min(m.target, profile.stats[STAT_FOR[m.kind]] - m.start);
  return Math.min(m.target, Math.floor((run && run[m.kind]) || 0));
}

// Call during and after a run; returns the missions completed just now.
export function checkMissions(run) {
  const done = [];
  profile.missions.active = profile.missions.active.filter((m) => {
    if (missionProgress(m, run) >= m.target) {
      done.push(m);
      return false;
    }
    return true;
  });
  for (const m of done) {
    profile.coins += m.reward;
    profile.missions.done++;
  }
  if (done.length) {
    ensureMissions();
    save();
  }
  return done;
}

// ------------------------------------------------------------------ weekly missions
// Three longer missions every week (Monday to Sunday), counted over all the runs of the
// week, with bigger rewards; finishing all three gives a bonus on top.
const WEEKLY = [
  { kind: 'distance', base: 25000, reward: 250 },
  { kind: 'games', base: 30, reward: 200 },
  { kind: 'coins', base: 500, reward: 250 },
  { kind: 'obstacles', base: 600, reward: 200 },
  { kind: 'jumps', base: 1500, reward: 200 },
  { kind: 'perfects', base: 60, reward: 300 },
  { kind: 'powerups', base: 35, reward: 250 },
  { kind: 'dailies', base: 4, reward: 350 },
  { kind: 'miniBosses', base: 3, reward: 350 },
  { kind: 'goldBones', base: 4, reward: 300 },
];
export const WEEKLY_BONUS = 400;

// "2026-W46" for the ISO week of the date, and the days left until Monday
export function weekInfo(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const w = Math.ceil(((d - y0) / 86400000 + 1) / 7);
  return { id: `${d.getUTCFullYear()}-W${String(w).padStart(2, '0')}`, daysLeft: 8 - day, seed: d.getUTCFullYear() * 100 + w };
}

export function ensureWeekly() {
  const wk = weekInfo();
  const W = profile.weekly;
  if (W.week === wk.id && W.list.length) return W;
  // the same three missions for everybody in a given week (seeded by the week)
  let s = wk.seed;
  const r = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const pool = [...WEEKLY];
  const list = [];
  const level = Math.min(10, Math.floor((profile.missions.done || 0) / 10)); // a bit harder for veterans
  while (list.length < 3) {
    const t = pool.splice(Math.floor(r() * pool.length), 1)[0];
    let target = Math.round(t.base * (1 + level * 0.08));
    if (target > 50) target = Math.round(target / 10) * 10;
    list.push({ kind: t.kind, target, reward: t.reward, start: profile.stats[t.kind] || 0, done: false });
  }
  profile.weekly = { week: wk.id, list, bonus: false };
  save();
  return profile.weekly;
}

export const weeklyProgress = (m) => Math.max(0, Math.min(m.target, (profile.stats[m.kind] || 0) - m.start));

// after a run: returns { done: [missions], bonus: bones or 0 }
export function checkWeekly() {
  const W = ensureWeekly();
  const done = [];
  for (const m of W.list) {
    if (m.done || weeklyProgress(m) < m.target) continue;
    m.done = true;
    profile.coins += m.reward;
    profile.stats.weeklies = (profile.stats.weeklies || 0) + 1;
    done.push(m);
  }
  let bonus = 0;
  if (!W.bonus && W.list.every((m) => m.done)) {
    W.bonus = true;
    bonus = WEEKLY_BONUS;
    profile.coins += bonus;
  }
  if (done.length || bonus) save();
  return { done, bonus };
}

// ------------------------------------------------------------------ achievements
export const ACHIEVEMENTS = [
  { id: 'first', test: (s) => s.games >= 1 },
  { id: 'score1k', test: (s) => s.best >= 1000 },
  { id: 'score2k5', test: (s) => s.best >= 2500 },
  { id: 'score5k', test: (s) => s.best >= 5000 },
  { id: 'jungle', test: (s) => s.maxBiome >= 1 },
  { id: 'snow', test: (s) => s.maxBiome >= 3 },
  { id: 'cave', test: (s) => s.maxBiome >= 4 },
  { id: 'volcano', test: (s) => s.maxBiome >= 6 },
  { id: 'space', test: (s) => s.maxBiome >= 7 },
  { id: 'coins100', test: (s) => s.coins >= 100 },
  { id: 'coins1k', test: (s) => s.coins >= 1000 },
  { id: 'shopper', test: () => bought() >= 1 },
  { id: 'collector', test: () => profile.owned.skin.length >= 4 },
  { id: 'powerups', test: (s) => s.powerups >= 25 },
  { id: 'meteors', test: (s) => s.meteors >= 10 },
  { id: 'jumps', test: (s) => s.jumps >= 1000 },
  { id: 'games50', test: (s) => s.games >= 50 },
  { id: 'lan', test: (s) => s.mpGames >= 1 },
  { id: 'lanWin', test: (s) => s.mpWins >= 1 },
  { id: 'daily', test: (s) => s.dailies >= 1 },
  { id: 'daily7', test: () => profile.daily.streak >= 7 },
  { id: 'revive', test: (s) => s.revives >= 1 },
  { id: 'pound', test: (s) => s.pounds >= 10 },
  { id: 'egg', test: (s) => s.eggs >= 1 },
  { id: 'level10', test: () => levelOf() >= 10 },
  { id: 'pet', test: () => profile.owned.pet.length > 1 },
  { id: 'boss', test: (s) => s.bosses >= 1 },
  { id: 'combo5', test: (s) => s.bestCombo >= 5 },
  { id: 'bot', test: (s) => s.botWins >= 1 },
  { id: 'album', test: () => allFossils().every((f) => profile.fossils.includes(f)) },
  // v1.6
  { id: 'score10k', test: (s) => s.best >= 10000 },
  { id: 'games200', test: (s) => s.games >= 200 },
  { id: 'swampBoss', test: () => (profile.adventure[advBoss('swamp')] || 0) > 0 },
  { id: 'skyBoss', test: () => (profile.adventure[advBoss('sky')] || 0) > 0 },
  { id: 'storyEnd', test: () => profile.storySeen.includes('end') },
  { id: 'stars60', test: () => Object.values(profile.adventure).reduce((a, b) => a + b, 0) >= 60 },
  { id: 'teamBoss', test: (s) => (s.teamBosses || 0) >= 1 },
  { id: 'seasonRun', test: (s) => (s.seasonBest || 0) >= 1500 },
  { id: 'fashion', test: () => profile.owned.hat.length >= 7 },
  { id: 'goldBones25', test: (s) => (s.goldBones || 0) >= 25 },
  { id: 'rushAll', test: (s) => (s.rushes || 0) >= 1 },
  { id: 'crowns10', test: () => Object.keys(profile.advCrowns || {}).length >= 10 },
];
// the boss level of a world, as saved in profile.adventure ("11-2")
const advBoss = (id) => `${BIOMES.findIndex((b) => b.id === id)}-2`;
export const ACHIEVEMENT_REWARD = 25;

export function checkAchievements() {
  const fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (profile.achievements[a.id]) continue;
    if (a.test(profile.stats)) {
      profile.achievements[a.id] = Date.now();
      profile.coins += ACHIEVEMENT_REWARD;
      fresh.push(a);
    }
  }
  if (fresh.length) save();
  return fresh;
}
