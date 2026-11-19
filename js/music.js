// Procedural chiptune: each biome gets its own key, tempo and a song generated from a
// fixed seed, played with pulse/triangle/noise voices. A song has several parts
// (A, B, A with a second voice, a quiet bridge) so it no longer repeats every few seconds.
// There are also tracks of their own for the menu and the bosses, and short jingles.
import { rng } from './voxel.js';

// one song per biome, in the same order as BIOMES, then the menu and boss tracks
// chords are scale degrees; chordsB is the progression of the second part
// style: drum pattern ('normal', 'soft' for calm tracks, 'boss' for the fights)
const SONGS = [
  // desert: A minor pentatonic, laid back
  { id: 'desert', root: 57, scale: [0, 3, 5, 7, 10], chords: [0, 3, 2, 4], chordsB: [3, 4, 2, 0], bpm: 132, lead: 0.25 },
  // jungle: D dorian, bouncy
  { id: 'jungle', root: 50, scale: [0, 2, 3, 5, 7, 9, 10], chords: [0, 3, 4, 3], chordsB: [5, 4, 3, 1], bpm: 144, lead: 0.125 },
  // beach: F lydian, sunny
  { id: 'beach', root: 53, scale: [0, 2, 4, 6, 7, 9, 11], chords: [0, 1, 4, 0], chordsB: [5, 4, 1, 4], bpm: 128, lead: 0.25 },
  // snow: E major, bells
  { id: 'snow', root: 52, scale: [0, 2, 4, 7, 9], chords: [0, 3, 1, 4], chordsB: [4, 3, 2, 1], bpm: 120, lead: 0.5 },
  // cave: B minor, slow and echoing
  { id: 'cave', root: 47, scale: [0, 2, 3, 5, 7, 8, 10], chords: [0, 5, 3, 4], chordsB: [5, 6, 4, 4], bpm: 104, lead: 0.5 },
  // city: G minor, punchy
  { id: 'city', root: 55, scale: [0, 2, 3, 5, 7, 8, 10], chords: [0, 5, 6, 4], chordsB: [3, 4, 5, 6], bpm: 140, lead: 0.125 },
  // volcano: C phrygian, driving
  { id: 'volcano', root: 48, scale: [0, 1, 3, 5, 7, 8, 10], chords: [0, 1, 5, 1], chordsB: [5, 6, 1, 0], bpm: 156, lead: 0.25 },
  // space: C whole-tone, floating
  { id: 'space', root: 48, scale: [0, 2, 4, 6, 8, 10], chords: [0, 2, 1, 3], chordsB: [4, 3, 2, 1], bpm: 112, lead: 0.5 },
  // ocean: E dorian, slow and wavy
  { id: 'ocean', root: 52, scale: [0, 2, 3, 5, 7, 9, 10], chords: [0, 4, 3, 1], chordsB: [3, 5, 4, 0], bpm: 100, lead: 0.5 },
  // candy: C major, sugary and quick
  { id: 'candy', root: 60, scale: [0, 2, 4, 5, 7, 9, 11], chords: [0, 5, 3, 4], chordsB: [3, 4, 2, 5], bpm: 152, lead: 0.125 },
  // world of the season: A harmonic minor, a bit mysterious
  { id: 'season', root: 57, scale: [0, 2, 3, 5, 7, 8, 11], chords: [0, 3, 5, 4], chordsB: [5, 3, 1, 4], bpm: 136, lead: 0.25 },
  // menu: G major pentatonic, calm and friendly
  { id: 'menu', root: 55, scale: [0, 2, 4, 7, 9], chords: [0, 3, 4, 2], chordsB: [3, 4, 1, 0], bpm: 96, lead: 0.5, style: 'soft' },
  // boss: D harmonic minor, fast and tense
  { id: 'boss', root: 50, scale: [0, 2, 3, 5, 7, 8, 11], chords: [0, 0, 5, 4], chordsB: [3, 1, 5, 4], bpm: 172, lead: 0.25, style: 'boss' },
];
export const MENU_TRACK = 11;
export const BOSS_TRACK = 12;
export const TRACK_IDS = SONGS.map((s) => s.id);

// short tunes: [midi, start in beats, length in beats], played at their own tempo
const JINGLES = {
  // finishing a level
  victory: { bpm: 150, wave: 'p25', notes: [[67, 0, 0.5], [72, 0.5, 0.5], [76, 1, 0.5], [79, 1.5, 1], [76, 2.5, 0.5], [79, 3, 0.5], [84, 3.5, 2]], bass: [[48, 0, 1.5], [55, 1.5, 1], [60, 3.5, 2]] },
  // a new record
  record: { bpm: 180, wave: 'p125', notes: [[72, 0, 0.25], [76, 0.25, 0.25], [79, 0.5, 0.25], [84, 0.75, 0.75], [83, 1.5, 0.25], [84, 1.75, 0.25], [88, 2, 1.5]], bass: [[48, 0, 0.75], [52, 0.75, 0.75], [55, 1.5, 0.5], [60, 2, 1.5]] },
  // the boss runs away
  bossDown: { bpm: 160, wave: 'p25', notes: [[69, 0, 0.33], [72, 0.33, 0.33], [76, 0.66, 0.33], [81, 1, 1], [79, 2, 0.5], [81, 2.5, 1.5]], bass: [[45, 0, 1], [52, 1, 1], [57, 2, 2]] },
  // a new player level
  levelUp: { bpm: 200, wave: 'p50', notes: [[76, 0, 0.5], [79, 0.5, 0.5], [84, 1, 1]], bass: [] },
  // game over (the old "sting")
  over: { bpm: 140, wave: 'p25', notes: [[72, 0, 0.5], [67, 0.5, 0.5], [63, 1, 0.5], [60, 1.5, 1]], bass: [[48, 0, 1], [43, 1, 1.5]] },
};

