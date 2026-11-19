// Generative audio engine (Web Audio API). No sound files. One graph: each
// ambient layer is a synth routed through its own GainNode into a master bus +
// soft compressor. Layers are keyed by string id so scenes pick defaults and
// the mixer can raise any layer anywhere. Levels ramp smoothly (no pops).

type Ctx = AudioContext;

/** Every layer exposes a level setter (0..1), ramped. */
type Layer = { setLevel: (level: number, ramp?: number) => void };

const RAMP = 0.6;

// ---- noise ----

function noiseBuffer(ctx: Ctx, kind: 'white' | 'brown', seconds = 3): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  if (kind === 'white') {
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  } else {
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
  }
  return buf;
}

function loopNoise(ctx: Ctx, kind: 'white' | 'brown'): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, kind);
  src.loop = true;
  return src;
}

// ---- continuous filtered-noise bed (wind) ----

type BedOpts = {
  kind: 'white' | 'brown';
  filters: { type: BiquadFilterType; freq: number; q: number }[];
  cutoffLfo?: { rate: number; depth: number; target: number };
  ampLfo?: { rate: number; depth: number };
  scale: number;
};

function makeBed(ctx: Ctx, dest: AudioNode, o: BedOpts): Layer {
  const src = loopNoise(ctx, o.kind);
  const out = ctx.createGain();
  out.gain.value = 0;
  let node: AudioNode = src;
  const filters = o.filters.map((f) => {
    const bq = ctx.createBiquadFilter();
    bq.type = f.type;
    bq.frequency.value = f.freq;
    bq.Q.value = f.q;
    node.connect(bq);
    node = bq;
    return bq;
  });
  const amp = ctx.createGain();
  amp.gain.value = 1;
  node.connect(amp);
  amp.connect(out);
  out.connect(dest);
  if (o.cutoffLfo) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = o.cutoffLfo.rate;
    const g = ctx.createGain();
    g.gain.value = o.cutoffLfo.depth;
    lfo.connect(g);
    g.connect(filters[o.cutoffLfo.target].frequency);
    lfo.start();
  }
  if (o.ampLfo) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = o.ampLfo.rate;
    const g = ctx.createGain();
    g.gain.value = o.ampLfo.depth;
    lfo.connect(g);
    g.connect(amp.gain);
    lfo.start();
  }
  src.start();
  return {
    setLevel(level, ramp = RAMP) {
      out.gain.setTargetAtTime(level * o.scale, ctx.currentTime, ramp);
    },
  };
}

// ---- event-scheduled layers ----

function makeEventLayer(
  ctx: Ctx,
  dest: AudioNode,
  scale: number,
  voice: (ctx: Ctx, out: AudioNode) => void,
  delay: () => number,
): Layer {
  const out = ctx.createGain();
  out.gain.value = 0;
  out.connect(dest);
  let running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const loop = () => {
    if (!running) return;
    voice(ctx, out);
    timer = setTimeout(loop, delay());
  };
  return {
    setLevel(level, ramp = RAMP) {
      out.gain.setTargetAtTime(level * scale, ctx.currentTime, ramp);
      const want = level > 0.001;
      if (want && !running) {
        running = true;
        timer = setTimeout(loop, delay());
      } else if (!want && running) {
        running = false;
        if (timer) clearTimeout(timer);
      }
    },
  };
}

function chirp(ctx: Ctx, out: AudioNode, t: number, f: number) {
  const o = ctx.createOscillator();
  o.type = 'sine';
  const g = ctx.createGain();
  g.gain.value = 0;
  o.connect(g);
  g.connect(out);
  o.frequency.setValueAtTime(f, t);
  o.frequency.exponentialRampToValueAtTime(f * 1.6, t + 0.05);
  o.frequency.exponentialRampToValueAtTime(f * 0.85, t + 0.13);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.9, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0008, t + 0.17);
  o.start(t);
  o.stop(t + 0.2);
}

function birdPhrase(ctx: Ctx, out: AudioNode) {
  const t0 = ctx.currentTime + 0.02;
  const n = 1 + Math.floor(Math.random() * 3);
  const base = 2000 + Math.random() * 2200;
  for (let k = 0; k < n; k++) {
    chirp(ctx, out, t0 + k * (0.1 + Math.random() * 0.1), base * (0.9 + Math.random() * 0.3));
  }
}

const PENTA = [0, 2, 4, 7, 9];
function bell(ctx: Ctx, out: AudioNode, t: number, f: number, peak = 0.8, decay = 2.4) {
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.value = f;
  const o2 = ctx.createOscillator();
  o2.type = 'sine';
  o2.frequency.value = f * 2.76;
  const g2 = ctx.createGain();
  g2.gain.value = 0.25;
  const g = ctx.createGain();
  g.gain.value = 0;
  o.connect(g);
  o2.connect(g2);
  g2.connect(g);
  g.connect(out);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0006, t + decay);
  o.start(t);
  o2.start(t);
  o.stop(t + decay + 0.2);
  o2.stop(t + decay + 0.2);
}

