// v1.9: the dino's house, its trophy shelf, and the friends' league
//  - house: furniture bought with bones, placed in the room; comfort gives up to +10% bones
//  - trophies: earned in LAN (cups, tournaments, league, raids...), shown on the shelf and in LAN rooms
//  - league: points for every LAN race between the same friends, a champion every week
import { profile, save } from './save.js';

// ------------------------------------------------------------------ house
// slot: where it can stand (wall, floor, table); comfort adds to the room's comfort
export const FURNITURE = {
  // wall
  painting: { icon: '🖼️', slot: 'wall', price: 150, comfort: 2 },
  window: { icon: '🪟', slot: 'wall', price: 250, comfort: 3 },
  clock: { icon: '🕰️', slot: 'wall', price: 400, comfort: 4 },
  map: { icon: '🗺️', slot: 'wall', price: 600, comfort: 5 },
  mirror: { icon: '🪞', slot: 'wall', price: 900, comfort: 7 },
  fossil: { icon: '🦴', slot: 'wall', price: 1500, comfort: 10 },
  // floor
  plant: { icon: '🪴', slot: 'floor', price: 200, comfort: 2 },
  chair: { icon: '🪑', slot: 'floor', price: 300, comfort: 3 },
  teddy: { icon: '🧸', slot: 'floor', price: 500, comfort: 5 },
  sofa: { icon: '🛋️', slot: 'floor', price: 900, comfort: 8 },
  bed: { icon: '🛏️', slot: 'floor', price: 1400, comfort: 11 },
  piano: { icon: '🎹', slot: 'floor', price: 2200, comfort: 15 },
  aquarium: { icon: '🐠', slot: 'floor', price: 3000, comfort: 18 },
  // table
  lamp: { icon: '💡', slot: 'table', price: 150, comfort: 2 },
  books: { icon: '📚', slot: 'table', price: 300, comfort: 3 },
  radio: { icon: '📻', slot: 'table', price: 600, comfort: 5 },
  tv: { icon: '📺', slot: 'table', price: 1200, comfort: 9 },
  console: { icon: '🎮', slot: 'table', price: 2000, comfort: 13 },
  globe: { icon: '🌍', slot: 'table', price: 2600, comfort: 15 },
};
export const SLOTS = { wall: 3, floor: 4, table: 2 };
// wallpaper and floor: the first one of each is free
export const WALLS = { cream: { c: '#f6ecd2', price: 0 }, mint: { c: '#cdeedd', price: 300 }, sky: { c: '#cfe4f7', price: 300 }, rose: { c: '#f7d4dd', price: 500 }, night: { c: '#3a3f66', price: 1000 } };
export const FLOORS = { wood: { c: '#b98552', price: 0 }, stone: { c: '#9da3a8', price: 300 }, grass: { c: '#7cbf5a', price: 500 }, carpet: { c: '#b8434f', price: 800 } };
export const COMFORT_MAX = 100; // comfort for the full +10%
export const HOUSE_MAX_BONUS = 0.1;

const ensure = () => {
  const h = profile.house;
  // drop anything that is not (or no longer) a piece of furniture, a wallpaper or a floor
  h.owned = h.owned.filter((id, i, a) => FURNITURE[id] && a.indexOf(id) === i);
  for (const k of Object.keys(h.slots)) if (!/^(wall|floor|table)\d$/.test(k) || +k.slice(-1) >= SLOTS[k.replace(/\d$/, '')] || (h.slots[k] && (!FURNITURE[h.slots[k]] || !h.owned.includes(h.slots[k]) || !k.startsWith(FURNITURE[h.slots[k]].slot)))) {
    if (/^(wall|floor|table)\d$/.test(k) && +k.slice(-1) < SLOTS[k.replace(/\d$/, '')]) h.slots[k] = '';
    else delete h.slots[k];
  }
  if (!WALLS[h.wall]) h.wall = 'cream';
  if (!FLOORS[h.floor]) h.floor = 'wood';
  for (const [s, n] of Object.entries(SLOTS)) for (let i = 0; i < n; i++) if (!(s + i in h.slots)) h.slots[s + i] = '';
  return h;
};
export function comfort() {
  const h = ensure();
  let c = Object.values(h.slots).reduce((a, id) => a + (FURNITURE[id] ? FURNITURE[id].comfort : 0), 0);
  c += Math.round((WALLS[h.wall] || WALLS.cream).price / 100) + Math.round((FLOORS[h.floor] || FLOORS.wood).price / 100);
  return c;
}
export const houseBonus = () => Math.min(HOUSE_MAX_BONUS, (comfort() / COMFORT_MAX) * HOUSE_MAX_BONUS);
export const houseK = () => 1 + houseBonus();

