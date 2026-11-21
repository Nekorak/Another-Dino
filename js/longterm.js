// v1.8: things to spend bones on for weeks, not days.
//  - titles: a few words shown next to your name in LAN rooms and on the player card
//  - sticker album: packs of 3 random stickers; doubles turn into glitter that buys the missing ones
//  - skin mastery: every skin you own can climb 3 ranks, each one +5% bones while you wear it
import { profile, save } from './save.js';
import { SKINS } from './models.js';

// ------------------------------------------------------------------ titles
// price 0 = earned, not bought (how is in `earn`)
export const TITLES = {
  rookie: { icon: '🥚', price: 150 },
  runner: { icon: '🏃', price: 300 },
  jumper: { icon: '🦘', price: 450 },
  cactus: { icon: '🌵', price: 600 },
  bones: { icon: '🦴', price: 800 },
  storm: { icon: '⛈️', price: 1000 },
  ninja: { icon: '🥷', price: 1300 },
  explorer: { icon: '🧭', price: 1600 },
  pilot: { icon: '✈️', price: 2000 },
  wizard: { icon: '🧙', price: 2500 },
  champion: { icon: '🏆', price: 3200 },
  dragon: { icon: '🐉', price: 4000 },
  legend: { icon: '🌟', price: 5000 },
  king: { icon: '👑', price: 6500 },
  meteor: { icon: '☄️', price: 8000 },
  // earned
  collector: { icon: '📒', price: 0, earn: 'album' }, // the whole sticker album
  master: { icon: '🎖️', price: 0, earn: 'mastery' }, // one skin at rank 3
  relay: { icon: '🏅', price: 0, earn: 'relay' }, // 5 relay wins
  friend: { icon: '🎁', price: 0, earn: 'gifts' }, // 20 gifts sent
  bracket: { icon: '🥇', price: 0, earn: 'bracket' }, // a knockout cup won
};

export function buyTitle(id) {
  const tt = TITLES[id];
  if (!tt || !tt.price || profile.titles.includes(id) || profile.coins < tt.price) return false;
  profile.coins -= tt.price;
  profile.titles.push(id);
  profile.title = id;
  save();
  return true;
}
export function giveTitle(id) {
  if (!TITLES[id] || profile.titles.includes(id)) return false;
  profile.titles.push(id);
  save();
  return true;
}
// the titles earned by playing, checked after runs, races and album changes
export function checkEarnedTitles() {
  const st = profile.stats;
  const got = [];
  const want = {
    album: albumDone(),
    mastery: Object.values(profile.mastery).some((r) => r >= MASTERY.length),
    relay: (st.relayWins || 0) >= 5,
    gifts: (st.giftsSent || 0) >= 20,
    bracket: (st.brackets || 0) >= 1,
  };
  for (const [id, tt] of Object.entries(TITLES)) if (tt.earn && want[tt.earn] && giveTitle(id)) got.push(id);
  return got;
}

// ------------------------------------------------------------------ sticker album
// 6 pages x 8 stickers: 5 common, 2 rare, 1 legendary on every page
export const PAGES = [
  { id: 'dinos', list: ['🦖', '🦕', '🥚', '🦴', '🐊', '🦎', '🐢', '🐲'] },
  { id: 'worlds', list: ['🌵', '🌴', '🏖️', '❄️', '🌋', '🏙️', '🪐', '🌈'] },
  { id: 'food', list: ['🍎', '🍌', '🍩', '🍉', '🍕', '🍭', '🧁', '🍰'] },
  { id: 'sea', list: ['🐟', '🐠', '🦀', '🐙', '🐬', '🦈', '🐳', '🧜'] },
  { id: 'space', list: ['⭐', '🌙', '☄️', '🛰️', '🚀', '👽', '🛸', '🌌'] },
  { id: 'legends', list: ['🗡️', '🛡️', '🏰', '🧙', '🐉', '🦄', '👑', '💎'] },
];
const RARITY = ['common', 'common', 'common', 'common', 'common', 'rare', 'rare', 'legendary'];
export const STICKERS = PAGES.flatMap((pg, p) => pg.list.map((e, i) => ({ id: `${p}-${i}`, page: p, e, r: RARITY[i] })));
export const PACK_PRICE = 120;
export const PACK_SIZE = 3;
// what a double is worth in glitter, and what a missing sticker costs in glitter
export const GLITTER = { common: 1, rare: 3, legendary: 10 };
export const GLITTER_COST = { common: 10, rare: 30, legendary: 100 };
export const PAGE_REWARD = 300;

const pickRarity = (rnd) => (rnd < 0.04 ? 'legendary' : rnd < 0.25 ? 'rare' : 'common');
export function openPack(rnd = Math.random) {
  if (profile.coins < PACK_PRICE) return null;
  profile.coins -= PACK_PRICE;
  const out = [];
  for (let i = 0; i < PACK_SIZE; i++) {
    const r = pickRarity(rnd());
    const pool = STICKERS.filter((s) => s.r === r);
    out.push(addSticker(pool[Math.floor(rnd() * pool.length)]));
  }
  profile.stats.packs = (profile.stats.packs || 0) + 1;
  const pages = finishedPages();
  save();
  return { stickers: out, pages };
}
function addSticker(s) {
  const n = profile.stickers[s.id] || 0;
  profile.stickers[s.id] = n + 1;
  // a double becomes glitter right away
  if (n > 0) profile.glitter += GLITTER[s.r];
  return { ...s, dup: n > 0 };
}
// glitter buys one missing sticker of your choice
export function craftSticker(id) {
  const s = STICKERS.find((x) => x.id === id);
  if (!s || profile.stickers[id] || profile.glitter < GLITTER_COST[s.r]) return null;
  profile.glitter -= GLITTER_COST[s.r];
  profile.stickers[id] = 1;
  const pages = finishedPages();
  save();
  return { pages };
}
export const pageDone = (p) => STICKERS.filter((s) => s.page === p).every((s) => profile.stickers[s.id]);
export const albumDone = () => PAGES.every((_, p) => pageDone(p));
export const stickerCount = () => STICKERS.filter((s) => profile.stickers[s.id]).length;
// pages finished just now: each gives its reward once
function finishedPages() {
  const done = [];
  PAGES.forEach((_, p) => {
    if (pageDone(p) && !profile.pagesDone.includes(p)) {
      profile.pagesDone.push(p);
      profile.coins += PAGE_REWARD;
      done.push(p);
    }
  });
  return done;
}

// ------------------------------------------------------------------ skin mastery
// cost of each rank; every rank: +5% bones while wearing that skin
export const MASTERY = [400, 1200, 3000];
export const MASTERY_BONUS = 0.05;
export const masteryOf = (skin) => profile.mastery[skin] || 0;
export const masteryCost = (skin) => MASTERY[masteryOf(skin)] ?? null;
export const masteryK = (skin = profile.skin) => 1 + MASTERY_BONUS * masteryOf(skin);
export function buyMastery(skin) {
  const cost = masteryCost(skin);
  if (cost == null || !profile.owned.skin.includes(skin) || !SKINS[skin] || profile.coins < cost) return false;
  profile.coins -= cost;
  profile.mastery[skin] = masteryOf(skin) + 1;
  save();
  return true;
}
export const stars = (n, max = MASTERY.length) => '★'.repeat(n) + '☆'.repeat(Math.max(0, max - n));