function chimeCluster(ctx: Ctx, out: AudioNode) {
  const t = ctx.currentTime + 0.02;
  const root = 523.25;
  const cluster = 1 + Math.floor(Math.random() * 2);
  for (let k = 0; k < cluster; k++) {
    const semi = PENTA[Math.floor(Math.random() * PENTA.length)] + 12 * Math.floor(Math.random() * 2);
    bell(ctx, out, t + k * 0.14, root * Math.pow(2, semi / 12));
  }
}

// ---- rain: filtered-noise bed + droplet impulses ----

function makeRain(ctx: Ctx, dest: AudioNode): Layer {
  const out = ctx.createGain();
  out.gain.value = 0;
  out.connect(dest);

  const src = loopNoise(ctx, 'white');
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 600;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 3000;
  const bed = ctx.createGain();
  bed.gain.value = 0.5;
  src.connect(hp);
  hp.connect(lp);
  lp.connect(bed);
  bed.connect(out);
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.4;
  const lg = ctx.createGain();
  lg.gain.value = 500;
  lfo.connect(lg);
  lg.connect(lp.frequency);
  lfo.start();
  src.start();

  let running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const drop = () => {
    if (!running) return;
    const t = ctx.currentTime + 0.01;
    const o = ctx.createOscillator();
    o.type = 'sine';
    const f = 900 + Math.random() * 1400;
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.5, t + 0.05);
    const g = ctx.createGain();
    g.gain.value = 0;
    o.connect(g);
    g.connect(out);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.08);
    o.start(t);
    o.stop(t + 0.1);
    timer = setTimeout(drop, 120 + Math.random() * 380);
  };

  const SCALE = 0.5;
  return {
    setLevel(level, ramp = RAMP) {
      out.gain.setTargetAtTime(level * SCALE, ctx.currentTime, ramp);
      const want = level > 0.001;
      if (want && !running) {
        running = true;
        timer = setTimeout(drop, 200);
      } else if (!want && running) {
        running = false;
        if (timer) clearTimeout(timer);
      }
    },
  };
}

// ---- water: burble bed + droplets ----

function makeWater(ctx: Ctx, dest: AudioNode): Layer {
  const out = ctx.createGain();
  out.gain.value = 0;
  out.connect(dest);
  const src = loopNoise(ctx, 'brown');
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 520;
  bp.Q.value = 0.8;
  const bed = ctx.createGain();
  bed.gain.value = 0.7;
  src.connect(bp);
  bp.connect(bed);
  bed.connect(out);
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.18;
  const lg = ctx.createGain();
  lg.gain.value = 180;
  lfo.connect(lg);
  lg.connect(bp.frequency);
  lfo.start();
  src.start();

  let running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const drop = () => {
    if (!running) return;
    const t = ctx.currentTime + 0.02;
    const f = 700 + Math.random() * 900;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.12);
    const g = ctx.createGain();
    g.gain.value = 0;
    o.connect(g);
    g.connect(out);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.25, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0006, t + 0.18);
    o.start(t);
    o.stop(t + 0.2);
    timer = setTimeout(drop, 1500 + Math.random() * 3500);
  };

  const SCALE = 0.5;
  return {
    setLevel(level, ramp = RAMP) {
      out.gain.setTargetAtTime(level * SCALE, ctx.currentTime, ramp);
      const want = level > 0.001;
      if (want && !running) {
        running = true;
        timer = setTimeout(drop, 800 + Math.random() * 2000);
      } else if (!want && running) {
        running = false;
        if (timer) clearTimeout(timer);
      }
    },
  };
}

// ---- thunder: occasional low rumble ----

function makeThunder(ctx: Ctx, dest: AudioNode): Layer {
  const out = ctx.createGain();
  out.gain.value = 0;
  out.connect(dest);
  let running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const rumble = () => {
    if (!running) return;
    const t = ctx.currentTime + 0.05;
    // low filtered-noise body
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, 'brown', 4);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(220, t);
    lp.frequency.exponentialRampToValueAtTime(70, t + 3.5);
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(lp);
    lp.connect(g);
    g.connect(out);
    const dur = 3 + Math.random() * 2.5;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.9, t + 0.3 + Math.random() * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.start(t);
    src.stop(t + dur + 0.1);
    // sub sine sweep
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(58, t);
    o.frequency.exponentialRampToValueAtTime(38, t + dur);
    const og = ctx.createGain();
    og.gain.value = 0;
    o.connect(og);
    og.connect(out);
    og.gain.setValueAtTime(0, t);
    og.gain.linearRampToValueAtTime(0.35, t + 0.4);
    og.gain.exponentialRampToValueAtTime(0.0006, t + dur);
    o.start(t);
    o.stop(t + dur + 0.1);

    timer = setTimeout(rumble, 12000 + Math.random() * 20000);
  };

  const SCALE = 0.9;
  return {
    setLevel(level, ramp = RAMP) {
      out.gain.setTargetAtTime(level * SCALE, ctx.currentTime, ramp);
      const want = level > 0.001;
      if (want && !running) {
        running = true;
        timer = setTimeout(rumble, 2500 + Math.random() * 6000);
      } else if (!want && running) {
        running = false;
        if (timer) clearTimeout(timer);
      }
    },
  };
}

