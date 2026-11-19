// The medal album: a bronze, silver and gold medal for every statistic.
import { profile, save } from './save.js';

// [bronze, silver, gold] for each stat ('time' is in seconds)
export const MEDALS = {
  games: [10, 100, 500],
  distance: [10000, 100000, 1000000],
  best: [1000, 3000, 6000],
  jumps: [500, 5000, 25000],
  ducks: [100, 1000, 5000],
  coins: [500, 5000, 25000],
  obstacles: [300, 3000, 20000],
  perfects: [50, 500, 2500],
  bestCombo: [2, 4, 5],
  powerups: [25, 250, 1000],
  meteors: [10, 100, 500],
  pounds: [10, 100, 500],
  goldBones: [5, 50, 250],
  time: [3600, 36000, 180000],
  dailies: [5, 30, 100],
  chests: [7, 30, 100],
  eggs: [1, 5, 15],
  revives: [1, 10, 50],
  bosses: [1, 8, 24],
  miniBosses: [3, 25, 100],
  botWins: [1, 10, 50],
  challengesWon: [1, 10, 50],
  mpGames: [5, 50, 200],
  mpWins: [1, 20, 100],
  tournaments: [1, 5, 20],
  coopGames: [1, 10, 50],
  coopBest: [1000, 3000, 6000],
  levelsMade: [1, 5, 15],
  levelsWon: [1, 10, 40],
  photos: [1, 10, 30],
  weeklies: [3, 15, 60],
  // v1.6
  teamBosses: [1, 10, 30],
  seasonRuns: [5, 25, 100],
};
export const MEDAL_REWARD = [0, 25, 75, 200]; // bones for bronze, silver, gold
export const MEDAL_NAMES = ['', 'bronze', 'silver', 'gold'];

export const medalOf = (stat) => profile.medals[stat] || 0;

// the tier the stat value earns right now (0..3)
export function earnedTier(stat) {
  const v = profile.stats[stat] || 0;
  return MEDALS[stat].filter((n) => v >= n).length;
}

// gives every medal earned since the last check; returns [{ stat, tier, reward }]
export function checkMedals() {
  const fresh = [];
  for (const stat of Object.keys(MEDALS)) {
    const have = medalOf(stat);
    const now = earnedTier(stat);
    for (let tier = have + 1; tier <= now; tier++) {
      profile.coins += MEDAL_REWARD[tier];
      fresh.push({ stat, tier, reward: MEDAL_REWARD[tier] });
    }
    if (now > have) profile.medals[stat] = now;
  }
  if (fresh.length) save();
  return fresh;
}

export function medalCount() {
  const out = [0, 0, 0, 0];
  for (const stat of Object.keys(MEDALS)) out[medalOf(stat)]++;
  return { bronze: out[1] + out[2] + out[3], silver: out[2] + out[3], gold: out[3], total: Object.keys(MEDALS).length };
}
