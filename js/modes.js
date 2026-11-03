// Adventure levels and the computer-controlled rival.
import { BIOMES } from './biomes.js';
import { profile, save } from './save.js';

// ------------------------------------------------------------------ adventure
// 8 worlds x 3 levels. Level 3 of every world ends with a boss fight.
export const ADV_LEVELS = 3;
export const levelKey = (w, l) => `${w}-${l}`;

export function levelDef(w, l) {
  const boss = l === ADV_LEVELS - 1;
  return {
    world: w,
    level: l,
    boss,
    biome: BIOMES[w].id,
    seed: 7000 + w * 31 + l * 7,
    length: boss ? 750 : 450 + l * 250, // in points of distance
    bossAt: 260,
    bossTime: 24,
    startSpeed: 13 + w * 1.1 + l * 0.6,
  };
}

export const stars = (w, l) => profile.adventure[levelKey(w, l)] || 0;

export function unlocked(w, l) {
  if (w === 0 && l === 0) return true;
  if (l > 0) return stars(w, l - 1) > 0;
  return stars(w - 1, ADV_LEVELS - 1) > 0;
}

export function totalStars() {
  return Object.values(profile.adventure).reduce((a, b) => a + b, 0);
}

// stars: 1 = finished, 2 = also 60% of the bones, 3 = also no hits
export function scoreLevel(bonesTaken, bonesSpawned, hits) {
  let s = 1;
  if (bonesSpawned === 0 || bonesTaken / bonesSpawned >= 0.6) s++;
  if (hits === 0) s++;
  return s;
}

// saves the result; returns the bones earned for new stars
export function saveLevel(w, l, s) {
  const key = levelKey(w, l);
  const before = profile.adventure[key] || 0;
  const gained = Math.max(0, s - before);
  if (s > before) profile.adventure[key] = s;
  let reward = gained * 15;
  if (before === 0 && l === ADV_LEVELS - 1) reward += 60; // first boss defeat
  profile.coins += reward;
  save();
  return reward;
}

// ------------------------------------------------------------------ robot rival
// Looks at the next obstacle like a player would, with reaction time and mistakes
// that depend on the difficulty.
export const BOT_LEVELS = [
  { miss: 0.12, jitter: 0.35 }, // easy
  { miss: 0.05, jitter: 0.2 }, // normal
  { miss: 0.012, jitter: 0.08 }, // hard
];

export class BotBrain {
  constructor(level) {
    this.cfg = BOT_LEVELS[level] || BOT_LEVELS[1];
    this.plan = new Map(); // obstacle -> { act, at, miss }
    this.holding = null;
  }
  // returns 'jump' | 'duck' | null for this frame
  think(p, obstacles, speed) {
    const ahead = obstacles.filter((o) => o.x + o.width > -0.6 && !o.broken.has(p.index)).sort((a, b) => a.x - b.x)[0];
    if (!ahead) return null;
    if (!this.plan.has(ahead)) {
      const miss = Math.random() < this.cfg.miss;
      const lead = (speed + (ahead.extra || 0)) * 0.2 + 1.2 + (Math.random() - 0.5) * this.cfg.jitter * 4;
      let act = 'jump';
      if (ahead.kind === 'bird') act = ahead.y > 3 ? null : ahead.y > 1.5 ? 'duck' : 'jump';
      this.plan.set(ahead, { act: miss ? (act === 'duck' ? 'jump' : null) : act, lead: ahead.kind === 'pit' ? lead - 0.3 : act === 'duck' ? lead + 2 : lead });
      if (this.plan.size > 12) this.plan.delete(this.plan.keys().next().value);
    }
    const pl = this.plan.get(ahead);
    if (!pl.act) return null;
    if (ahead.x < pl.lead && ahead.x > -1) return pl.act;
    return null;
  }
}
