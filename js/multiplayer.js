// LAN race: one device hosts a room, others on the same Wi-Fi / hotspot join.
// Everyone runs the same seeded track; positions are exchanged ~15 times a second
// through the host (star topology), so nobody needs a server or the internet.
import { cleanTrophies } from './house.js';
export const LAN_PORT = 47777;
// v2 (late join, reconnect, gifts, relay, handicap, tracks): older versions don't see these rooms
// v3 (v1.9: boss raid, builder vs runners, trophies): v1.8 and older don't see these rooms
export const PROTO = 3;
export const MAX_PLAYERS = 8;
export const TOUR_RACES = 5;
// tournament points for 1st, 2nd, 3rd... place in each race
const TOUR_POINTS = [10, 8, 6, 5, 4, 3, 2, 1];
// co-op: the whole team shares this many hearts; the host keeps the count
export const COOP_HEARTS = 3;
const TIMEOUT = 4500; // players send something at least every second (heartbeat)
const RECONNECT = 15000; // a client that lost the host keeps knocking this long before giving up
// every LAN mode, in the order of the mode picker
export const LAN_MODES = ['race', 'sabotage', 'elimination', 'tournament', 'bracket', 'builder', 'coop', 'bosses', 'raid', 'teams', 'relay'];
// co-op modes: the whole team shares the hearts
export const COOP_MODES = ['coop', 'bosses', 'raid'];
// builder vs runners: the builder spends energy on obstacles, a runner who reaches this distance wins
export const BUILD_PIECES = { cactus: 1, bird: 2, boulder: 2, wall: 3 };
export const BUILD_GOAL = 1500;
export const BUILD_ENERGY = 6;
// modes that can run on a track from the level editor instead of a random one
export const TRACK_MODES = ['race', 'sabotage', 'tournament', 'bracket', 'coop', 'teams'];
// modes played as two teams, A and B, alternating in lobby order
export const TEAM_MODES = ['teams', 'relay'];
// handicap: a slower world (the score still counts at full speed) and spare hearts
export const HANDICAPS = [
  { k: 1, hearts: 0 },
  { k: 0.85, hearts: 1 },
  { k: 0.7, hearts: 2 },
];
// gifts between friends in a room: what they cost the sender
export const GIFTS = { b25: 25, b100: 100, snack: 60 };
export const GIFTS_PER_DAY = 5;
// quick messages in the room: ready-made phrases (i18n keys qm_0 .. qm_7)
export const QUICK_MSGS = 8;
function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// the QR code a host shows so friends can join without searching
const JOIN_HEADER = 'ANOTHERDINO-LAN';
export const isLanJoin = (text) => String(text || '').trim().startsWith(JOIN_HEADER + ';');
export function encodeLanJoin(ips, name) {
  return [JOIN_HEADER, ips.join(','), LAN_PORT, String(name || '').replace(/;/g, '').slice(0, 12)].join(';');
}
export function decodeLanJoin(text) {
  const [, ips, port, name] = String(text || '').trim().split(';');
  const list = String(ips || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  if (!list.length) return null;
  return { ips: list, port: Number(port) || LAN_PORT, name: name || '' };
}
const cleanTrack = (trk) =>
  trk && typeof trk.t === 'string' ? { name: String(trk.name || '').slice(0, 18), w: trk.w | 0, s: trk.s | 0, t: trk.t.replace(/[^.a-zA-Z]/g, '').slice(0, 60) } : null;

export class LanSession {
  constructor(transport, me, on) {
    this.t = transport;
    this.me = me; // { id, name, skin, hat, hc, ti (title), spec (only watches) }
    this.on = on; // { rooms, lobby, start, end, error, closed, attack, emote, reconnect, gift, giftDone }
    this.role = 'idle';
    this.rooms = new Map();
    this.players = new Map(); // host: id -> player
    this.lobby = [];
    this.peerStates = new Map();
    this.timers = [];
    this.raceSeed = null;
    this.hostSeen = 0;
    this.mode = 'race'; // race | sabotage | elimination | tournament | coop
    this.hearts = COOP_HEARTS; // co-op: the hearts the team has left
    this.hitsSeen = new Set(); // host: co-op hits already counted (each one is sent three times)
    this.tour = null; // host: { race, total, pts: Map id -> points }
    this.track = null; // a level-editor track everyone plays, or null for a random one
    this.order = []; // ids in lobby order when the race started (teams and relay)
    this.raceIds = new Set(); // host: who runs in this race (a late joiner waits for the next one)
    this.lobbySt = 'lobby'; // client: what the host is doing (a late joiner sees 'race')
    this.reconnecting = 0; // client: when the host went quiet
    this.gifts = new Map(); // gifts and track packs on their way: key -> { to, m, tries, done }
    this.giftsSeen = new Set();
    this.bracket = null; // host: the knockout cup { round, alive: [ids], rounds: [...], done, champ }
    this.cup = null; // the cup as everyone sees it (from the lobby)
  }

  async open() {
    await this.t.start(LAN_PORT, (m) => this.receive(m));
    this.every(1000, () => this.tick());
  }

  every(ms, fn) {
    this.timers.push(setInterval(fn, ms));
  }

  async close() {
    for (let i = 0; i < 3; i++) {
      if (this.role === 'host') this.toPeers({ t: 'close' });
      else if (this.role === 'client') this.toHost({ t: 'bye' });
    }
    clearInterval(this.relay);
    clearInterval(this.giftTimer);
    this.timers.forEach(clearInterval);
    this.timers = [];
    this.role = 'idle';
    await this.t.stop();
  }

  pack(m) {
    return JSON.stringify({ ...m, p: PROTO, from: this.me.id });
  }
  toHost(m) {
    if (this.hostAddr) this.t.send(this.hostAddr, this.hostPort, this.pack(m));
  }
  toPeers(m) {
    const data = this.pack(m);
    for (const p of this.players.values()) if (p.addr) this.t.send(p.addr, p.port, data);
  }

  // -------------------------------------------------------------- roles
  host() {
    this.role = 'host';
    this.state = 'lobby';
    this.players = new Map([[this.me.id, { ...this.me, addr: null, seen: Date.now() }]]);
    this.publishLobby();
  }

  browse() {
    this.role = 'browse';
    this.rooms.clear();
  }

  join(addr, port = LAN_PORT) {
    this.role = 'client';
    this.hostAddr = addr;
    this.hostPort = port;
    this.hostSeen = Date.now();
    this.sendJoin();
  }

  sendJoin() {
    const { name, skin, hat, hc, ti, spec, tr } = this.me;
    this.toHost({ t: 'join', name, skin, hat, hc, ti, spec: spec ? 1 : 0, tr: cleanTrophies(tr) });
  }

  setMe(fields) {
    Object.assign(this.me, fields);
    if (this.role === 'host') {
      Object.assign(this.players.get(this.me.id), fields);
      this.publishLobby();
    } else if (this.role === 'client') this.sendJoin();
  }

  // -------------------------------------------------------------- periodic
  tick() {
    const now = Date.now();
    if (this.role === 'host') {
      this.t.broadcast(LAN_PORT, this.pack({ t: 'ad', name: this.me.name, n: this.players.size, st: this.state }));
      let changed = false;
      for (const [id, p] of this.players) {
        if (id !== this.me.id && now - p.seen > TIMEOUT) {
          this.players.delete(id);
          this.peerStates.delete(id);
          changed = true;
        }
      }
      if (changed || this.state === 'lobby') this.publishLobby();
      if (this.state === 'race') this.checkEnd();
    } else if (this.role === 'browse') {
      for (const [k, r] of this.rooms) if (now - r.seen > 3500) this.rooms.delete(k);
      this.on.rooms([...this.rooms.values()]);
    } else if (this.role === 'client') {
      // knocking again while the host is quiet: the host takes us back with the same id
      if (this.state !== 'race' || this.reconnecting) this.sendJoin();
      // a heartbeat in case the game sends nothing for a while (a very slow frame rate, the results screen…)
      else if (performance.now() - (this.lastSend || 0) > 1000) this.toHost({ t: 'hb' });
      if (now - this.hostSeen > TIMEOUT && !this.reconnecting) {
        this.reconnecting = now;
        this.on.reconnect(true);
      }
      if (this.reconnecting && now - this.hostSeen > TIMEOUT + RECONNECT) {
        this.reconnecting = 0;
        this.role = 'idle';
        this.on.error('hostLost');
      }
    }
  }

  publishLobby() {
    this.lobby = [...this.players.values()].map(({ id, name, skin, hat, hc, ti, spec, tr }) => ({ id, name, skin, hat, hc: hc | 0, ti: ti || '', spec: spec ? 1 : 0, tr: cleanTrophies(tr), late: this.state === 'race' && !this.raceIds.has(id) ? 1 : 0 }));
    this.cup = this.cupInfo();
    const tour = this.tour ? { race: this.tour.race, total: this.tour.total } : null;
    this.lobbySt = this.state;
    this.toPeers({ t: 'lobby', players: this.lobby, st: this.state, mode: this.mode, tour, last: this.lastEnd || null, trk: this.trackFor(), cup: this.cup, rs: this.raceSeed });
    this.on.lobby(this.lobby, true);
  }

  // the track of the next race, if the mode can use one
  trackFor(mode = this.mode) {
    return this.track && TRACK_MODES.includes(mode) ? this.track : null;
  }
  setTrack(lv) {
    if (this.role !== 'host' || this.state === 'race') return;
    this.track = cleanTrack(lv);
    this.publishLobby();
  }

  // -------------------------------------------------------------- race
  startRace() {
    if (this.role !== 'host') return;
    // a double tap on START must not start two races (the first one's relay would keep running)
    if (this.state === 'race' && performance.now() - (this.startedAt || 0) < 1500) return;
    this.startedAt = performance.now();
    clearInterval(this.relay);
    // a tournament is a series of races; a new one starts after the last race
    if (this.mode === 'tournament' && (!this.tour || this.tour.race >= this.tour.total)) this.tour = { race: 0, total: TOUR_RACES, pts: new Map() };
    if (this.mode !== 'tournament') this.tour = null;
    this.state = 'race';
    this.raceSeed = (Math.random() * 2 ** 31) | 0;
    this.hearts = COOP_HEARTS;
    this.hitsSeen.clear();
    this.peerStates.clear();
    // who runs: everyone but the spectators (and, in the cup, only those still in it)
    const runners = [...this.players.values()].filter((p) => !p.spec).map((p) => p.id);
    if (this.mode === 'bracket') {
      if (!this.bracket || this.bracket.done) this.bracket = { round: 0, alive: shuffle(runners), rounds: [], done: false, champ: null };
      this.bracket.alive = this.bracket.alive.filter((id) => this.players.has(id));
      this.order = this.bracket.alive.slice();
    } else if (this.mode === 'builder' && runners.length >= 2) {
      // builder vs runners: everybody gets a turn as the builder, one race each
      this.bldTurn = (this.bldTurn ?? -1) + 1;
      this.builder = runners[this.bldTurn % runners.length];
      this.order = runners.filter((id) => id !== this.builder);
    } else this.order = runners;
    this.raceIds = new Set(this.order);
    const x = this.raceExtra();
    // relay: only the first runner of each team starts, the others wait for the baton
    this.order.forEach((id, i) => this.peerStates.set(id, { id, sc: 0, y: 0, d: 0, a: 1, w: this.mode === 'relay' && i >= 2 ? 1 : 0 }));
    for (let i = 0; i < 3; i++) setTimeout(() => this.toPeers({ t: 'go', seed: this.raceSeed, mode: this.mode, ...x }), i * 150);
    this.on.start(this.raceSeed, this.mode, x);
    this.publishLobby();
    // the seed rides along, so a player who lost every 'go' packet still finds the race
    this.relay = setInterval(() => this.toPeers({ t: 'all', s: [...this.peerStates.values()], seed: this.raceSeed, mode: this.mode, h: this.hearts, ...x }), 66);
  }

  // players who can run (spectators only watch)
  runners() {
    return this.lobby.filter((p) => !p.spec);
  }
  // the cup as shown in every lobby: this round's pairs and who is still in
  cupInfo() {
    const b = this.bracket;
    if (!b || this.mode !== 'bracket') return null;
    const name = (id) => (this.players.get(id) || {}).name || '?';
    const pairs = [];
    for (let i = 0; i < b.alive.length; i += 2) pairs.push([name(b.alive[i]), b.alive[i + 1] ? name(b.alive[i + 1]) : null]);
    return { round: b.round, left: b.alive.length, pairs, rounds: b.rounds, done: b.done, champ: b.champ };
  }

  raceExtra() {
    const trk = this.trackFor();
    return { ord: this.order, ...(trk ? { trk } : {}), ...(this.mode === 'builder' && this.builder ? { bld: this.builder } : {}) };
  }

  // co-op: this player was hit. Returns the hearts the team has left after it (0 = the run is over).
  // A client guesses the count right away; the host's number (in every 'all' message) has the last word.
  coopHit() {
    this.hearts = Math.max(0, this.hearts - 1);
    if (this.role === 'client') {
      const k = Math.random().toString(36).slice(2, 8);
      for (let i = 0; i < 3; i++) setTimeout(() => this.toHost({ t: 'hit', k }), i * 80);
    }
    return this.hearts;
  }

  // called by the game every frame (throttled here)
  sendState(st) {
    const now = performance.now();
    if (now - (this.lastSend || 0) < 60 && st.a) return;
    this.lastSend = now;
    const s = { id: this.me.id, sc: Math.floor(st.sc), pt: Math.floor(st.pt ?? st.sc), y: Math.round(st.y * 100) / 100, d: st.d ? 1 : 0, a: st.a ? 1 : 0 };
    if (st.w) s.w = 1; // relay: still waiting for the baton
    if (st.v) s.v = Math.round(st.v * 10) / 10; // relay: the speed the next runner starts with
    if (st.ft) s.ft = Math.round(st.ft * 10) / 10; // a track's finish line: the time
    if (st.hc) s.hc = st.hc;
    if (st.dm) s.dm = st.dm | 0; // raid: this player's hits on the boss
    if (this.role === 'host') {
      this.peerStates.set(this.me.id, s);
      this.checkEnd();
    } else if (this.role === 'client') this.toHost({ t: 's', s });
  }

  checkEnd() {
    if (this.state !== 'race') return;
    const all = [...this.peerStates.values()].filter((s) => this.players.has(s.id));
    if (all.length && all.every((s) => !s.a)) {
      this.state = 'lobby';
      clearInterval(this.relay);
      // ranked by points (distance plus combo bonus); on a track, whoever crossed the finish
      // line first wins and the others follow by points
      const tm = new Map(this.order.map((id, i) => [id, i % 2]));
      const results = all
        .map((s) => {
          const r = { id: s.id, name: this.players.get(s.id).name, sc: s.pt ?? s.sc, tm: tm.get(s.id) ?? 0 };
          if (s.ft) r.ft = s.ft;
          if (this.players.get(s.id).hc) r.hc = this.players.get(s.id).hc;
          return r;
        })
        .sort((a, b) => (a.ft && b.ft ? a.ft - b.ft : a.ft ? -1 : b.ft ? 1 : b.sc - a.sc));
      let tour = null;
      if (this.tour) {
        const tr = this.tour;
        tr.race++;
        results.forEach((r, i) => tr.pts.set(r.id, (tr.pts.get(r.id) || 0) + (TOUR_POINTS[i] || 0)));
        const table = [...tr.pts.entries()]
          .filter(([id]) => this.players.has(id))
          .map(([id, pts]) => ({ id, name: this.players.get(id).name, pts }))
          .sort((a, b) => b.pts - a.pts);
        tour = { race: tr.race, total: tr.total, table, done: tr.race >= tr.total };
      }
      // the cup: in every pair the one with more points goes on; an odd one out goes on free
      let cup = null;
      if (this.mode === 'bracket' && this.bracket) {
        const b = this.bracket;
        const rank = new Map(results.map((r, i) => [r.id, i]));
        const name = (id) => (this.players.get(id) || {}).name || '?';
        const next = [];
        const pairs = [];
        for (let i = 0; i < b.alive.length; i += 2) {
          const a = b.alive[i];
          const c = b.alive[i + 1];
          let w = a;
          if (c != null) w = (rank.get(a) ?? 99) <= (rank.get(c) ?? 99) ? a : c;
          next.push(w);
          pairs.push({ a: name(a), b: c != null ? name(c) : null, w: name(w) });
        }
        b.rounds.push(pairs);
        b.round++;
        b.alive = next;
        if (next.length <= 1) {
          b.done = true;
          b.champ = next[0] ? { id: next[0], name: name(next[0]) } : null;
        }
        cup = { round: b.round, pairs, left: next.length, done: b.done, champ: b.champ };
      }
      const end = { t: 'end', r: results, seed: this.raceSeed, tour, mode: this.mode, cup };
      this.lastEnd = end; // repeated in every lobby message for anyone who missed it
      this.toPeers(end);
      for (let i = 1; i < 3; i++) setTimeout(() => this.toPeers(end), i * 150);
      this.on.end(results, tour, this.mode, cup);
      this.publishLobby();
    }
  }

  setMode(mode) {
    if (this.role !== 'host' || this.state === 'race') return; // never in the middle of a race
    this.mode = mode;
    this.tour = null;
    this.bracket = null;
    this.publishLobby();
  }

  // sabotage: drop a boulder on everyone else's track
  attack(k) {
    if (this.role === 'host') this.toPeers({ t: 'atk', by: this.me.id, k });
    else this.toHost({ t: 'atk', k });
  }

  // ------------------------------------------------------------ gifts
  // a message for one player: the host passes it on (clients only talk to the host)
  sendTo(id, m) {
    if (this.role === 'host') {
      const p = this.players.get(id);
      if (p && p.addr) this.t.send(p.addr, p.port, this.pack({ ...m, to: id }));
    } else if (this.role === 'client') this.toHost({ ...m, to: id });
  }
  // sent again until the friend says it arrived; returns false if the friend is not here
  gift(to, kind) {
    if (!(kind in GIFTS)) return false;
    return this.reliable(to, { t: 'gift', kind }, (ok) => this.on.giftDone({ to, kind }, ok));
  }
  // the host shares its tracks from the level editor with everyone in the room
  sendPack(levels) {
    const lv = (levels || []).map(cleanTrack).filter(Boolean).slice(0, 20);
    if (!lv.length) return 0;
    let n = 0;
    for (const p of this.lobby) if (p.id !== this.me.id && this.reliable(p.id, { t: 'pack', lv }, (ok) => this.on.packDone(p.id, ok))) n++;
    return n;
  }
  // sent again every 0.7 s until the friend says it arrived (10 tries)
  reliable(to, m, done) {
    if (!this.lobby.some((p) => p.id === to)) return false;
    const k = Math.random().toString(36).slice(2, 10);
    this.gifts.set(k, { to, m: { ...m, k }, tries: 0, done });
    this.sendTo(to, { ...m, k });
    if (!this.giftTimer)
      this.giftTimer = setInterval(() => {
        for (const [key, g] of this.gifts) {
          if (++g.tries > 10) {
            this.gifts.delete(key);
            g.done(false);
          } else this.sendTo(g.to, g.m);
        }
        if (!this.gifts.size) {
          clearInterval(this.giftTimer);
          this.giftTimer = null;
        }
      }, 700);
    return true;
  }
  // gifts and their receipts, wherever they came from
  direct(m) {
    if ((m.t === 'gift' && m.kind in GIFTS) || (m.t === 'pack' && Array.isArray(m.lv))) {
      this.sendTo(m.from, { t: 'gack', k: m.k });
      const key = m.from + ':' + m.k;
      if (this.giftsSeen.has(key)) return; // a repeat of something we already have
      this.giftsSeen.add(key);
      if (m.t === 'gift') this.on.gift(m.from, m.kind);
      else this.on.pack(m.from, m.lv.map(cleanTrack).filter(Boolean).slice(0, 20));
    } else if (m.t === 'gack') {
      const g = this.gifts.get(m.k);
      if (!g) return;
      this.gifts.delete(m.k);
      g.done(true);
    }
  }

  // a quick message (one of the ready-made phrases) to everyone in the room
  quick(i) {
    i = Math.max(0, Math.min(QUICK_MSGS - 1, i | 0));
    this.on.quick(this.me.id, i);
    if (this.role === 'host') this.toPeers({ t: 'qm', by: this.me.id, i });
    else this.toHost({ t: 'qm', i });
  }

  emote(e) {
    this.on.emote(this.me.id, e);
    if (this.role === 'host') this.toPeers({ t: 'emo', by: this.me.id, e });
    else this.toHost({ t: 'emo', e });
  }

  // host: pass a client's attack / emote on to the other players
  relayFrom(m, from) {
    const data = this.pack({ ...m, by: from });
    for (const p of this.players.values()) if (p.addr && p.id !== from) this.t.send(p.addr, p.port, data);
  }

  others() {
    return [...this.peerStates.values()].filter((s) => s.id !== this.me.id);
  }

  // -------------------------------------------------------------- receive
  receive({ data, address, port }) {
    let m;
    try {
      m = JSON.parse(data);
    } catch {
      return;
    }
    if (!m || m.from === this.me.id) return;
    // a room from another version of the game: listed, but it can't be joined
    if (this.role === 'browse' && m.t === 'ad') {
      this.rooms.set(m.from, { id: m.from, name: m.name, n: m.n, st: m.st, addr: address, port, seen: Date.now(), old: m.p !== PROTO });
      this.on.rooms([...this.rooms.values()]);
      return;
    }
    if (m.p !== PROTO) return;
    if (m.t === 'gift' || m.t === 'gack' || m.t === 'pack') {
      // the host passes on what is meant for someone else
      if (this.role === 'host' && m.to && m.to !== this.me.id) {
        const p = this.players.get(m.to);
        if (p && p.addr && this.players.has(m.from)) this.t.send(p.addr, p.port, data);
        return;
      }
      if (this.role === 'host' ? this.players.has(m.from) : this.role === 'client' && address === this.hostAddr) this.direct(m);
      return;
    }

    if (this.role === 'host') {
      if (m.t === 'join') {
        let p = this.players.get(m.from);
        if (!p) {
          if (this.players.size >= MAX_PLAYERS) {
            // tell them, instead of leaving them waiting
            this.t.send(address, port, this.pack({ t: 'full' }));
            return;
          }
          // someone who dropped out of this race comes back and carries on; anyone else
          // joining during a race waits in the room for the next one
          p = { id: m.from };
          this.players.set(m.from, p);
          if (this.state === 'race' && this.raceIds.has(m.from) && !this.peerStates.has(m.from)) this.peerStates.set(m.from, { id: m.from, sc: 0, y: 0, d: 0, a: 1 });
        }
        Object.assign(p, { name: String(m.name).slice(0, 12), skin: m.skin, hat: m.hat, hc: Math.max(0, Math.min(HANDICAPS.length - 1, m.hc | 0)), ti: String(m.ti || '').slice(0, 12), spec: m.spec ? 1 : 0, tr: cleanTrophies(m.tr), addr: address, port, seen: Date.now() });
        this.publishLobby();
      } else if (m.t === 'hb' && this.players.has(m.from)) {
        this.players.get(m.from).seen = Date.now();
      } else if (m.t === 's' && this.players.has(m.from)) {
        this.players.get(m.from).seen = Date.now();
        if (this.state === 'race' && this.raceIds.has(m.from)) this.peerStates.set(m.from, { ...m.s, id: m.from });
      } else if (m.t === 'hit' && this.players.has(m.from) && this.state === 'race' && COOP_MODES.includes(this.mode)) {
        const key = m.from + ':' + m.k;
        if (!this.hitsSeen.has(key)) {
          this.hitsSeen.add(key);
          this.hearts = Math.max(0, this.hearts - 1);
        }
      } else if (m.t === 'atk' && this.players.has(m.from) && this.state === 'race') {
        const k = m.k in BUILD_PIECES ? m.k : undefined;
        this.relayFrom({ t: 'atk', k }, m.from);
        this.on.attack(m.from, k);
      } else if (m.t === 'emo' && this.players.has(m.from)) {
        const e = String(m.e).slice(0, 8);
        this.relayFrom({ t: 'emo', e }, m.from);
        this.on.emote(m.from, e);
      } else if (m.t === 'qm' && this.players.has(m.from)) {
        const i = Math.max(0, Math.min(QUICK_MSGS - 1, m.i | 0));
        this.relayFrom({ t: 'qm', i }, m.from);
        this.on.quick(m.from, i);
      } else if (m.t === 'bye') {
        this.players.delete(m.from);
        this.peerStates.delete(m.from);
        this.publishLobby();
      }
      return;
    }

    if (this.role === 'client' && address === this.hostAddr) {
      this.hostSeen = Date.now();
      if (this.reconnecting) {
        this.reconnecting = 0;
        this.on.reconnect(false);
      }
      switch (m.t) {
        case 'lobby':
          this.lobby = m.players;
          this.mode = m.mode || 'race';
          this.lobbySt = m.st;
          this.track = cleanTrack(m.trk);
          this.cup = m.cup || null;
          // the race of ours ended but the 'end' packets were all lost: the lobby brings the results
          if (m.last && m.last.seed === this.raceSeed && this.endedSeed !== m.last.seed) {
            this.endedSeed = m.last.seed;
            this.state = 'lobby';
            this.on.end(m.last.r, m.last.tour || null, m.last.mode || this.mode, m.last.cup || null);
          }
          // back to the lobby only if the host is past OUR race: a late lobby packet sent
          // before 'go' (rs = the previous race) must not stop the race we are running
          if (m.st === 'lobby' && this.state === 'race' && (m.rs === undefined || m.rs === this.raceSeed)) this.state = 'lobby';
          this.on.lobby(m.players, false);
          break;
        case 'all':
          // a race is running that we never heard start (all 'go' packets lost): join it now
          if (m.seed != null && this.raceSeed !== m.seed && this.endedSeed !== m.seed && m.s.some((x) => x.id === this.me.id)) this.begin(m);
          for (const x of m.s) this.peerStates.set(x.id, x);
          if (m.seed === this.raceSeed && typeof m.h === 'number') this.hearts = m.h;
          break;
        case 'go':
          if (this.raceSeed !== m.seed) this.begin(m);
          break;
        case 'end':
          // keyed by race so repeats are ignored but a late 'end' still shows the results
          // (a player who came in during this race and only waited gets no results)
          if (this.endedSeed !== m.seed && m.seed === this.raceSeed) {
            this.endedSeed = m.seed;
            this.state = 'lobby';
            this.on.end(m.r, m.tour || null, m.mode || this.mode, m.cup || null);
          }
          break;
        case 'atk':
          if (m.by !== this.me.id) this.on.attack(m.by, m.k in BUILD_PIECES ? m.k : undefined);
          break;
        case 'emo':
          if (m.by !== this.me.id) this.on.emote(m.by, String(m.e).slice(0, 8));
          break;
        case 'qm':
          if (m.by !== this.me.id) this.on.quick(m.by, Math.max(0, Math.min(QUICK_MSGS - 1, m.i | 0)));
          break;
        case 'close':
          this.role = 'idle';
          this.on.closed();
          break;
        case 'full':
          if (this.state === 'race' || this.lobby.some((x) => x.id === this.me.id)) break; // we are already in
          this.role = 'idle';
          this.on.error('mpRoomFull');
          break;
      }
    }
  }

  // client: a race starts (from 'go', or from 'all' if every 'go' was lost)
  begin(m) {
    this.raceSeed = m.seed;
    this.mode = m.mode || 'race';
    this.state = 'race';
    this.hearts = COOP_HEARTS;
    this.peerStates.clear();
    this.order = Array.isArray(m.ord) ? m.ord : [];
    const trk = cleanTrack(m.trk);
    this.builder = m.bld ? String(m.bld) : null;
    this.on.start(m.seed, this.mode, { ord: this.order, ...(trk ? { trk } : {}), ...(this.builder ? { bld: this.builder } : {}) });
  }

  // a team's runners in relay order (index 0 = A, 1 = B)
  team(i) {
    return this.order.filter((_, k) => k % 2 === i);
  }

  nameOf(id) {
    const p = this.lobby.find((x) => x.id === id);
    return p ? p.name : '?';
  }
  playerInfo(id) {
    return this.lobby.find((x) => x.id === id);
  }
}