// buys a piece of furniture (it goes to the first free slot of its kind)
export function buyFurniture(id) {
  const f = FURNITURE[id];
  const h = ensure();
  if (!f || h.owned.includes(id) || profile.coins < f.price) return false;
  profile.coins -= f.price;
  h.owned.push(id);
  const free = Object.keys(h.slots).find((k) => k.startsWith(f.slot) && !h.slots[k]);
  if (free) h.slots[free] = id;
  save();
  return true;
}
// puts an owned piece in a slot ('' empties it); a piece stands in one slot only
export function placeFurniture(slot, id) {
  const h = ensure();
  if (!(slot in h.slots)) return false;
  if (id && (!h.owned.includes(id) || !slot.startsWith(FURNITURE[id].slot))) return false;
  for (const k of Object.keys(h.slots)) if (id && h.slots[k] === id) h.slots[k] = '';
  h.slots[slot] = id || '';
  save();
  return true;
}
export function buyStyle(kind, id) {
  const list = kind === 'wall' ? WALLS : FLOORS;
  const h = ensure();
  const it = list[id];
  if (!it) return false;
  const have = h.styles.includes(kind + ':' + id) || !it.price;
  if (!have) {
    if (profile.coins < it.price) return false;
    profile.coins -= it.price;
    h.styles.push(kind + ':' + id);
  }
  h[kind] = id;
  save();
  return true;
}
export const hasStyle = (kind, id) => !(kind === 'wall' ? WALLS : FLOORS)[id].price || profile.house.styles.includes(kind + ':' + id);
export const houseSlots = () => ensure().slots;

// ------------------------------------------------------------------ trophies
// each trophy counts how many times it was won (0 = not yet)
export const TROPHIES = {
  cup: { icon: '🏆', n: (s) => s.brackets || 0 },
  tour: { icon: '🥇', n: (s) => s.tournaments || 0 },
  league: { icon: '👑', n: (s) => s.leagues || 0 },
  raid: { icon: '🐲', n: (s) => s.raids || 0 },
  builder: { icon: '🧱', n: (s) => s.builderWins || 0 },
  relay: { icon: '🏅', n: (s) => s.relayWins || 0 },
  lan: { icon: '🎖️', n: (s) => ((s.mpWins || 0) >= 10 ? Math.floor(s.mpWins / 10) : 0) },
};
export const trophyCount = (id) => TROPHIES[id].n(profile.stats);
export const myTrophies = () => Object.keys(TROPHIES).filter((id) => trophyCount(id) > 0);
// sent with the player in LAN rooms: the trophies won, at most 7 ids
export const cleanTrophies = (list) => (Array.isArray(list) ? list.filter((id) => id in TROPHIES).slice(0, 7) : []);

// ------------------------------------------------------------------ friends' league
// a "season" of the league is one week (Monday to Sunday) on this device
export function weekKey(d = new Date()) {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = (x.getUTCDay() + 6) % 7; // Monday = 0
  x.setUTCDate(x.getUTCDate() - day + 3); // the Thursday of this week decides its year
  const y = x.getUTCFullYear();
  const w = 1 + Math.floor((x - Date.UTC(y, 0, 1)) / 86400000 / 7);
  return `${y}-${String(w).padStart(2, '0')}`;
}
export const LEAGUE_POINTS = [10, 8, 6, 5, 4, 3, 2, 1];
// a new week: last week's leader becomes its champion; returns { name, me } if a season just ended
export function leagueRoll(d = new Date()) {
  const L = profile.league;
  const wk = weekKey(d);
  if (L.wk === wk) return null;
  let done = null;
  const top = Object.entries(L.pts).filter(([, p]) => Number.isFinite(p)).sort((a, b) => b[1] - a[1])[0];
  if (L.wk && top) {
    done = { wk: L.wk, name: top[0], pts: top[1], me: top[0] === profile.name };
    L.champs.unshift(done);
    L.champs.length = Math.min(L.champs.length, 8);
    if (done.me) profile.stats.leagues = (profile.stats.leagues || 0) + 1;
  }
  L.wk = wk;
  L.pts = {};
  save();
  return done;
}
// points for a race: by place, only in modes where everybody runs for themselves
export function leagueRace(results) {
  leagueRoll();
  const L = profile.league;
  results.slice(0, LEAGUE_POINTS.length).forEach((r, i) => (L.pts[r.name] = (L.pts[r.name] || 0) + LEAGUE_POINTS[i]));
  save();
}
export const leagueTable = () =>
  Object.entries(profile.league.pts)
    .filter(([, pts]) => Number.isFinite(pts))
    .map(([name, pts]) => ({ name, pts }))
    .sort((a, b) => b.pts - a.pts);
// days left in this week's season (today counts)
export const leagueDaysLeft = (d = new Date()) => 7 - ((d.getDay() + 6) % 7);
