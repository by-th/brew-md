// JellyfishScene — a WebGL2 deep-water scene built on the same architecture as
// the koi pond (see ../koi/KoiPondScene.ts): a ping-pong height-field "current"
// simulation, a 2D canvas of procedurally drawn creatures uploaded to a GPU
// texture each frame, and a render shader that composites water + caustics +
// god-rays + additive bioluminescent bloom. The GL scaffolding, ping-pong
// simulation, lifecycle, resize, and input/visibility/context-loss handling are
// ported from the koi scene; the creatures (pulsing jellyfish), the deep-water
// render shader, the backdrop, and the cool palette are new.

import { audioEngine } from '../../audio/engine';

const TAU = Math.PI * 2;

const VERT = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUv;
void main(){vUv=aPos*0.5+0.5;gl_Position=vec4(aPos,0.,1.);}`;

// Height-field wave equation (centered-difference Laplacian + damping), reused
// verbatim from the koi pond. Here the field is a gentle "current/agitation"
// field: jelly pulses, pointer drag, and ambient drift inject into it.
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

// Deep-water composite: refraction wobble from the field, a painted backdrop,
// agitation caustics, surface god-rays, and the jelly texture added as
// bioluminescent bloom (mostly additive so bells glow rather than occlude).
const RENDER_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uH;
uniform sampler2D uBackdrop;
uniform sampler2D uJelly;
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
  n.xy+=0.0020*vec2(
    sin(vUv.x*120.0+uT*0.8)+sin(vUv.y*70.0-uT*0.5),
    cos(vUv.x*60.0-uT*0.6)+cos(vUv.y*130.0+uT*0.9));
  n=normalize(n);
  vec2 off=n.xy*0.030;

  vec3 col=texture(uBackdrop,vUv+off).rgb;

  // agitation caustics where the field bunches up
  float lap=(hL+hR+hB+hT-4.0*h);
  float caust=min(max(-lap,0.0)*80.0,0.6);
  col+=vec3(0.30,0.66,0.80)*caust*0.35;

  // surface god-rays (vUv.y -> 1 is the surface/top)
  float depth=vUv.y;
  float xs=vUv.x+(1.0-depth)*0.15;
  float shaft=pow(0.5+0.5*sin(xs*22.0+sin(uT*0.2)*2.0),8.0);
  shaft+=0.6*pow(0.5+0.5*sin(xs*9.0-uT*0.13),12.0);
  shaft*=smoothstep(0.12,1.0,depth);
  shaft*=0.6+0.4*sin(uT*0.25+vUv.x*4.0);
  col+=vec3(0.30,0.62,0.78)*shaft*0.10;

  // jellyfish: additive bloom + a little over-composite so bodies read
  vec4 jel=texture(uJelly,vUv+off*0.5);
  col+=jel.rgb*jel.a*1.15;
  col=mix(col,jel.rgb,jel.a*0.30);

  float vg=smoothstep(1.08,0.30,length(vUv-0.5));
  col*=mix(0.42,1.0,vg);
  o=vec4(col,1.0);
}`;

type Jelly = {
  x: number; y: number;       // position (css px)
  vx: number; vy: number;     // velocity (css px/s)
  size: number;               // bell radius (css px)
  homeFrac: number;           // preferred depth as a fraction of height [0,1]
  heading: number;            // travel/orientation (radians, ~ -PI/2 = up)
  pt: number;                 // pulse cycle phase [0,1)
  pulseDur: number;           // seconds per pulse
  sway: number;               // slow heading-sway phase
  swaySpeed: number;
  tphase: number;             // tentacle wave phase
  tentN: number;
  glow: number;               // 0..1 bioluminescent flash envelope
  core: string; mid: string; rim: string; // "r,g,b" triplets
};
type Snow = { x: number; y: number; r: number; a: number; vy: number; drift: number; ph: number };
type Drop = { x: number; y: number; r: number; s: number };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const CYAN = { core: [190, 252, 255], mid: [70, 190, 235], rim: [208, 255, 255] };
const VIOLET = { core: [226, 202, 255], mid: [150, 112, 236], rim: [226, 198, 255] };
const triplet = (a: number[], b: number[], t: number) =>
  `${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))}`;

