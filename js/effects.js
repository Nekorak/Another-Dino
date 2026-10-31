// Particles (dust, voxel shatter, weather) and the retro display styles.
import * as THREE from 'three';
import { VOX } from './voxel.js';

// ------------------------------------------------------------------ dust
export class Dust {
  constructor(scene, count = 48) {
    this.mat = new THREE.MeshLambertMaterial({ color: '#e2bf86' });
    const geo = new THREE.BoxGeometry(VOX, VOX, VOX);
    this.items = [];
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(geo, this.mat);
      m.visible = false;
      scene.add(m);
      this.items.push({ m, life: 0, vx: 0, vy: 0, vz: 0 });
    }
    this.i = 0;
  }
  setColor(c) {
    this.mat.color.set(c);
  }
  puff(x, y, z, vx, vy, vz) {
    const d = this.items[this.i++ % this.items.length];
    d.m.position.set(x, y, z);
    Object.assign(d, { vx, vy, vz, life: 0.45 });
    d.m.visible = true;
  }
  update(dt, worldV) {
    for (const d of this.items) {
      if (d.life <= 0) continue;
      d.life -= dt;
      d.vy -= 9 * dt;
      d.m.position.x += (d.vx - worldV * 0.2) * dt;
      d.m.position.y = Math.max(0.05, d.m.position.y + d.vy * dt);
      d.m.position.z += d.vz * dt;
      d.m.scale.setScalar(Math.max(0.01, d.life / 0.45));
      if (d.life <= 0) d.m.visible = false;
    }
  }
}

