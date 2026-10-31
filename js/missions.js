// Missions (3 active at a time, replaced when done) and permanent achievements.
import { profile, save } from './save.js';

// scope 'run': counted within one run; 'total': counted since the mission was given
const TEMPLATES = [
  { kind: 'score', scope: 'run', base: 500, reward: 40 },
  { kind: 'jumps', scope: 'run', base: 25, reward: 30 },
  { kind: 'coins', scope: 'run', base: 20, reward: 30 },
  { kind: 'obstacles', scope: 'run', base: 20, reward: 35 },
  { kind: 'ducks', scope: 'run', base: 4, reward: 35 },
  { kind: 'powerups', scope: 'run', base: 2, reward: 40 },
  { kind: 'biome', scope: 'run', base: 2, reward: 60, max: 4 },
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

// ------------------------------------------------------------------ achievements
export const ACHIEVEMENTS = [
  { id: 'first', test: (s) => s.games >= 1 },
  { id: 'score1k', test: (s) => s.best >= 1000 },
  { id: 'score2k5', test: (s) => s.best >= 2500 },
  { id: 'score5k', test: (s) => s.best >= 5000 },
  { id: 'jungle', test: (s) => s.maxBiome >= 1 },
  { id: 'snow', test: (s) => s.maxBiome >= 2 },
  { id: 'volcano', test: (s) => s.maxBiome >= 3 },
  { id: 'coins100', test: (s) => s.coins >= 100 },
  { id: 'coins1k', test: (s) => s.coins >= 1000 },
  { id: 'shopper', test: () => profile.owned.skin.length + profile.owned.hat.length > 2 },
  { id: 'collector', test: () => profile.owned.skin.length >= 4 },
  { id: 'powerups', test: (s) => s.powerups >= 25 },
  { id: 'meteors', test: (s) => s.meteors >= 10 },
  { id: 'jumps', test: (s) => s.jumps >= 1000 },
  { id: 'games50', test: (s) => s.games >= 50 },
  { id: 'lan', test: (s) => s.mpGames >= 1 },
  { id: 'lanWin', test: (s) => s.mpWins >= 1 },
];
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