export class JellyfishScene {
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
  private drawScale = 1;
  private simW = 0;
  private simH = 0;
  private texA: WebGLTexture | null = null;
  private texB: WebGLTexture | null = null;
  private fboA: WebGLFramebuffer | null = null;
  private fboB: WebGLFramebuffer | null = null;

  private bgCan!: HTMLCanvasElement;
  private bgCtx!: CanvasRenderingContext2D;
  private jCan!: HTMLCanvasElement;
  private jCtx!: CanvasRenderingContext2D;
  private backdropTex: WebGLTexture | null = null;
  private jellyTex: WebGLTexture | null = null;
  private jellyTexW = 0;
  private jellyTexH = 0;

  private jellies: Jelly[] = [];
  private snow: Snow[] = [];
  private drops: Drop[] = [];
  private dropArr = new Float32Array(32);

  private rafId = 0;
  private running = false;
  private last = 0;
  private ambT = 4;
  private lmx = -1;
  private lmy = -1;
  private reduced = false;
  private speedScale = 1;
  private resizeTimer: ReturnType<typeof setTimeout> | undefined;

  // ---- public lifecycle ----

  init(canvas: HTMLCanvasElement): boolean {
    this.canvas = canvas;
    if (!this.initGL()) return false;
    if (!this.jellies.length) {
      const classes = [128, 104, 96, 84, 76, 64, 58];
      this.jellies = classes.map((s, i) => this.makeJelly(s, i / (classes.length - 1)));
    }
    window.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    canvas.addEventListener('webglcontextrestored', this.onContextRestored);
    this.ambT = 4;
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
      [this.texA, this.texB, this.backdropTex, this.jellyTex].forEach((t) => t && gl.deleteTexture(t));
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

  /** Pointer click: a soft glow pulse — disturb the water and flash nearby jellies. */
  pulse(x: number, y: number) {
    this.addDrop(x, y, 16, 0.9);
    for (const j of this.jellies) {
      const dx = j.x - x, dy = j.y - y;
      const dist = Math.hypot(dx, dy);
      const reach = 260;
      if (dist < reach) {
        const f = 1 - dist / reach;
        j.glow = Math.min(1, j.glow + f);
        // a gentle outward nudge
        const push = 70 * f * this.speedScale;
        const inv = dist > 0.01 ? 1 / dist : 0;
        j.vx += dx * inv * push;
        j.vy += dy * inv * push;
      }
    }
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
      backdrop: gl.getUniformLocation(this.renProg, 'uBackdrop'),
      jelly: gl.getUniformLocation(this.renProg, 'uJelly'),
      texel: gl.getUniformLocation(this.renProg, 'uTexel'),
      t: gl.getUniformLocation(this.renProg, 'uT'),
    };

    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    if (!this.bgCan) {
      this.bgCan = document.createElement('canvas');
      this.bgCtx = this.bgCan.getContext('2d')!;
      this.jCan = document.createElement('canvas');
      this.jCtx = this.jCan.getContext('2d')!;
    }
    this.backdropTex = gl.createTexture();
    this.jellyTex = gl.createTexture();
    this.jellyTexW = 0;
    this.jellyTexH = 0;

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

  private uploadBackdrop() {
    const gl = this.gl!;
    gl.bindTexture(gl.TEXTURE_2D, this.backdropTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.bgCan);
    this.texParams();
  }

  private uploadJelly() {
    const gl = this.gl!;
    gl.bindTexture(gl.TEXTURE_2D, this.jellyTex);
    if (this.jellyTexW !== this.jCan.width || this.jellyTexH !== this.jCan.height) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.jCan);
      this.texParams();
      this.jellyTexW = this.jCan.width;
      this.jellyTexH = this.jCan.height;
    } else {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.jCan);
    }
  }

  // ---- backdrop (painted once on resize) ----

  private paintBackdrop() {
    const c = this.bgCtx;
    const w = this.cssW;
    const h = this.cssH;
    c.setTransform(this.drawScale, 0, 0, this.drawScale, 0, 0);
    // vertical depth gradient (lighter near the surface at top)
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0c2433');
    g.addColorStop(0.45, '#06141f');
    g.addColorStop(1, '#02060c');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    // a pool of surface light up top
    const sl = c.createRadialGradient(w * 0.5, -h * 0.1, 0, w * 0.5, -h * 0.1, h * 0.7);
    sl.addColorStop(0, 'rgba(90,180,210,0.30)');
    sl.addColorStop(1, 'rgba(90,180,210,0)');
    c.fillStyle = sl;
    c.fillRect(0, 0, w, h);
    // a few soft distant bioluminescent glows for depth
    for (let i = 0; i < 7; i++) {
      const x = Math.random() * w, y = h * (0.25 + Math.random() * 0.7), r = 120 + Math.random() * 260;
      const violet = Math.random() < 0.5;
      const col = violet ? '120,90,210' : '50,150,190';
      const ag = c.createRadialGradient(x, y, 0, x, y, r);
      ag.addColorStop(0, `rgba(${col},${(0.05 + Math.random() * 0.06).toFixed(3)})`);
      ag.addColorStop(1, `rgba(${col},0)`);
      c.fillStyle = ag;
      c.beginPath();
      c.arc(x, y, r, 0, TAU);
      c.fill();
    }
    // deepen the very bottom
    const dk = c.createLinearGradient(0, h * 0.6, 0, h);
    dk.addColorStop(0, 'rgba(1,3,7,0)');
    dk.addColorStop(1, 'rgba(1,3,7,0.6)');
    c.fillStyle = dk;
    c.fillRect(0, h * 0.6, w, h * 0.4);
  }

  // ---- jellyfish ----

  private makeJelly(size: number, hue: number): Jelly {
    const homeFrac = 0.18 + Math.random() * 0.62;
    return {
      x: 120 + Math.random() * Math.max(60, this.cssW - 240),
      y: Math.max(size, Math.min(this.cssH - size, homeFrac * this.cssH + (Math.random() - 0.5) * 120)),
      vx: 0, vy: 0,
      size,
      homeFrac,
      heading: -Math.PI / 2 + (Math.random() - 0.5) * 0.4,
      pt: Math.random(),
      pulseDur: 2.6 + Math.random() * 1.6,
      sway: Math.random() * TAU,
      swaySpeed: 0.18 + Math.random() * 0.22,
      tphase: Math.random() * TAU,
      tentN: 7 + ((Math.random() * 4) | 0),
      glow: 0,
      core: triplet(CYAN.core, VIOLET.core, hue),
      mid: triplet(CYAN.mid, VIOLET.mid, hue),
      rim: triplet(CYAN.rim, VIOLET.rim, hue),
    };
  }

  // asymmetric bell contraction: a quick squeeze then a slow relax
  private squeeze(pt: number): number {
    const u = (pt - 0.12) / 0.16;
    return Math.exp(-u * u);
  }

  private updateJelly(j: Jelly, dt: number) {
    const ss = this.speedScale;
    // slow heading sway
    j.sway += dt * j.swaySpeed;
    j.heading = -Math.PI / 2 + Math.sin(j.sway) * 0.34;
    j.tphase += dt * (0.9 + 0.5 * ss);

    // pulse cycle: thrust + wake at the start of each contraction
    j.pt += (dt / j.pulseDur) * (0.6 + 0.4 * ss);
    if (j.pt >= 1) {
      j.pt -= 1;
      const thrust = (38 + j.size * 0.7) * ss;
      j.vx += Math.cos(j.heading) * thrust;
      j.vy += Math.sin(j.heading) * thrust;
      // wake injected behind the bell (at the mouth)
      this.addDrop(
        j.x - Math.cos(j.heading) * j.size * 0.6,
        j.y - Math.sin(j.heading) * j.size * 0.6,
        4 + j.size * 0.1,
        0.08 + 0.05 * ss,
      );
    }

    // gentle horizontal current + gravity/spring toward a home depth so the
    // bloom stays spread through the water column instead of piling at the top
    const homeY = j.homeFrac * this.cssH;
    j.vx += Math.sin(j.sway * 0.8 + j.tphase * 0.05) * 6 * dt * ss;
    j.vy += 10 * dt * ss;             // gravity (passive sink)
    j.vy += (homeY - j.y) * 0.9 * dt; // soft spring to home depth
    const drag = Math.exp(-dt * 0.9);
    j.vx *= drag;
    j.vy *= drag;

    j.x += j.vx * dt;
    j.y += j.vy * dt;

    // soft bounds: wrap horizontally, cushion vertically
    const m = j.size;
    if (j.x < -m) j.x = this.cssW + m;
    if (j.x > this.cssW + m) j.x = -m;
    if (j.y < m) { j.y = m; j.vy += 18 * ss; }
    if (j.y > this.cssH - m) { j.y = this.cssH - m; j.vy = -Math.abs(j.vy) * 0.3; }

    // flash decays
    j.glow *= Math.exp(-dt * 1.7);
  }

  private drawJelly(c: CanvasRenderingContext2D, j: Jelly) {
    const s = j.size;
    const sq = this.squeeze(j.pt);
    const scaleX = 1 + 0.16 * sq;
    const scaleY = 1 - 0.30 * sq;
    const a = 0.34 + 0.5 * j.glow;

    c.save();
    c.translate(j.x, j.y);
    c.rotate(j.heading + Math.PI / 2);

    // tentacles / oral arms (behind the bell, hanging to +y)
    c.lineCap = 'round';
    for (let i = 0; i < j.tentN; i++) {
      const f = j.tentN > 1 ? i / (j.tentN - 1) : 0.5;
      const tx = (-s * 0.78 + f * s * 1.56) * scaleX;
      const len = s * (1.3 + ((i * 7) % 5) / 5 * 0.9);
      const segs = 8;
      c.beginPath();
      c.moveTo(tx, 0);
      for (let k = 1; k <= segs; k++) {
        const u = k / segs;
        const yy = u * len;
        const xx = tx + Math.sin(j.tphase + i * 0.6 + u * 2.4) * s * 0.24 * u;
        c.lineTo(xx, yy);
      }
      c.strokeStyle = `rgba(${j.rim},${(a * 0.32).toFixed(3)})`;
      c.lineWidth = s * 0.03 * (1 - 0.4 * f);
      c.stroke();
    }
    // a few thicker central oral arms
    for (let i = 0; i < 3; i++) {
      const tx = (i - 1) * s * 0.22;
      const len = s * (1.1 + i % 2 * 0.5);
      c.beginPath();
      c.moveTo(tx, 0);
      c.bezierCurveTo(
        tx + Math.sin(j.tphase + i) * s * 0.2, len * 0.5,
        tx - Math.sin(j.tphase * 1.2 + i) * s * 0.28, len * 0.8,
        tx + Math.sin(j.tphase + i) * s * 0.1, len,
      );
      c.strokeStyle = `rgba(${j.core},${(a * 0.4).toFixed(3)})`;
      c.lineWidth = s * 0.07;
      c.stroke();
    }

    // bell dome
    c.save();
    c.scale(scaleX, scaleY);
    const grad = c.createRadialGradient(0, -s * 0.15, s * 0.06, 0, 0, s * 1.05);
    grad.addColorStop(0, `rgba(${j.core},${a.toFixed(3)})`);
    grad.addColorStop(0.55, `rgba(${j.mid},${(a * 0.55).toFixed(3)})`);
    grad.addColorStop(1, `rgba(${j.mid},0)`);
    c.fillStyle = grad;
    c.beginPath();
    c.moveTo(-s * 0.82, 0);
    c.bezierCurveTo(-s * 0.92, -s * 1.34, s * 0.92, -s * 1.34, s * 0.82, 0); // dome top
    // scalloped underside back to the left rim
    c.bezierCurveTo(s * 0.46, s * 0.22, s * 0.18, s * 0.22, 0, s * 0.14);
    c.bezierCurveTo(-s * 0.18, s * 0.22, -s * 0.46, s * 0.22, -s * 0.82, 0);
    c.closePath();
    c.fill();

    // bioluminescent rim
    c.strokeStyle = `rgba(${j.rim},${(a * 0.7).toFixed(3)})`;
    c.lineWidth = s * 0.03;
    c.beginPath();
    c.moveTo(-s * 0.8, -s * 0.02);
    c.bezierCurveTo(-s * 0.42, s * 0.18, s * 0.42, s * 0.18, s * 0.8, -s * 0.02);
    c.stroke();

    // inner highlight
    const hg = c.createRadialGradient(0, -s * 0.3, 0, 0, -s * 0.3, s * 0.6);
    hg.addColorStop(0, `rgba(255,255,255,${(a * 0.4).toFixed(3)})`);
    hg.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = hg;
    c.beginPath();
    c.ellipse(0, -s * 0.32, s * 0.5, s * 0.4, 0, 0, TAU);
    c.fill();
    c.restore();

    c.restore();
  }

  private drawJellyCanvas(t: number) {
    const c = this.jCtx;
    c.setTransform(this.drawScale, 0, 0, this.drawScale, 0, 0);
    c.clearRect(0, 0, this.cssW, this.cssH);
    // marine snow drifting down
    for (const m of this.snow) {
      m.y += m.vy;
      m.x += Math.sin(t * 0.3 + m.ph) * m.drift;
      if (m.y > this.cssH + 4) { m.y = -4; m.x = Math.random() * this.cssW; }
      c.fillStyle = `rgba(200,228,240,${m.a.toFixed(3)})`;
      c.beginPath();
      c.arc(m.x, m.y, m.r, 0, TAU);
      c.fill();
    }
    // jellies back-to-front (smaller/further behind)
    const order = [...this.jellies].sort((p, q) => p.size - q.size);
    for (const j of order) this.drawJelly(c, j);
  }

  // ---- field sim ----

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
      const tt = this.texA; this.texA = this.texB; this.texB = tt;
      const tf = this.fboA; this.fboA = this.fboB; this.fboB = tf;
    }
  }

  private render(t: number) {
    const gl = this.gl!;
    gl.useProgram(this.renProg);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas!.width, this.canvas!.height);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.texA); gl.uniform1i(this.ru.h, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.backdropTex); gl.uniform1i(this.ru.backdrop, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.jellyTex); gl.uniform1i(this.ru.jelly, 2);
    gl.uniform2f(this.ru.texel, 1 / this.simW, 1 / this.simH);
    gl.uniform1f(this.ru.t, t);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // ---- layout ----

  private buildSnow() {
    const n = Math.min(180, Math.max(40, Math.round((this.cssW * this.cssH) / 9000)));
    this.snow = [];
    for (let i = 0; i < n; i++) {
      this.snow.push({
        x: Math.random() * this.cssW,
        y: Math.random() * this.cssH,
        r: 0.5 + Math.random() * 1.6,
        a: 0.05 + Math.random() * 0.22,
        vy: 0.15 + Math.random() * 0.5,
        drift: 0.1 + Math.random() * 0.35,
        ph: Math.random() * TAU,
      });
    }
  }

  private resize() {
    const gl = this.gl;
    if (!gl || !this.canvas) return;
    this.cssW = window.innerWidth;
    this.cssH = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.cssW * this.dpr);
    this.canvas.height = Math.round(this.cssH * this.dpr);
    this.drawScale = Math.min(this.dpr, 1.5);
    this.jCan.width = Math.round(this.cssW * this.drawScale);
    this.jCan.height = Math.round(this.cssH * this.drawScale);
    this.jellyTexW = 0;
    this.bgCan.width = this.jCan.width;
    this.bgCan.height = this.jCan.height;
    this.paintBackdrop();
    this.uploadBackdrop();
    this.createSim();
    this.buildSnow();
    for (const j of this.jellies) {
      j.x = Math.max(40, Math.min(this.cssW - 40, j.x));
      j.y = Math.max(40, Math.min(this.cssH - 40, j.y));
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
        this.addDrop(Math.random() * this.cssW, Math.random() * this.cssH, 10, 0.12);
        this.ambT = 4 + Math.random() * 5;
      }
    }
    for (const j of this.jellies) this.updateJelly(j, dt);
    this.drawJellyCanvas(t);
    this.uploadJelly();
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
    this.pulse(e.clientX, e.clientY);
    audioEngine.pulse();
  };

  private onPointerMove = (e: PointerEvent) => {
    if (this.reduced || this.isUI(e)) return;
    if (this.lmx < 0) { this.lmx = e.clientX; this.lmy = e.clientY; return; }
    const dx = e.clientX - this.lmx;
    const dy = e.clientY - this.lmy;
    const d = Math.hypot(dx, dy);
    if (d > 18) {
      // ripple the water and herd nearby jellies along the drag
      this.addDrop(e.clientX, e.clientY, 7, 0.06);
      const reach = 220;
      const k = Math.min(1, d / 60) * 0.5;
      for (const j of this.jellies) {
        const jd = Math.hypot(j.x - e.clientX, j.y - e.clientY);
        if (jd < reach) {
          const f = (1 - jd / reach) * k;
          j.vx += dx * f;
          j.vy += dy * f;
        }
      }
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
