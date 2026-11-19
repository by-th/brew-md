import type { Scene } from '../scene/types';

export const scenes: Scene[] = [
  {
    id: 'astral-tea-garden',
    name: 'astral tea garden',
    description: 'a tea garden adrift in the night sky. move to stir the petals, hold to gather them.',
    palette: { background: '#0b1026', foreground: '#eaf0ff', accent: '#f4c97a', muted: '#6f7bb0' },
    visualMode: 'dark',
    // Fallback gradients (used only if a 2D context is unavailable) + picker swatch.
    layers: [
      { css: 'linear-gradient(180deg, #080c22 0%, #101a3a 46%, #0c1430 100%)' },
      { css: 'radial-gradient(46% 40% at 74% 22%, rgba(214,228,255,.55), transparent 60%)', blend: 'screen' },
      { css: 'radial-gradient(120% 100% at 50% 46%, transparent 52%, rgba(3,5,14,.62) 100%)' },
    ],
    particles: { type: 'none', count: 0, speed: 0, size: [0, 0], color: 'transparent' },
    defaultSounds: [
      { layerId: 'pads', level: 0.42 },
      { layerId: 'chimes', level: 0.18 },
      { layerId: 'wind', level: 0.12 },
    ],
    renderer: 'astral',
  },
  {
    id: 'clockwork-conservatory',
    name: 'clockwork conservatory',
    description: 'a moonlit glasshouse. move to stir the fireflies, click the earth to plant a light.',
    palette: { background: '#07151C', foreground: '#ece6da', accent: '#e8a94a', muted: '#365c3d' },
    visualMode: 'dark',
    // Fallback gradients (used only when WebGL2 is unavailable) + picker swatch.
    layers: [
      { css: 'linear-gradient(180deg, #07151c 0%, #0a2018 52%, #0d2a20 100%)' },
      { css: 'radial-gradient(42% 38% at 74% 20%, rgba(156,207,227,.42), transparent 60%)', blend: 'screen' },
      { css: 'radial-gradient(46% 42% at 18% 84%, rgba(247,213,106,.18), transparent 66%)', blend: 'screen' },
      { css: 'radial-gradient(120% 100% at 50% 44%, transparent 50%, rgba(26,20,36,.66) 100%)' },
    ],
    particles: { type: 'none', count: 0, speed: 0, size: [0, 0], color: 'transparent' },
    defaultSounds: [
      { layerId: 'rain', level: 0.4 },
      { layerId: 'pads', level: 0.24 },
      { layerId: 'chimes', level: 0.16 },
      { layerId: 'wind', level: 0.1 },
    ],
    renderer: 'conservatory',
  },
  {
    id: 'koi-pond',
    name: 'koi pond',
    description: 'a still pond. click the water to feed the fish.',
    palette: { background: '#0c1512', foreground: '#eef0e8', accent: '#ff8a26', muted: '#5c7a6e' },
    visualMode: 'dark',
    // Fallback gradients (used only when WebGL2 is unavailable).
    layers: [
      { css: 'radial-gradient(80% 70% at 50% 44%, #2a2c1e 0%, #14191300 70%)' },
      { css: 'linear-gradient(180deg, #11201c 0%, #0c1512 60%, #0a120f 100%)' },
      { css: 'radial-gradient(120% 95% at 50% 45%, transparent 50%, rgba(3,8,6,.6) 100%)' },
    ],
    particles: { type: 'none', count: 0, speed: 0, size: [0, 0], color: 'transparent' },
    defaultSounds: [
      { layerId: 'water', level: 0.5 },
      { layerId: 'birds', level: 0.22 },
      { layerId: 'chimes', level: 0.14 },
    ],
    renderer: 'koi',
  },
  {
    id: 'jellyfish-deep',
    name: 'jellyfish deep',
    description: 'bioluminescent drift. drag the water to guide the jellyfish.',
    palette: { background: '#04080f', foreground: '#dfeaf2', accent: '#5ad7ff', muted: '#2f5566' },
    visualMode: 'dark',
    // Fallback gradients (used only when WebGL2 is unavailable) + selector swatch.
    layers: [
      { css: 'linear-gradient(180deg, #0a2230 0%, #061320 45%, #02060c 100%)' },
      {
        // soft distant bioluminescent glows, drifting
        css:
          'radial-gradient(30% 26% at 30% 62%, rgba(70,200,235,.30), transparent 72%),' +
          'radial-gradient(26% 24% at 68% 50%, rgba(140,110,235,.28), transparent 74%),' +
          'radial-gradient(20% 18% at 52% 76%, rgba(80,220,255,.22), transparent 72%)',
        blend: 'screen',
        opacity: 0.85,
        animate: 'drift',
      },
      { css: 'radial-gradient(60% 50% at 50% -8%, rgba(90,180,210,.32), transparent 70%)', blend: 'screen', animate: 'pulse' },
      { css: 'radial-gradient(120% 100% at 50% 42%, transparent 52%, rgba(1,4,9,.66) 100%)' },
    ],
    particles: { type: 'none', count: 0, speed: 0, size: [0, 0], color: 'transparent' },
    defaultSounds: [
      { layerId: 'pads', level: 0.4 },
      { layerId: 'brownNoise', level: 0.35 },
      { layerId: 'water', level: 0.18 },
    ],
    renderer: 'jellyfish',
  },
  {
    id: 'rainy-window',
    name: 'rainy window',
    description: 'a dark room, city lights blurred behind running glass.',
    palette: { background: '#0c1426', foreground: '#ece6da', accent: '#e7b56a', muted: '#5d6e8c' },
    visualMode: 'dark',
    layers: [
      { css: 'linear-gradient(180deg, #0a1226 0%, #111d36 52%, #0b1322 100%)' },
      {
        // blurred city-light bokeh, drifting slowly
        css:
          'radial-gradient(7% 9% at 20% 70%, rgba(231,181,106,.55), transparent 70%),' +
          'radial-gradient(6% 8% at 33% 78%, rgba(120,160,220,.45), transparent 70%),' +
          'radial-gradient(9% 11% at 58% 66%, rgba(231,181,106,.4), transparent 72%),' +
          'radial-gradient(5% 7% at 72% 80%, rgba(150,120,220,.4), transparent 70%),' +
          'radial-gradient(8% 10% at 84% 62%, rgba(120,170,230,.4), transparent 72%)',
        blend: 'screen',
        opacity: 0.6,
        animate: 'drift',
      },
      { css: 'linear-gradient(160deg, rgba(24,46,90,.28), rgba(4,8,18,.42))' },
      { css: 'radial-gradient(125% 95% at 50% 38%, transparent 44%, rgba(3,7,16,.62) 100%)' },
    ],
    particles: { type: 'rain', count: 220, speed: 1, size: [1, 2.2], color: 'rgba(186,206,236,0.5)' },
    defaultSounds: [
      { layerId: 'rain', level: 0.7 },
      { layerId: 'thunder', level: 0.3 },
    ],
  },
  {
    id: 'garden-courtyard',
    name: 'garden courtyard',
    description: 'soft daylight, drifting petals, a pond keeping the hours.',
    palette: { background: '#e7eed8', foreground: '#1d3325', accent: '#d2789a', muted: '#6f8a6a' },
    visualMode: 'light',
    layers: [
      { css: 'linear-gradient(180deg, #d7e8f0 0%, #e9f0d6 46%, #cfe0bd 100%)' },
      {
        css: 'radial-gradient(58% 50% at 78% 16%, rgba(255,240,200,.65), transparent 70%)',
        blend: 'screen',
        animate: 'pulse',
      },
      {
        css:
          'radial-gradient(40% 38% at 12% 96%, rgba(95,140,80,.45), transparent 70%),' +
          'radial-gradient(46% 40% at 88% 98%, rgba(110,150,95,.4), transparent 72%)',
        blend: 'multiply',
        opacity: 0.7,
      },
      { css: 'radial-gradient(50% 30% at 50% 92%, rgba(125,185,165,.32), transparent 72%)', blend: 'screen' },
      { css: 'radial-gradient(120% 95% at 50% 40%, transparent 58%, rgba(40,60,35,.24) 100%)' },
    ],
    particles: { type: 'petals', count: 34, speed: 0.5, size: [6, 12], color: 'rgba(231,140,165,0.85)', sway: 42 },
    defaultSounds: [
      { layerId: 'water', level: 0.5 },
      { layerId: 'birds', level: 0.4 },
      { layerId: 'chimes', level: 0.2 },
    ],
  },
  {
    id: 'blank-focus',
    name: 'blank focus',
    description: 'nothing to look at. just the work.',
    palette: { background: '#15161a', foreground: '#e9e7e2', accent: '#b9b4a8', muted: '#6a6a6a' },
    visualMode: 'dark',
    layers: [
      { css: 'linear-gradient(135deg, #15161a 0%, #24252b 50%, #191a1f 100%)', animate: 'drift' },
      { css: 'radial-gradient(120% 100% at 50% 45%, transparent 62%, rgba(6,6,8,.5) 100%)' },
    ],
    particles: { type: 'dust', count: 12, speed: 0.25, size: [1.5, 3], color: 'rgba(233,231,226,0.4)', sway: 6 },
    defaultSounds: [{ layerId: 'brownNoise', level: 0.5 }],
  },
];

export const DEFAULT_SCENE_ID = 'koi-pond';

export function getScene(id: string): Scene {
  return scenes.find((s) => s.id === id) ?? scenes[0];
}

/** A scene's default mix as a level map, e.g. { rain: 0.7, thunder: 0.3 }. */
export function sceneDefaultLevels(id: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of getScene(id).defaultSounds) out[d.layerId] = d.level;
  return out;
}
