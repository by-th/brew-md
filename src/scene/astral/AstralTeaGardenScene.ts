// Astral Tea Garden — a hidden tea garden floating in the night sky.
//
// A pure Canvas2D ambient scene built in the same spirit (and with the same
// lifecycle contract) as the WebGL koi/jellyfish scenes: init(canvas) -> start()
// runs a requestAnimationFrame loop; setReduced() honors prefers-reduced-motion;
// destroy() tears everything down. There is no water surface here, so a GPU
// height-field would be unused — the whole scene is procedural 2D drawing with
// cached static layers (starfield, clouds, platform) for performance.
//
// Diegetic focus: setFocusProgress()/setPhase()/pulseBloom() let the focus timer
// steep the tea, wax the moon, and fill the lanterns without any on-canvas UI.

import { clamp } from '../../lib/clamp';
import { audioEngine } from '../../audio/engine';

type FocusPhase = 'work' | 'break' | 'idle';

type Star = {
  x: number;
  y: number;
  r: number;
  base: number; // base brightness 0..1
  tw: number; // twinkle phase
  tws: number; // twinkle speed
  hue: number; // 0 cool .. 1 warm
};

type Constellation = { idx: number[] };

type Cloud = {
  sprite: number;
  x: number;
  y: number;
  scale: number;
  alpha: number;
  speed: number;
  band: 'far' | 'mid' | 'near';
};

type Lantern = {
  x: number;
  topY: number;
  bodyY: number;
  r: number;
  hue: string;
  glow: number; // eased current glow
  target: number; // target glow
  sway: number;
  swaySpeed: number;
  flick: number;
};

type Petal = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  rotV: number;
  size: number;
  depth: number; // 0 far .. 1 near
  hue: string;
  alpha: number;
  orbit: boolean;
  oa: number; // orbit angle
  orr: number; // orbit radius
  ph: number; // drift phase
  glow: number; // transient glow after a burst
};

type Crane = { x: number; y: number; vx: number; bob: number; ph: number; depth: number };

type Creature = { x: number; y: number; vx: number; ph: number; alpha: number; dir: number };

type Ring = { x: number; y: number; r: number; maxR: number; alpha: number; hue: string };

type Shoot = { x: number; y: number; vx: number; vy: number; life: number; len: number };

