// Adventure levels and the computer-controlled rival.
import { BIOMES } from './biomes.js';
import { profile, save } from './save.js';

// ------------------------------------------------------------------ adventure
// 13 worlds x 3 levels. Level 3 of every world ends with a boss fight.
export const ADV_LEVELS = 3;
export const levelKey = (w, l) => `${w}-${l}`;

// The order of the worlds on the map and in the story. Saves use the index in BIOMES, so
// worlds added later go at the end of BIOMES; here the season world moves to the very end.
export const ADV_ORDER = [...BIOMES.keys()].filter((w) => !BIOMES[w].seasonal).concat([...BIOMES.keys()].filter((w) => BIOMES[w].seasonal));
export const advPos = (w) => ADV_ORDER.indexOf(w);
export const SEASON_W = BIOMES.findIndex((b) => b.seasonal);
export const LAST_STORY_W = ADV_ORDER.filter((w) => !BIOMES[w].seasonal).at(-1); // after its boss: the end of the story
const CANDY_W = BIOMES.findIndex((b) => b.id === 'candy'); // the season world opens after this one, as before v1.6

// Adventure+: after the end of the story the levels can be played again, faster, for a crown
export const advPlusOpen = () => profile.storySeen.includes('end');
export const advHardOn = () => !!profile.advHard && advPlusOpen();
export const HARD_SPEED = 5;

export function levelDef(w, l) {
  const boss = l === ADV_LEVELS - 1;
  const pos = BIOMES[w].seasonal ? CANDY_W + 1 : advPos(w); // the season world keeps its old speed
  return {
    world: w,
    level: l,
    boss,
    biome: BIOMES[w].id,
    seed: 7000 + w * 31 + l * 7,
    length: boss ? 750 : 450 + l * 250, // in points of distance
    bossAt: 260,
    bossTime: 24,
    startSpeed: 13 + pos * 1.1 + l * 0.6 + (advHardOn() ? HARD_SPEED : 0),
  };
}

export const stars = (w, l) => profile.adventure[levelKey(w, l)] || 0;

// the world of the season opens after the last boss, or early at tier 5 of the season pass
export const SEASON_PASS_TIER = 5;
export function unlocked(w, l) {
  if (w === ADV_ORDER[0] && l === 0) return true;
  if (l > 0) return stars(w, l - 1) > 0;
  if (!BIOMES[w]) return false;
  if (BIOMES[w].seasonal) return passTier() >= SEASON_PASS_TIER || stars(CANDY_W, ADV_LEVELS - 1) > 0;
  const prev = ADV_ORDER[advPos(w) - 1];
  return prev != null && stars(prev, ADV_LEVELS - 1) > 0;
}
// the season run (endless, in the world of the season): its best score resets every season
export const seasonRunKey = (d = new Date()) => `${d.getFullYear()}-${Math.floor(d.getMonth() / 3)}`;
export function seasonRunBest() {
  return profile.seasonRun.key === seasonRunKey() ? profile.seasonRun.best : 0;
}

// the pass tier without importing rewards.js (that would be a loop): same formula as passState
const passTier = () => Math.floor((profile.pass.xp || 0) / 250);

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
  // later worlds are faster, so their stars are worth a bit more (v1.6)
  const pos = Math.max(0, advPos(w));
  let reward = gained * (15 + pos);
  if (before === 0 && l === ADV_LEVELS - 1) reward += 60 + pos * 5; // first boss defeat
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
      if (ahead.kind === 'bird' && !ahead.zig) act = ahead.y > 3 ? null : ahead.y > 1.5 ? 'duck' : 'jump';
      this.plan.set(ahead, { act: miss ? (act === 'duck' ? 'jump' : null) : act, lead: ahead.kind === 'pit' || ahead.kind === 'platform' ? lead - 0.3 : act === 'duck' ? lead + 2 : lead });
      if (this.plan.size > 12) this.plan.delete(this.plan.keys().next().value);
    }
    const pl = this.plan.get(ahead);
    // a swooping pterodactyl: decide at the last moment from where it is now
    if (ahead.zig && pl.act) return ahead.x < pl.lead && ahead.x > -1 ? (ahead.y > 1.7 ? 'duck' : 'jump') : null;
    if (!pl.act) return null;
    if (ahead.x < pl.lead && ahead.x > -1) return pl.act;
    return null;
  }
}

// ------------------------------------------------------------------ rule of the day
// One extra rule for the whole day, the same for everybody (from the date, no server).
// bones: how much a bone is worth under this rule.
export const MUTATORS = {
  moon: { bones: 1.5 }, // low gravity everywhere
  night: { bones: 1.5 }, // the night never ends
  turbo: { bones: 3, speed: 1.35 }, // much faster from the start, triple bones
  birds: { bones: 2 }, // pterodactyls everywhere
  giant: { bones: 1 }, // start every run as a giant, and power-ups come twice as often
};
export function todayMutator(date = new Date()) {
  const ids = Object.keys(MUTATORS);
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  const id = ids[day % ids.length];
  const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  if (profile.mutator.date !== key) profile.mutator = { date: key, best: 0 };
  return { id, ...MUTATORS[id], best: profile.mutator.best };
}
