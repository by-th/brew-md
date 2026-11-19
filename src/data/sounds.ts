import type { IconName } from '../components/icons';

// The global ambience layer registry. Scenes pick defaults from these, and the
// mixer lists them all so any layer can be raised in any scene (rain in the
// cabin, etc.). Each id maps 1:1 to a generator in src/audio/engine.ts.
export type SoundLayerMeta = { id: string; label: string; icon: IconName };

export const SOUND_LAYERS: SoundLayerMeta[] = [
  { id: 'rain', label: 'rain', icon: 'rain' },
  { id: 'thunder', label: 'distant thunder', icon: 'thunder' },
  { id: 'wind', label: 'wind', icon: 'wind' },
  { id: 'water', label: 'pond water', icon: 'water' },
  { id: 'birds', label: 'songbirds', icon: 'bird' },
  { id: 'chimes', label: 'wind chimes', icon: 'chime' },
  { id: 'fireplace', label: 'fireplace', icon: 'fire' },
  { id: 'cityHum', label: 'city hum', icon: 'city' },
  { id: 'brownNoise', label: 'brown noise', icon: 'noise' },
  { id: 'pads', label: 'soft pads', icon: 'pad' },
];

export const SOUND_LAYER_IDS = SOUND_LAYERS.map((l) => l.id);
