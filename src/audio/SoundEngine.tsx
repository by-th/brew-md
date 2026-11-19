import { useEffect } from 'react';
import { audioEngine } from './engine';
import { useStore } from '../hooks/useStore';
import { useUI } from '../hooks/useUI';
import { SOUND_LAYER_IDS } from '../data/sounds';

/**
 * Bridges ambience state to the audio engine. Renders nothing. Audio only
 * starts after the entry gesture (autoplay policy), via the engine's 2s fade.
 */
export function SoundEngine() {
  const entered = useUI((s) => s.entered);
  const soundLevels = useStore((s) => s.state.soundLevels);
  const masterVolume = useStore((s) => s.state.masterVolume);

  // Entry: fade master in, then apply the saved/seeded mix.
  useEffect(() => {
    if (!entered) return;
    audioEngine.enter(masterVolume);
    for (const id of SOUND_LAYER_IDS) audioEngine.setLevel(id, soundLevels[id] ?? 0, 0.1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entered]);

  // Mix changes (mixer edits + scene switches crossfade levels).
  useEffect(() => {
    if (!entered) return;
    for (const id of SOUND_LAYER_IDS) audioEngine.setLevel(id, soundLevels[id] ?? 0);
  }, [entered, soundLevels]);

  useEffect(() => {
    if (!entered) return;
    audioEngine.setMaster(masterVolume);
  }, [entered, masterVolume]);

  return null;
}