// ---- brown noise ----

function makeBrownNoise(ctx: Ctx, dest: AudioNode): Layer {
  const out = ctx.createGain();
  out.gain.value = 0;
  out.connect(dest);
  const src = loopNoise(ctx, 'brown');
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1000;
  src.connect(lp);
  lp.connect(out);
  src.start();
  const SCALE = 0.5;
  return {
    setLevel(level, ramp = RAMP) {
      out.gain.setTargetAtTime(level * SCALE, ctx.currentTime, ramp);
    },
  };
}

// ---- city hum: low drone + filtered noise ----

function makeCityHum(ctx: Ctx, dest: AudioNode): Layer {
  const out = ctx.createGain();
  out.gain.value = 0;
  out.connect(dest);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 420;
  lp.Q.value = 0.6;
  lp.connect(out);
  [55, 55.2, 82.4].forEach((f, i) => {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.value = i === 2 ? 0.1 : 0.16;
    o.connect(g);
    g.connect(lp);
    o.start();
  });
  const src = loopNoise(ctx, 'brown');
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 220;
  bp.Q.value = 0.5;
  const ng = ctx.createGain();
  ng.gain.value = 0.5;
  src.connect(bp);
  bp.connect(ng);
  ng.connect(out);
  src.start();
  const SCALE = 0.4;
  return {
    setLevel(level, ramp = RAMP) {
      out.gain.setTargetAtTime(level * SCALE, ctx.currentTime, ramp);
    },
  };
}

// ---- fireplace: low bed + crackle impulses ----

function makeFireplace(ctx: Ctx, dest: AudioNode): Layer {
  const out = ctx.createGain();
  out.gain.value = 0;
  out.connect(dest);
  const src = loopNoise(ctx, 'brown');
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 360;
  const bed = ctx.createGain();
  bed.gain.value = 0.5;
  src.connect(lp);
  lp.connect(bed);
  bed.connect(out);
  src.start();

  let running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const crackle = () => {
    if (!running) return;
    const t = ctx.currentTime + 0.005;
    const o = ctx.createBufferSource();
    o.buffer = noiseBuffer(ctx, 'white', 0.05);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1500;
    const g = ctx.createGain();
    g.gain.value = 0;
    o.connect(hp);
    hp.connect(g);
    g.connect(out);
    const peak = 0.15 + Math.random() * 0.35;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0004, t + 0.04 + Math.random() * 0.05);
    o.start(t);
    o.stop(t + 0.14);
    timer = setTimeout(crackle, 40 + Math.random() * 260);
  };

  const SCALE = 0.5;
  return {
    setLevel(level, ramp = RAMP) {
      out.gain.setTargetAtTime(level * SCALE, ctx.currentTime, ramp);
      const want = level > 0.001;
      if (want && !running) {
        running = true;
        timer = setTimeout(crackle, 100);
      } else if (!want && running) {
        running = false;
        if (timer) clearTimeout(timer);
      }
    },
  };
}

// ---- pads: detuned chord through a generated reverb ----

function reverbIR(ctx: Ctx, seconds = 2.4): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
  }
  return buf;
}

function makePads(ctx: Ctx, dest: AudioNode): Layer {
  const out = ctx.createGain();
  out.gain.value = 0;
  out.connect(dest);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 900;
  lp.Q.value = 0.4;
  const conv = ctx.createConvolver();
  conv.buffer = reverbIR(ctx);
  const wet = ctx.createGain();
  wet.gain.value = 0.6;
  const dry = ctx.createGain();
  dry.gain.value = 0.5;
  lp.connect(dry);
  dry.connect(out);
  lp.connect(conv);
  conv.connect(wet);
  wet.connect(out);
  const flfo = ctx.createOscillator();
  flfo.frequency.value = 0.05;
  const flg = ctx.createGain();
  flg.gain.value = 400;
  flfo.connect(flg);
  flg.connect(lp.frequency);
  flfo.start();
  [110, 130.81, 164.81, 220].forEach((f) => {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = f * 1.004;
    const g = ctx.createGain();
    g.gain.value = 0.11;
    o.connect(g);
    o2.connect(g);
    g.connect(lp);
    o.start();
    o2.start();
  });
  const SCALE = 0.5;
  return {
    setLevel(level, ramp = 0.9) {
      out.gain.setTargetAtTime(level * SCALE, ctx.currentTime, ramp);
    },
  };
}

