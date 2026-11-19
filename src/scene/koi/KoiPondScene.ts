// KoiPondScene — a WebGL2 ripple simulation + canvas-drawn koi, ported verbatim
// from the reference implementation and wrapped in an init/start/stop/destroy
// lifecycle. The shaders, simulation loop, fish AI, and drawing code are the
// spec and are not modified beyond what the integration requirements force
// (window-bound input with UI filtering, reduced-motion, visibility pause,
// debounced resize, context-loss handling, GL cleanup, audio plop).

import { audioEngine } from '../../audio/engine';

const TAU = Math.PI * 2;

const VERT = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUv;
void main(){vUv=aPos*0.5+0.5;gl_Position=vec4(aPos,0.,1.);}`;

const SIM_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uPrev;
uniform vec2 uTexel;
uniform vec4 uDrops[8];
uniform int uCount;
in vec2 vUv; out vec4 o;
void main(){
  vec2 c=texture(uPrev,vUv).rg;
  float sum=
    texture(uPrev,vUv+vec2(uTexel.x,0.)).r+
    texture(uPrev,vUv-vec2(uTexel.x,0.)).r+
    texture(uPrev,vUv+vec2(0.,uTexel.y)).r+
    texture(uPrev,vUv-vec2(0.,uTexel.y)).r;
  float nh=(sum*0.5-c.g)*0.992;
  vec2 px=vUv/uTexel;
  for(int i=0;i<8;i++){
    if(i>=uCount)break;
    vec4 d=uDrops[i];
    float dist=distance(px,d.xy);
    if(dist<d.z) nh+=d.w*(cos(dist/d.z*3.14159)*0.5+0.5);
  }
  vec2 e=min(vUv,1.0-vUv);
  float edge=smoothstep(0.0,0.05,min(e.x,e.y));
  nh*=mix(0.86,1.0,edge);
  o=vec4(nh,c.r,0.,1.);
}`;