const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);

function buildSong(def, seed) {
  const r = rng(seed);
  const deg = (i) => def.scale[((i % def.scale.length) + def.scale.length) % def.scale.length] + 12 * Math.floor(i / def.scale.length);
  // one part of the song: the lead walks over the chords, the arpeggio and bass follow them
  const part = (chords, nBars, kind) => {
    const bars = [];
    for (let b = 0; b < nBars; b++) {
      const chord = chords[b % chords.length];
      const lead = [];
      const arp = [];
      const bass = [];
      const harm = [];
      let last = chord + (kind === 'B' ? 9 : 7);
      for (let s = 0; s < 16; s++) {
        // lead: chord tones on strong steps, stepwise motion in between, some rests
        const play = kind === 'C' ? s % 8 === 0 && r() > 0.3 : s % 2 === 0 && r() > (kind === 'B' ? 0.3 : 0.22);
        if (play) {
          last += s % 4 === 0 ? [0, 2, -2, 4][Math.floor(r() * 4)] : [1, -1, 2][Math.floor(r() * 3)];
          last = Math.max(chord + 3, Math.min(chord + (kind === 'B' ? 14 : 12), last));
          lead.push(def.root + 12 + deg(last));
          harm.push(def.root + 12 + deg(last - 2)); // a third below, for the second time round
        } else {
          lead.push(null);
          harm.push(null);
        }
        const pat = kind === 'B' ? [0, 4, 2, 4] : [0, 2, 4, 2];
        arp.push(def.root + 12 + deg(chord + pat[s % 4]));
        const bassHit = def.style === 'boss' ? s % 2 === 0 : s % 4 === 0 || (s % 4 === 2 && r() < 0.4);
        bass.push(bassHit ? def.root - 12 + deg(chord) + (def.style === 'boss' && s % 4 === 2 ? 12 : 0) : null);
      }
      bars.push({ lead, arp, bass, harm, drums: kind === 'C' ? 'light' : b === nBars - 1 ? 'fill' : 'full', second: false });
    }
    return bars;
  };
  const A = part(def.chords, 8, 'A');
  const B = part(def.chordsB || def.chords, 8, 'B');
  const C = part(def.chords, 4, 'C');
  // A, B, A again with a second voice, then a short quiet bridge
  return [...A, ...B, ...A.map((bar) => ({ ...bar, second: true })), ...C];
}