// ------------------------------------------------------------------ voxel shatter
// Instanced chunks that fly apart, bounce on the ground and settle.
export class Shatter {
  constructor(scene, max = 420) {
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(VOX * 2, VOX * 2, VOX * 2), new THREE.MeshLambertMaterial(), max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = true;
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.max = max;
    this.parts = [];
    this.tmp = new THREE.Object3D();
    this.color = new THREE.Color();
  }
  clear() {
    this.parts.length = 0;
    this.mesh.count = 0;
  }
  // pieces: [{x,y,z,color}] local positions; origin: world offset
  burst(pieces, ox, oy, oz, power = 1, carry = 0) {
    for (const p of pieces) {
      if (this.parts.length >= this.max) break;
      const dx = p.x - 0.2;
      const dy = p.y - 1.4;
      const len = Math.hypot(dx, dy, p.z) || 1;
      const s = (3 + Math.random() * 5) * power;
      this.parts.push({
        x: ox + p.x,
        y: oy + p.y,
        z: oz + p.z,
        vx: (dx / len) * s + carry + (Math.random() - 0.5) * 2,
        vy: (dy / len) * s * 0.6 + 3 + Math.random() * 4 * power,
        vz: (p.z / len) * s + (Math.random() - 0.5) * 3,
        rx: Math.random() * 6,
        ry: Math.random() * 6,
        spin: (Math.random() - 0.5) * 14,
        color: p.color,
        rest: false,
        life: 6,
      });
    }
    this.mesh.count = this.parts.length;
    this.parts.forEach((p, i) => this.mesh.setColorAt(i, this.color.set(p.color)));
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  // generic burst of n cubes inside a box, all one colour
  burstBox(x0, x1, y0, y1, n, color, power = 1) {
    const pieces = [];
    for (let i = 0; i < n; i++) pieces.push({ x: x0 + Math.random() * (x1 - x0), y: y0 + Math.random() * (y1 - y0), z: (Math.random() - 0.5) * 0.4, color });
    this.burst(pieces, 0, 0, 0, power);
  }
  update(dt, worldV) {
    if (!this.parts.length) return;
    const t = this.tmp;
    let alive = 0;
    for (let i = 0; i < this.parts.length; i++) {
      const p = this.parts[i];
      p.life -= dt;
      p.x -= worldV * dt;
      if (!p.rest) {
        p.vy -= 22 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.rx += p.spin * dt;
        p.ry += p.spin * 0.7 * dt;
        if (p.y < VOX) {
          p.y = VOX;
          p.vy *= -0.35;
          p.vx *= 0.6;
          p.vz *= 0.6;
          p.spin *= 0.5;
          if (Math.abs(p.vy) < 1) p.rest = true;
        }
      }
      if (p.life > 0 && p.x > -30) alive++;
      t.position.set(p.x, p.y, p.z);
      t.rotation.set(p.rx, p.ry, 0);
      t.scale.setScalar(p.life > 1 ? 1 : Math.max(0.01, p.life));
      t.updateMatrix();
      this.mesh.setMatrixAt(i, t.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (!alive) this.clear();
  }
}

// ------------------------------------------------------------------ weather
const WEATHER = {
  sand: { color: '#e9c98f', size: 2, n: 420 },
  rain: { color: '#cfe8ff', size: 2, n: 520 },
  snow: { color: '#ffffff', size: 2, n: 420 },
  embers: { color: '#ffae4a', size: 2, n: 260 },
};

export class Weather {
  constructor(scene) {
    this.n = 520;
    const pos = new Float32Array(this.n * 3);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.mat = new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.type = null;
    this.intensity = 0;
    this.target = 0;
    this.seed = Array.from({ length: this.n }, () => Math.random());
    for (let i = 0; i < this.n; i++) this.respawn(i, true);
  }
  setType(type) {
    if (type === this.type) return;
    this.type = type;
    const w = WEATHER[type];
    this.mat.color.set(w.color);
    this.mat.size = w.size;
    this.geo.setDrawRange(0, w.n);
    for (let i = 0; i < this.n; i++) this.respawn(i, true);
  }
  respawn(i, anywhere) {
    const p = this.geo.attributes.position.array;
    p[i * 3] = -14 + Math.random() * 56;
    p[i * 3 + 1] = anywhere ? Math.random() * 16 : this.type === 'embers' ? -0.2 : this.type === 'sand' ? Math.random() * 5 : 16;
    p[i * 3 + 2] = -16 + Math.random() * 28;
    if (this.type === 'sand' && !anywhere) p[i * 3] = 42;
  }
  update(dt, worldV, time) {
    this.intensity += Math.max(-dt * 0.4, Math.min(dt * 0.4, this.target - this.intensity));
    this.mat.opacity = this.intensity * (this.type === 'sand' ? 0.7 : 0.9);
    this.points.visible = this.intensity > 0.01;
    if (!this.points.visible) return;
    const p = this.geo.attributes.position.array;
    const n = WEATHER[this.type].n;
    for (let i = 0; i < n; i++) {
      const s = this.seed[i];
      let x = p[i * 3];
      let y = p[i * 3 + 1];
      let z = p[i * 3 + 2];
      switch (this.type) {
        case 'rain':
          y -= (16 + s * 6) * dt;
          x -= (worldV * 0.3 + 2) * dt;
          break;
        case 'snow':
          y -= (1.2 + s * 1.2) * dt;
          x -= (worldV * 0.25 + Math.sin(time * 1.3 + s * 20) * 0.8) * dt;
          z += Math.cos(time + s * 10) * 0.3 * dt;
          break;
        case 'embers':
          y += (1 + s * 2) * dt;
          x -= (worldV * 0.2 + Math.sin(time * 2 + s * 30) * 0.6) * dt;
          break;
        case 'sand':
          x -= (worldV * 0.8 + 14 + s * 8) * dt;
          y += Math.sin(time * 3 + s * 40) * 0.6 * dt;
          break;
      }
      p[i * 3] = x;
      p[i * 3 + 1] = y;
      p[i * 3 + 2] = z;
      if (y < 0 || y > 17 || x < -16) this.respawn(i, false);
    }
    this.geo.attributes.position.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ display styles
const POST_FRAG = /* glsl */ `
  uniform sampler2D tColor;
  uniform sampler2D tDepth;
  uniform vec2 texel;
  uniform float cameraNear;
  uniform float cameraFar;
  uniform int mode;
  varying vec2 vUv;

  float linDepth(vec2 uv) {
    float z = texture2D(tDepth, uv).x * 2.0 - 1.0;
    return (2.0 * cameraNear * cameraFar) / (cameraFar + cameraNear - z * (cameraFar - cameraNear));
  }

  float bayer(vec2 p) {
    int x = int(mod(p.x, 4.0));
    int y = int(mod(p.y, 4.0));
    int i = x + y * 4;
    float m[16];
    m[0]=0.;m[1]=8.;m[2]=2.;m[3]=10.;m[4]=12.;m[5]=4.;m[6]=14.;m[7]=6.;
    m[8]=3.;m[9]=11.;m[10]=1.;m[11]=9.;m[12]=15.;m[13]=7.;m[14]=13.;m[15]=5.;
    for (int k = 0; k < 16; k++) if (k == i) return m[k] / 16.0;
    return 0.0;
  }

  void main() {
    vec3 c = texture2D(tColor, vUv).rgb;
    vec3 s = pow(max(c, vec3(0.0)), vec3(1.0 / 2.2));
    float d = linDepth(vUv);
    float m = 0.0;
    m = max(m, linDepth(vUv + vec2(texel.x, 0.0)) - d);
    m = max(m, linDepth(vUv - vec2(texel.x, 0.0)) - d);
    m = max(m, linDepth(vUv + vec2(0.0, texel.y)) - d);
    m = max(m, linDepth(vUv - vec2(0.0, texel.y)) - d);
    float edge = step(0.12 + d * 0.06, m) * step(d, 60.0);
    if (mode == 2) {
      float lum = dot(s, vec3(0.299, 0.587, 0.114));
      float level = clamp(floor(lum * 4.0 + bayer(gl_FragCoord.xy) - 0.25), 0.0, 3.0);
      vec3 pal0 = vec3(0.059, 0.220, 0.059);
      vec3 pal1 = vec3(0.188, 0.384, 0.188);
      vec3 pal2 = vec3(0.545, 0.675, 0.059);
      vec3 pal3 = vec3(0.608, 0.737, 0.059);
      s = level < 0.5 ? pal0 : level < 1.5 ? pal1 : level < 2.5 ? pal2 : pal3;
      if (edge > 0.5) s = pal0;
    } else if (edge > 0.5) {
      s *= 0.18;
    }
    gl_FragColor = vec4(s, 1.0);
  }
`;

export class PostFX {
  constructor(renderer) {
    this.renderer = renderer;
    this.target = null;
    this.mode = 'normal';
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: null },
        tDepth: { value: null },
        texel: { value: new THREE.Vector2() },
        cameraNear: { value: 0.1 },
        cameraFar: { value: 300 },
        mode: { value: 1 },
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: POST_FRAG,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.quad.frustumCulled = false;
    this.postScene = new THREE.Scene();
    this.postScene.add(this.quad);
    this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  setMode(mode) {
    this.mode = mode;
    document.body.classList.toggle('crt', mode === 'crt');
  }
  ensureTarget() {
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    if (this.target && this.target.width === size.x && this.target.height === size.y) return;
    if (this.target) this.target.dispose();
    const depth = new THREE.DepthTexture(size.x, size.y);
    this.target = new THREE.WebGLRenderTarget(size.x, size.y, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthTexture: depth,
    });
    this.material.uniforms.texel.value.set(1 / size.x, 1 / size.y);
  }
  render(scene, camera) {
    if (this.mode === 'normal' || this.mode === 'crt') {
      this.renderer.setRenderTarget(null);
      this.renderer.render(scene, camera);
      return;
    }
    this.ensureTarget();
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(scene, camera);
    const u = this.material.uniforms;
    u.tColor.value = this.target.texture;
    u.tDepth.value = this.target.depthTexture;
    u.cameraNear.value = camera.near;
    u.cameraFar.value = camera.far;
    u.mode.value = this.mode === 'gameboy' ? 2 : 1;
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCam);
  }
}