const RENDER_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uH;
uniform sampler2D uBottom;
uniform sampler2D uFish;
uniform vec2 uTexel;
uniform float uT;
in vec2 vUv; out vec4 o;
void main(){
  vec2 d=uTexel*1.5;
  float h =texture(uH,vUv).r;
  float hL=texture(uH,vUv-vec2(d.x,0.)).r;
  float hR=texture(uH,vUv+vec2(d.x,0.)).r;
  float hB=texture(uH,vUv-vec2(0.,d.y)).r;
  float hT=texture(uH,vUv+vec2(0.,d.y)).r;
  vec3 n=normalize(vec3((hL-hR)*6.0,(hB-hT)*6.0,1.0));
  n.xy+=0.0026*vec2(
    sin(vUv.x*130.0+uT*1.2)+sin(vUv.y*88.0-uT*0.7),
    cos(vUv.x*76.0-uT*0.9)+cos(vUv.y*140.0+uT*1.4));
  n=normalize(n);
  vec2 off=n.xy*0.042;
  vec3 bottom=texture(uBottom,vUv+off).rgb;
  float lap=(hL+hR+hB+hT-4.0*h);
  float caust=min(max(-lap,0.0)*90.0,0.7);
  bottom+=vec3(1.0,0.96,0.80)*caust*0.55;
  bottom*=1.0-min(max(lap,0.0)*70.0,0.30);
  float sh=texture(uFish,vUv+off+vec2(0.013,-0.018)).a;
  bottom*=1.0-sh*0.32;
  vec3 water=vec3(0.10,0.30,0.32);
  vec3 col=mix(bottom,water,0.27);
  vec4 fish=texture(uFish,vUv+off*0.45);
  vec3 fcol=mix(fish.rgb,water,0.10);
  col=mix(col,fcol,fish.a);
  vec3 L=normalize(vec3(-0.35,0.45,0.82));
  float spec=pow(max(dot(reflect(vec3(0.,0.,-1.),n),L),0.0),140.0);
  col+=vec3(1.0,0.98,0.90)*spec*0.95;
  col+=vec3(0.35,0.45,0.50)*pow(max(dot(n,normalize(vec3(0.2,-0.3,0.9))),0.0),3.0)*0.06;
  float vg=smoothstep(0.95,0.35,length(vUv-0.5));
  col*=mix(0.60,1.0,vg);
  o=vec4(col,1.0);
}`;

type Patch = { s: number; o: number; r: number; col: string };
type Fish = {
  x: number; y: number; a: number; len: number; phase: number; speed: number;
  spT: number; turn: number; changeT: number; wakeT: number; speedN: number; po: number;
  core: string; mid: string; edge: string; fin: string; patches: Patch[];
};
type Food = { x: number; y: number; ph: number };
type Drop = { x: number; y: number; r: number; s: number };

const angDiff = (a: number, b: number) => {
  let d = a - b;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
};

export class KoiPondScene {
  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGL2RenderingContext | null = null;
  private simProg: WebGLProgram | null = null;
  private renProg: WebGLProgram | null = null;
  private su: Record<string, WebGLUniformLocation | null> = {};
  private ru: Record<string, WebGLUniformLocation | null> = {};
  private quad: WebGLBuffer | null = null;

  private cssW = 0;
  private cssH = 0;
  private dpr = 1;
  private fishScale = 1;
  private simW = 0;
  private simH = 0;
  private texA: WebGLTexture | null = null;
  private texB: WebGLTexture | null = null;
  private fboA: WebGLFramebuffer | null = null;
  private fboB: WebGLFramebuffer | null = null;

  private bCan!: HTMLCanvasElement;
  private bctx!: CanvasRenderingContext2D;
  private fCan!: HTMLCanvasElement;
  private fctx!: CanvasRenderingContext2D;
  private bottomTex: WebGLTexture | null = null;
  private fishTex: WebGLTexture | null = null;
  private fishTexW = 0;
  private fishTexH = 0;

  private fishes: Fish[] = [];
  private foods: Food[] = [];
  private drops: Drop[] = [];
  private dropArr = new Float32Array(32);

  private rafId = 0;
  private running = false;
  private last = 0;
  private ambT = 3;
  private lmx = -1;
  private lmy = -1;
  private reduced = false;
  private speedScale = 1;
  private resizeTimer: ReturnType<typeof setTimeout> | undefined;

  // ---- public lifecycle ----

  init(canvas: HTMLCanvasElement): boolean {
    this.canvas = canvas;
    if (!this.initGL()) return false;
    if (!this.fishes.length) {
      this.fishes = [
        this.makeFish('orange', 118),
        this.makeFish('kohaku', 104),
        this.makeFish('calico', 92),
        this.makeFish('red', 128),
        this.makeFish('orange', 72),
        this.makeFish('tancho', 86),
      ];
      for (let i = 0; i < 3; i++) this.addDrop(Math.random() * this.cssW, Math.random() * this.cssH, 14, 0.6);
    }
    window.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    canvas.addEventListener('webglcontextrestored', this.onContextRestored);
    this.ambT = 3;
    this.last = 0;
    return true;
  }

  setReduced(v: boolean) {
    this.reduced = v;
    this.speedScale = v ? 0.5 : 1;
  }

  start() {
    if (this.running || !this.gl) return;
    this.running = true;
    this.last = 0;
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  destroy() {
    this.stop();
    window.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    this.canvas?.removeEventListener('webglcontextlost', this.onContextLost);
    this.canvas?.removeEventListener('webglcontextrestored', this.onContextRestored);
    const gl = this.gl;
    if (gl) {
      [this.texA, this.texB, this.bottomTex, this.fishTex].forEach((t) => t && gl.deleteTexture(t));
      [this.fboA, this.fboB].forEach((f) => f && gl.deleteFramebuffer(f));
      if (this.quad) gl.deleteBuffer(this.quad);
      if (this.simProg) gl.deleteProgram(this.simProg);
      if (this.renProg) gl.deleteProgram(this.renProg);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
    this.gl = null;
  }

  addRipple(x: number, y: number, r: number, strength: number) {
    this.addDrop(x, y, r, strength);
  }

  feed(x: number, y: number) {
    this.addDrop(x, y, 18, 1.3);
    if (this.foods.length < 25)
      this.foods.push({ x: x + (Math.random() - 0.5) * 16, y: y + (Math.random() - 0.5) * 16, ph: Math.random() * TAU });
  }

  // ---- GL setup ----

  private initGL(): boolean {
    const canvas = this.canvas;
    if (!canvas) return false;
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false });
    if (!gl) return false;
    if (!gl.getExtension('EXT_color_buffer_float')) return false;
    this.gl = gl;
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    this.simProg = this.program(VERT, SIM_FRAG);
    this.renProg = this.program(VERT, RENDER_FRAG);
    this.su = {
      prev: gl.getUniformLocation(this.simProg, 'uPrev'),
      texel: gl.getUniformLocation(this.simProg, 'uTexel'),
      drops: gl.getUniformLocation(this.simProg, 'uDrops[0]'),
      count: gl.getUniformLocation(this.simProg, 'uCount'),
    };
    this.ru = {
      h: gl.getUniformLocation(this.renProg, 'uH'),
      bottom: gl.getUniformLocation(this.renProg, 'uBottom'),
      fish: gl.getUniformLocation(this.renProg, 'uFish'),
      texel: gl.getUniformLocation(this.renProg, 'uTexel'),
      t: gl.getUniformLocation(this.renProg, 'uT'),
    };

    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    if (!this.bCan) {
      this.bCan = document.createElement('canvas');
      this.bctx = this.bCan.getContext('2d')!;
      this.fCan = document.createElement('canvas');
      this.fctx = this.fCan.getContext('2d')!;
    }
    this.bottomTex = gl.createTexture();
    this.fishTex = gl.createTexture();
    this.fishTexW = 0;
    this.fishTexH = 0;

    this.resize();
    return true;
  }

  private compile(type: number, src: string): WebGLShader {
    const gl = this.gl!;
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
    return s;
  }

  private program(vs: string, fs: string): WebGLProgram {
    const gl = this.gl!;
    const p = gl.createProgram()!;
    gl.attachShader(p, this.compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, this.compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'program');
    return p;
  }

  private texParams() {
    const gl = this.gl!;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  private makeTarget(w: number, h: number): [WebGLTexture, WebGLFramebuffer] {
    const gl = this.gl!;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    this.texParams();
    const f = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return [t, f];
  }

  private createSim() {
    const gl = this.gl!;
    if (this.texA) {
      gl.deleteTexture(this.texA);
      gl.deleteTexture(this.texB);
      gl.deleteFramebuffer(this.fboA);
      gl.deleteFramebuffer(this.fboB);
    }
    const scale = Math.min(0.5, 768 / Math.max(this.cssW, this.cssH));
    this.simW = Math.max(64, Math.round(this.cssW * scale));
    this.simH = Math.max(64, Math.round(this.cssH * scale));
    [this.texA, this.fboA] = this.makeTarget(this.simW, this.simH);
    [this.texB, this.fboB] = this.makeTarget(this.simW, this.simH);
  }

  private uploadBottom() {
    const gl = this.gl!;
    gl.bindTexture(gl.TEXTURE_2D, this.bottomTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.bCan);
    this.texParams();
  }

  private uploadFish() {
    const gl = this.gl!;
    gl.bindTexture(gl.TEXTURE_2D, this.fishTex);
    if (this.fishTexW !== this.fCan.width || this.fishTexH !== this.fCan.height) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.fCan);
      this.texParams();
      this.fishTexW = this.fCan.width;
      this.fishTexH = this.fCan.height;
    } else {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.fCan);
    }
  }

  // ---- pond bottom ----

  private paintBottom() {
    const c = this.bctx;
    const w = this.cssW;
    const h = this.cssH;
    c.setTransform(this.fishScale, 0, 0, this.fishScale, 0, 0);
    const g = c.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
    g.addColorStop(0, '#7e6f4e');
    g.addColorStop(0.55, '#5c5a40');
    g.addColorStop(1, '#323a2c');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 9; i++) {
      const x = Math.random() * w, y = Math.random() * h, r = 80 + Math.random() * 180;
      const ag = c.createRadialGradient(x, y, 0, x, y, r);
      ag.addColorStop(0, 'rgba(34,52,28,0.28)');
      ag.addColorStop(1, 'rgba(34,52,28,0)');
      c.fillStyle = ag;
      c.beginPath();
      c.arc(x, y, r, 0, TAU);
      c.fill();
    }
    for (let i = 0; i < 2400; i++) {
      const x = Math.random() * w, y = Math.random() * h, r = Math.random() * 1.7 + 0.4;
      c.fillStyle = Math.random() < 0.5
        ? 'rgba(255,240,200,' + (Math.random() * 0.09).toFixed(3) + ')'
        : 'rgba(18,24,14,' + (Math.random() * 0.13).toFixed(3) + ')';
      c.beginPath();
      c.arc(x, y, r, 0, TAU);
      c.fill();
    }
    const np = Math.max(14, Math.round((w * h) / 55000));
    for (let i = 0; i < np; i++) {
      this.drawPebble(c, Math.random() * w, Math.random() * h, 12 + Math.random() * 46, Math.random() * TAU);
    }
  }

  private drawPebble(c: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number) {
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    const ry = r * (0.62 + Math.random() * 0.3);
    c.fillStyle = 'rgba(0,0,0,0.30)';
    c.beginPath();
    c.ellipse(r * 0.13, ry * 0.2, r * 1.02, ry * 1.02, 0, 0, TAU);
    c.fill();
    const hue = 28 + Math.random() * 32, sat = 7 + Math.random() * 14, li = 36 + Math.random() * 26;
    const g = c.createRadialGradient(-r * 0.35, -ry * 0.4, r * 0.08, 0, 0, r * 1.15);
    g.addColorStop(0, 'hsl(' + hue + ',' + sat + '%,' + (li + 17) + '%)');
    g.addColorStop(0.7, 'hsl(' + hue + ',' + sat + '%,' + li + '%)');
    g.addColorStop(1, 'hsl(' + hue + ',' + (sat + 5) + '%,' + (li - 14) + '%)');
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(0, 0, r, ry, 0, 0, TAU);
    c.fill();
    c.restore();
  }

  // ---- goldfish ----

  private palette(type: string) {
    if (type === 'orange') return { core: '#ffb347', mid: '#ff7d17', edge: '#cf4708', fin: 'rgba(255,138,38,', patches: [] as Patch[] };
    if (type === 'red') return { core: '#ff7a45', mid: '#f04a12', edge: '#a82803', fin: 'rgba(238,76,26,', patches: [] as Patch[] };
    if (type === 'kohaku') {
      const p: Patch[] = [];
      const n = 3 + ((Math.random() * 2) | 0);
      for (let i = 0; i < n; i++) p.push({ s: 0.1 + Math.random() * 0.62, o: (Math.random() - 0.5) * 1.2, r: 0.13 + Math.random() * 0.13, col: 'rgba(241,71,18,0.92)' });
      return { core: '#ffffff', mid: '#f4ecdd', edge: '#cdbfa8', fin: 'rgba(255,234,214,', patches: p };
    }
    if (type === 'calico') {
      const p: Patch[] = [];
      for (let i = 0; i < 3; i++) p.push({ s: 0.12 + Math.random() * 0.58, o: (Math.random() - 0.5) * 1.3, r: 0.12 + Math.random() * 0.12, col: 'rgba(249,109,30,0.9)' });
      for (let i = 0; i < 3; i++) p.push({ s: 0.1 + Math.random() * 0.68, o: (Math.random() - 0.5) * 1.4, r: 0.05 + Math.random() * 0.07, col: 'rgba(36,36,48,0.85)' });
      return { core: '#ffffff', mid: '#f1e9da', edge: '#c9bba2', fin: 'rgba(255,240,224,', patches: p };
    }
    return { core: '#ffffff', mid: '#f6efe3', edge: '#d3c5ae', fin: 'rgba(255,238,222,', patches: [{ s: 0.07, o: 0, r: 0.12, col: 'rgba(234,40,18,0.95)' }] as Patch[] };
  }

  private makeFish(type: string, len: number): Fish {
    const pal = this.palette(type);
    return {
      x: 120 + Math.random() * Math.max(60, this.cssW - 240),
      y: 120 + Math.random() * Math.max(60, this.cssH - 240),
      a: Math.random() * TAU, len,
      phase: Math.random() * 10, speed: 28, spT: 30, turn: 0,
      changeT: Math.random() * 3, wakeT: Math.random() * 0.2, speedN: 0.3,
      po: Math.random() * TAU,
      core: pal.core, mid: pal.mid, edge: pal.edge, fin: pal.fin, patches: pal.patches,
    };
  }

  private updateFish(f: Fish, dt: number) {
    const ss = this.speedScale;
    f.changeT -= dt;
    if (f.changeT <= 0) {
      f.spT = (18 + Math.random() * 40) * ss;
      if (Math.random() < 0.16) f.spT = (95 + Math.random() * 45) * ss;
      f.changeT = 2 + Math.random() * 4;
    }
    f.turn += (Math.random() - 0.5) * 3.2 * dt;
    f.turn *= Math.exp(-dt * 1.4);
    let target: Food | null = null, fdist = 1e9;
    for (const fd of this.foods) {
      const d = Math.hypot(fd.x - f.x, fd.y - f.y);
      if (d < fdist) { fdist = d; target = fd; }
    }
    let ta: number;
    if (target && fdist < 560) {
      ta = Math.atan2(target.y - f.y, target.x - f.x);
      f.spT = Math.max(f.spT, (fdist < 90 ? 55 : 95) * ss);
    } else { target = null; ta = f.a + f.turn; }
    const m = 85;
    if (f.x < m || f.y < m || f.x > this.cssW - m || f.y > this.cssH - m)
      ta = Math.atan2(this.cssH * 0.5 - f.y, this.cssW * 0.5 - f.x);
    for (const g of this.fishes) {
      if (g === f) continue;
      const dx = f.x - g.x, dy = f.y - g.y;
      if (dx * dx + dy * dy < 5600) { ta = Math.atan2(dy, dx); break; }
    }
    const da = angDiff(ta, f.a);
    const mt = (target ? 2.6 : 1.1) * dt;
    f.a += Math.max(-mt, Math.min(mt, da));
    f.speed += (f.spT - f.speed) * Math.min(1, dt * 1.8);
    f.x += Math.cos(f.a) * f.speed * dt;
    f.y += Math.sin(f.a) * f.speed * dt;
    f.x = Math.max(24, Math.min(this.cssW - 24, f.x));
    f.y = Math.max(24, Math.min(this.cssH - 24, f.y));
    f.speedN = Math.min(1, f.speed / 120);
    f.phase += dt * (3.5 + f.speed * 0.075) * 2.4;
    f.wakeT -= dt;
    if (f.wakeT <= 0 && f.speed > 30) {
      this.addDrop(f.x + Math.cos(f.a) * f.len * 0.42, f.y + Math.sin(f.a) * f.len * 0.42,
        6 + f.speedN * 8, 0.05 + 0.16 * f.speedN);
      f.wakeT = 0.1 + Math.random() * 0.08;
    }
    if (target && fdist < 16) {
      this.foods.splice(this.foods.indexOf(target), 1);
      this.addDrop(f.x, f.y, 10, 0.5);
      f.spT = 14 * ss;
      f.changeT = 1.2;
    }
  }

  private bodyOutline(pts: { x: number; y: number; s: number }[], wfun: (s: number) => number) {
    const top: { x: number; y: number }[] = [], bot: { x: number; y: number }[] = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const pa = pts[Math.max(0, i - 1)], pb = pts[Math.min(pts.length - 1, i + 1)];
      let dx = pb.x - pa.x, dy = pb.y - pa.y;
      const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      const w = wfun(p.s);
      top.push({ x: p.x - dy * w, y: p.y + dx * w });
      bot.push({ x: p.x + dy * w, y: p.y - dx * w });
    }
    return { top, bot };
  }

  private tailLobe(c: CanvasRenderingContext2D, len: number, spread: number, sw: number) {
    const ty = spread + sw;
    c.beginPath();
    c.moveTo(0, 0);
    c.bezierCurveTo(len * 0.32, spread * 0.06 + sw * 0.2, len * 0.72, ty * 0.6, len, ty);
    c.bezierCurveTo(len * 0.78, ty * 0.98, len * 0.3, spread * 0.55 + sw * 0.25, 0, 0);
    c.closePath();
    c.fill();
  }

  private finShape(c: CanvasRenderingContext2D, x: number, y: number, ang: number, len: number, flip: boolean) {
    c.save();
    c.translate(x, y);
    c.rotate(ang);
    if (flip) c.scale(1, -1);
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(len * 0.55, -len * 0.1, len, len * 0.22);
    c.quadraticCurveTo(len * 0.45, len * 0.34, 0, 0);
    c.closePath();
    c.fill();
    c.restore();
  }

  private drawFish(c: CanvasRenderingContext2D, f: Fish) {
    const L = f.len;
    c.save();
    c.translate(f.x, f.y);
    c.rotate(f.a);
    const segs = 16, pts: { x: number; y: number; s: number }[] = [];
    const amp = L * (0.05 + 0.06 * f.speedN);
    for (let i = 0; i <= segs; i++) {
      const s = i / segs;
      pts.push({ x: L * 0.48 - s * L * 0.96, y: Math.sin(f.phase - s * 4.4) * amp * Math.pow(s, 1.5), s });
    }
    const wmax = L * 0.16;
    const wf = (s: number) => wmax * Math.pow(Math.sin(Math.PI * Math.min(0.1 + s * 0.9, 1)), 0.85) * (1 - 0.58 * s) + L * 0.018;
    const tp = pts[segs], tq = pts[segs - 1];
    const tang = Math.atan2(tp.y - tq.y, tp.x - tq.x);
    c.save();
    c.translate(tp.x, tp.y);
    c.rotate(tang);
    const tl = L * 0.66;
    const sw = Math.sin(f.phase - 5.2) * tl * 0.3;
    const tg = c.createRadialGradient(0, 0, tl * 0.06, 0, 0, tl);
    tg.addColorStop(0, f.fin + '0.85)');
    tg.addColorStop(0.55, f.fin + '0.5)');
    tg.addColorStop(1, f.fin + '0)');
    c.fillStyle = tg;
    this.tailLobe(c, tl, tl * 0.52, sw);
    this.tailLobe(c, tl, -tl * 0.52, sw * 0.85);
    this.tailLobe(c, tl * 0.72, tl * 0.16, sw * 0.7);
    this.tailLobe(c, tl * 0.72, -tl * 0.16, sw * 0.6);
    c.restore();
    const pp = pts[5], wp = wf(pts[5].s);
    const fl = Math.sin(f.phase * 1.2 + f.po) * 0.22;
    c.fillStyle = f.fin + '0.55)';
    this.finShape(c, pp.x, pp.y + wp * 0.85, 2.3 + fl, L * 0.24, false);
    this.finShape(c, pp.x, pp.y - wp * 0.85, -2.3 - fl, L * 0.24, true);
    const o = this.bodyOutline(pts, wf);
    const path = () => {
      c.beginPath();
      c.moveTo(o.top[0].x, o.top[0].y);
      for (let i = 1; i < o.top.length; i++) c.lineTo(o.top[i].x, o.top[i].y);
      for (let i = o.bot.length - 1; i >= 0; i--) c.lineTo(o.bot[i].x, o.bot[i].y);
      c.quadraticCurveTo(pts[0].x + L * 0.16, pts[0].y, o.top[0].x, o.top[0].y);
      c.closePath();
    };
    const bg = c.createRadialGradient(L * 0.12, 0, L * 0.05, L * 0.05, 0, L * 0.62);
    bg.addColorStop(0, f.core);
    bg.addColorStop(0.55, f.mid);
    bg.addColorStop(1, f.edge);
    path();
    c.fillStyle = bg;
    c.fill();
    if (f.patches.length) {
      c.save();
      path();
      c.clip();
      for (const p of f.patches) {
        const i = Math.min(segs, Math.round(p.s * segs));
        const pt = pts[i], w = wf(p.s);
        c.beginPath();
        c.ellipse(pt.x, pt.y + p.o * w, p.r * L, p.r * L * 0.75, 0, 0, TAU);
        c.fillStyle = p.col;
        c.fill();
      }
      c.restore();
    }
    c.save();
    path();
    c.clip();
    const hg = c.createRadialGradient(L * 0.15, 0, 0, L * 0.1, 0, L * 0.5);
    hg.addColorStop(0, 'rgba(255,255,255,0.30)');
    hg.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = hg;
    c.beginPath();
    c.ellipse(L * 0.1, 0, L * 0.45, wmax * 0.55, 0, 0, TAU);
    c.fill();
    c.strokeStyle = 'rgba(60,20,0,0.18)';
    c.lineWidth = L * 0.016;
    c.beginPath();
    c.moveTo(pts[3].x, pts[3].y);
    for (let i = 4; i <= 11; i++) c.lineTo(pts[i].x, pts[i].y);
    c.stroke();
    c.strokeStyle = 'rgba(0,0,0,0.10)';
    c.lineWidth = L * 0.012;
    c.beginPath();
    c.arc(pts[2].x - L * 0.02, pts[2].y, wf(pts[2].s) * 0.85, -1.2, 1.2);
    c.stroke();
    c.restore();
    path();
    c.strokeStyle = 'rgba(40,15,0,0.18)';
    c.lineWidth = 1;
    c.stroke();
    const ep = pts[1], ew = wf(pts[1].s);
    c.fillStyle = '#19120a';
    c.beginPath();
    c.arc(ep.x, ep.y + ew * 0.72, L * 0.026, 0, TAU);
    c.fill();
    c.beginPath();
    c.arc(ep.x, ep.y - ew * 0.72, L * 0.026, 0, TAU);
    c.fill();
    c.fillStyle = 'rgba(255,255,255,0.6)';
    c.beginPath();
    c.arc(ep.x - L * 0.008, ep.y + ew * 0.72 - L * 0.008, L * 0.008, 0, TAU);
    c.fill();
    c.beginPath();
    c.arc(ep.x - L * 0.008, ep.y - ew * 0.72 - L * 0.008, L * 0.008, 0, TAU);
    c.fill();
    c.restore();
  }

  private drawFishCanvas(t: number) {
    const fctx = this.fctx;
    fctx.setTransform(this.fishScale, 0, 0, this.fishScale, 0, 0);
    fctx.clearRect(0, 0, this.cssW, this.cssH);
    for (const fd of this.foods) {
      const bob = Math.sin(t * 3 + fd.ph) * 1.3;
      fctx.fillStyle = 'rgba(238,220,170,0.92)';
      fctx.beginPath();
      fctx.arc(fd.x + bob, fd.y + Math.cos(t * 2.4 + fd.ph) * 1.1, 2.3, 0, TAU);
      fctx.fill();
    }
    for (const f of this.fishes) this.drawFish(fctx, f);
  }

  // ---- ripples ----

  private addDrop(x: number, y: number, r: number, s: number) {
    this.drops.push({ x, y, r, s });
    if (this.drops.length > 24) this.drops.shift();
  }

  private simulate() {
    const gl = this.gl!;
    gl.useProgram(this.simProg);
    gl.viewport(0, 0, this.simW, this.simH);
    gl.uniform2f(this.su.texel, 1 / this.simW, 1 / this.simH);
    for (let step = 0; step < 2; step++) {
      let n = 0;
      if (step === 0) {
        n = Math.min(this.drops.length, 8);
        for (let j = 0; j < n; j++) {
          const d = this.drops[j];
          this.dropArr[j * 4] = (d.x / this.cssW) * this.simW;
          this.dropArr[j * 4 + 1] = (1 - d.y / this.cssH) * this.simH;
          this.dropArr[j * 4 + 2] = Math.max(2, (d.r * this.simW) / this.cssW);
          this.dropArr[j * 4 + 3] = d.s;
        }
        this.drops.splice(0, n);
      }
      gl.uniform4fv(this.su.drops, this.dropArr);
      gl.uniform1i(this.su.count, n);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboB);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texA);
      gl.uniform1i(this.su.prev, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      let tt = this.texA; this.texA = this.texB; this.texB = tt;
      let tf = this.fboA; this.fboA = this.fboB; this.fboB = tf;
    }
  }

  private render(t: number) {
    const gl = this.gl!;
    gl.useProgram(this.renProg);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas!.width, this.canvas!.height);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.texA); gl.uniform1i(this.ru.h, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.bottomTex); gl.uniform1i(this.ru.bottom, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.fishTex); gl.uniform1i(this.ru.fish, 2);
    gl.uniform2f(this.ru.texel, 1 / this.simW, 1 / this.simH);
    gl.uniform1f(this.ru.t, t);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // ---- layout ----

  private resize() {
    const gl = this.gl;
    if (!gl || !this.canvas) return;
    this.cssW = window.innerWidth;
    this.cssH = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.cssW * this.dpr);
    this.canvas.height = Math.round(this.cssH * this.dpr);
    this.fishScale = Math.min(this.dpr, 1.5);
    this.fCan.width = Math.round(this.cssW * this.fishScale);
    this.fCan.height = Math.round(this.cssH * this.fishScale);
    this.fishTexW = 0;
    this.bCan.width = this.fCan.width;
    this.bCan.height = this.fCan.height;
    this.paintBottom();
    this.uploadBottom();
    this.createSim();
    for (const f of this.fishes) {
      f.x = Math.max(40, Math.min(this.cssW - 40, f.x));
      f.y = Math.max(40, Math.min(this.cssH - 40, f.y));
    }
  }

  // ---- main loop ----

  private frame = (ts: number) => {
    if (!this.running) return;
    const t = ts / 1000;
    const dt = Math.min(0.05, Math.max(0.001, t - this.last));
    this.last = t;
    if (!this.reduced) {
      this.ambT -= dt;
      if (this.ambT <= 0) {
        this.addDrop(Math.random() * this.cssW, Math.random() * this.cssH, 8, 0.32);
        this.ambT = 3 + Math.random() * 5;
      }
    }
    for (const f of this.fishes) this.updateFish(f, dt);
    this.drawFishCanvas(t);
    this.uploadFish();
    this.simulate();
    this.render(t);
    this.rafId = requestAnimationFrame(this.frame);
  };

  // ---- input / lifecycle handlers ----

  private isUI(e: Event): boolean {
    const t = e.target as Element | null;
    return !!t && typeof t.closest === 'function' && !!t.closest('[data-ui]');
  }

  private onPointerDown = (e: PointerEvent) => {
    if (this.isUI(e)) return;
    this.feed(e.clientX, e.clientY);
    audioEngine.plop();
  };

  private onPointerMove = (e: PointerEvent) => {
    if (this.reduced || this.isUI(e)) return;
    if (this.lmx < 0) { this.lmx = e.clientX; this.lmy = e.clientY; return; }
    const d = Math.hypot(e.clientX - this.lmx, e.clientY - this.lmy);
    if (d > 26) {
      this.addDrop(e.clientX, e.clientY, 7, 0.06);
      this.lmx = e.clientX;
      this.lmy = e.clientY;
    }
  };

  private onResize = () => {
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => this.resize(), 150);
  };

  private onVisibility = () => {
    if (document.hidden) this.stop();
    else this.start();
  };

  private onContextLost = (e: Event) => {
    e.preventDefault();
    this.stop();
  };

  private onContextRestored = () => {
    this.initGL();
    this.start();
  };
}
