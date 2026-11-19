import type { ParticleConfig, ParticleType } from './types';

// One reusable particle system over a single canvas. Behaviors (rain, petals,
// fireflies/dust drift, stars) are parameter sets over a shared integrator.
// Driven imperatively by SceneRenderer's rAF loop. No per-frame React state.

type P = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  len: number;
  alpha: number;
  rot: number;
  vr: number;
  phase: number;
  twinkle: number;
};

const REF_AREA = 1280 * 800;
const HARD_CAP: Record<ParticleType, number> = {
  rain: 320,
  petals: 64,
  fireflies: 80,
  dust: 90,
  stars: 220,
  none: 0,
};

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

export class ParticleSystem {
  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private config: ParticleConfig;
  private particles: P[] = [];
  private shootingIn = rand(4, 12); // seconds until next shooting star

  constructor(canvas: HTMLCanvasElement, config: ParticleConfig) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    this.ctx = ctx;
    this.config = config;
    this.resize();
    this.build();
  }

  resize() {
    const canvas = this.ctx.canvas;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = canvas.clientWidth;
    this.h = canvas.clientHeight;
    canvas.width = Math.max(1, Math.floor(this.w * this.dpr));
    canvas.height = Math.max(1, Math.floor(this.h * this.dpr));
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  configure(config: ParticleConfig) {
    this.config = config;
    this.build();
  }

  private targetCount(): number {
    const { type, count } = this.config;
    if (type === 'none') return 0;
    const areaFactor = Math.min(1.4, Math.max(0.35, (this.w * this.h) / REF_AREA));
    return Math.min(HARD_CAP[type], Math.round(count * areaFactor));
  }

  private spawn(initial: boolean): P {
    const { type, size, speed } = this.config;
    const s = rand(size[0], size[1]);
    const base: P = {
      x: rand(0, this.w),
      y: initial ? rand(0, this.h) : -10,
      vx: 0,
      vy: 0,
      size: s,
      len: 0,
      alpha: 1,
      rot: rand(0, Math.PI * 2),
      vr: rand(-0.4, 0.4),
      phase: rand(0, Math.PI * 2),
      twinkle: rand(0.4, 1),
    };
    if (type === 'rain') {
      base.vy = rand(620, 1020) * speed;
      base.vx = rand(-30, 10);
      base.len = rand(12, 26);
      base.alpha = rand(0.25, 0.6);
      base.y = initial ? rand(0, this.h) : rand(-this.h * 0.3, -10);
    } else if (type === 'petals') {
      base.vy = rand(18, 40) * speed;
      base.vx = rand(-8, 8);
      base.alpha = rand(0.6, 0.95);
    } else if (type === 'fireflies' || type === 'dust') {
      base.vy = rand(-6, 6) * speed;
      base.vx = rand(-6, 6) * speed;
      base.alpha = 0;
    } else if (type === 'stars') {
      base.vx = rand(-2, 2) * speed;
      base.vy = rand(-1, 1) * speed;
      base.alpha = rand(0.2, 0.9);
    }
    return base;
  }

  private build() {
    const n = this.targetCount();
    this.particles = [];
    for (let i = 0; i < n; i++) this.particles.push(this.spawn(true));
  }

  /** Advance + draw one frame. dt in seconds. */
  step(dt: number) {
    const { ctx, w, h } = this;
    ctx.clearRect(0, 0, w, h);
    const type = this.config.type;
    if (type === 'none' || this.particles.length === 0) return;

    if (type === 'rain') this.drawRain(dt);
    else if (type === 'petals') this.drawPetals(dt);
    else if (type === 'stars') this.drawStars(dt);
    else this.drawDrift(dt); // fireflies + dust
  }

  /** Single static frame for reduced-motion. */
  drawStatic() {
    const { ctx, w, h } = this;
    ctx.clearRect(0, 0, w, h);
    if (this.config.type === 'none') return;
    // Render motes/stars at rest; skip rain streaks (motion-defined).
    if (this.config.type === 'rain') return;
    for (const p of this.particles) {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = this.config.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawRain(dt: number) {
    const { ctx, h } = this;
    ctx.strokeStyle = this.config.color;
    ctx.lineCap = 'round';
    for (const p of this.particles) {
      p.x += p.vx * dt + Math.sin(p.phase) * 0.3;
      p.y += p.vy * dt;
      p.phase += dt * 3;
      if (p.y > h + p.len) Object.assign(p, this.spawn(false));
      ctx.globalAlpha = p.alpha;
      ctx.lineWidth = p.size;
      const dx = (p.vx / p.vy) * p.len;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + dx, p.y + p.len);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private drawPetals(dt: number) {
    const { ctx, w, h } = this;
    const sway = this.config.sway ?? 30;
    ctx.fillStyle = this.config.color;
    for (const p of this.particles) {
      p.phase += dt * 0.8;
      p.y += p.vy * dt;
      p.x += p.vx * dt + Math.sin(p.phase) * sway * dt;
      p.rot += p.vr * dt;
      if (p.y > h + 14) Object.assign(p, this.spawn(false));
      if (p.x < -14) p.x = w + 14;
      if (p.x > w + 14) p.x = -14;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  private drawDrift(dt: number) {
    const { ctx, w, h } = this;
    ctx.fillStyle = this.config.color;
    for (const p of this.particles) {
      p.phase += dt * rand(0.4, 0.9);
      p.x += p.vx * dt + Math.sin(p.phase) * (this.config.sway ?? 8) * dt;
      p.y += p.vy * dt;
      if (p.x < -8) p.x = w + 8;
      if (p.x > w + 8) p.x = -8;
      if (p.y < -8) p.y = h + 8;
      if (p.y > h + 8) p.y = -8;
      // soft fade in/out
      const a = (Math.sin(p.phase) * 0.5 + 0.5) * p.twinkle;
      ctx.globalAlpha = a * 0.9;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawStars(dt: number) {
    const { ctx, w, h } = this;
    ctx.fillStyle = this.config.color;
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < 0) p.x = w;
      if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h;
      if (p.y > h) p.y = 0;
      p.phase += dt * rand(0.5, 1.5);
      ctx.globalAlpha = p.alpha * (0.6 + 0.4 * Math.sin(p.phase));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // occasional shooting star
    this.shootingIn -= dt;
    if (this.shootingIn <= 0) {
      this.shootingIn = rand(7, 18);
      const sx = rand(w * 0.1, w * 0.7);
      const sy = rand(h * 0.05, h * 0.4);
      const len = rand(120, 220);
      const grad = ctx.createLinearGradient(sx, sy, sx + len, sy + len * 0.4);
      grad.addColorStop(0, 'rgba(255,255,255,0.9)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + len, sy + len * 0.4);
      ctx.stroke();
    }
  }
}
