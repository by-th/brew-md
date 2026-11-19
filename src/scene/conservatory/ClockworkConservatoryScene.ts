// ClockworkConservatoryScene — a moonlit Victorian greenhouse where nature and
// soft machinery blend. Architecture mirrors the koi/jellyfish WebGL2 scenes: a
// ping-pong height-field simulation (here it is rain on the curved glass) refracts
// a painted backdrop (night sky, moon, far gears behind glass), while the whole
// conservatory interior — iron frame, plants, vines, brass gears, the antique
// focus-clock, lanterns, flowers and a firefly swarm — is drawn each frame on a
// 2D canvas, uploaded as a texture, and composited on top by the render shader
// (which adds glass glints, bloom on the fireflies/lanterns, vignette and grain).
//
// Diegetic focus: setFocusProgress()/setPhase()/pulseBloom() turn the clock hand,
// open the flower-clock petals, bloom flowers, calm the fireflies, and warm the
// room on break — no on-canvas UI.

import { audioEngine } from '../../audio/engine';
import { clamp } from '../../lib/clamp';

const TAU = Math.PI * 2;

const PAL = {
  sky0: '#07151C',
  sky1: '#0D2A20',
  violet: '#1A1424',
  moss: '#365C3D',
  glass: '#9CCFE3',
  gold: '#F7D56A',
  flower: '#F4E6A1',
  amber: '#E8A94A',
  brass: '#B88A42',
};

const VERT = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUv;
void main(){vUv=aPos*0.5+0.5;gl_Position=vec4(aPos,0.,1.);}`;

// Height-field wave equation (rain striking the glass). Identical in spirit to the
// koi water sim: Laplacian relaxation + damping, with drop impulses injected.
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
  float nh=(sum*0.5-c.g)*0.990;
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

// Composite: refract the backdrop by the glass height field, add glints + droplet
// sparkle, lay the interior on top, bloom its bright pixels (fireflies/lanterns),
// then vignette + grain. uWarm shifts the whole frame warmer on break.
const RENDER_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uH;
uniform sampler2D uBackdrop;
uniform sampler2D uInterior;
uniform vec2 uTexel;
uniform float uT;
uniform float uWarm;
in vec2 vUv; out vec4 o;
void main(){
  vec2 d=uTexel*1.5;
  float h =texture(uH,vUv).r;
  float hL=texture(uH,vUv-vec2(d.x,0.)).r;
  float hR=texture(uH,vUv+vec2(d.x,0.)).r;
  float hB=texture(uH,vUv-vec2(0.,d.y)).r;
  float hT=texture(uH,vUv+vec2(0.,d.y)).r;
  vec3 n=normalize(vec3((hL-hR)*5.0,(hB-hT)*5.0,1.0));
  vec2 off=n.xy*0.028;
  vec3 bg=texture(uBackdrop,vUv+off).rgb;
  float lap=(hL+hR+hB+hT-4.0*h);
  // droplet sparkle where the glass curves sharply
  bg+=vec3(0.62,0.78,0.95)*min(max(-lap,0.0)*70.0,0.6)*0.5;
  // moonlight glint off the rain ridges (light from upper-right where the moon is)
  vec3 L=normalize(vec3(0.45,0.55,0.7));
  float spec=pow(max(dot(reflect(vec3(0.,0.,-1.),n),L),0.0),90.0);
  bg+=vec3(0.7,0.82,1.0)*spec*0.5;
  // interior, drawn nearly straight (only the strongest ridges nudge it)
  vec4 inr=texture(uInterior,vUv+off*0.12);
  vec3 col=mix(bg,inr.rgb,inr.a);
  // bloom only bright interior pixels (firefly/lantern/flower glow)
  float lum=max(max(inr.r,inr.g),inr.b);
  col+=inr.rgb*inr.a*smoothstep(0.55,1.0,lum)*0.6;
  // warm wash on break
  col*=mix(vec3(1.0),vec3(1.12,1.02,0.86),uWarm*0.5);
  // vignette
  float vg=smoothstep(1.02,0.34,length(vUv-0.5));
  col*=mix(0.5,1.0,vg);
  // film grain
  float g=fract(sin(dot(vUv+fract(uT*0.13),vec2(12.9898,78.233)))*43758.5453);
  col+=(g-0.5)*0.022;
  o=vec4(col,1.0);
}`;