export class Music {
  constructor(sfx) {
    this.sfx = sfx;
    this.enabled = true;
    this.biome = 0; // the track to play: a biome index, MENU_TRACK or BOSS_TRACK
    this.boss = false; // a boss fight plays the boss track over the biome's song
    this.playing = false;
    this.rate = 1;
    this.volume = 1;
    this.songs = SONGS.map((d, i) => buildSong(d, 4242 + i * 97));
    this.step = 0;
    this.timer = null;
    this.current = -1;
  }
  get track() {
    return this.boss ? BOSS_TRACK : Math.max(0, Math.min(SONGS.length - 1, this.biome | 0));
  }
  get level() {
    return 0.32 * this.volume;
  }
  setup() {
    const ctx = this.sfx.ctx;
    if (!ctx || this.master) return !!ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.level;
    this.master.connect(ctx.destination);
    this.jingleOut = ctx.createGain();
    this.jingleOut.gain.value = this.level;
    this.jingleOut.connect(ctx.destination);
    const pulse = (duty) => {
      const n = 32;
      const real = new Float32Array(n);
      const imag = new Float32Array(n);
      for (let k = 1; k < n; k++) {
        real[k] = (2 / (k * Math.PI)) * Math.sin(2 * Math.PI * k * duty);
        imag[k] = (2 / (k * Math.PI)) * (1 - Math.cos(2 * Math.PI * k * duty));
      }
      return ctx.createPeriodicWave(real, imag);
    };
    this.waves = { p25: pulse(0.25), p125: pulse(0.125), p50: pulse(0.5) };
    const len = ctx.sampleRate * 0.3;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  start() {
    if (!this.enabled || this.playing || !this.setup()) return;
    this.playing = true;
    this.next = this.sfx.ctx.currentTime + 0.06;
    this.step = 0;
    this.current = this.track;
    this.master.gain.cancelScheduledValues(this.sfx.ctx.currentTime);
    this.master.gain.setValueAtTime(this.level, this.sfx.ctx.currentTime);
    this.timer = setInterval(() => this.schedule(), 25);
  }
  stop(fade = 0.25) {
    if (!this.playing) return;
    this.playing = false;
    clearInterval(this.timer);
    const t = this.sfx.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(0.0001, t + fade);
  }
  setEnabled(on) {
    this.enabled = on;
    if (!on) this.stop(0.05);
  }
  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (!this.master) return;
    const t = this.sfx.ctx.currentTime;
    this.jingleOut.gain.setValueAtTime(this.level, t);
    if (this.playing) {
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setValueAtTime(this.level, t);
    }
  }
  schedule() {
    const ctx = this.sfx.ctx;
    // a new track (another world, a boss) starts from its first bar
    if (this.track !== this.current) {
      this.current = this.track;
      this.step = 0;
    }
    const def = SONGS[this.current];
    const stepDur = 60 / (def.bpm * this.rate) / 4;
    while (this.next < ctx.currentTime + 0.12) {
      this.playStep(this.step, this.next, stepDur);
      this.next += stepDur;
      this.step++;
    }
  }
  voice(wave, freq, t, dur, vol, out = this.master) {
    const ctx = this.sfx.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    if (typeof wave === 'string') o.type = wave;
    else o.setPeriodicWave(wave);
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  drum(t, kind, vol = 1) {
    const ctx = this.sfx.ctx;
    if (kind === 'kick') {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(0.5 * vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 0.15);
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = kind === 'hat' ? 'highpass' : 'bandpass';
    f.frequency.value = kind === 'hat' ? 7000 : 1800;
    const g = ctx.createGain();
    const dur = kind === 'hat' ? 0.03 : 0.12;
    g.gain.setValueAtTime((kind === 'hat' ? 0.09 : 0.22) * vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.01);
  }
  playStep(step, t, sd) {
    const song = this.songs[this.current];
    const def = SONGS[this.current];
    const bar = song[Math.floor(step / 16) % song.length];
    const s = step % 16;
    const lead = bar.lead[s];
    const leadWave = def.lead === 0.5 ? 'triangle' : def.lead === 0.125 ? this.waves.p125 : this.waves.p25;
    if (lead) this.voice(leadWave, midiHz(lead), t, sd * 1.8, def.lead === 0.5 ? 0.1 : 0.07);
    if (bar.second && bar.harm[s]) this.voice(this.waves.p50, midiHz(bar.harm[s]), t, sd * 1.6, 0.03);
    if (s % 2 === 1) this.voice(this.waves.p50, midiHz(bar.arp[s]), t, sd * 0.8, bar.drums === 'light' ? 0.035 : 0.025);
    if (bar.bass[s]) this.voice('triangle', midiHz(bar.bass[s]), t, sd * (def.style === 'boss' ? 1.6 : 2.5), 0.2);
    this.drums(def.style || 'normal', bar.drums, s, t, sd);
  }
  drums(style, kind, s, t, sd) {
    if (kind === 'light') {
      if (s === 0) this.drum(t, 'kick', 0.6);
      if (s % 4 === 2) this.drum(t, 'hat', 0.7);
      return;
    }
    if (kind === 'fill' && s >= 12) {
      // a little roll into the next part
      this.drum(t, 'snare', 0.5 + (s - 12) * 0.15);
      if (s === 14) this.drum(t + sd / 2, 'snare', 0.6);
      return;
    }
    if (style === 'soft') {
      if (s === 0 || s === 10) this.drum(t, 'kick', 0.5);
      if (s % 4 === 2) this.drum(t, 'hat', 0.6);
      return;
    }
    if (style === 'boss') {
      if (s % 4 === 0) this.drum(t, 'kick');
      if (s % 8 === 4) this.drum(t, 'snare');
      this.drum(t, 'hat', s % 2 ? 0.6 : 1);
      return;
    }
    if (s % 8 === 0) this.drum(t, 'kick');
    if (s % 8 === 4) this.drum(t, 'snare');
    if (s % 2 === 0) this.drum(t, 'hat');
  }
  // a short tune over (or instead of) the music
  jingle(name, delay = 0) {
    const j = JINGLES[name];
    if (!j || !this.enabled || !this.setup()) return;
    const ctx = this.sfx.ctx;
    const beat = 60 / j.bpm;
    const t0 = ctx.currentTime + 0.05 + delay;
    for (const [m, at, len] of j.notes) this.voice(this.waves[j.wave], midiHz(m), t0 + at * beat, len * beat * 1.1, 0.09, this.jingleOut);
    for (const [m, at, len] of j.bass) this.voice('triangle', midiHz(m), t0 + at * beat, len * beat, 0.2, this.jingleOut);
  }
  // game over: the music stops and a short sad tune plays
  sting() {
    this.stop(0.2);
    this.jingle('over', 0.25);
  }
}