// ---- engine ----

class AudioEngine {
  private ctx?: Ctx;
  private bus?: GainNode;
  private layers: Record<string, Layer> = {};
  private master = 0.7;
  private levels: Record<string, number> = {};
  private built = false;

  /** Build the graph + resume. Safe to call repeatedly. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;

    const comp = ctx.createDynamicsCompressor();
    const bus = ctx.createGain();
    bus.gain.value = this.master;
    bus.connect(comp);
    comp.connect(ctx.destination);
    this.bus = bus;

    this.layers.rain = makeRain(ctx, bus);
    this.layers.thunder = makeThunder(ctx, bus);
    this.layers.wind = makeBed(ctx, bus, {
      kind: 'brown',
      filters: [{ type: 'lowpass', freq: 480, q: 0.4 }],
      cutoffLfo: { rate: 0.08, depth: 260, target: 0 },
      ampLfo: { rate: 0.07, depth: 0.4 },
      scale: 0.5,
    });
    this.layers.water = makeWater(ctx, bus);
    this.layers.birds = makeEventLayer(ctx, bus, 0.5, birdPhrase, () => 2500 + Math.random() * 5000);
    this.layers.chimes = makeEventLayer(ctx, bus, 0.5, chimeCluster, () => 1800 + Math.random() * 4200);
    this.layers.fireplace = makeFireplace(ctx, bus);
    this.layers.cityHum = makeCityHum(ctx, bus);
    this.layers.brownNoise = makeBrownNoise(ctx, bus);
    this.layers.pads = makePads(ctx, bus);

    this.built = true;
    if (ctx.state === 'suspended') void ctx.resume();
    // apply any levels set before build
    for (const [id, lvl] of Object.entries(this.levels)) this.layers[id]?.setLevel(lvl, 0.1);
  }

  /** Entry: build, then fade the master in from silence over ~2s. */
  enter(masterTarget: number) {
    this.master = masterTarget;
    this.unlock();
    if (!this.ctx || !this.bus) return;
    const now = this.ctx.currentTime;
    this.bus.gain.cancelScheduledValues(now);
    this.bus.gain.setValueAtTime(0, now);
    this.bus.gain.linearRampToValueAtTime(masterTarget, now + 2);
  }

  setMaster(v: number) {
    this.master = v;
    if (this.ctx && this.bus) this.bus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.2);
  }

  setLevel(id: string, level: number, ramp = RAMP) {
    this.levels[id] = level;
    if (this.built) this.layers[id]?.setLevel(level, ramp);
  }

  /** Short water plop (used when feeding the koi). Under 200ms. No-op pre-entry. */
  plop() {
    if (!this.ctx || !this.bus) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    // pitched sine drop
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(820 + Math.random() * 160, t);
    o.frequency.exponentialRampToValueAtTime(180, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.16);
    o.connect(g);
    g.connect(this.bus);
    o.start(t);
    o.stop(t + 0.18);
    // filtered noise burst
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, 'white', 0.1);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1100;
    bp.Q.value = 0.7;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.12, t);
    ng.gain.exponentialRampToValueAtTime(0.0004, t + 0.12);
    src.connect(bp);
    bp.connect(ng);
    ng.connect(this.bus);
    src.start(t);
    src.stop(t + 0.14);
  }

  /** Soft low swell (used for the jellyfish glow pulse). ~360ms, no-op pre-entry. */
  pulse() {
    if (!this.ctx || !this.bus) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(92, t + 0.32);
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.setValueAtTime(301, t);
    o2.frequency.exponentialRampToValueAtTime(190, t + 0.3);
    const g2 = ctx.createGain();
    g2.gain.value = 0.18;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(300, t + 0.34);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0004, t + 0.36);
    o.connect(g);
    o2.connect(g2);
    g2.connect(g);
    g.connect(lp);
    lp.connect(this.bus);
    o.start(t);
    o2.start(t);
    o.stop(t + 0.4);
    o2.stop(t + 0.4);
  }

  /** Soft confirmation bell (used by the focus timer). */
  chime() {
    if (!this.ctx || !this.bus) return;
    const t = this.ctx.currentTime + 0.02;
    bell(this.ctx, this.bus, t, 880, 0.5, 1.6);
    bell(this.ctx, this.bus, t + 0.18, 1174.66, 0.4, 1.8);
  }
}

export const audioEngine = new AudioEngine();