type Firefly = {
  x: number; y: number; vx: number; vy: number; depth: number; glowR: number;
  pulse: number; pulseSp: number; tx: number; ty: number; seed: number;
  green: boolean; calm: number; life: number;
};
type Gear = {
  x: number; y: number; r: number; teeth: number; toothD: number; hub: number;
  angle: number; av: number; shade: number; glint: number;
};
type Leaf = {
  x: number; y: number; len: number; wid: number; angle: number; curve: number;
  hue: number; light: number; swayPh: number; swaySp: number; depth: number; ribs: number;
};
type Vine = { pts: { x: number; y: number }[]; width: number; swayPh: number; leafEvery: number };
type Flower = { x: number; y: number; r: number; hue: string; bloom: number; bSp: number; swayPh: number; petals: number };
type Lantern = { x: number; topY: number; y: number; r: number; glow: number; target: number; sway: number; swaySp: number; flick: number };
type Drop = { x: number; y: number; r: number; s: number };

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export class ClockworkConservatoryScene {
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
  private mobile = false;
  private simW = 0;
  private simH = 0;
  private texA: WebGLTexture | null = null;
  private texB: WebGLTexture | null = null;
  private fboA: WebGLFramebuffer | null = null;
  private fboB: WebGLFramebuffer | null = null;

  private bgCan!: HTMLCanvasElement;
  private bgCtx!: CanvasRenderingContext2D;
  private iCan!: HTMLCanvasElement;
  private iCtx!: CanvasRenderingContext2D;
  private frameCan!: HTMLCanvasElement;
  private glowGold!: HTMLCanvasElement;
  private glowGreen!: HTMLCanvasElement;
  private backdropTex: WebGLTexture | null = null;
  private interiorTex: WebGLTexture | null = null;
  private iTexW = 0;
  private iTexH = 0;

  private drops: Drop[] = [];
  private dropArr = new Float32Array(32);

  private fireflies: Firefly[] = [];
  private gears: Gear[] = [];
  private leaves: Leaf[] = [];
  private vines: Vine[] = [];
  private flowers: Flower[] = [];
  private lanterns: Lantern[] = [];

  private rafId = 0;
  private running = false;
  private last = 0;
  private time = 0;
  private ambT = 1.2;
  private reduced = false;
  private speedScale = 1;
  private resizeTimer: ReturnType<typeof setTimeout> | undefined;

  // pointer + wind
  private px = -1;
  private py = -1;
  private down = false;
  private lmx = -1;
  private lmy = -1;
  private windX = 0;
  private windY = 0;
  private gather = 0;

  // focus
  private focusProgress = 0;
  private displayProgress = 0;
  private focusPhase: 'work' | 'break' | 'idle' = 'idle';
  private warm = 0;
  private flash = 0;

  // clock centerpiece
  private clockX = 0;
  private clockY = 0;
  private clockR = 0;
  private clockHand = -Math.PI / 2;

  // ---- lifecycle ----

  init(canvas: HTMLCanvasElement): boolean {
    this.canvas = canvas;
    if (!this.initGL()) return false;
    window.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    canvas.addEventListener('webglcontextrestored', this.onContextRestored);
    this.ambT = 1.2;
    this.last = 0;
    return true;
  }

  setReduced(v: boolean) {
    this.reduced = v;
    this.speedScale = v ? 0.45 : 1;
  }

  setFocusProgress(p: number) {
    this.focusProgress = clamp(p, 0, 1);
  }

  setPhase(phase: 'work' | 'break' | 'idle') {
    this.focusPhase = phase;
  }

  pulseBloom() {
    this.flash = Math.min(1, this.flash + 0.9);
    for (const f of this.flowers) f.bloom = Math.min(1, f.bloom + 0.5);
    // a small upward lift + brightening of the fireflies
    for (const ff of this.fireflies) {
      ff.vy -= rand(20, 60);
      ff.pulse = 0;
    }
    this.addDrop(this.clockX, this.clockY, 26, 0.7);
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
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    this.canvas?.removeEventListener('webglcontextlost', this.onContextLost);
    this.canvas?.removeEventListener('webglcontextrestored', this.onContextRestored);
    const gl = this.gl;
    if (gl) {
      [this.texA, this.texB, this.backdropTex, this.interiorTex].forEach((t) => t && gl.deleteTexture(t));
      [this.fboA, this.fboB].forEach((f) => f && gl.deleteFramebuffer(f));
      if (this.quad) gl.deleteBuffer(this.quad);
      if (this.simProg) gl.deleteProgram(this.simProg);
      if (this.renProg) gl.deleteProgram(this.renProg);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
    this.gl = null;
  }

  // ---- GL setup (mirrors KoiPondScene) ----

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
      interior: gl.getUniformLocation(this.renProg, 'uInterior'),
      texel: gl.getUniformLocation(this.renProg, 'uTexel'),
      t: gl.getUniformLocation(this.renProg, 'uT'),
      warm: gl.getUniformLocation(this.renProg, 'uWarm'),
    };

    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    if (!this.bgCan) {
      this.bgCan = document.createElement('canvas');
      this.bgCtx = this.bgCan.getContext('2d')!;
      this.iCan = document.createElement('canvas');
      this.iCtx = this.iCan.getContext('2d')!;
      this.frameCan = document.createElement('canvas');
    }
    this.backdropTex = gl.createTexture();
    this.interiorTex = gl.createTexture();
    this.iTexW = 0;
    this.iTexH = 0;
    this.buildGlowSprites();

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

  private uploadInterior() {
    const gl = this.gl!;
    gl.bindTexture(gl.TEXTURE_2D, this.interiorTex);
    if (this.iTexW !== this.iCan.width || this.iTexH !== this.iCan.height) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.iCan);
      this.texParams();
      this.iTexW = this.iCan.width;
      this.iTexH = this.iCan.height;
    } else {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.iCan);
    }
  }

  // ---- layout / creation ----

  private resize() {
    const gl = this.gl;
    if (!gl || !this.canvas) return;
    this.cssW = window.innerWidth;
    this.cssH = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.mobile = this.cssW <= 820;
    this.canvas.width = Math.round(this.cssW * this.dpr);
    this.canvas.height = Math.round(this.cssH * this.dpr);
    this.drawScale = Math.min(this.dpr, 1.5);
    this.iCan.width = Math.round(this.cssW * this.drawScale);
    this.iCan.height = Math.round(this.cssH * this.drawScale);
    this.iTexW = 0;
    this.bgCan.width = this.iCan.width;
    this.bgCan.height = this.iCan.height;

    this.clockX = this.cssW * 0.5;
    this.clockY = this.cssH * (this.mobile ? 0.34 : 0.4);
    this.clockR = Math.min(this.cssW, this.cssH) * (this.mobile ? 0.16 : 0.13);

    this.createGears();
    this.createPlants();
    this.createVines();
    this.createFlowers();
    this.createLanterns();
    this.retargetFireflies();

    this.buildFrame();
    this.paintBackdrop();
    this.uploadBackdrop();
    this.createSim();
  }

  private areaFactor(): number {
    return clamp((this.cssW * this.cssH) / (1280 * 800), 0.4, 1.4);
  }

  private fireflyTarget(): number {
    return Math.round((this.mobile ? 26 : 50) * this.areaFactor());
  }

  private retargetFireflies() {
    const t = this.fireflyTarget();
    while (this.fireflies.length > t) this.fireflies.pop();
    while (this.fireflies.length < t) this.fireflies.push(this.makeFirefly());
  }

  private makeFirefly(): Firefly {
    const depth = rand(0.2, 1);
    return {
      x: rand(0, this.cssW),
      y: rand(this.cssH * 0.1, this.cssH),
      vx: rand(-8, 8),
      vy: rand(-8, 8),
      depth,
      glowR: lerp(5, 13, depth),
      pulse: rand(0, TAU),
      pulseSp: rand(1.1, 2.2),
      tx: rand(0, this.cssW),
      ty: rand(this.cssH * 0.15, this.cssH * 0.95),
      seed: rand(0, 100),
      green: Math.random() < 0.05,
      calm: 0,
      life: 1,
    };
  }

  createGears() {
    const w = this.cssW;
    const h = this.cssH;
    const s = Math.min(w, h);
    // a few interior brass gears tucked behind the foliage, lower-left and around the clock
    this.gears = [
      { x: w * 0.13, y: h * 0.7, r: s * 0.1, teeth: 16, toothD: s * 0.016, hub: s * 0.03, angle: 0, av: 0.12, shade: 0, glint: rand(0, TAU) },
      { x: w * 0.2, y: h * 0.82, r: s * 0.06, teeth: 11, toothD: s * 0.012, hub: s * 0.02, angle: 0, av: -0.2, shade: -0.08, glint: rand(0, TAU) },
      { x: w * 0.86, y: h * 0.74, r: s * 0.08, teeth: 13, toothD: s * 0.014, hub: s * 0.025, angle: 0, av: -0.15, shade: -0.04, glint: rand(0, TAU) },
      { x: this.clockX - this.clockR * 1.05, y: this.clockY + this.clockR * 0.92, r: s * 0.05, teeth: 10, toothD: s * 0.011, hub: s * 0.018, angle: 0, av: 0.26, shade: 0.05, glint: rand(0, TAU) },
    ];
  }

  createPlants() {
    const w = this.cssW;
    const h = this.cssH;
    const s = Math.min(w, h);
    this.leaves = [];
    const defs: [number, number, number, number][] = this.mobile
      ? [
          [0.1, 0.96, 1.5, 0.7],
          [0.9, 0.97, -1.7, 0.8],
          [0.18, 0.5, 0.5, 0.5],
          [0.84, 0.46, 2.6, 0.55],
        ]
      : [
          [0.06, 0.98, 1.4, 0.9],
          [0.16, 1.0, 1.0, 0.7],
          [0.94, 0.99, -1.6, 0.95],
          [0.86, 1.0, -1.2, 0.7],
          [0.1, 0.42, 0.4, 0.5],
          [0.9, 0.4, 2.7, 0.55],
          [0.5, 1.02, -1.57, 0.8],
        ];
    for (const [fx, fy, ang, depth] of defs) {
      this.leaves.push({
        x: w * fx,
        y: h * fy,
        len: s * lerp(0.18, 0.34, depth),
        wid: s * lerp(0.06, 0.12, depth),
        angle: ang,
        curve: rand(-0.3, 0.3),
        hue: rand(140, 166),
        light: lerp(14, 26, depth),
        swayPh: rand(0, TAU),
        swaySp: rand(0.3, 0.6),
        depth,
        ribs: 5,
      });
    }
  }

  createVines() {
    const w = this.cssW;
    const h = this.cssH;
    this.vines = [];
    const make = (x0: number, y0: number, x1: number, y1: number, segs: number, width: number): Vine => {
      const pts = [];
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        pts.push({ x: lerp(x0, x1, t) + Math.sin(t * 6) * w * 0.02, y: lerp(y0, y1, t) });
      }
      return { pts, width, swayPh: rand(0, TAU), leafEvery: 2 };
    };
    this.vines.push(make(w * 0.02, h * 0.0, w * 0.08, h * 0.6, 8, 3));
    this.vines.push(make(w * 0.98, h * 0.0, w * 0.9, h * 0.55, 8, 3));
    // a vine crossing the lower edge of the clock
    this.vines.push(make(this.clockX - this.clockR * 1.2, this.clockY + this.clockR * 0.7, this.clockX + this.clockR * 1.2, this.clockY + this.clockR * 1.0, 7, 2.4));
  }

  createFlowers() {
    const w = this.cssW;
    const h = this.cssH;
    const s = Math.min(w, h);
    const n = this.mobile ? 5 : 9;
    this.flowers = [];
    for (let i = 0; i < n; i++) {
      this.flowers.push({
        x: rand(w * 0.06, w * 0.94),
        y: rand(h * 0.66, h * 0.98),
        r: s * rand(0.012, 0.024),
        hue: Math.random() < 0.5 ? PAL.flower : '#f2c0d8',
        bloom: rand(0.2, 0.8),
        bSp: rand(0.1, 0.25),
        swayPh: rand(0, TAU),
        petals: 5,
      });
    }
  }

  createLanterns() {
    const w = this.cssW;
    const h = this.cssH;
    const s = Math.min(w, h);
    const defs = this.mobile
      ? [
          [0.22, 0.3, 0.03],
          [0.8, 0.24, 0.024],
        ]
      : [
          [0.16, 0.34, 0.03],
          [0.32, 0.22, 0.022],
          [0.82, 0.3, 0.028],
        ];
    this.lanterns = defs.map(([fx, drop, fr]) => ({
      x: w * fx,
      topY: 0,
      y: h * drop,
      r: s * fr,
      glow: 0.5,
      target: 0.5,
      sway: rand(0, TAU),
      swaySp: rand(0.3, 0.55),
      flick: rand(0, TAU),
    }));
  }

  // ---- caches ----

  private buildGlowSprites() {
    const make = (col: string): HTMLCanvasElement => {
      const cv = document.createElement('canvas');
      cv.width = 64;
      cv.height = 64;
      const c = cv.getContext('2d')!;
      const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, col);
      g.addColorStop(0.4, col.replace('1)', '0.5)'));
      g.addColorStop(1, col.replace('1)', '0)'));
      c.fillStyle = g;
      c.fillRect(0, 0, 64, 64);
      return cv;
    };
    this.glowGold = make('rgba(247,213,106,1)');
    this.glowGreen = make('rgba(150,230,150,1)');
  }

  private buildFrame() {
    const cv = this.frameCan;
    cv.width = this.iCan.width;
    cv.height = this.iCan.height;
    const c = cv.getContext('2d')!;
    c.setTransform(this.drawScale, 0, 0, this.drawScale, 0, 0);
    c.clearRect(0, 0, this.cssW, this.cssH);
    const w = this.cssW;
    const h = this.cssH;

    const iron = 'rgba(18,22,30,0.92)';
    const brassEdge = 'rgba(184,138,66,0.5)';

    // the big arched greenhouse window: side posts + round-arch top + mullion grid
    const left = w * 0.12;
    const right = w * 0.88;
    const springY = h * 0.34; // where the arch springs from the verticals
    const apexY = h * 0.06;
    const midX = (left + right) / 2;

    const bar = (x0: number, y0: number, x1: number, y1: number, width: number) => {
      c.strokeStyle = iron;
      c.lineWidth = width;
      c.beginPath();
      c.moveTo(x0, y0);
      c.lineTo(x1, y1);
      c.stroke();
      c.strokeStyle = brassEdge;
      c.lineWidth = Math.max(1, width * 0.3);
      c.beginPath();
      c.moveTo(x0 - width * 0.3, y0);
      c.lineTo(x1 - width * 0.3, y1);
      c.stroke();
    };

    // side posts down to the floor
    bar(left, springY, left, h, 10);
    bar(right, springY, right, h, 10);
    // mullions (vertical glazing bars)
    const cols = this.mobile ? 3 : 5;
    for (let i = 1; i < cols; i++) {
      const x = lerp(left, right, i / cols);
      bar(x, springY, x, h, 4);
    }
    // transom bars (horizontal)
    for (let j = 1; j <= 2; j++) {
      const y = lerp(springY, h, j / 3);
      c.strokeStyle = iron;
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(left, y);
      c.lineTo(right, y);
      c.stroke();
    }
    // round arch (two curves meeting at the apex) + radial glazing bars
    c.strokeStyle = iron;
    c.lineWidth = 10;
    c.beginPath();
    c.moveTo(left, springY);
    c.quadraticCurveTo(midX, apexY - h * 0.04, right, springY);
    c.stroke();
    c.strokeStyle = brassEdge;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(left, springY);
    c.quadraticCurveTo(midX, apexY - h * 0.04, right, springY);
    c.stroke();
    // radial bars in the fan light
    const fans = this.mobile ? 4 : 6;
    for (let i = 1; i < fans; i++) {
      const t = i / fans;
      const ax = lerp(left, right, t);
      const ay = springY - Math.sin(t * Math.PI) * (springY - apexY);
      bar(midX, springY, ax, ay, 3);
    }
    // an ornamental hub where the fans meet
    c.fillStyle = 'rgba(26,30,40,0.95)';
    c.beginPath();
    c.arc(midX, springY, 9, 0, TAU);
    c.fill();
    c.strokeStyle = brassEdge;
    c.lineWidth = 2;
    c.stroke();
  }

  private paintBackdrop() {
    const c = this.bgCtx;
    c.setTransform(this.drawScale, 0, 0, this.drawScale, 0, 0);
    const w = this.cssW;
    const h = this.cssH;

    // night sky gradient
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, PAL.sky0);
    g.addColorStop(0.5, '#0a2018');
    g.addColorStop(1, PAL.sky1);
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    // violet corners
    const vg = c.createRadialGradient(w / 2, h * 0.42, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.8);
    vg.addColorStop(0, 'rgba(26,20,36,0)');
    vg.addColorStop(1, 'rgba(26,20,36,0.7)');
    c.fillStyle = vg;
    c.fillRect(0, 0, w, h);

    // moon glow, upper-right behind the glass
    const mx = w * 0.74;
    const my = h * 0.2;
    const mr = Math.min(w, h) * 0.06;
    const halo = c.createRadialGradient(mx, my, 0, mx, my, mr * 7);
    halo.addColorStop(0, 'rgba(156,207,227,0.4)');
    halo.addColorStop(0.4, 'rgba(120,170,200,0.14)');
    halo.addColorStop(1, 'rgba(120,170,200,0)');
    c.fillStyle = halo;
    c.beginPath();
    c.arc(mx, my, mr * 7, 0, TAU);
    c.fill();
    const disc = c.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, mr * 0.2, mx, my, mr);
    disc.addColorStop(0, '#eef6fb');
    disc.addColorStop(1, '#adc6d6');
    c.fillStyle = disc;
    c.beginPath();
    c.arc(mx, my, mr, 0, TAU);
    c.fill();

    // faint stars (denser near the moon)
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h * 0.5;
      const a = Math.random() * 0.4 + 0.04;
      c.fillStyle = `rgba(200,224,236,${a})`;
      c.beginPath();
      c.arc(x, y, Math.random() * 1.1 + 0.3, 0, TAU);
      c.fill();
    }

    // far gear silhouettes behind the glass (very low contrast)
    c.globalAlpha = 0.4;
    this.paintFarGear(c, w * 0.3, h * 0.18, Math.min(w, h) * 0.13, 18);
    this.paintFarGear(c, w * 0.46, h * 0.26, Math.min(w, h) * 0.08, 13);
    this.paintFarGear(c, w * 0.62, h * 0.5, Math.min(w, h) * 0.1, 15);
    c.globalAlpha = 1;

    // blurred distant foliage along the base
    const fg = c.createLinearGradient(0, h * 0.7, 0, h);
    fg.addColorStop(0, 'rgba(13,42,32,0)');
    fg.addColorStop(1, 'rgba(13,42,32,0.85)');
    c.fillStyle = fg;
    c.fillRect(0, h * 0.7, w, h * 0.3);
  }

  private paintFarGear(c: CanvasRenderingContext2D, x: number, y: number, r: number, teeth: number) {
    c.save();
    c.translate(x, y);
    c.fillStyle = '#1a1424';
    c.beginPath();
    for (let i = 0; i < teeth; i++) {
      const a0 = (i / teeth) * TAU;
      const a1 = ((i + 0.5) / teeth) * TAU;
      const a2 = ((i + 1) / teeth) * TAU;
      const ro = r * 1.12;
      c.lineTo(Math.cos(a0) * r, Math.sin(a0) * r);
      c.lineTo(Math.cos(a0 + (a1 - a0) * 0.25) * ro, Math.sin(a0 + (a1 - a0) * 0.25) * ro);
      c.lineTo(Math.cos(a1 - (a1 - a0) * 0.25) * ro, Math.sin(a1 - (a1 - a0) * 0.25) * ro);
      c.lineTo(Math.cos(a2) * r, Math.sin(a2) * r);
    }
    c.closePath();
    c.fill();
    c.restore();
  }

  // ---- pointer ----

  private isUI(e: Event): boolean {
    const t = e.target as Element | null;
    return !!t && typeof t.closest === 'function' && !!t.closest('[data-ui]');
  }

  private onPointerDown = (e: PointerEvent) => {
    if (this.isUI(e)) return;
    this.down = true;
    this.px = e.clientX;
    this.py = e.clientY;
    // a seed-bloom: a new flower grows where you click
    if (this.flowers.length < 26 && e.clientY > this.cssH * 0.4) {
      this.flowers.push({
        x: e.clientX, y: e.clientY, r: Math.min(this.cssW, this.cssH) * 0.02,
        hue: Math.random() < 0.5 ? PAL.flower : '#f2c0d8', bloom: 0, bSp: 0.5,
        swayPh: rand(0, TAU), petals: 5,
      });
    }
    // clicking the clock brightens the room
    if (Math.hypot(e.clientX - this.clockX, e.clientY - this.clockY) < this.clockR * 1.2) {
      this.flash = Math.min(1, this.flash + 0.4);
    }
    this.addDrop(e.clientX, e.clientY, 16, 0.8);
    audioEngine.plop();
  };

  private onPointerMove = (e: PointerEvent) => {
    if (this.isUI(e)) return;
    this.px = e.clientX;
    this.py = e.clientY;
    if (this.reduced) return;
    if (this.lmx < 0) {
      this.lmx = e.clientX;
      this.lmy = e.clientY;
      return;
    }
    const dx = e.clientX - this.lmx;
    const dy = e.clientY - this.lmy;
    this.windX = clamp(this.windX + dx * 0.05, -36, 36);
    this.windY = clamp(this.windY + dy * 0.04, -28, 28);
    if (Math.hypot(dx, dy) > 24) {
      this.addDrop(e.clientX, e.clientY, 7, 0.05);
      this.lmx = e.clientX;
      this.lmy = e.clientY;
    }
  };

  private onPointerUp = () => {
    this.down = false;
  };

  private onResize = () => {
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => this.resize(), 150);
  };

  private onVisibility = () => {
    if (document.hidden) this.stop();
    else if (!this.running) this.start();
  };

  private onContextLost = (e: Event) => {
    e.preventDefault();
    this.stop();
  };

  private onContextRestored = () => {
    this.initGL();
    this.start();
  };

  private addDrop(x: number, y: number, r: number, s: number) {
    this.drops.push({ x, y, r, s });
    if (this.drops.length > 24) this.drops.shift();
  }

  // ---- loop ----

  private frame = (ts: number) => {
    if (!this.running) return;
    const t = ts / 1000;
    const dt = Math.min(0.05, Math.max(0.001, t - this.last));
    this.last = t;
    // ambient rain striking the glass
    if (!this.reduced) {
      this.ambT -= dt;
      if (this.ambT <= 0) {
        this.addDrop(Math.random() * this.cssW, Math.random() * this.cssH * 0.7, 5 + Math.random() * 5, 0.18 + Math.random() * 0.18);
        this.ambT = 0.5 + Math.random() * 1.1;
      }
    }
    this.update(dt);
    this.drawInterior(t);
    this.uploadInterior();
    this.simulate();
    this.render(t);
    this.rafId = requestAnimationFrame(this.frame);
  };

  private update(dt: number) {
    const sdt = dt * this.speedScale;
    this.time += sdt;
    this.windX *= 1 - Math.min(1, dt * 0.8);
    this.windY *= 1 - Math.min(1, dt * 0.8);
    this.displayProgress += (this.focusProgress - this.displayProgress) * Math.min(1, dt * 0.8);
    const warmTarget = this.focusPhase === 'break' ? 1 : 0;
    this.warm += (warmTarget - this.warm) * Math.min(1, dt * 0.5);
    this.gather += ((this.down ? 1 : 0) - this.gather) * Math.min(1, dt * 2.2);
    this.flash *= 1 - Math.min(1, dt * 1.4);

    // gears turn
    for (const g of this.gears) {
      g.angle += g.av * sdt;
      g.glint += sdt;
    }

    // clock hand -> focus progress (or a slow idle drift)
    const handTarget = this.focusPhase === 'idle' ? this.clockHand + sdt * 0.1 : -Math.PI / 2 + this.displayProgress * TAU;
    this.clockHand += (handTarget - this.clockHand) * Math.min(1, dt * 1.5);

    // flowers breathe; open more with focus
    for (const fl of this.flowers) {
      const base = 0.4 + this.displayProgress * 0.5;
      const target = clamp(base + Math.sin(this.time * fl.bSp + fl.swayPh) * 0.2, 0, 1);
      fl.bloom += (target - fl.bloom) * Math.min(1, dt * 1.2);
    }

    // lanterns: milestone brightening + cursor proximity + flicker
    const milestone = 0.45 + Math.floor(this.displayProgress / 0.34) * 0.18;
    for (const l of this.lanterns) {
      l.flick += sdt * 6;
      let target = milestone + this.warm * 0.1;
      if (this.px >= 0) {
        const d = Math.hypot(this.px - l.x, this.py - l.y);
        if (d < 200) target += (1 - d / 200) * 0.22;
      }
      l.target = clamp(target, 0.3, 1.05);
      l.glow += (l.target - l.glow) * Math.min(1, dt * 2);
    }

    // fireflies
    const calmTarget = this.focusPhase === 'work' ? 1 : 0;
    for (const f of this.fireflies) {
      f.pulse += sdt * f.pulseSp;
      f.calm += (calmTarget - f.calm) * Math.min(1, dt * 0.4);
      const speedMul = 1 - f.calm * 0.5;

      // re-roll drift target occasionally
      if (Math.random() < dt * 0.4) {
        f.tx = rand(0, this.cssW);
        f.ty = rand(this.cssH * 0.12, this.cssH * 0.96);
      }
      // wander toward target
      let ax = (f.tx - f.x) * 0.4 + Math.sin(this.time * 0.7 + f.seed) * 10;
      let ay = (f.ty - f.y) * 0.4 + Math.cos(this.time * 0.5 + f.seed * 1.3) * 10;
      // during focus, drift gently toward the clock
      if (f.calm > 0.1) {
        ax += (this.clockX - f.x) * 0.06 * f.calm;
        ay += (this.clockY - f.y) * 0.06 * f.calm;
      }
      // cursor wind + gather/repel
      ax += this.windX * 0.4 * f.depth;
      ay += this.windY * 0.4 * f.depth;
      if (this.px >= 0) {
        const gx = this.px - f.x;
        const gy = this.py - f.y;
        const gd = Math.hypot(gx, gy) || 1;
        if (this.gather > 0.05) {
          const pull = this.gather * 70 * (0.4 + f.depth);
          ax += (gx / gd) * pull;
          ay += (gy / gd) * pull;
        } else if (gd < 120) {
          // gentle baseline attraction
          ax += (gx / gd) * (1 - gd / 120) * 24;
          ay += (gy / gd) * (1 - gd / 120) * 24;
        }
      }
      f.vx += (ax - f.vx) * Math.min(1, dt * 1.4);
      f.vy += (ay - f.vy) * Math.min(1, dt * 1.4);
      f.x += f.vx * sdt * speedMul;
      f.y += f.vy * sdt * speedMul;
      // soft bounds
      const m = 20;
      if (f.x < -m) f.x = this.cssW + m;
      else if (f.x > this.cssW + m) f.x = -m;
      if (f.y < -m) f.y = this.cssH + m;
      else if (f.y > this.cssH + m) f.y = -m;
    }
  }

  // ---- interior drawing ----

  private drawInterior(t: number) {
    const c = this.iCtx;
    c.setTransform(this.drawScale, 0, 0, this.drawScale, 0, 0);
    c.clearRect(0, 0, this.cssW, this.cssH);

    // the cached iron frame sits in front of the glass
    c.drawImage(this.frameCan, 0, 0, this.cssW, this.cssH);

    this.drawClockwork(c);
    this.drawVines(c);
    this.drawPlants(c);
    this.drawClock(c);
    this.drawLanterns(c);
    this.drawFlowers(c);
    this.drawFireflies(c);
    this.drawForeground(c);
    this.drawGlassSheen(c, t);
  }

  private drawClockwork(c: CanvasRenderingContext2D) {
    for (const g of this.gears) this.drawGear(c, g);
  }

  private drawGear(c: CanvasRenderingContext2D, g: Gear) {
    c.save();
    c.translate(g.x, g.y);
    c.rotate(g.angle);
    const baseL = 30 + g.shade * 100;
    // teeth (trapezoidal: root -> tip-rise -> tip-flat -> root -> valley)
    const seg = TAU / g.teeth;
    const ro = g.r + g.toothD;
    c.beginPath();
    for (let i = 0; i < g.teeth; i++) {
      const a = i * seg;
      c.lineTo(Math.cos(a) * g.r, Math.sin(a) * g.r);
      c.lineTo(Math.cos(a + seg * 0.16) * ro, Math.sin(a + seg * 0.16) * ro);
      c.lineTo(Math.cos(a + seg * 0.34) * ro, Math.sin(a + seg * 0.34) * ro);
      c.lineTo(Math.cos(a + seg * 0.5) * g.r, Math.sin(a + seg * 0.5) * g.r);
      c.lineTo(Math.cos(a + seg) * g.r, Math.sin(a + seg) * g.r);
    }
    c.closePath();
    const grad = c.createRadialGradient(-g.r * 0.3, -g.r * 0.3, g.r * 0.1, 0, 0, g.r + g.toothD);
    grad.addColorStop(0, `hsl(38,46%,${baseL + 16}%)`);
    grad.addColorStop(0.6, `hsl(36,44%,${baseL}%)`);
    grad.addColorStop(1, `hsl(34,40%,${baseL - 14}%)`);
    c.fillStyle = grad;
    c.fill();
    // hub ring
    c.fillStyle = `hsl(34,38%,${baseL - 8}%)`;
    c.beginPath();
    c.arc(0, 0, g.hub, 0, TAU);
    c.fill();
    c.fillStyle = `hsl(38,40%,${baseL + 10}%)`;
    c.beginPath();
    c.arc(0, 0, g.hub * 0.45, 0, TAU);
    c.fill();
    // spokes
    c.strokeStyle = `hsl(34,36%,${baseL - 10}%)`;
    c.lineWidth = Math.max(1.5, g.r * 0.05);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      c.beginPath();
      c.moveTo(Math.cos(a) * g.hub, Math.sin(a) * g.hub);
      c.lineTo(Math.cos(a) * (g.r - g.toothD), Math.sin(a) * (g.r - g.toothD));
      c.stroke();
    }
    // rare glint
    const gl = Math.sin(g.glint * 0.6);
    if (gl > 0.97) {
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = 'rgba(255,240,200,0.5)';
      c.beginPath();
      c.arc(g.r * 0.7, -g.r * 0.2, g.r * 0.12, 0, TAU);
      c.fill();
      c.globalCompositeOperation = 'source-over';
    }
    c.restore();
  }

  private drawVines(c: CanvasRenderingContext2D) {
    for (const v of this.vines) {
      const sway = Math.sin(this.time * 0.5 + v.swayPh) * 6 + this.windX * 0.1;
      c.strokeStyle = 'rgba(46,72,52,0.92)';
      c.lineWidth = v.width;
      c.lineCap = 'round';
      c.beginPath();
      for (let i = 0; i < v.pts.length; i++) {
        const p = v.pts[i];
        const sx = p.x + Math.sin(i * 0.6 + this.time * 0.5 + v.swayPh) * 4 + (i / v.pts.length) * sway;
        if (i === 0) c.moveTo(sx, p.y);
        else c.lineTo(sx, p.y);
      }
      c.stroke();
      // little leaves along the vine
      for (let i = 1; i < v.pts.length; i += v.leafEvery) {
        const p = v.pts[i];
        const sx = p.x + Math.sin(i * 0.6 + this.time * 0.5 + v.swayPh) * 4 + (i / v.pts.length) * sway;
        this.drawSmallLeaf(c, sx, p.y, (i % 2 ? 1 : -1) * 1.2, v.width * 3);
      }
      c.lineCap = 'butt';
    }
  }

  private drawSmallLeaf(c: CanvasRenderingContext2D, x: number, y: number, ang: number, s: number) {
    c.save();
    c.translate(x, y);
    c.rotate(ang);
    const g = c.createLinearGradient(0, 0, s, 0);
    g.addColorStop(0, 'rgba(60,96,68,0.95)');
    g.addColorStop(1, 'rgba(40,72,52,0.9)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(s * 0.5, -s * 0.4, s, 0);
    c.quadraticCurveTo(s * 0.5, s * 0.4, 0, 0);
    c.closePath();
    c.fill();
    c.restore();
  }

  private drawPlants(c: CanvasRenderingContext2D) {
    // sort by depth so far leaves draw first
    const order = [...this.leaves].sort((a, b) => a.depth - b.depth);
    for (const lf of order) this.drawLeaf(c, lf);
  }

  private drawLeaf(c: CanvasRenderingContext2D, lf: Leaf) {
    const sway = Math.sin(this.time * lf.swaySp + lf.swayPh) * 0.06 + this.windX * 0.0016;
    c.save();
    c.translate(lf.x, lf.y);
    c.rotate(lf.angle + sway);
    const L = lf.len;
    const W = lf.wid;
    const tipBend = lf.curve + sway * 2;
    // leaf body
    c.beginPath();
    c.moveTo(0, 0);
    c.bezierCurveTo(W, -L * 0.2, W * (1 + tipBend), -L * 0.7, tipBend * W * 1.2, -L);
    c.bezierCurveTo(-W * (1 - tipBend), -L * 0.7, -W, -L * 0.2, 0, 0);
    c.closePath();
    const g = c.createLinearGradient(0, 0, 0, -L);
    g.addColorStop(0, `hsl(${lf.hue},26%,${lf.light - 7}%)`);
    g.addColorStop(0.6, `hsl(${lf.hue},30%,${lf.light}%)`);
    g.addColorStop(1, `hsl(${lf.hue + 6},34%,${lf.light + 7}%)`);
    c.fillStyle = g;
    c.fill();
    // moonlit rim along the leading edge
    c.strokeStyle = `hsla(190,40%,72%,0.16)`;
    c.lineWidth = Math.max(1, W * 0.05);
    c.stroke();
    // midrib + ribs
    c.strokeStyle = `hsla(${lf.hue},24%,${lf.light + 12}%,0.45)`;
    c.lineWidth = Math.max(1, W * 0.04);
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(tipBend * W * 0.6, -L * 0.5, tipBend * W * 1.2, -L);
    c.stroke();
    c.lineWidth = Math.max(0.6, W * 0.02);
    for (let i = 1; i <= lf.ribs; i++) {
      const t = i / (lf.ribs + 1);
      const mx = tipBend * W * 1.2 * t;
      const my = -L * t;
      c.beginPath();
      c.moveTo(mx, my);
      c.lineTo(mx + W * (0.5 - 0.3 * t), my - L * 0.08);
      c.moveTo(mx, my);
      c.lineTo(mx - W * (0.5 - 0.3 * t), my - L * 0.08);
      c.stroke();
    }
    c.restore();
  }

  private drawClock(c: CanvasRenderingContext2D) {
    const x = this.clockX;
    const y = this.clockY;
    const r = this.clockR;

    // soft moon-blue light wash behind the clock from the glass
    c.globalCompositeOperation = 'lighter';
    const back = c.createRadialGradient(x, y, 0, x, y, r * 2.2);
    back.addColorStop(0, `rgba(156,207,227,${0.12 + this.flash * 0.2})`);
    back.addColorStop(1, 'rgba(156,207,227,0)');
    c.fillStyle = back;
    c.beginPath();
    c.arc(x, y, r * 2.2, 0, TAU);
    c.fill();
    c.globalCompositeOperation = 'source-over';

    // flower-clock petals around the rim, opening with focus
    const petals = 12;
    const open = 0.3 + this.displayProgress * 0.7;
    for (let i = 0; i < petals; i++) {
      const a = (i / petals) * TAU;
      const pr = r * 1.18;
      c.save();
      c.translate(x + Math.cos(a) * pr, y + Math.sin(a) * pr);
      c.rotate(a + Math.PI / 2);
      const pl = r * 0.34 * open;
      const pw = r * 0.12;
      const g = c.createLinearGradient(0, 0, 0, -pl);
      g.addColorStop(0, 'rgba(180,138,66,0.9)');
      g.addColorStop(1, `rgba(247,213,106,${0.5 + this.displayProgress * 0.4})`);
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(0, 0);
      c.quadraticCurveTo(pw, -pl * 0.6, 0, -pl);
      c.quadraticCurveTo(-pw, -pl * 0.6, 0, 0);
      c.closePath();
      c.fill();
      c.restore();
    }

    // brass bezel
    const bez = c.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.4, x, y, r * 1.05);
    bez.addColorStop(0, '#d8ac63');
    bez.addColorStop(0.6, PAL.brass);
    bez.addColorStop(1, '#7c5a2c');
    c.fillStyle = bez;
    c.beginPath();
    c.arc(x, y, r, 0, TAU);
    c.fill();
    // bolts
    c.fillStyle = 'rgba(60,42,18,0.7)';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      c.beginPath();
      c.arc(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9, r * 0.025, 0, TAU);
      c.fill();
    }
    // recessed dark face
    const face = c.createRadialGradient(x, y, 0, x, y, r * 0.82);
    face.addColorStop(0, '#142019');
    face.addColorStop(1, '#0a140f');
    c.fillStyle = face;
    c.beginPath();
    c.arc(x, y, r * 0.82, 0, TAU);
    c.fill();

    // luminous progress ring
    c.globalCompositeOperation = 'lighter';
    c.lineWidth = r * 0.06;
    c.strokeStyle = `rgba(247,213,106,${0.5 + this.displayProgress * 0.4 + this.flash * 0.3})`;
    c.beginPath();
    c.arc(x, y, r * 0.7, -Math.PI / 2, -Math.PI / 2 + Math.max(0.02, this.displayProgress) * TAU);
    c.stroke();
    c.globalCompositeOperation = 'source-over';

    // hour ticks
    c.strokeStyle = 'rgba(200,176,120,0.6)';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      const big = i % 3 === 0;
      c.lineWidth = big ? 2.4 : 1.2;
      c.beginPath();
      c.moveTo(x + Math.cos(a) * r * 0.74, y + Math.sin(a) * r * 0.74);
      c.lineTo(x + Math.cos(a) * r * (big ? 0.62 : 0.66), y + Math.sin(a) * r * (big ? 0.62 : 0.66));
      c.stroke();
    }

    // central gear-train glimpse + hand
    c.save();
    c.translate(x, y);
    c.fillStyle = 'rgba(184,138,66,0.5)';
    c.beginPath();
    c.arc(0, 0, r * 0.16, 0, TAU);
    c.fill();
    // the slow hand
    c.rotate(this.clockHand + Math.PI / 2);
    c.strokeStyle = '#e8c878';
    c.lineWidth = r * 0.035;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(0, r * 0.1);
    c.lineTo(0, -r * 0.58);
    c.stroke();
    c.lineCap = 'butt';
    c.fillStyle = '#d8ac63';
    c.beginPath();
    c.arc(0, 0, r * 0.05, 0, TAU);
    c.fill();
    c.restore();
  }

  private drawLanterns(c: CanvasRenderingContext2D) {
    for (const l of this.lanterns) {
      const swing = Math.sin(this.time * l.swaySp + l.sway) * 8 + this.windX * 0.08;
      const bx = l.x + swing;
      const by = l.y;
      const flick = 0.92 + 0.08 * Math.sin(l.flick);
      const glow = l.glow * flick;
      // cord up into the canopy
      c.strokeStyle = 'rgba(30,34,44,0.8)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(l.x, 0);
      c.quadraticCurveTo((l.x + bx) / 2, by * 0.5, bx, by - l.r);
      c.stroke();
      // halo
      const hr = l.r * 5;
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = glow * 0.5;
      c.drawImage(this.glowGold, bx - hr, by - hr, hr * 2, hr * 2);
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
      // body
      const bg = c.createLinearGradient(0, by - l.r, 0, by + l.r);
      bg.addColorStop(0, '#ffd98c');
      bg.addColorStop(0.5, PAL.amber);
      bg.addColorStop(1, '#b9712f');
      c.fillStyle = bg;
      c.beginPath();
      c.ellipse(bx, by, l.r * 0.78, l.r, 0, 0, TAU);
      c.fill();
      // caps
      c.fillStyle = 'rgba(40,40,52,0.85)';
      c.beginPath();
      c.ellipse(bx, by - l.r, l.r * 0.4, l.r * 0.14, 0, 0, TAU);
      c.fill();
      c.beginPath();
      c.ellipse(bx, by + l.r, l.r * 0.32, l.r * 0.12, 0, 0, TAU);
      c.fill();
    }
  }

  private drawFlowers(c: CanvasRenderingContext2D) {
    for (const fl of this.flowers) {
      const sway = Math.sin(this.time * 0.7 + fl.swayPh) * 2 + this.windX * 0.03;
      const x = fl.x + sway;
      const y = fl.y;
      const open = fl.bloom;
      // stem
      c.strokeStyle = 'rgba(70,104,74,0.7)';
      c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(fl.x, fl.y + fl.r * 2.4);
      c.quadraticCurveTo(fl.x + sway * 0.5, fl.y + fl.r, x, y);
      c.stroke();
      // petals
      for (let i = 0; i < fl.petals; i++) {
        const a = (i / fl.petals) * TAU + this.time * 0.05;
        const pr = fl.r * (0.4 + open * 0.9);
        c.fillStyle = fl.hue;
        c.globalAlpha = 0.85;
        c.beginPath();
        c.ellipse(x + Math.cos(a) * pr, y + Math.sin(a) * pr, fl.r * 0.5, fl.r * 0.3, a, 0, TAU);
        c.fill();
      }
      c.globalAlpha = 1;
      // glowing center
      c.globalCompositeOperation = 'lighter';
      const cg = c.createRadialGradient(x, y, 0, x, y, fl.r * 1.2);
      cg.addColorStop(0, `rgba(247,230,161,${0.5 + open * 0.4})`);
      cg.addColorStop(1, 'rgba(247,230,161,0)');
      c.fillStyle = cg;
      c.beginPath();
      c.arc(x, y, fl.r * 1.2, 0, TAU);
      c.fill();
      c.globalCompositeOperation = 'source-over';
    }
  }

  private drawFireflies(c: CanvasRenderingContext2D) {
    const order = [...this.fireflies].sort((a, b) => a.depth - b.depth);
    c.globalCompositeOperation = 'lighter';
    for (const f of order) {
      const pulse = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(f.pulse));
      const a = pulse * (0.45 + f.depth * 0.55);
      const R = f.glowR * (1 + pulse * 0.4);
      const sprite = f.green ? this.glowGreen : this.glowGold;
      c.globalAlpha = a;
      c.drawImage(sprite, f.x - R, f.y - R, R * 2, R * 2);
      // bright core
      c.globalAlpha = Math.min(1, a + 0.2);
      c.fillStyle = f.green ? 'rgba(210,255,210,0.9)' : 'rgba(255,248,210,0.9)';
      c.beginPath();
      c.arc(f.x, f.y, Math.max(0.8, f.depth * 1.6), 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }

  private drawForeground(c: CanvasRenderingContext2D) {
    if (this.mobile) return;
    const ox = this.windX * 0.5;
    const leaf = (x: number, y: number, s: number, flip: number) => {
      c.save();
      c.translate(x + ox * flip, y);
      c.scale(flip, 1);
      c.globalAlpha = 0.6;
      const g = c.createLinearGradient(0, -s, 0, s);
      g.addColorStop(0, 'rgba(8,18,16,0)');
      g.addColorStop(1, 'rgba(6,14,12,0.95)');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(0, s);
      c.bezierCurveTo(s * 1.2, s * 0.2, s * 1.0, -s * 0.7, 0, -s);
      c.bezierCurveTo(-s * 0.5, -s * 0.4, -s * 0.5, s * 0.5, 0, s);
      c.closePath();
      c.fill();
      c.restore();
    };
    leaf(-10, this.cssH + 40, this.cssH * 0.4, 1);
    leaf(this.cssW + 10, this.cssH + 60, this.cssH * 0.46, -1);
    c.globalAlpha = 1;
  }

  private drawGlassSheen(c: CanvasRenderingContext2D, t: number) {
    // a few slow condensation runs catching the moonlight (subtle, on the glass)
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = 'rgba(156,207,227,0.06)';
    c.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const x = (i / 5) * this.cssW + Math.sin(t * 0.2 + i) * 6;
      const y0 = (i * 53) % (this.cssH * 0.4);
      c.beginPath();
      c.moveTo(x, y0);
      c.quadraticCurveTo(x + 8, y0 + this.cssH * 0.2, x - 4, y0 + this.cssH * 0.42);
      c.stroke();
    }
    c.globalCompositeOperation = 'source-over';
  }

  // ---- composite ----

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
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.interiorTex); gl.uniform1i(this.ru.interior, 2);
    gl.uniform2f(this.ru.texel, 1 / this.simW, 1 / this.simH);
    gl.uniform1f(this.ru.t, t);
    gl.uniform1f(this.ru.warm, this.warm);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
