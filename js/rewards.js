// Daily chest (a present every day you play, bigger on a streak) and the free season pass.
import { profile, save } from './save.js';
import { addXp, today } from './progress.js';

const dayNum = (s) => Math.floor(new Date(s + 'T12:00:00').getTime() / 86400000);

// ------------------------------------------------------------------ daily chest
export const CHEST_DAYS = [20, 30, 40, 60, 80, 100, 200]; // bones on day 1..7 of a streak

export function chestInfo() {
  const t = today();
  const c = profile.chest;
  if (c.last === t) return { available: false, day: c.streak };
  // the streak goes on if the chest was opened yesterday; after day 7 it starts over
  const goesOn = c.last && dayNum(c.last) === dayNum(t) - 1;
  const day = goesOn ? (c.streak % CHEST_DAYS.length) + 1 : 1;
  return { available: true, day, bones: CHEST_DAYS[day - 1], xp: day * 15 };
}

export function openChest() {
  const info = chestInfo();
  if (!info.available) return null;
  profile.chest = { last: today(), streak: info.day };
  profile.coins += info.bones;
  profile.stats.chests = (profile.stats.chests || 0) + 1;
  const xp = addXp(info.xp);
  addPassXp(info.xp);
  save();
  return { ...info, levelUps: xp.levelUps, unlocked: xp.unlocked };
}

// ------------------------------------------------------------------ season pass
// One pass per quarter of the year; XP from runs (and chests) fills it.
export const PASS_TIERS = 30;
export const PASS_XP = 250; // XP per tier
export const PASS_SPECIAL = { 10: ['hat', 'laurel'], 20: ['trail', 'confetti'], 30: ['skin', 'champion'] };

export function passSeason(d = new Date()) {
  const q = Math.floor(d.getMonth() / 3);
  const ends = new Date(d.getFullYear(), q * 3 + 3, 1);
  return { id: `${d.getFullYear()}-${q + 1}`, q, daysLeft: Math.max(1, Math.ceil((ends - d) / 86400000)) };
}

export function passState() {
  const s = passSeason();
  if (profile.pass.season !== s.id) {
    // a new season: the pass starts over (exclusive items you got stay yours)
    profile.pass = { season: s.id, xp: 0, claimed: [] };
    save();
  }
  const tier = Math.min(PASS_TIERS, Math.floor(profile.pass.xp / PASS_XP));
  const unclaimed = [];
  for (let i = 1; i <= tier; i++) if (!profile.pass.claimed.includes(i)) unclaimed.push(i);
  return { ...s, xp: profile.pass.xp, tier, into: profile.pass.xp % PASS_XP, unclaimed };
}

export function addPassXp(amount) {
  passState();
  profile.pass.xp += Math.max(0, Math.floor(amount));
}

// what tier n gives: { kind: 'bones', n } or { kind: 'hat'|'trail'|'skin', id }
export function passReward(n) {
  if (PASS_SPECIAL[n]) {
    const [kind, id] = PASS_SPECIAL[n];
    // already have it from an earlier season: bones instead
    if (profile.owned[kind].includes(id)) return { kind: 'bones', n: 200, was: id };
    return { kind, id };
  }
  return { kind: 'bones', n: n % 5 === 0 ? 100 : 20 + n * 2 };
}

export function claimTier(n) {
  const st = passState();
  if (n > st.tier || profile.pass.claimed.includes(n)) return null;
  const r = passReward(n);
  if (r.kind === 'bones') profile.coins += r.n;
  else profile.owned[r.kind].push(r.id);
  profile.pass.claimed.push(n);
  save();
  return r;
}
