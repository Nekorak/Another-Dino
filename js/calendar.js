// v1.9: things that follow the calendar on this device (there is no server)
//  - the challenge of the day: one of 31, picked by the day of the month (world + goal)
//  - seasonal events: a few weeks a year, with a skin that can only be bought then
import { profile } from './save.js';

// ------------------------------------------------------------------ challenge of the day
// w: world (0 desert, 1 jungle, 2 beach, 3 snow, 4 cave, 5 city, 6 volcano, 7 space)
// goal: score (points), bones (bones in one run), jumps, obstacles (jumped over or broken)
export const DAY_GOALS = { score: '🏁', bones: '🦴', jumps: '🦘', obstacles: '🌵' };
export const DAY_CH = [
  { w: 0, goal: 'score', n: 600 },
  { w: 1, goal: 'bones', n: 15 },
  { w: 2, goal: 'jumps', n: 40 },
  { w: 3, goal: 'obstacles', n: 25 },
  { w: 4, goal: 'score', n: 700 },
  { w: 5, goal: 'bones', n: 20 },
  { w: 6, goal: 'jumps', n: 50 },
  { w: 7, goal: 'score', n: 800 },
  { w: 0, goal: 'obstacles', n: 30 },
  { w: 1, goal: 'score', n: 900 },
  { w: 2, goal: 'bones', n: 25 },
  { w: 3, goal: 'jumps', n: 55 },
  { w: 4, goal: 'obstacles', n: 35 },
  { w: 5, goal: 'score', n: 1000 },
  { w: 6, goal: 'bones', n: 25 },
  { w: 7, goal: 'jumps', n: 45 },
  { w: 0, goal: 'score', n: 1100 },
  { w: 1, goal: 'obstacles', n: 40 },
  { w: 2, goal: 'score', n: 1200 },
  { w: 3, goal: 'bones', n: 30 },
  { w: 4, goal: 'jumps', n: 60 },
  { w: 5, goal: 'obstacles', n: 45 },
  { w: 6, goal: 'score', n: 1300 },
  { w: 7, goal: 'bones', n: 30 },
  { w: 0, goal: 'jumps', n: 70 },
  { w: 1, goal: 'score', n: 1400 },
  { w: 2, goal: 'obstacles', n: 50 },
  { w: 3, goal: 'score', n: 1500 },
  { w: 4, goal: 'bones', n: 35 },
  { w: 5, goal: 'jumps', n: 80 },
  // the 31st: the big one
  { w: 6, goal: 'score', n: 2000 },
];
export const dayChallenge = (date = new Date()) => DAY_CH[date.getDate() - 1];

// ------------------------------------------------------------------ seasonal events
// from / to: [month, day], both included; a range that crosses the new year wraps around.
// Each event has a skin that is sold only while it runs (kept forever once bought)
// and makes bones worth a bit more.
export const EVENTS = [
  { id: 'winter', icon: '❄️', from: [12, 15], to: [1, 6], skin: 'snowman' },
  { id: 'spring', icon: '🌷', from: [3, 1], to: [3, 14], skin: 'blossom' },
  { id: 'kids', icon: '🎈', from: [6, 1], to: [6, 7], skin: 'party' },
  { id: 'summer', icon: '☀️', from: [7, 1], to: [7, 15], skin: 'surf' },
  { id: 'halloween', icon: '🎃', from: [10, 20], to: [11, 5], skin: 'ghostly' },
  { id: 'harvest', icon: '🍂', from: [11, 15], to: [11, 30], skin: 'autumn' },
];
export const EVENT_BONES = 1.2;

const md = (d) => (d.getMonth() + 1) * 100 + d.getDate();
const inside = (ev, d) => {
  const x = md(d);
  const a = ev.from[0] * 100 + ev.from[1];
  const b = ev.to[0] * 100 + ev.to[1];
  return a <= b ? x >= a && x <= b : x >= a || x <= b;
};
// ?event=<id> forces one (testing), ?event=none turns them off
export function currentEvent(date = new Date()) {
  const forced = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('event') : null;
  if (forced) return EVENTS.find((e) => e.id === forced) || null;
  if (profile.settings && profile.settings.seasons === false) return null;
  return EVENTS.find((e) => inside(e, date)) || null;
}
// days left in the event (today counts)
export function eventDaysLeft(ev, date = new Date()) {
  let n = 0;
  const d = new Date(date);
  while (inside(ev, d) && n < 60) {
    n++;
    d.setDate(d.getDate() + 1);
  }
  return n;
}
// the next event and how many days until it starts
export function nextEvent(date = new Date()) {
  const d = new Date(date);
  for (let i = 1; i <= 366; i++) {
    d.setDate(d.getDate() + 1);
    const ev = EVENTS.find((e) => inside(e, d) && !inside(e, date));
    if (ev) return { ev, days: i };
  }
  return null;
}
export const eventBonesK = () => (currentEvent() ? EVENT_BONES : 1);
