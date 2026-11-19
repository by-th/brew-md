// Scene data model. Scenes are pure data: a stack of CSS gradient layers for
// static depth, plus one canvas particle config for motion. No images.

export type GradientAnimate = 'drift' | 'flicker' | 'pulse' | 'none';

export type GradientLayer = {
  /** A full CSS `background` value (gradient, or comma-separated gradients). */
  css: string;
  /** Optional blend mode against layers beneath (e.g. 'screen', 'overlay'). */
  blend?: string;
  opacity?: number;
  /** Slow, code-driven motion applied via CSS animation. */
  animate?: GradientAnimate;
};

export type ParticleType = 'rain' | 'fireflies' | 'stars' | 'petals' | 'dust' | 'none';

export type ParticleConfig = {
  type: ParticleType;
  /** Target count at a reference viewport; scaled + capped at runtime. */
  count: number;
  /** Behavior-relative speed multiplier. */
  speed: number;
  /** Particle size range in px [min, max]. */
  size: [number, number];
  /** Base particle color (rgba/hex). */
  color: string;
  /** Horizontal sway amplitude (petals/dust/fireflies). */
  sway?: number;
};

export type VisualMode = 'dark' | 'light' | 'neon';

export type ScenePalette = {
  background: string;
  foreground: string;
  accent: string;
  muted: string;
};

export type SceneSoundDefault = { layerId: string; level: number };

export type Scene = {
  id: string;
  name: string;
  description: string;
  palette: ScenePalette;
  layers: GradientLayer[];
  particles: ParticleConfig;
  defaultSounds: SceneSoundDefault[];
  visualMode: VisualMode;
  /**
   * Optional custom background renderer. When set, a dedicated component takes
   * over the visuals (the `layers` here act only as a fallback when that
   * renderer is unavailable). 'koi' = the WebGL2 goldfish pond; 'jellyfish' =
   * the WebGL2 deep-sea jellyfish drift; 'astral' = the Canvas2D tea garden;
   * 'conservatory' = the WebGL2 clockwork firefly conservatory.
   */
  renderer?: 'koi' | 'jellyfish' | 'astral' | 'conservatory';
};
