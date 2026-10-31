// Procedural chiptune: each biome gets its own key, tempo and an 8-bar loop
// generated from a fixed seed, played with pulse/triangle/noise voices.
import { rng } from './voxel.js';

const SONGS = [
  // desert: A minor pentatonic, laid back
  { root: 57, scale: [0, 3, 5, 7, 10], chords: [0, 3, 2, 4], bpm: 132, lead: 0.25 },
  // jungle: D dorian, bouncy
  { root: 50, scale: [0, 2, 3, 5, 7, 9, 10], chords: [0, 3, 4, 3], bpm: 144, lead: 0.125 },
  // snow: E major, bells
  { root: 52, scale: [0, 2, 4, 7, 9], chords: [0, 3, 1, 4], bpm: 120, lead: 0.5 },
  // volcano: C phrygian, driving
  { root: 48, scale: [0, 1, 3, 5, 7, 8, 10], chords: [0, 1, 5, 1], bpm: 156, lead: 0.25 },
];

const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);

function buildSong(def, seed) {
  const r = rng(seed);
  const deg = (i) => def.scale[((i % def.scale.length) + def.scale.length) % def.scale.length] + 12 * Math.floor(i / def.scale.length);
  const bars = [];
  for (let b = 0; b < 8; b++) {
    const chord = def.chords[b % def.chords.length];
    const lead = [];
    const arp = [];
    const bass = [];
    let last = chord + 7;
    for (let s = 0; s < 16; s++) {
      // lead: chord tones on strong steps, stepwise motion in between, some rests
      if (s % 2 === 0 && r() > 0.22) {
        last += s % 4 === 0 ? [0, 2, -2, 4][Math.floor(r() * 4)] : [1, -1, 2][Math.floor(r() * 3)];
        last = Math.max(chord + 3, Math.min(chord + 12, last));
        lead.push(def.root + 12 + deg(last));
      } else lead.push(null);
      arp.push(def.root + 12 + deg(chord + [0, 2, 4, 2][s % 4]));
      bass.push(s % 4 === 0 || (s % 4 === 2 && r() < 0.4) ? def.root - 12 + deg(chord) : null);
    }
    bars.push({ lead, arp, bass });
  }
  return bars;
}

export class Music {
  constructor(sfx) {
    this.sfx = sfx;
    this.enabled = true;
    this.biome = 0;
    this.playing = false;
    this.rate = 1;
    this.songs = SONGS.map((d, i) => buildSong(d, 4242 + i * 97));
    this.step = 0;
    this.timer = null;
  }
  setup() {
    const ctx = this.sfx.ctx;
    if (!ctx || this.master) return !!ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.32;
    this.master.connect(ctx.destination);
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
    this.master.gain.cancelScheduledValues(this.sfx.ctx.currentTime);
    this.master.gain.setValueAtTime(0.32, this.sfx.ctx.currentTime);
    this.timer = setInterval(() => this.schedule(), 25);
  }
  stop(fade = 0.25) {
    if (!this.playing) return;
    this.playing = false;
    clearInterval(this.timer);
    const t = this.sfx.ctx.currentTime;
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(0.0001, t + fade);
  }
  setEnabled(on) {
    this.enabled = on;
    if (!on) this.stop(0.05);
  }
  schedule() {
    const ctx = this.sfx.ctx;
    const def = SONGS[this.biome];
    const stepDur = 60 / (def.bpm * this.rate) / 4;
    while (this.next < ctx.currentTime + 0.12) {
      this.playStep(this.step, this.next, stepDur);
      this.next += stepDur;
      this.step++;
    }
  }
  voice(wave, freq, t, dur, vol) {
    const ctx = this.sfx.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    if (typeof wave === 'string') o.type = wave;
    else o.setPeriodicWave(wave);
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  drum(t, kind) {
    const ctx = this.sfx.ctx;
    if (kind === 'kick') {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(0.5, t);
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
    g.gain.setValueAtTime(kind === 'hat' ? 0.09 : 0.22, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.01);
  }
  playStep(step, t, sd) {
    const song = this.songs[this.biome];
    const def = SONGS[this.biome];
    const bar = song[Math.floor(step / 16) % song.length];
    const s = step % 16;
    const lead = bar.lead[s];
    if (lead) this.voice(def.lead === 0.5 ? 'triangle' : def.lead === 0.125 ? this.waves.p125 : this.waves.p25, midiHz(lead), t, sd * 1.8, 0.07);
    if (s % 2 === 1) this.voice(this.waves.p50, midiHz(bar.arp[s]), t, sd * 0.8, 0.025);
    if (bar.bass[s]) this.voice('triangle', midiHz(bar.bass[s]), t, sd * 2.5, 0.2);
    if (s % 8 === 0) this.drum(t, 'kick');
    if (s % 8 === 4) this.drum(t, 'snare');
    if (s % 2 === 0) this.drum(t, 'hat');
  }
  // short jingle on game over
  sting() {
    if (!this.enabled || !this.setup()) return;
    const t = this.sfx.ctx.currentTime + 0.3;
    this.master.gain.cancelScheduledValues(t - 0.3);
    this.master.gain.setValueAtTime(0.32, t);
    [72, 67, 63, 60].forEach((m, i) => this.voice(this.waves.p25, midiHz(m), t + i * 0.12, 0.2, 0.08));
  }
}
