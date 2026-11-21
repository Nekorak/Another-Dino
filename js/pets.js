// Pets grow up: the distance you run together makes them bigger and gives them new powers.
import { profile, save } from './save.js';

// total distance (points) needed for level 1..5
export const PET_LEVELS = [0, 2000, 6000, 15000, 30000];
export const PET_MAX = PET_LEVELS.length;

export const petXp = (id) => profile.petXp[id] || 0;

export function petLevel(id = profile.pet) {
  if (!id || id === 'none') return 0;
  const xp = petXp(id);
  let l = 1;
  while (l < PET_MAX && xp >= PET_LEVELS[l]) l++;
  return l;
}

// { level, into, need } (need = 0 at the top level)
export function petProgress(id) {
  const level = petLevel(id);
  if (level >= PET_MAX) return { level, into: 0, need: 0 };
  const a = PET_LEVELS[level - 1];
  return { level, into: petXp(id) - a, need: PET_LEVELS[level] - a };
}

// What each pet does at a level (0 = no such pet). Every pet at level 5 also starts the run with a shield.
export function petPower(id = profile.pet, level = petLevel(id)) {
  const out = { bones100: 0, reach: 0, tongue: 0, powerK: 1, shield: level >= PET_MAX, scale: 1 + 0.12 * Math.max(0, level - 1), saves: 0 };
  if (!level) return out;
  // v1.9: from level 2 the pet jumps in and takes a hit for you once a run (twice from level 4)
  out.saves = level >= 4 ? 2 : level >= 2 ? 1 : 0;
  if (id === 'turtle') out.bones100 = 1 + Math.floor((level - 1) / 2); // a bone every 100 points: 1, 1, 2, 2, 3
  if (id === 'ptera') out.reach = 1.2 + 0.2 * level; // catches bones higher up: 1.4 .. 2.2
  if (id === 'frog') out.tongue = 1.6 + 0.7 * level; // licks bones from this far ahead
  if (id === 'chick') out.powerK = 1 + 0.06 * level; // power-ups last longer: +6% .. +30%
  return out;
}

// pet food from the shop; returns { level } when it grew, {} when not, null when it can't eat
export function feedPet(price, xp) {
  const id = profile.pet;
  if (!id || id === 'none' || petLevel(id) >= PET_MAX || profile.coins < price) return null;
  const before = petLevel(id);
  profile.coins -= price;
  profile.petXp[id] = petXp(id) + xp;
  save();
  const after = petLevel(id);
  return after > before ? { level: after } : {};
}

// Call at the end of a run with the distance; returns the new level if the pet grew, else 0.
export function growPet(distance) {
  const id = profile.pet;
  if (!id || id === 'none' || !(distance > 0)) return 0;
  const before = petLevel(id);
  profile.petXp[id] = petXp(id) + Math.floor(distance);
  const after = petLevel(id);
  save();
  return after > before ? after : 0;
}
