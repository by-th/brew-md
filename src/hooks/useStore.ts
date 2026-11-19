import { create } from 'zustand';
import {
  clearState,
  defaultState,
  loadState,
  persistState,
  type ClockFace,
  type SavedState,
  type TimerMode,
  type Pos,
} from '../lib/state';
import { sceneDefaultLevels } from '../data/scenes';
import { clamp } from '../lib/clamp';

const SAVE_DEBOUNCE_MS = 300;

type Store = {
  state: SavedState;

  setScene: (id: string) => void;
  setLayer: (id: string, level: number) => void;
  setMaster: (v: number) => void;
  toggleMusic: () => void;

  setTimerConfig: (patch: Partial<Pick<SavedState['timer'], 'mode' | 'workMin' | 'breakMin'>>) => void;
  startTimer: () => void;
  pauseTimer: () => void;
  stopTimer: () => void;
  advanceTimer: () => void; // called when the running phase hits zero

  setUiHidden: (v: boolean) => void;
  toggleUiHidden: () => void;
  dismissKoiHint: () => void;
  dismissJellyHint: () => void;
  dismissAstralHint: () => void;
  dismissConservatoryHint: () => void;
  setFontTheme: (id: string) => void;
  toggleGreeting: () => void;
  toggleQuotes: () => void;
  toggleNotepad: () => void;
  setShowNotepad: (v: boolean) => void;
  setNotepad: (text: string) => void;
  addNotepadItem: (text: string) => void;
  toggleNotepadItem: (id: string) => void;
  removeNotepadItem: (id: string) => void;
  setTimerPos: (pos: Pos) => void;
  setGreetingPos: (pos: Pos) => void;
  setQuotePos: (pos: Pos) => void;

  setClockFace: (f: ClockFace) => void;
  setH24: (v: boolean) => void;
  setName: (name: string) => void;
  setClockPos: (pos: Pos) => void;

  resetAll: () => void;
};

let saveTimer: ReturnType<typeof setTimeout> | undefined;
function schedulePersist(s: SavedState) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => persistState(s), SAVE_DEBOUNCE_MS);
}

function minutesFor(t: SavedState['timer']): number {
  return t.phase === 'work' ? t.workMin : t.breakMin;
}

export const useStore = create<Store>((set, get) => {
  const update = (mut: (s: SavedState) => SavedState) => {
    const next = mut(get().state);
    set({ state: next });
    schedulePersist(next);
  };

  return {
    state: loadState(),

    setScene: (id) =>
      update((s) => ({ ...s, sceneId: id, soundLevels: sceneDefaultLevels(id) })),
    setLayer: (id, level) =>
      update((s) => ({ ...s, soundLevels: { ...s.soundLevels, [id]: clamp(level, 0, 1) } })),
    setMaster: (v) => update((s) => ({ ...s, masterVolume: clamp(v, 0, 1) })),
    toggleMusic: () => update((s) => ({ ...s, musicOn: !s.musicOn })),

    setTimerConfig: (patch) =>
      update((s) => {
        const timer = { ...s.timer, ...patch };
        // Changing config while idle keeps the timer stopped + consistent.
        if (!timer.running) {
          timer.endsAt = null;
          timer.phase = 'work';
          timer.pausedMs = null;
        }
        return { ...s, timer };
      }),
    startTimer: () =>
      update((s) => {
        if (s.timer.mode === 'off') return s;
        const ms = s.timer.pausedMs != null ? s.timer.pausedMs : minutesFor(s.timer) * 60_000;
        return { ...s, timer: { ...s.timer, running: true, endsAt: Date.now() + ms, pausedMs: null } };
      }),
    pauseTimer: () =>
      update((s) => {
        if (!s.timer.running || s.timer.endsAt == null) return s;
        const pausedMs = Math.max(0, s.timer.endsAt - Date.now());
        return { ...s, timer: { ...s.timer, running: false, endsAt: null, pausedMs } };
      }),
    stopTimer: () =>
      update((s) => ({
        ...s,
        timer: { ...s.timer, running: false, endsAt: null, phase: 'work', pausedMs: null },
      })),
    advanceTimer: () =>
      update((s) => {
        const t = s.timer;
        if (t.mode === 'pomodoro') {
          const phase = t.phase === 'work' ? 'break' : 'work';
          const mins = phase === 'work' ? t.workMin : t.breakMin;
          return { ...s, timer: { ...t, phase, endsAt: Date.now() + mins * 60_000, pausedMs: null } };
        }
        return { ...s, timer: { ...t, running: false, endsAt: null, pausedMs: null } };
      }),

    setUiHidden: (v) => update((s) => ({ ...s, uiHidden: v })),
    toggleUiHidden: () => update((s) => ({ ...s, uiHidden: !s.uiHidden })),
    dismissKoiHint: () =>
      update((s) => (s.koiHintDismissed ? s : { ...s, koiHintDismissed: true })),
    dismissJellyHint: () =>
      update((s) => (s.jellyHintDismissed ? s : { ...s, jellyHintDismissed: true })),
    dismissAstralHint: () =>
      update((s) => (s.astralHintDismissed ? s : { ...s, astralHintDismissed: true })),
    dismissConservatoryHint: () =>
      update((s) => (s.conservatoryHintDismissed ? s : { ...s, conservatoryHintDismissed: true })),
    setFontTheme: (id) => update((s) => ({ ...s, fontTheme: id })),
    toggleGreeting: () => update((s) => ({ ...s, showGreeting: !s.showGreeting })),
    toggleQuotes: () => update((s) => ({ ...s, showQuotes: !s.showQuotes })),
    toggleNotepad: () => update((s) => ({ ...s, showNotepad: !s.showNotepad })),
    setShowNotepad: (v) => update((s) => ({ ...s, showNotepad: v })),
    setNotepad: (text) => update((s) => ({ ...s, notepad: text.slice(0, 5000) })),
    addNotepadItem: (text) =>
      update((s) => {
        const t = text.trim();
        if (!t) return s;
        const id = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
        return { ...s, notepadItems: [...s.notepadItems, { id, text: t.slice(0, 200), done: false }] };
      }),
    toggleNotepadItem: (id) =>
      update((s) => ({
        ...s,
        notepadItems: s.notepadItems.map((i) => (i.id === id ? { ...i, done: !i.done } : i)),
      })),
    removeNotepadItem: (id) =>
      update((s) => ({ ...s, notepadItems: s.notepadItems.filter((i) => i.id !== id) })),
    setTimerPos: (pos) => update((s) => ({ ...s, timerPos: pos })),
    setGreetingPos: (pos) => update((s) => ({ ...s, greetingPos: pos })),
    setQuotePos: (pos) => update((s) => ({ ...s, quotePos: pos })),

    setClockFace: (f) => update((s) => ({ ...s, clock: { ...s.clock, face: f } })),
    setH24: (v) => update((s) => ({ ...s, clock: { ...s.clock, h24: v } })),
    setName: (name) => update((s) => ({ ...s, clock: { ...s.clock, name: name.slice(0, 24) } })),
    setClockPos: (pos) => update((s) => ({ ...s, clock: { ...s.clock, pos } })),

    resetAll: () => {
      clearState();
      set({ state: defaultState() });
    },
  };
});

export type { TimerMode };
