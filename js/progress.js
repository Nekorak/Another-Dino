// Long-term progress: permanent upgrades, player level, the daily challenge
// and mystery eggs.
import { profile, save } from './save.js';
import { SKINS, HATS, PETS } from './models.js';

// ------------------------------------------------------------------ upgrades
// cost of each next level; the array length is the max level
export const UPGRADES = {
  duration: { cost: [100, 250, 450, 800, 1300, 2000, 3000, 4500] }, // power-ups last +15% per level
  shieldStart: { cost: [800] }, // every run starts with a shield
  bones: { cost: [150, 350, 650, 1000, 1600, 2400, 3500, 5000] }, // +10% chance per level that a bone counts double
  luck: { cost: [200, 450, 900, 1800, 3000] }, // power-ups show up more often
  // v1.8: more to save up for
  xp: { cost: [500, 1000, 2000, 3500, 5000] }, // +10% XP per level
  revive: { cost: [600, 1500, 3000] }, // the second chance costs 10 bones less per level
  chest: { cost: [800, 2000, 4000] }, // the daily chest gives +25% bones per level
};
export const xpK = () => 1 + 0.1 * upgradeLevel('xp');
export const reviveCost = () => 50 - 10 * upgradeLevel('revive');
export const chestK = () => 1 + 0.25 * upgradeLevel('chest');

export const upgradeLevel = (id) => profile.upgrades[id] || 0;
export const powerTimeK = () => 1 + 0.15 * upgradeLevel('duration');
export const doubleBoneChance = () => 0.1 * upgradeLevel('bones');
export const powerGapK = () => 1 - 0.15 * upgradeLevel('luck');

export function nextUpgradeCost(id) {
  return UPGRADES[id].cost[upgradeLevel(id)] ?? null;
}

export function buyUpgrade(id) {
  const cost = nextUpgradeCost(id);
  if (cost == null || profile.coins < cost) return false;
  profile.coins -= cost;
  profile.upgrades[id] = upgradeLevel(id) + 1;
  save();
  return true;
}

// ------------------------------------------------------------------ level
// total XP needed to reach a level: 0, 100, 300, 600, 1000, ...
export const xpForLevel = (l) => 50 * l * (l - 1);

export function levelOf(xp = profile.xp) {
  let l = 1;
  while (xpForLevel(l + 1) <= xp) l++;
  return l;
}

export function levelProgress(xp = profile.xp) {
  const l = levelOf(xp);
  const a = xpForLevel(l);
  const b = xpForLevel(l + 1);
  return { level: l, into: xp - a, need: b - a };
}

// returns { gained, levelUps: [levels], unlocked: [skin ids] }
export function addXp(amount) {
  const before = levelOf();
  profile.xp += Math.max(0, Math.floor(amount));
  const after = levelOf();
  const levelUps = [];
  const unlocked = [];
  for (let l = before + 1; l <= after; l++) {
    levelUps.push(l);
    for (const [id, sk] of Object.entries(SKINS)) {
      if (sk.level === l && !profile.owned.skin.includes(id)) {
        profile.owned.skin.push(id);
        unlocked.push(id);
      }
    }
  }
  // skins whose level was reached before this version existed
  for (const [id, sk] of Object.entries(SKINS)) {
    if (sk.level && sk.level <= after && !profile.owned.skin.includes(id)) profile.owned.skin.push(id);
  }
  save();
  return { gained: amount, levelUps, unlocked };
}

// ------------------------------------------------------------------ daily challenge
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayNumber(date) {
  return Math.floor(new Date(date + 'T12:00:00').getTime() / 86400000);
}

export function dailyInfo() {
  const date = today();
  const n = dayNumber(date);
  const d = profile.daily;
  if (d.date !== date) {
    d.date = date;
    d.best = 0;
  }
  // the streak survives only if yesterday (or today) was completed
  const streakAlive = d.done && dayNumber(d.done) >= n - 1;
  return {
    date,
    seed: (n * 2654435761) >>> 0,
    target: 600 + (n % 5) * 200,
    done: d.done === date,
    best: d.best,
    streak: streakAlive ? d.streak : 0,
    reward: 100 + Math.min(6, streakAlive ? d.streak : 0) * 20,
  };
}

// call when a daily run reaches its target; returns the bones awarded (0 if already done today)
export function completeDaily() {
  const info = dailyInfo();
  if (info.done) return 0;
  const d = profile.daily;
  d.streak = info.streak + 1;
  d.done = info.date;
  profile.coins += info.reward;
  profile.stats.dailies++;
  save();
  return info.reward;
}

export function recordDaily(score) {
  dailyInfo();
  profile.daily.best = Math.max(profile.daily.best, Math.floor(score));
  save();
}

// ------------------------------------------------------------------ mystery egg
export const EGG_PRICE = 300;

// the golden egg only holds the expensive things
export const GOLD_EGG_PRICE = 1000;
const GOLD_EGG_MIN = 500;
function eggPool(gold) {
  const min = gold ? GOLD_EGG_MIN : 1;
  const pool = [];
  for (const [id, it] of Object.entries(SKINS)) if (it.price >= min && !profile.owned.skin.includes(id)) pool.push(['skin', id]);
  for (const [id, it] of Object.entries(HATS)) if (it.price >= min && !profile.owned.hat.includes(id)) pool.push(['hat', id]);
  for (const [id, it] of Object.entries(PETS)) if (it.price >= min && !profile.owned.pet.includes(id)) pool.push(['pet', id]);
  return pool;
}

// returns { kind: 'skin'|'hat'|'pet', id } or null when everything is owned
export function openEgg(gold = false) {
  const pool = eggPool(gold);
  const price = gold ? GOLD_EGG_PRICE : EGG_PRICE;
  if (!pool.length || profile.coins < price) return null;
  const [kind, id] = pool[Math.floor(Math.random() * pool.length)];
  profile.coins -= price;
  profile.owned[kind].push(id);
  profile.stats.eggs++;
  save();
  return { kind, id };
}

export function eggPoolSize(gold = false) {
  if (gold) return eggPool(true).length;
  let n = 0;
  for (const [id, it] of Object.entries(SKINS)) if (it.price > 0 && !profile.owned.skin.includes(id)) n++;
  for (const [id, it] of Object.entries(HATS)) if (it.price > 0 && !profile.owned.hat.includes(id)) n++;
  for (const [id, it] of Object.entries(PETS)) if (it.price > 0 && !profile.owned.pet.includes(id)) n++;
  return n;
}

// ------------------------------------------------------------------ pet food
// bones for the pet: it grows as if you had run PET_FOOD_XP points together
export const PET_FOOD_PRICE = 200;
export const PET_FOOD_XP = 2500;
