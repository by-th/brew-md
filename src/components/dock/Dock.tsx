import { useRef } from 'react';
import { Icon } from '../icons';
import { Motion } from '../Motion';
import { useUI } from '../../hooks/useUI';
import { useStore } from '../../hooks/useStore';
import { MusicPlayer } from '../../audio/MusicPlayer';

/** Bottom dock: scenes · music · sounds · timer · volume · focus. */
export function Dock() {
  const open = useUI((s) => s.open);
  const toggle = useUI((s) => s.toggle);
  const master = useStore((s) => s.state.masterVolume);
  const setMaster = useStore((s) => s.setMaster);
  const toggleUiHidden = useStore((s) => s.toggleUiHidden);

  // Remember the last audible level so tapping the volume icon mutes/unmutes.
  const prevVol = useRef(master > 0 ? master : 0.7);
  if (master > 0) prevVol.current = master;
  const muted = master === 0;
  const toggleMute = () => setMaster(muted ? prevVol.current || 0.7 : 0);

  return (
    <div id="dock">
      <button
        className={'dock-btn dock-icon' + (open === 'control' ? ' on' : '')}
        onClick={() => toggle('control')}
        aria-label="control panel"
        aria-pressed={open === 'control'}
      >
        {Icon.gear}
      </button>
      <div className="dock-sep" />
      <button
        className={'dock-btn' + (open === 'scenes' ? ' on' : '')}
        onClick={() => toggle('scenes')}
        aria-pressed={open === 'scenes'}
      >
        {Icon.scenes}
        <Motion className="t" text="scenes" reveal />
      </button>

      <div className="dock-sep" />
      <MusicPlayer />
      <div className="dock-sep" />

      <button
        className={'dock-btn' + (open === 'mixer' ? ' on' : '')}
        onClick={() => toggle('mixer')}
        aria-pressed={open === 'mixer'}
      >
        {Icon.music}
        <Motion className="t" text="sounds" reveal />
      </button>
      <button
        className={'dock-btn dock-icon' + (open === 'timer' ? ' on' : '')}
        onClick={() => toggle('timer')}
        aria-label="timer"
        aria-pressed={open === 'timer'}
      >
        {Icon.timer}
      </button>

      <div className="dock-vol">
        <button
          className="dock-vol-btn"
          onClick={toggleMute}
          aria-label={muted ? 'unmute' : 'mute'}
          aria-pressed={muted}
        >
          {muted ? Icon.mute : Icon.vol}
        </button>
        <input
          className="sl sl-mini"
          type="range"
          min={0}
          max={100}
          value={Math.round(master * 100)}
          onChange={(e) => setMaster(Number(e.target.value) / 100)}
          aria-label="master volume"
        />
      </div>

      <button className="dock-btn dock-icon" onClick={() => toggleUiHidden()} aria-label="focus mode (hide ui)">
        {Icon.eye}
      </button>
    </div>
  );
}
