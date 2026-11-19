import { useEffect, useState } from 'react';
import { Icon } from '../components/icons';
import { useStore } from '../hooks/useStore';

type ManifestTrack = { title: string; artist?: string; src: string };
type Manifest = { tracks: ManifestTrack[] };

/**
 * Architecture-only music slot. Reads /music-manifest.json (ships empty) and
 * shows a quiet "coming soon" state until real licensed tracks are added. No
 * URLs that do not exist; playback wiring lands when the manifest has files.
 */
export function MusicPlayer() {
  const [tracks, setTracks] = useState<ManifestTrack[]>([]);
  const musicOn = useStore((s) => s.state.musicOn);
  const toggleMusic = useStore((s) => s.toggleMusic);

  useEffect(() => {
    let alive = true;
    fetch('/music-manifest.json')
      .then((r) => r.json())
      .then((m: Manifest) => {
        if (alive) setTracks(Array.isArray(m.tracks) ? m.tracks : []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const has = tracks.length > 0;
  const playing = has && musicOn;

  return (
    <div className="np">
      <button
        className="np-play"
        disabled={!has}
        onClick={has ? toggleMusic : undefined}
        aria-label={!has ? 'music coming soon' : playing ? 'pause music' : 'play music'}
      >
        {playing ? Icon.pause : Icon.play}
      </button>
      <div>
        <div className="np-name">{has ? tracks[0].title : 'music'}</div>
        <div className="np-sub">{has ? tracks[0].artist ?? 'now playing' : 'coming soon'}</div>
      </div>
    </div>
  );
}
