// LAN race: one device hosts a room, others on the same Wi-Fi / hotspot join.
// Everyone runs the same seeded track; positions are exchanged ~15 times a second
// through the host (star topology), so nobody needs a server or the internet.
export const LAN_PORT = 47777;
const PROTO = 1;
export const MAX_PLAYERS = 8;
export const TOUR_RACES = 5;
// tournament points for 1st, 2nd, 3rd... place in each race
const TOUR_POINTS = [10, 8, 6, 5, 4, 3, 2, 1];
const TIMEOUT = 4500; // players send something at least every second (heartbeat)

export class LanSession {
  constructor(transport, me, on) {
    this.t = transport;
    this.me = me; // { id, name, skin, hat }
    this.on = on; // { rooms, lobby, start, peers, end, error, closed }
    this.role = 'idle';
    this.rooms = new Map();
    this.players = new Map(); // host: id -> player
    this.lobby = [];
    this.peerStates = new Map();
    this.timers = [];
    this.raceSeed = null;
    this.hostSeen = 0;
    this.mode = 'race'; // race | sabotage | elimination | tournament
    this.tour = null; // host: { race, total, pts: Map id -> points }
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
    const { name, skin, hat } = this.me;
    this.toHost({ t: 'join', name, skin, hat });
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
      if (this.state !== 'race') this.sendJoin();
      // a heartbeat in case the game sends nothing for a while (a very slow frame rate, the results screen…)
      else if (performance.now() - (this.lastSend || 0) > 1000) this.toHost({ t: 'hb' });
      if (now - this.hostSeen > TIMEOUT) {
        this.role = 'idle';
        this.on.error('hostLost');
      }
    }
  }

  publishLobby() {
    this.lobby = [...this.players.values()].map(({ id, name, skin, hat }) => ({ id, name, skin, hat }));
    const tour = this.tour ? { race: this.tour.race, total: this.tour.total } : null;
    this.toPeers({ t: 'lobby', players: this.lobby, st: this.state, mode: this.mode, tour, last: this.lastEnd || null });
    this.on.lobby(this.lobby, true);
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
    this.peerStates.clear();
    for (const id of this.players.keys()) this.peerStates.set(id, { id, sc: 0, y: 0, d: 0, a: 1 });
    for (let i = 0; i < 3; i++) setTimeout(() => this.toPeers({ t: 'go', seed: this.raceSeed, mode: this.mode }), i * 150);
    this.on.start(this.raceSeed, this.mode);
    // the seed rides along, so a player who lost every 'go' packet still finds the race
    this.relay = setInterval(() => this.toPeers({ t: 'all', s: [...this.peerStates.values()], seed: this.raceSeed, mode: this.mode }), 66);
  }

  // called by the game every frame (throttled here)
  sendState(st) {
    const now = performance.now();
    if (now - (this.lastSend || 0) < 60 && st.a) return;
    this.lastSend = now;
    const s = { id: this.me.id, sc: Math.floor(st.sc), pt: Math.floor(st.pt ?? st.sc), y: Math.round(st.y * 100) / 100, d: st.d ? 1 : 0, a: st.a ? 1 : 0 };
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
      // ranked by points (distance plus combo bonus)
      const results = all
        .map((s) => ({ id: s.id, name: this.players.get(s.id).name, sc: s.pt ?? s.sc }))
        .sort((a, b) => b.sc - a.sc);
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
      const end = { t: 'end', r: results, seed: this.raceSeed, tour };
      this.lastEnd = end; // repeated in every lobby message for anyone who missed it
      this.toPeers(end);
      for (let i = 1; i < 3; i++) setTimeout(() => this.toPeers(end), i * 150);
      this.on.end(results, tour);
      this.publishLobby();
    }
  }

  setMode(mode) {
    if (this.role !== 'host') return;
    this.mode = mode;
    this.tour = null;
    this.publishLobby();
  }

  // sabotage: drop a boulder on everyone else's track
  attack() {
    if (this.role === 'host') this.toPeers({ t: 'atk', by: this.me.id });
    else this.toHost({ t: 'atk' });
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
    if (!m || m.p !== PROTO || m.from === this.me.id) return;

    if (this.role === 'browse' && m.t === 'ad') {
      this.rooms.set(m.from, { id: m.from, name: m.name, n: m.n, st: m.st, addr: address, port, seen: Date.now() });
      this.on.rooms([...this.rooms.values()]);
      return;
    }

    if (this.role === 'host') {
      if (m.t === 'join') {
        let p = this.players.get(m.from);
        if (!p) {
          if (this.players.size >= MAX_PLAYERS || this.state === 'race') {
            // tell them, instead of leaving them waiting
            this.t.send(address, port, this.pack({ t: this.state === 'race' ? 'busy' : 'full' }));
            return;
          }
          p = { id: m.from };
          this.players.set(m.from, p);
        }
        Object.assign(p, { name: String(m.name).slice(0, 12), skin: m.skin, hat: m.hat, addr: address, port, seen: Date.now() });
        this.publishLobby();
      } else if (m.t === 'hb' && this.players.has(m.from)) {
        this.players.get(m.from).seen = Date.now();
      } else if (m.t === 's' && this.players.has(m.from)) {
        this.players.get(m.from).seen = Date.now();
        if (this.state === 'race') this.peerStates.set(m.from, { ...m.s, id: m.from });
      } else if (m.t === 'atk' && this.players.has(m.from) && this.state === 'race') {
        this.relayFrom({ t: 'atk' }, m.from);
        this.on.attack(m.from);
      } else if (m.t === 'emo' && this.players.has(m.from)) {
        const e = String(m.e).slice(0, 8);
        this.relayFrom({ t: 'emo', e }, m.from);
        this.on.emote(m.from, e);
      } else if (m.t === 'bye') {
        this.players.delete(m.from);
        this.peerStates.delete(m.from);
        this.publishLobby();
      }
      return;
    }

    if (this.role === 'client' && address === this.hostAddr) {
      this.hostSeen = Date.now();
      switch (m.t) {
        case 'lobby':
          this.lobby = m.players;
          this.mode = m.mode || 'race';
          // the race of ours ended but the 'end' packets were all lost: the lobby brings the results
          if (m.last && m.last.seed === this.raceSeed && this.endedSeed !== m.last.seed) {
            this.endedSeed = m.last.seed;
            this.state = 'lobby';
            this.on.end(m.last.r, m.last.tour || null);
          }
          if (m.st === 'lobby' && this.state === 'race') this.state = 'lobby';
          this.on.lobby(m.players, false);
          break;
        case 'all':
          // a race is running that we never heard start (all 'go' packets lost): join it now
          if (m.seed != null && this.raceSeed !== m.seed && this.endedSeed !== m.seed && m.s.some((x) => x.id === this.me.id)) {
            this.raceSeed = m.seed;
            this.mode = m.mode || 'race';
            this.state = 'race';
            this.peerStates.clear();
            this.on.start(m.seed, this.mode);
          }
          for (const x of m.s) this.peerStates.set(x.id, x);
          break;
        case 'go':
          if (this.raceSeed !== m.seed) {
            this.raceSeed = m.seed;
            this.mode = m.mode || 'race';
            this.state = 'race';
            this.peerStates.clear();
            this.on.start(m.seed, this.mode);
          }
          break;
        case 'end':
          // keyed by race so repeats are ignored but a late 'end' still shows the results
          if (this.endedSeed !== m.seed) {
            this.endedSeed = m.seed;
            this.state = 'lobby';
            this.on.end(m.r, m.tour || null);
          }
          break;
        case 'atk':
          if (m.by !== this.me.id) this.on.attack(m.by);
          break;
        case 'emo':
          if (m.by !== this.me.id) this.on.emote(m.by, String(m.e).slice(0, 8));
          break;
        case 'close':
          this.role = 'idle';
          this.on.closed();
          break;
        case 'full':
        case 'busy':
          if (this.state === 'race' || this.lobby.some((x) => x.id === this.me.id)) break; // we are already in
          this.role = 'idle';
          this.on.error(m.t === 'full' ? 'mpRoomFull' : 'mpRoomBusy');
          break;
      }
    }
  }

  nameOf(id) {
    const p = this.lobby.find((x) => x.id === id);
    return p ? p.name : '?';
  }
  playerInfo(id) {
    return this.lobby.find((x) => x.id === id);
  }
}