const TAU = Math.PI * 2;
const REF_AREA = 1280 * 800;

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export class AstralTeaGardenScene {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  private cssW = 0;
  private cssH = 0;
  private dpr = 1;
  private mobile = false;

  private running = false;
  private rafId = 0;
  private resizeTimer: ReturnType<typeof setTimeout> | null = null;
  private last = 0;
  private time = 0;

  private reduced = false;
  private speedScale = 1;

  // pointer + wind
  private px = -1;
  private py = -1;
  private down = false;
  private lmx = -1;
  private lmy = -1;
  private windX = 0;
  private windY = 0;
  private gather = 0; // eased gather strength while held

  // focus
  private focusProgress = 0;
  private displayProgress = 0;
  private focusPhase: FocusPhase = 'idle';
  private warm = 0; // eased: 1 = warm focus, drops on break
  private flash = 0; // transient brightening (clicks / completion)

  // entities
  private stars: Star[] = [];
  private constellations: Constellation[] = [];
  private clouds: Cloud[] = [];
  private lanterns: Lantern[] = [];
  private petals: Petal[] = [];
  private cranes: Crane[] = [];
  private creature: Creature | null = null;
  private rings: Ring[] = [];
  private shoots: Shoot[] = [];

  // timers
  private craneT = rand(8, 18);
  private creatureT = rand(20, 45);
  private shootT = rand(6, 16);

  // layout anchors (css px)
  private moonX = 0;
  private moonY = 0;
  private moonR = 0;
  private platX = 0;
  private platY = 0;
  private platW = 0;
  private platH = 0;
  private tableX = 0;
  private tableY = 0;
  private tableR = 0;
  private bob = 0;

  // caches
  private starCan: HTMLCanvasElement | null = null;
  private cloudSprites: HTMLCanvasElement[] = [];
  private platCan: HTMLCanvasElement | null = null;

  // ---- lifecycle ----

  init(canvas: HTMLCanvasElement): boolean {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return false;
    this.canvas = canvas;
    this.ctx = ctx;

    this.measure();
    this.buildCloudSprites();
    this.layout();
    this.createStars();
    this.createClouds();
    this.createLanterns();
    this.createPetals();
    this.cranes = [];
    this.creature = null;
    this.buildStarfield();
    this.buildPlatform();

    window.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);

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

  setPhase(phase: FocusPhase) {
    this.focusPhase = phase;
  }

  /** Diegetic "session complete": a soft petal/bloom wave from the tea table. */
  pulseBloom() {
    this.flash = Math.min(1, this.flash + 0.9);
    this.rings.push({ x: this.tableX, y: this.tableY, r: this.tableR * 0.6, maxR: Math.max(this.cssW, this.cssH) * 0.6, alpha: 0.5, hue: '#f6d79a' });
    this.spawnPetalBurst(this.tableX, this.tableY, 18, 90);
  }

  start() {
    if (this.running || !this.ctx) return;
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
    this.resizeTimer = null;
    this.stars = [];
    this.clouds = [];
    this.lanterns = [];
    this.petals = [];
    this.cranes = [];
    this.rings = [];
    this.shoots = [];
    this.creature = null;
    this.starCan = null;
    this.platCan = null;
    this.cloudSprites = [];
    this.ctx = null;
    this.canvas = null;
  }

  // ---- sizing + layout ----

  private measure() {
    this.cssW = window.innerWidth;
    this.cssH = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.mobile = this.cssW <= 820;
    const c = this.canvas!;
    c.width = Math.round(this.cssW * this.dpr);
    c.height = Math.round(this.cssH * this.dpr);
    this.ctx!.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  private areaFactor(): number {
    return clamp((this.cssW * this.cssH) / REF_AREA, 0.4, 1.4);
  }

  private layout() {
    const w = this.cssW;
    const h = this.cssH;
    this.moonX = w * (this.mobile ? 0.74 : 0.76);
    this.moonY = h * (this.mobile ? 0.17 : 0.2);
    this.moonR = Math.min(w, h) * (this.mobile ? 0.085 : 0.075);

    this.platX = w * 0.5;
    this.platY = h * (this.mobile ? 0.7 : 0.66);
    this.platW = Math.min(w * (this.mobile ? 0.86 : 0.56), 760);
    this.platH = this.platW * 0.42;

    this.tableR = Math.min(this.platW * 0.13, 86);
    this.tableX = this.platX;
    this.tableY = this.platY - this.platH * 0.06;
  }

  private resize() {
    if (!this.ctx || !this.canvas) return;
    this.measure();
    this.layout();
    this.buildStarfield();
    this.buildPlatform();
    // keep counts in range for the new viewport
    this.retarget(this.stars, this.starTarget(), () => this.makeStar());
    this.retarget(this.petals, this.petalTarget(), () => this.makePetal(false));
    // reflow lanterns/clouds to new anchors
    this.createLanterns();
    this.createClouds();
  }

  private retarget<T>(arr: T[], target: number, make: () => T) {
    while (arr.length > target) arr.pop();
    while (arr.length < target) arr.push(make());
  }

  // ---- creation ----

  private starTarget(): number {
    return Math.round((this.mobile ? 80 : 140) * this.areaFactor());
  }
  private petalTarget(): number {
    return Math.round((this.mobile ? 20 : 44) * this.areaFactor());
  }

  private makeStar(): Star {
    const warmBias = Math.random();
    return {
      x: rand(0, this.cssW),
      y: rand(0, this.cssH * 0.72),
      r: rand(0.5, 1.7),
      base: rand(0.25, 0.95),
      tw: rand(0, TAU),
      tws: rand(0.4, 1.6),
      hue: warmBias > 0.85 ? rand(0.6, 1) : rand(0, 0.4),
    };
  }

  createStars() {
    const n = this.starTarget();
    this.stars = Array.from({ length: n }, () => this.makeStar());
    // a few faint constellations linking nearby brighter stars
    this.constellations = [];
    const bright = this.stars
      .map((s, i) => ({ s, i }))
      .filter((o) => o.s.base > 0.6 && o.s.y < this.cssH * 0.5);
    let used = 0;
    for (let g = 0; g < 4 && used < bright.length - 3; g++) {
      const start = bright[used];
      const idx = [start.i];
      let cur = start.s;
      for (let k = 0; k < 3 && used + 1 < bright.length; k++) {
        // find a nearby bright star
        let bestJ = -1;
        let bestD = Infinity;
        for (let j = 0; j < bright.length; j++) {
          const o = bright[j];
          if (idx.includes(o.i)) continue;
          const d = Math.hypot(o.s.x - cur.x, o.s.y - cur.y);
          if (d < bestD && d < this.cssW * 0.16) {
            bestD = d;
            bestJ = j;
          }
        }
        if (bestJ < 0) break;
        idx.push(bright[bestJ].i);
        cur = bright[bestJ].s;
      }
      used += Math.max(1, idx.length);
      if (idx.length >= 3) this.constellations.push({ idx });
    }
  }

  createClouds() {
    const af = this.areaFactor();
    const bands: { band: Cloud['band']; n: number; y: [number, number]; scale: [number, number]; alpha: [number, number]; speed: [number, number] }[] = [
      { band: 'far', n: Math.round((this.mobile ? 3 : 5) * af), y: [0.28, 0.52], scale: [0.9, 1.5], alpha: [0.1, 0.2], speed: [3, 7] },
      { band: 'mid', n: Math.round((this.mobile ? 3 : 5) * af), y: [0.42, 0.7], scale: [1.1, 2.0], alpha: [0.16, 0.32], speed: [8, 16] },
      { band: 'near', n: Math.round((this.mobile ? 2 : 4) * af), y: [0.66, 0.96], scale: [1.6, 2.8], alpha: [0.12, 0.26], speed: [18, 30] },
    ];
    this.clouds = [];
    for (const b of bands) {
      for (let i = 0; i < b.n; i++) {
        this.clouds.push({
          sprite: Math.floor(rand(0, this.cloudSprites.length)),
          x: rand(-0.1, 1.1) * this.cssW,
          y: rand(b.y[0], b.y[1]) * this.cssH,
          scale: rand(b.scale[0], b.scale[1]),
          alpha: rand(b.alpha[0], b.alpha[1]),
          speed: rand(b.speed[0], b.speed[1]) * (Math.random() < 0.5 ? 1 : 1),
          band: b.band,
        });
      }
    }
  }

  createLanterns() {
    const w = this.cssW;
    const baseY = this.platY - this.platH * 0.5;
    const defs = this.mobile
      ? [
          { x: 0.26, drop: 0.16, r: 17 },
          { x: 0.76, drop: 0.1, r: 14 },
        ]
      : [
          { x: 0.2, drop: 0.2, r: 20 },
          { x: 0.36, drop: 0.34, r: 15 },
          { x: 0.82, drop: 0.16, r: 18 },
        ];
    this.lanterns = defs.map((d, i) => ({
      x: w * d.x,
      topY: this.cssH * (this.mobile ? 0.08 : 0.04),
      bodyY: baseY - this.cssH * d.drop,
      r: d.r,
      hue: i % 2 === 0 ? '#f3b863' : '#ef9b6a',
      glow: 0.4,
      target: 0.4,
      sway: rand(0, TAU),
      swaySpeed: rand(0.3, 0.6),
      flick: rand(0, TAU),
    }));
  }

  private makePetal(orbit: boolean): Petal {
    const hues = ['#f7c6d8', '#fbe3ec', '#f4d49a', '#ead7f2', '#ffe9d2'];
    const depth = rand(0.2, 1);
    return {
      x: rand(0, this.cssW),
      y: rand(0, this.cssH),
      vx: rand(-6, 6),
      vy: rand(-3, 6),
      rot: rand(0, TAU),
      rotV: rand(-0.8, 0.8),
      size: lerp(3, 9, depth),
      depth,
      hue: hues[Math.floor(rand(0, hues.length))],
      alpha: rand(0.5, 0.9),
      orbit,
      oa: rand(0, TAU),
      orr: rand(this.tableR * 1.2, this.tableR * 3.2),
      ph: rand(0, TAU),
      glow: 0,
    };
  }

  createPetals() {
    const n = this.petalTarget();
    this.petals = Array.from({ length: n }, (_, i) => this.makePetal(i % 3 === 0));
  }

  // ---- caches ----

  private buildCloudSprites() {
    this.cloudSprites = [];
    for (let s = 0; s < 3; s++) {
      const cw = 320;
      const ch = 150;
      const cv = document.createElement('canvas');
      cv.width = cw;
      cv.height = ch;
      const c = cv.getContext('2d')!;
      const puffs = 5 + Math.floor(rand(0, 4));
      for (let i = 0; i < puffs; i++) {
        const px = lerp(cw * 0.2, cw * 0.8, i / (puffs - 1)) + rand(-24, 24);
        const py = ch * 0.55 + rand(-18, 18);
        const pr = rand(40, 76);
        const g = c.createRadialGradient(px, py, 0, px, py, pr);
        g.addColorStop(0, 'rgba(196,210,240,0.5)');
        g.addColorStop(0.55, 'rgba(150,168,210,0.26)');
        g.addColorStop(1, 'rgba(120,140,190,0)');
        c.fillStyle = g;
        c.beginPath();
        c.arc(px, py, pr, 0, TAU);
        c.fill();
      }
      this.cloudSprites.push(cv);
    }
  }

  private buildStarfield() {
    const cv = this.starCan ?? document.createElement('canvas');
    cv.width = Math.round(this.cssW);
    cv.height = Math.round(this.cssH);
    const c = cv.getContext('2d')!;
    c.clearRect(0, 0, cv.width, cv.height);

    // faint constellation lines first (under the stars)
    c.lineWidth = 1;
    for (const con of this.constellations) {
      c.beginPath();
      for (let k = 0; k < con.idx.length; k++) {
        const s = this.stars[con.idx[k]];
        if (!s) continue;
        if (k === 0) c.moveTo(s.x, s.y);
        else c.lineTo(s.x, s.y);
      }
      c.strokeStyle = 'rgba(160,185,230,0.10)';
      c.stroke();
    }

    // soft painterly stars
    for (const s of this.stars) {
      const col = s.hue > 0.5 ? '255,232,196' : '206,224,255';
      const halo = s.r * 3.4;
      const g = c.createRadialGradient(s.x, s.y, 0, s.x, s.y, halo);
      g.addColorStop(0, `rgba(${col},${0.5 * s.base})`);
      g.addColorStop(0.4, `rgba(${col},${0.16 * s.base})`);
      g.addColorStop(1, `rgba(${col},0)`);
      c.fillStyle = g;
      c.beginPath();
      c.arc(s.x, s.y, halo, 0, TAU);
      c.fill();
      c.fillStyle = `rgba(255,255,255,${0.7 * s.base})`;
      c.beginPath();
      c.arc(s.x, s.y, s.r * 0.7, 0, TAU);
      c.fill();
    }
    this.starCan = cv;
  }

  private buildPlatform() {
    const pad = 80;
    const w = Math.round(this.platW + pad * 2);
    const h = Math.round(this.platH * 2.6 + pad);
    const cv = this.platCan ?? document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const c = cv.getContext('2d')!;
    c.clearRect(0, 0, w, h);

    const cx = w / 2;
    const topY = pad;
    const rx = this.platW / 2;
    const ry = this.platH / 2;

    // soft drop shadow / aura under the island
    const sh = c.createRadialGradient(cx, topY + ry, 0, cx, topY + ry, rx * 1.5);
    sh.addColorStop(0, 'rgba(10,16,40,0.5)');
    sh.addColorStop(1, 'rgba(10,16,40,0)');
    c.fillStyle = sh;
    c.beginPath();
    c.ellipse(cx, topY + ry * 1.3, rx * 1.45, ry * 1.5, 0, 0, TAU);
    c.fill();

    // hanging rock underside
    c.beginPath();
    c.moveTo(cx - rx, topY);
    c.bezierCurveTo(cx - rx * 0.6, topY + ry * 2.4, cx - rx * 0.2, topY + ry * 3.1, cx, topY + ry * 3.2);
    c.bezierCurveTo(cx + rx * 0.3, topY + ry * 3.0, cx + rx * 0.7, topY + ry * 2.2, cx + rx, topY);
    c.closePath();
    const rock = c.createLinearGradient(0, topY, 0, topY + ry * 3.2);
    rock.addColorStop(0, '#3a3550');
    rock.addColorStop(0.5, '#241f38');
    rock.addColorStop(1, '#15122a');
    c.fillStyle = rock;
    c.fill();

    // top surface (moonlit)
    const top = c.createLinearGradient(0, topY - ry, 0, topY + ry);
    top.addColorStop(0, '#6b7aa6');
    top.addColorStop(0.5, '#4a567f');
    top.addColorStop(1, '#343c5e');
    c.fillStyle = top;
    c.beginPath();
    c.ellipse(cx, topY, rx, ry, 0, 0, TAU);
    c.fill();

    // moonlight sheen on the near edge
    const sheen = c.createLinearGradient(0, topY - ry, 0, topY + ry * 0.4);
    sheen.addColorStop(0, 'rgba(180,205,245,0.34)');
    sheen.addColorStop(1, 'rgba(180,205,245,0)');
    c.fillStyle = sheen;
    c.beginPath();
    c.ellipse(cx, topY - ry * 0.18, rx * 0.92, ry * 0.7, 0, 0, TAU);
    c.fill();

    // mossy rim
    c.lineWidth = 5;
    c.strokeStyle = 'rgba(86,120,92,0.55)';
    c.beginPath();
    c.ellipse(cx, topY + ry * 0.04, rx * 0.99, ry * 0.99, 0, 0.05 * Math.PI, 0.95 * Math.PI);
    c.stroke();

    // stone path: a few flat stepping stones meandering toward the table
    for (let i = 0; i < 4; i++) {
      const f = i / 3;
      const sy = topY + ry * 0.94 - f * ry * 0.72;
      const sx = cx + Math.sin(i * 1.7) * rx * 0.13;
      const sw = lerp(rx * 0.15, rx * 0.075, f);
      const g = c.createRadialGradient(sx, sy, 0, sx, sy, sw);
      g.addColorStop(0, `rgba(216,224,246,${0.26 - f * 0.12})`);
      g.addColorStop(1, 'rgba(216,224,246,0)');
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(sx, sy, sw, sw * 0.42, 0, 0, TAU);
      c.fill();
    }

    this.platCan = cv;
    this.platCacheW = w;
    this.platCacheTop = topY;
  }
  private platCacheW = 0;
  private platCacheTop = 0;

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
    this.spawnPetalBurst(e.clientX, e.clientY, 12, 70);
    this.rings.push({ x: e.clientX, y: e.clientY, r: 6, maxR: 150, alpha: 0.4, hue: '#f6d79a' });
    this.flash = Math.min(1, this.flash + 0.35);
    audioEngine.pulse();
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
    this.windX = clamp(this.windX + dx * 0.06, -40, 40);
    this.windY = clamp(this.windY + dy * 0.05, -30, 30);
    this.lmx = e.clientX;
    this.lmy = e.clientY;
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

  spawnPetalBurst(x: number, y: number, count: number, speed: number) {
    const hues = ['#f7c6d8', '#fbe3ec', '#f4d49a', '#ffe9d2'];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + rand(-0.2, 0.2);
      const sp = speed * rand(0.6, 1.1);
      this.petals.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 10,
        rot: rand(0, TAU),
        rotV: rand(-2, 2),
        size: rand(4, 8),
        depth: rand(0.6, 1),
        hue: hues[Math.floor(rand(0, hues.length))],
        alpha: rand(0.7, 0.95),
        orbit: false,
        oa: 0,
        orr: 0,
        ph: rand(0, TAU),
        glow: 1,
      });
    }
    // keep the array bounded (oldest non-burst petals fall off first)
    const cap = this.petalTarget() + 60;
    while (this.petals.length > cap) this.petals.shift();
  }

  // ---- loop ----

  private frame = (ts: number) => {
    if (!this.running) return;
    const t = ts / 1000;
    const dt = Math.min(0.05, Math.max(0.001, t - this.last));
    this.last = t;
    this.update(dt);
    this.draw();
    this.rafId = requestAnimationFrame(this.frame);
  };

  private update(dt: number) {
    const sdt = dt * this.speedScale;
    this.time += sdt;

    // ease wind back to calm
    this.windX *= 1 - Math.min(1, dt * 0.8);
    this.windY *= 1 - Math.min(1, dt * 0.8);

    // ease focus-driven values
    this.displayProgress += (this.focusProgress - this.displayProgress) * Math.min(1, dt * 0.8);
    const warmTarget = this.focusPhase === 'break' ? 0.15 : this.focusPhase === 'work' ? 1 : 0.55;
    this.warm += (warmTarget - this.warm) * Math.min(1, dt * 0.5);
    this.gather += ((this.down ? 1 : 0) - this.gather) * Math.min(1, dt * 2.2);
    this.flash *= 1 - Math.min(1, dt * 1.4);

    this.bob = Math.sin(this.time * 0.4) * 6 + Math.sin(this.time * 0.13) * 3;

    // clouds drift
    for (const c of this.clouds) {
      const windMul = c.band === 'near' ? 1.6 : c.band === 'mid' ? 1 : 0.5;
      c.x += (c.speed + this.windX * 0.4 * windMul) * sdt;
      const spriteW = 320 * c.scale;
      if (c.x - spriteW > this.cssW) c.x = -spriteW;
      if (c.x + spriteW < 0) c.x = this.cssW + spriteW;
    }

    // lanterns sway + glow targets
    const milestone = this.displayProgress > 0 ? 0.4 + Math.floor(this.displayProgress / 0.34) * 0.2 : 0.4;
    for (const l of this.lanterns) {
      l.flick += sdt * 6;
      let target = milestone + this.warm * 0.15;
      // brighten near the cursor
      if (this.px >= 0) {
        const d = Math.hypot(this.px - l.x, this.py - l.bodyY);
        if (d < 220) target += (1 - d / 220) * 0.25;
      }
      l.target = clamp(target, 0.2, 1.1);
      l.glow += (l.target - l.glow) * Math.min(1, dt * 2);
    }

    // petals
    const tableX = this.tableX;
    const tableY = this.tableY + this.bob;
    const focusCalm = this.focusPhase === 'work' ? 0.55 : 1;
    for (let i = this.petals.length - 1; i >= 0; i--) {
      const p = this.petals[i];
      p.ph += sdt;
      if (p.glow > 0) p.glow = Math.max(0, p.glow - dt * 0.6);

      if (p.orbit && this.gather < 0.3) {
        p.oa += sdt * (0.25 + p.depth * 0.2) * focusCalm;
        const wob = Math.sin(p.ph * 1.3) * 6;
        const tx = tableX + Math.cos(p.oa) * (p.orr + wob);
        const ty = tableY + Math.sin(p.oa) * (p.orr + wob) * 0.5 - this.tableR * 0.2;
        p.x += (tx - p.x) * Math.min(1, dt * 2);
        p.y += (ty - p.y) * Math.min(1, dt * 2);
        p.rot += p.rotV * sdt;
      } else {
        // drift + wind + gather toward pointer
        let ax = this.windX * 0.5 * p.depth + Math.sin(p.ph * 0.7) * 4;
        let ay = this.windY * 0.4 * p.depth + 6 + Math.cos(p.ph * 0.5) * 3;
        if (this.gather > 0.05 && this.px >= 0) {
          const gx = this.px - p.x;
          const gy = this.py - p.y;
          const gd = Math.hypot(gx, gy) || 1;
          const pull = this.gather * 60 * (0.4 + p.depth);
          ax += (gx / gd) * pull;
          ay += (gy / gd) * pull;
        }
        p.vx += (ax - p.vx) * Math.min(1, dt * 1.5);
        p.vy += (ay - p.vy) * Math.min(1, dt * 1.5);
        p.x += p.vx * sdt * focusCalm;
        p.y += p.vy * sdt * focusCalm;
        p.rot += p.rotV * sdt;

        // wrap drifting petals
        const m = 30;
        if (p.x < -m) p.x = this.cssW + m;
        else if (p.x > this.cssW + m) p.x = -m;
        if (p.y > this.cssH + m) {
          p.y = -m;
          p.x = rand(0, this.cssW);
        } else if (p.y < -m * 2) {
          p.y = this.cssH + m;
        }
      }
    }
    // trim transient burst petals back toward target
    const cap = this.petalTarget() + 40;
    if (this.petals.length > cap) this.petals.splice(0, this.petals.length - cap);

    // shooting stars
    this.shootT -= dt;
    if (this.shootT <= 0 && !this.reduced) {
      this.shootT = rand(7, 20);
      const sx = rand(this.cssW * 0.1, this.cssW * 0.8);
      const sy = rand(this.cssH * 0.05, this.cssH * 0.3);
      const ang = rand(Math.PI * 0.12, Math.PI * 0.28);
      const sp = rand(420, 680);
      this.shoots.push({ x: sx, y: sy, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 1, len: rand(80, 160) });
    }
    for (let i = this.shoots.length - 1; i >= 0; i--) {
      const s = this.shoots[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt * 1.1;
      if (s.life <= 0) this.shoots.splice(i, 1);
    }

    // paper cranes
    this.craneT -= dt;
    if (this.craneT <= 0 && this.cranes.length < 3 && !this.reduced) {
      this.craneT = rand(14, 34);
      const dir = Math.random() < 0.5 ? 1 : -1;
      const depth = rand(0.4, 1);
      this.cranes.push({
        x: dir > 0 ? -60 : this.cssW + 60,
        y: rand(this.cssH * 0.16, this.cssH * 0.42),
        vx: dir * rand(26, 46) * depth,
        bob: rand(0, TAU),
        ph: rand(0, TAU),
        depth,
      });
    }
    for (let i = this.cranes.length - 1; i >= 0; i--) {
      const cr = this.cranes[i];
      cr.x += (cr.vx + this.windX * 0.2) * sdt;
      cr.bob += sdt * 1.4;
      cr.ph += sdt * 3.2;
      if (cr.x < -120 || cr.x > this.cssW + 120) this.cranes.splice(i, 1);
    }

    // rare celestial creature
    this.creatureT -= dt;
    if (!this.creature && this.creatureT <= 0 && !this.reduced) {
      this.creatureT = rand(120, 260);
      const dir = Math.random() < 0.5 ? 1 : -1;
      this.creature = {
        x: dir > 0 ? -this.cssW * 0.4 : this.cssW * 1.4,
        y: rand(this.cssH * 0.22, this.cssH * 0.42),
        vx: dir * rand(14, 22),
        ph: 0,
        alpha: 0,
        dir,
      };
    }
    if (this.creature) {
      const cr = this.creature;
      cr.x += cr.vx * sdt;
      cr.ph += sdt;
      // fade in/out across the crossing
      const off = cr.dir > 0 ? cr.x / this.cssW : 1 - cr.x / this.cssW;
      cr.alpha = clamp(Math.sin(clamp(off, 0, 1) * Math.PI), 0, 1) * 0.5;
      if ((cr.dir > 0 && cr.x > this.cssW * 1.4) || (cr.dir < 0 && cr.x < -this.cssW * 0.4)) this.creature = null;
    }

    // rings
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.r += (r.maxR - r.r) * Math.min(1, dt * 1.4);
      r.alpha -= dt * 0.6;
      if (r.alpha <= 0 || r.r > r.maxR - 4) this.rings.splice(i, 1);
    }
  }

  // ---- draw ----

  private draw() {
    const c = this.ctx;
    if (!c) return;
    this.drawSky(c);
    this.drawStars(c);
    this.drawClouds(c, 'far');
    this.drawCelestialCreature(c);
    this.drawClouds(c, 'mid');
    this.drawPaperCranes(c);
    this.drawPlatform(c);
    this.drawPlants(c);
    this.drawTeaTable(c);
    this.drawLanterns(c);
    this.drawPetals(c);
    this.drawGlowRings(c);
    this.drawClouds(c, 'near');
    this.drawForeground(c);
    this.drawAtmosphere(c);
  }

  private drawSky(c: CanvasRenderingContext2D) {
    const w = this.cssW;
    const h = this.cssH;
    const cool = this.warm < 0.4 ? 1 : 0; // break = cooler
    const g = c.createLinearGradient(0, 0, 0, h);
    if (cool) {
      g.addColorStop(0, '#070b1e');
      g.addColorStop(0.5, '#0c1430');
      g.addColorStop(1, '#0a1228');
    } else {
      g.addColorStop(0, '#080c22');
      g.addColorStop(0.45, '#101a3a');
      g.addColorStop(1, '#0c1430');
    }
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);

    // a faint horizon wash behind the island
    const hz = c.createLinearGradient(0, h * 0.55, 0, h);
    hz.addColorStop(0, 'rgba(70,90,150,0)');
    hz.addColorStop(1, 'rgba(60,80,140,0.1)');
    c.fillStyle = hz;
    c.fillRect(0, h * 0.55, w, h * 0.45);

    this.drawMoon(c);
  }

  private drawMoon(c: CanvasRenderingContext2D) {
    const { moonX: x, moonY: y, moonR: r } = this;
    // halo
    const halo = c.createRadialGradient(x, y, 0, x, y, r * 6);
    halo.addColorStop(0, 'rgba(200,220,255,0.28)');
    halo.addColorStop(0.3, 'rgba(170,195,250,0.12)');
    halo.addColorStop(1, 'rgba(150,180,245,0)');
    c.fillStyle = halo;
    c.beginPath();
    c.arc(x, y, r * 6, 0, TAU);
    c.fill();

    // moon disc
    const disc = c.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.2, x, y, r);
    disc.addColorStop(0, '#fdfbf3');
    disc.addColorStop(0.7, '#e7ecf6');
    disc.addColorStop(1, '#c7d2e6');
    c.fillStyle = disc;
    c.beginPath();
    c.arc(x, y, r, 0, TAU);
    c.fill();

    // crescent shadow — waxes subtly with focus progress
    const phase = 0.62 - this.displayProgress * 0.34; // 0.62 (thin) -> 0.28 (fuller)
    c.save();
    c.beginPath();
    c.arc(x, y, r + 0.5, 0, TAU);
    c.clip();
    const sg = c.createRadialGradient(x - r * phase, y - r * 0.1, r * 0.2, x - r * phase, y, r * 1.5);
    sg.addColorStop(0, 'rgba(10,14,32,0.92)');
    sg.addColorStop(1, 'rgba(10,14,32,0.78)');
    c.fillStyle = sg;
    c.beginPath();
    c.arc(x - r * phase, y, r, 0, TAU);
    c.fill();
    c.restore();
  }

  private drawStars(c: CanvasRenderingContext2D) {
    if (this.starCan) {
      const ox = this.windX * 0.4;
      const oy = this.windY * 0.3;
      c.drawImage(this.starCan, ox, oy);
    }
    // live twinkles (a small subset, additive)
    c.globalCompositeOperation = 'lighter';
    const n = Math.min(this.stars.length, this.mobile ? 14 : 22);
    for (let i = 0; i < n; i++) {
      const s = this.stars[(i * 7) % this.stars.length];
      const tw = 0.5 + 0.5 * Math.sin(this.time * s.tws + s.tw);
      const a = s.base * tw * 0.7;
      if (a < 0.05) continue;
      const col = s.hue > 0.5 ? '255,236,200' : '215,230,255';
      c.fillStyle = `rgba(${col},${a})`;
      c.beginPath();
      c.arc(s.x + this.windX * 0.4, s.y + this.windY * 0.3, s.r * 0.9, 0, TAU);
      c.fill();
    }
    // shooting stars
    for (const s of this.shoots) {
      const tailX = s.x - s.vx * 0.12;
      const tailY = s.y - s.vy * 0.12;
      const g = c.createLinearGradient(tailX, tailY, s.x, s.y);
      g.addColorStop(0, 'rgba(200,220,255,0)');
      g.addColorStop(1, `rgba(230,240,255,${0.8 * s.life})`);
      c.strokeStyle = g;
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(tailX, tailY);
      c.lineTo(s.x, s.y);
      c.stroke();
    }
    c.globalCompositeOperation = 'source-over';
  }

  private drawClouds(c: CanvasRenderingContext2D, band: Cloud['band']) {
    for (const cl of this.clouds) {
      if (cl.band !== band) continue;
      const sp = this.cloudSprites[cl.sprite];
      if (!sp) continue;
      const w = sp.width * cl.scale;
      const h = sp.height * cl.scale;
      c.globalAlpha = cl.alpha;
      c.drawImage(sp, cl.x - w / 2, cl.y - h / 2 + this.bob * 0.3 * (cl.band === 'near' ? 1 : 0.4), w, h);
    }
    c.globalAlpha = 1;
  }

  private drawCelestialCreature(c: CanvasRenderingContext2D) {
    const cr = this.creature;
    if (!cr || cr.alpha <= 0.01) return;
    const x = cr.x;
    const y = cr.y + Math.sin(cr.ph * 0.6) * 10;
    const s = this.cssW * 0.16; // body length scale
    const dir = cr.dir;
    c.save();
    c.translate(x, y);
    c.scale(dir, 1);
    c.globalAlpha = cr.alpha;

    // whale silhouette via bezier
    c.beginPath();
    c.moveTo(-s, 0);
    c.bezierCurveTo(-s * 0.6, -s * 0.34, s * 0.4, -s * 0.3, s * 0.8, -s * 0.06);
    c.bezierCurveTo(s * 0.95, 0, s * 0.95, 0, s * 1.02, -s * 0.16); // tail upper
    c.lineTo(s * 1.16, -s * 0.02);
    c.bezierCurveTo(s * 1.0, s * 0.06, s * 0.95, s * 0.08, s * 0.8, s * 0.12);
    c.bezierCurveTo(s * 0.3, s * 0.34, -s * 0.5, s * 0.32, -s, 0);
    c.closePath();
    const bg = c.createLinearGradient(0, -s * 0.3, 0, s * 0.3);
    bg.addColorStop(0, 'rgba(60,80,140,0.9)');
    bg.addColorStop(1, 'rgba(24,34,70,0.95)');
    c.fillStyle = bg;
    c.fill();

    // luminous belly edge
    c.strokeStyle = 'rgba(150,185,250,0.5)';
    c.lineWidth = 1.4;
    c.stroke();

    // side fin
    c.beginPath();
    c.moveTo(-s * 0.1, s * 0.1);
    c.bezierCurveTo(s * 0.05, s * 0.34, s * 0.2, s * 0.36, s * 0.26, s * 0.2);
    c.bezierCurveTo(s * 0.2, s * 0.16, s * 0.05, s * 0.14, -s * 0.1, s * 0.1);
    c.closePath();
    c.fillStyle = 'rgba(30,42,84,0.9)';
    c.fill();

    // inner constellation speckle
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) {
      const px = lerp(-s * 0.7, s * 0.7, (i + 0.5) / 7);
      const py = Math.sin(i * 1.7 + cr.ph) * s * 0.12;
      c.fillStyle = `rgba(190,215,255,${0.5 * cr.alpha})`;
      c.beginPath();
      c.arc(px, py, 1.2, 0, TAU);
      c.fill();
    }
    c.restore();
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }

  private drawPlatform(c: CanvasRenderingContext2D) {
    if (!this.platCan) return;
    const x = this.platX - this.platCacheW / 2;
    const y = this.platY - this.platCacheTop + this.bob;
    c.drawImage(this.platCan, x, y);
  }

  private drawPlants(c: CanvasRenderingContext2D) {
    const baseY = this.platY + this.bob - this.platH * 0.04;
    const rx = this.platW / 2;
    // grass tufts along the rim
    const tufts = this.mobile ? 10 : 16;
    for (let i = 0; i < tufts; i++) {
      const a = lerp(0.1, 0.9, i / (tufts - 1)) * Math.PI;
      const gx = this.platX + Math.cos(a) * rx * 0.92;
      const gy = baseY + Math.sin(a) * this.platH * 0.46;
      this.drawTuft(c, gx, gy, 10 + ((i * 7) % 6), i);
    }
    // two small glowing flower clusters + a little tree silhouette
    this.drawLittleTree(c, this.platX - rx * 0.6, baseY - this.platH * 0.1);
    this.drawFlowerCluster(c, this.platX + rx * 0.52, baseY + this.platH * 0.04, '#f6c8dd');
    this.drawFlowerCluster(c, this.platX - rx * 0.2, baseY + this.platH * 0.18, '#f3d79a');
  }

  private drawTuft(c: CanvasRenderingContext2D, x: number, y: number, h: number, seed: number) {
    const blades = 4;
    c.strokeStyle = 'rgba(96,128,98,0.7)';
    c.lineWidth = 1.4;
    for (let b = 0; b < blades; b++) {
      const lean = Math.sin(this.time * 0.8 + seed + b) * 3 + this.windX * 0.04;
      const bx = x + (b - blades / 2) * 2.2;
      c.beginPath();
      c.moveTo(bx, y);
      c.quadraticCurveTo(bx + lean * 0.5, y - h * 0.6, bx + lean, y - h);
      c.stroke();
    }
  }

  private drawLittleTree(c: CanvasRenderingContext2D, x: number, y: number) {
    const sway = Math.sin(this.time * 0.5) * 1.6 + this.windX * 0.04;
    // short dark trunk
    c.strokeStyle = 'rgba(44,38,52,0.95)';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(x, y);
    c.quadraticCurveTo(x + sway * 0.4, y - 13, x + sway, y - 24);
    c.stroke();
    // mounded canopy from overlapping soft blobs (reads as foliage, not a streak)
    const tx = x + sway;
    const blobs: [number, number, number][] = [
      [tx - 13, y - 28, 16],
      [tx + 13, y - 30, 15],
      [tx, y - 42, 18],
      [tx - 2, y - 22, 14],
    ];
    for (const [bx, by, br] of blobs) {
      const g = c.createRadialGradient(bx, by, 2, bx, by, br);
      g.addColorStop(0, 'rgba(98,130,106,0.82)');
      g.addColorStop(1, 'rgba(58,88,76,0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(bx, by, br, 0, TAU);
      c.fill();
    }
    // a few soft blossoms
    for (let i = 0; i < 5; i++) {
      const bx = tx + Math.cos(i * 1.7) * 13;
      const by = y - 32 + Math.sin(i * 2.1) * 9;
      c.fillStyle = 'rgba(247,205,224,0.5)';
      c.beginPath();
      c.arc(bx, by, 1.8, 0, TAU);
      c.fill();
    }
  }

  private drawFlowerCluster(c: CanvasRenderingContext2D, x: number, y: number, hue: string) {
    const sway = Math.sin(this.time * 0.7 + x) * 2 + this.windX * 0.04;
    for (let i = 0; i < 3; i++) {
      const fx = x + (i - 1) * 8 + sway;
      const fy = y - (i % 2) * 5;
      c.strokeStyle = 'rgba(96,128,98,0.6)';
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(fx, fy + 10);
      c.quadraticCurveTo(fx + sway * 0.5, fy + 4, fx, fy);
      c.stroke();
      c.globalCompositeOperation = 'lighter';
      const g = c.createRadialGradient(fx, fy, 0, fx, fy, 6);
      g.addColorStop(0, hue);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.globalAlpha = 0.7;
      c.fillStyle = g;
      c.beginPath();
      c.arc(fx, fy, 6, 0, TAU);
      c.fill();
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
    }
  }

  private drawTeaTable(c: CanvasRenderingContext2D) {
    const x = this.tableX;
    const y = this.tableY + this.bob;
    const r = this.tableR;
    const steep = this.displayProgress;

    // warm amber pool under the table
    c.globalCompositeOperation = 'lighter';
    const pool = c.createRadialGradient(x, y, 0, x, y, r * 3.9);
    const warmA = 0.26 + this.warm * 0.14 + this.flash * 0.22;
    pool.addColorStop(0, `rgba(247,200,128,${warmA})`);
    pool.addColorStop(0.5, `rgba(234,154,84,${warmA * 0.5})`);
    pool.addColorStop(1, 'rgba(234,154,84,0)');
    c.fillStyle = pool;
    c.beginPath();
    c.arc(x, y, r * 3.9, 0, TAU);
    c.fill();
    c.globalCompositeOperation = 'source-over';

    // table top (ellipse) — warm lit wood
    const top = c.createLinearGradient(0, y - r * 0.5, 0, y + r * 0.5);
    top.addColorStop(0, '#73564a');
    top.addColorStop(1, '#42312a');
    c.fillStyle = top;
    c.beginPath();
    c.ellipse(x, y, r, r * 0.46, 0, 0, TAU);
    c.fill();
    // warm sheen across the surface
    c.globalCompositeOperation = 'lighter';
    const sheen = c.createRadialGradient(x, y - r * 0.12, 0, x, y - r * 0.12, r * 0.95);
    sheen.addColorStop(0, `rgba(247,206,140,${0.14 + this.warm * 0.1})`);
    sheen.addColorStop(1, 'rgba(247,206,140,0)');
    c.fillStyle = sheen;
    c.beginPath();
    c.ellipse(x, y, r * 0.95, r * 0.44, 0, 0, TAU);
    c.fill();
    c.globalCompositeOperation = 'source-over';
    // rim highlight
    c.strokeStyle = 'rgba(247,214,158,0.5)';
    c.lineWidth = 1.5;
    c.beginPath();
    c.ellipse(x, y - 1, r * 0.98, r * 0.45, 0, Math.PI * 1.02, Math.PI * 1.98);
    c.stroke();

    // teapot
    const pr = r * 0.42;
    const pcx = x;
    const pcy = y - r * 0.2;
    const teaCol = `rgb(${Math.round(lerp(210, 150, steep))},${Math.round(lerp(190, 96, steep))},${Math.round(lerp(150, 54, steep))})`;
    // body
    const pg = c.createLinearGradient(0, pcy - pr, 0, pcy + pr);
    pg.addColorStop(0, '#e9e2d6');
    pg.addColorStop(1, '#c2b6a6');
    c.fillStyle = pg;
    c.beginPath();
    c.ellipse(pcx, pcy, pr, pr * 0.82, 0, 0, TAU);
    c.fill();
    // lid + knob
    c.fillStyle = '#d8cdbd';
    c.beginPath();
    c.ellipse(pcx, pcy - pr * 0.62, pr * 0.62, pr * 0.26, 0, 0, TAU);
    c.fill();
    c.fillStyle = teaCol;
    c.beginPath();
    c.arc(pcx, pcy - pr * 0.86, pr * 0.12, 0, TAU);
    c.fill();
    // spout
    c.strokeStyle = '#cdbfac';
    c.lineWidth = pr * 0.22;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(pcx - pr * 0.7, pcy);
    c.quadraticCurveTo(pcx - pr * 1.3, pcy - pr * 0.2, pcx - pr * 1.4, pcy - pr * 0.7);
    c.stroke();
    // handle
    c.beginPath();
    c.moveTo(pcx + pr * 0.7, pcy - pr * 0.2);
    c.quadraticCurveTo(pcx + pr * 1.3, pcy - pr * 0.1, pcx + pr * 0.72, pcy + pr * 0.5);
    c.stroke();
    c.lineCap = 'butt';

    // two cups
    this.drawCup(c, x - r * 0.62, y + r * 0.12, r * 0.2, teaCol);
    this.drawCup(c, x + r * 0.6, y + r * 0.16, r * 0.2, teaCol);

    // steam ribbons (grow then settle through the session)
    if (!this.reduced) {
      const intensity = 0.5 + Math.sin(this.displayProgress * Math.PI) * 0.5;
      this.drawSteam(c, pcx, pcy - pr * 0.9, intensity);
      this.drawSteam(c, x - r * 0.62, y + r * 0.12 - 6, intensity * 0.7);
    }
  }

  private drawCup(c: CanvasRenderingContext2D, x: number, y: number, r: number, tea: string) {
    c.fillStyle = '#e7ddcd';
    c.beginPath();
    c.ellipse(x, y, r, r * 0.5, 0, 0, TAU);
    c.fill();
    c.fillStyle = tea;
    c.beginPath();
    c.ellipse(x, y - r * 0.05, r * 0.74, r * 0.34, 0, 0, TAU);
    c.fill();
    // shimmer
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = 'rgba(255,240,210,0.4)';
    c.beginPath();
    c.ellipse(x - r * 0.2, y - r * 0.12, r * 0.22, r * 0.08, 0, 0, TAU);
    c.fill();
    c.globalCompositeOperation = 'source-over';
  }

  private drawSteam(c: CanvasRenderingContext2D, x: number, y: number, intensity: number) {
    c.globalCompositeOperation = 'lighter';
    for (let s = 0; s < 2; s++) {
      const ph = this.time * 1.2 + s * 2.1;
      const h = 46 + s * 8;
      c.beginPath();
      c.moveTo(x, y);
      const steps = 6;
      for (let i = 1; i <= steps; i++) {
        const f = i / steps;
        const sx = x + Math.sin(ph + f * 4) * 9 * f;
        const sy = y - f * h;
        const px = x + Math.sin(ph + (f - 0.5 / steps) * 4) * 9 * f;
        const py = y - (f - 0.5 / steps) * h;
        c.quadraticCurveTo(px, py, sx, sy);
      }
      const g = c.createLinearGradient(x, y, x, y - h);
      g.addColorStop(0, `rgba(255,244,222,${0.16 * intensity})`);
      g.addColorStop(1, 'rgba(255,244,222,0)');
      c.strokeStyle = g;
      c.lineWidth = 5;
      c.lineCap = 'round';
      c.stroke();
    }
    c.lineCap = 'butt';
    c.globalCompositeOperation = 'source-over';
  }

  private drawLanterns(c: CanvasRenderingContext2D) {
    for (const l of this.lanterns) {
      const swing = Math.sin(this.time * l.swaySpeed + l.sway) * 10 + this.windX * 0.1;
      const bx = l.x + swing;
      const by = l.bodyY + this.bob * 0.4;
      const flick = 0.92 + 0.08 * Math.sin(l.flick);
      const glow = l.glow * flick;

      // cord
      c.strokeStyle = 'rgba(40,44,66,0.7)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(l.x, l.topY);
      c.quadraticCurveTo((l.x + bx) / 2, (l.topY + by) / 2, bx, by - l.r);
      c.stroke();

      // halo
      c.globalCompositeOperation = 'lighter';
      const halo = c.createRadialGradient(bx, by, 0, bx, by, l.r * 4.2);
      halo.addColorStop(0, `rgba(247,196,118,${0.32 * glow})`);
      halo.addColorStop(0.5, `rgba(240,150,80,${0.14 * glow})`);
      halo.addColorStop(1, 'rgba(240,150,80,0)');
      c.fillStyle = halo;
      c.beginPath();
      c.arc(bx, by, l.r * 4.2, 0, TAU);
      c.fill();
      c.globalCompositeOperation = 'source-over';

      // body
      const bg = c.createLinearGradient(0, by - l.r, 0, by + l.r);
      bg.addColorStop(0, '#ffd98c');
      bg.addColorStop(0.5, l.hue);
      bg.addColorStop(1, '#c9763f');
      c.fillStyle = bg;
      c.beginPath();
      c.ellipse(bx, by, l.r * 0.82, l.r, 0, 0, TAU);
      c.fill();
      // caps
      c.fillStyle = 'rgba(40,40,54,0.85)';
      c.beginPath();
      c.ellipse(bx, by - l.r, l.r * 0.42, l.r * 0.14, 0, 0, TAU);
      c.fill();
      c.beginPath();
      c.ellipse(bx, by + l.r, l.r * 0.34, l.r * 0.12, 0, 0, TAU);
      c.fill();
      // inner light
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = `rgba(255,236,190,${0.5 * glow})`;
      c.beginPath();
      c.ellipse(bx, by, l.r * 0.4, l.r * 0.6, 0, 0, TAU);
      c.fill();
      c.globalCompositeOperation = 'source-over';
    }
  }

  private drawPetals(c: CanvasRenderingContext2D) {
    for (const p of this.petals) {
      c.save();
      c.translate(p.x, p.y);
      c.rotate(p.rot);
      c.globalAlpha = p.alpha * clamp(p.depth + 0.2, 0, 1);
      if (p.glow > 0) {
        c.globalCompositeOperation = 'lighter';
        const g = c.createRadialGradient(0, 0, 0, 0, 0, p.size * 3);
        g.addColorStop(0, 'rgba(255,225,200,' + 0.5 * p.glow + ')');
        g.addColorStop(1, 'rgba(255,225,200,0)');
        c.fillStyle = g;
        c.beginPath();
        c.arc(0, 0, p.size * 3, 0, TAU);
        c.fill();
        c.globalCompositeOperation = 'source-over';
        c.globalAlpha = p.alpha;
      }
      // petal shape
      c.fillStyle = p.hue;
      c.beginPath();
      c.moveTo(0, -p.size);
      c.bezierCurveTo(p.size * 0.7, -p.size * 0.4, p.size * 0.5, p.size * 0.6, 0, p.size);
      c.bezierCurveTo(-p.size * 0.5, p.size * 0.6, -p.size * 0.7, -p.size * 0.4, 0, -p.size);
      c.closePath();
      c.fill();
      c.restore();
    }
    c.globalAlpha = 1;
  }

  private drawPaperCranes(c: CanvasRenderingContext2D) {
    for (const cr of this.cranes) {
      const x = cr.x;
      const y = cr.y + Math.sin(cr.bob) * 6;
      const s = lerp(8, 18, cr.depth);
      const dir = Math.sign(cr.vx) || 1;
      const flap = Math.sin(cr.ph) * 0.5; // wing angle
      c.save();
      c.translate(x, y);
      c.scale(dir, 1);
      c.globalAlpha = 0.42 + cr.depth * 0.3;

      // body (folded diamond)
      c.fillStyle = '#dfe6f2';
      c.beginPath();
      c.moveTo(-s, 0);
      c.lineTo(0, -s * 0.36);
      c.lineTo(s * 1.2, 0);
      c.lineTo(0, s * 0.3);
      c.closePath();
      c.fill();
      // neck + head
      c.strokeStyle = '#cdd6e6';
      c.lineWidth = s * 0.16;
      c.beginPath();
      c.moveTo(s * 0.7, -s * 0.1);
      c.lineTo(s * 1.5, -s * 0.5);
      c.stroke();
      // tail
      c.beginPath();
      c.moveTo(-s, 0);
      c.lineTo(-s * 1.5, -s * 0.4);
      c.stroke();
      // wings (flap)
      c.fillStyle = '#eef2fa';
      c.beginPath();
      c.moveTo(-s * 0.1, -s * 0.1);
      c.lineTo(s * 0.5, -s * (0.5 + flap));
      c.lineTo(s * 0.7, -s * 0.05);
      c.closePath();
      c.fill();
      c.fillStyle = '#d4ddee';
      c.beginPath();
      c.moveTo(-s * 0.1, s * 0.05);
      c.lineTo(s * 0.45, s * (0.5 + flap));
      c.lineTo(s * 0.65, s * 0.02);
      c.closePath();
      c.fill();
      c.restore();
    }
    c.globalAlpha = 1;
  }

  private drawGlowRings(c: CanvasRenderingContext2D) {
    c.globalCompositeOperation = 'lighter';
    for (const r of this.rings) {
      const g = c.createRadialGradient(r.x, r.y, Math.max(0, r.r - 14), r.x, r.y, r.r + 6);
      g.addColorStop(0, 'rgba(246,215,154,0)');
      g.addColorStop(0.7, `rgba(246,215,154,${0.5 * r.alpha})`);
      g.addColorStop(1, 'rgba(246,215,154,0)');
      c.strokeStyle = g;
      c.lineWidth = 10;
      c.beginPath();
      c.arc(r.x, r.y, r.r, 0, TAU);
      c.stroke();
    }
    // gathered glow around the pointer
    if (this.gather > 0.05 && this.px >= 0) {
      const gr = 90;
      const g = c.createRadialGradient(this.px, this.py, 0, this.px, this.py, gr);
      g.addColorStop(0, `rgba(247,210,150,${0.18 * this.gather})`);
      g.addColorStop(1, 'rgba(247,210,150,0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(this.px, this.py, gr, 0, TAU);
      c.fill();
    }
    c.globalCompositeOperation = 'source-over';
  }

  private drawForeground(c: CanvasRenderingContext2D) {
    if (this.mobile) return;
    // two soft, out-of-focus leaf silhouettes in the bottom corners (parallax)
    const ox = this.windX * 0.6;
    const drawLeaf = (x: number, y: number, s: number, flip: number) => {
      c.save();
      c.translate(x + ox * flip, y + this.bob * 0.6);
      c.scale(flip, 1);
      c.globalAlpha = 0.5;
      const g = c.createLinearGradient(0, -s, 0, s);
      g.addColorStop(0, 'rgba(28,40,40,0.0)');
      g.addColorStop(1, 'rgba(16,26,30,0.9)');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(0, s);
      c.bezierCurveTo(s * 1.2, s * 0.3, s * 1.1, -s * 0.7, 0, -s);
      c.bezierCurveTo(-s * 0.4, -s * 0.5, -s * 0.5, s * 0.4, 0, s);
      c.closePath();
      c.fill();
      c.restore();
    };
    drawLeaf(-20, this.cssH + 30, this.cssH * 0.34, 1);
    drawLeaf(this.cssW + 20, this.cssH + 50, this.cssH * 0.4, -1);
    c.globalAlpha = 1;
  }

  private drawAtmosphere(c: CanvasRenderingContext2D) {
    const w = this.cssW;
    const h = this.cssH;
    // low mist over the clouds
    const mist = c.createLinearGradient(0, h * 0.6, 0, h);
    mist.addColorStop(0, 'rgba(120,140,190,0)');
    mist.addColorStop(1, 'rgba(120,140,190,0.08)');
    c.fillStyle = mist;
    c.fillRect(0, h * 0.6, w, h * 0.4);

    // completion / click brightening
    if (this.flash > 0.01) {
      c.fillStyle = `rgba(255,240,210,${0.06 * this.flash})`;
      c.fillRect(0, 0, w, h);
    }

    // vignette
    const vg = c.createRadialGradient(w / 2, h * 0.46, Math.min(w, h) * 0.3, w / 2, h * 0.5, Math.max(w, h) * 0.75);
    vg.addColorStop(0, 'rgba(4,6,16,0)');
    vg.addColorStop(1, 'rgba(3,5,14,0.62)');
    c.fillStyle = vg;
    c.fillRect(0, 0, w, h);

    // film grain (subtle, animated, cheap)
    if (!this.reduced) this.drawGrain(c);
  }

  private grainSeed = 0;
  private drawGrain(c: CanvasRenderingContext2D) {
    // sparse additive specks; reseeded slowly so it shimmers without per-pixel cost
    this.grainSeed += 1;
    c.globalAlpha = 0.025;
    c.fillStyle = '#ffffff';
    const n = this.mobile ? 60 : 140;
    const s = this.grainSeed * 9301 + 49297;
    for (let i = 0; i < n; i++) {
      const r1 = ((s * (i + 1) * 1.13) % 1000) / 1000;
      const r2 = ((s * (i + 7) * 2.71) % 1000) / 1000;
      c.fillRect(r1 * this.cssW, r2 * this.cssH, 1, 1);
    }
    c.globalAlpha = 1;
  }
}
