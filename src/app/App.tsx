import { useEffect, useState } from 'react';
import { SceneRenderer } from '../components/scene/SceneRenderer';
import { Entry } from '../components/Entry';
import { Brand } from '../components/Brand';
import { ClockWidget } from '../components/clock/ClockWidget';
import { Dock } from '../components/dock/Dock';
import { ScenePanel } from '../components/panels/ScenePanel';
import { Mixer } from '../components/mixer/Mixer';
import { TimerPanel } from '../components/timer/TimerPanel';
import { TimerReadout } from '../components/timer/TimerReadout';
import { KoiHint } from '../components/KoiHint';
import { JellyfishHint } from '../components/JellyfishHint';
import { AstralTeaGardenHint } from '../components/AstralTeaGardenHint';
import { ConservatoryHint } from '../components/ConservatoryHint';
import { Greeting } from '../components/Greeting';
import { Notepad } from '../components/Notepad';
import { QuoteBar } from '../components/QuoteBar';
import { ControlPanel } from '../components/panels/ControlPanel';
import { SoundEngine } from '../audio/SoundEngine';
import { useStore } from '../hooks/useStore';
import { useUI } from '../hooks/useUI';
import { getScene } from '../data/scenes';
import { fontVars } from '../lib/fonts';

function isTyping(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el as HTMLElement).isContentEditable;
}

export function App() {
  const sceneId = useStore((s) => s.state.sceneId);
  const fontTheme = useStore((s) => s.state.fontTheme);
  const uiHidden = useStore((s) => s.state.uiHidden);
  const toggleUiHidden = useStore((s) => s.toggleUiHidden);
  const open = useUI((s) => s.open);
  const toggle = useUI((s) => s.toggle);
  const close = useUI((s) => s.close);

  const [reveal, setReveal] = useState(false);

  const scene = getScene(sceneId);
  const { background, foreground, accent, muted } = scene.palette;

  // Keyboard: s scenes, m sounds, t timer, h hide-ui. (Esc handled by panels.)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(document.activeElement)) return;
      const k = e.key.toLowerCase();
      if (k === 'c') toggle('control');
      else if (k === 's') toggle('scenes');
      else if (k === 'm') toggle('mixer');
      else if (k === 't') toggle('timer');
      else if (k === 'h') toggleUiHidden();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, toggleUiHidden]);

  // Focus mode: reveal the chrome briefly on activity, then fade again.
  useEffect(() => {
    if (!uiHidden) {
      setReveal(false);
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const show = () => {
      setReveal(true);
      clearTimeout(timer);
      timer = setTimeout(() => setReveal(false), 2500);
    };
    window.addEventListener('pointermove', show);
    window.addEventListener('pointerdown', show);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointermove', show);
      window.removeEventListener('pointerdown', show);
    };
  }, [uiHidden]);

  return (
    <div
      className="app-shell"
      style={
        {
          '--bg': background,
          '--fg': foreground,
          '--accent': accent,
          '--muted': muted,
          ...fontVars(fontTheme),
        } as React.CSSProperties
      }
    >
      <SoundEngine />
      <SceneRenderer />

      <div
        className={'app' + (uiHidden ? ' ui-hidden' : '') + (reveal ? ' reveal' : '')}
        data-mode={scene.visualMode}
      >
        <div data-ui>
          <TimerReadout />
        </div>
        <KoiHint />
        <JellyfishHint />
        <AstralTeaGardenHint />
        <ConservatoryHint />
        <div className="chrome" data-ui>
          <Greeting />
          <Brand />
          <ClockWidget />
          <QuoteBar />
          <Notepad />
          <Dock />
          {open === 'control' && <ControlPanel onClose={close} />}
          {open === 'scenes' && <ScenePanel onClose={close} />}
          {open === 'mixer' && <Mixer onClose={close} />}
          {open === 'timer' && <TimerPanel onClose={close} />}
        </div>
      </div>

      <Entry />
    </div>
  );
}
