import { DEFAULT_SCENE_ID, sceneDefaultLevels } from '../data/scenes';
import { clamp } from './clamp';
import { readJSON, removeKey, writeJSON } from './localStorage';

export const STATE_KEY = 'brewmd:v2:state';

export type ClockFace = 'serif' | 'minimal' | 'analog' | 'poetic';
export type TimerMode = 'pomodoro' | 'countdown' | 'off';
export type TimerPhase = 'work' | 'break';
export type Pos = { x: number; y: number } | null;
export type NotepadItem = { id: string; text: string; done: boolean };

export type TimerState = {
  mode: TimerMode;
  workMin: number;
  breakMin: number;
  // Runtime fields (extend the spec shape) so a session survives reload.
  running: boolean;
  phase: TimerPhase;
  endsAt: number | null; // epoch ms
  pausedMs: number | null; // remaining ms while paused
};

export type ClockState = {
  face: ClockFace;
  h24: boolean;
  name: string;
  pos: Pos;
};

// Single persisted shape (spec shape + an approved `clock` field).
export type SavedState = {
  sceneId: string;
  soundLevels: Record<string, number>; // 0..1 per layer (current mix)
  masterVolume: number; // 0..1
  musicOn: boolean;
  timer: TimerState;
  uiHidden: boolean;
  clock: ClockState;
  koiHintDismissed: boolean;
  jellyHintDismissed: boolean;
  astralHintDismissed: boolean;
  conservatoryHintDismissed: boolean;
  fontTheme: string;
  showGreeting: boolean;
  showQuotes: boolean;
  showNotepad: boolean;
  notepad: string;
  notepadItems: NotepadItem[];
  timerPos: Pos;
  greetingPos: Pos;
  quotePos: Pos;
};

export function defaultState(): SavedState {
  return {
    sceneId: DEFAULT_SCENE_ID,
    soundLevels: sceneDefaultLevels(DEFAULT_SCENE_ID),
    masterVolume: 0.7,
    musicOn: false,
    timer: { mode: 'off', workMin: 25, breakMin: 5, running: false, phase: 'work', endsAt: null, pausedMs: null },
    uiHidden: false,
    clock: { face: 'serif', h24: false, name: '', pos: null },
    koiHintDismissed: false,
    jellyHintDismissed: false,
    astralHintDismissed: false,
    conservatoryHintDismissed: false,
    fontTheme: 'classic',
    showGreeting: true,
    showQuotes: true,
    showNotepad: false,
    notepad: '',
    notepadItems: [],
    timerPos: null,
    greetingPos: null,
    quotePos: null,
  };
}

function isFace(v: unknown): v is ClockFace {
  return v === 'serif' || v === 'minimal' || v === 'analog' || v === 'poetic';
}
function isMode(v: unknown): v is TimerMode {
  return v === 'pomodoro' || v === 'countdown' || v === 'off';
}
function isPos(v: unknown): v is Pos {
  if (v === null) return true;
  if (!v || typeof v !== 'object') return false;
  const p = v as { x?: unknown; y?: unknown };
  return typeof p.x === 'number' && typeof p.y === 'number';
}
function numMap(v: unknown): Record<string, number> {
  if (!v || typeof v !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === 'number' && Number.isFinite(val)) out[k] = clamp(val, 0, 1);
  }
  return out;
}

function sanitizeItems(v: unknown): NotepadItem[] | null {
  if (!Array.isArray(v)) return null;
  const out: NotepadItem[] = [];
  for (const it of v) {
    if (it && typeof it === 'object') {
      const o = it as Record<string, unknown>;
      if (typeof o.id === 'string' && typeof o.text === 'string') {
        out.push({ id: o.id, text: o.text.slice(0, 200), done: o.done === true });
      }
    }
  }
  return out.slice(0, 100);
}

/** Deep-merge stored state onto defaults, dropping anything malformed. */
function merge(raw: unknown): SavedState {
  const d = defaultState();
  if (!raw || typeof raw !== 'object') return d;
  const p = raw as Partial<SavedState>;
  const t = (p.timer ?? {}) as Partial<TimerState>;
  const c = (p.clock ?? {}) as Partial<ClockState>;
  const levels = numMap(p.soundLevels);

  return {
    sceneId: typeof p.sceneId === 'string' ? p.sceneId : d.sceneId,
    soundLevels: Object.keys(levels).length ? levels : d.soundLevels,
    masterVolume: typeof p.masterVolume === 'number' ? clamp(p.masterVolume, 0, 1) : d.masterVolume,
    musicOn: typeof p.musicOn === 'boolean' ? p.musicOn : d.musicOn,
    timer: {
      mode: isMode(t.mode) ? t.mode : d.timer.mode,
      workMin: typeof t.workMin === 'number' ? clamp(Math.round(t.workMin), 1, 180) : d.timer.workMin,
      breakMin: typeof t.breakMin === 'number' ? clamp(Math.round(t.breakMin), 1, 90) : d.timer.breakMin,
      running: typeof t.running === 'boolean' ? t.running : false,
      phase: t.phase === 'break' ? 'break' : 'work',
      endsAt: typeof t.endsAt === 'number' ? t.endsAt : null,
      pausedMs: typeof t.pausedMs === 'number' ? t.pausedMs : null,
    },
    uiHidden: typeof p.uiHidden === 'boolean' ? p.uiHidden : d.uiHidden,
    koiHintDismissed: typeof p.koiHintDismissed === 'boolean' ? p.koiHintDismissed : d.koiHintDismissed,
    jellyHintDismissed: typeof p.jellyHintDismissed === 'boolean' ? p.jellyHintDismissed : d.jellyHintDismissed,
    astralHintDismissed: typeof p.astralHintDismissed === 'boolean' ? p.astralHintDismissed : d.astralHintDismissed,
    conservatoryHintDismissed:
      typeof p.conservatoryHintDismissed === 'boolean' ? p.conservatoryHintDismissed : d.conservatoryHintDismissed,
    fontTheme: typeof p.fontTheme === 'string' ? p.fontTheme : d.fontTheme,
    showGreeting: typeof p.showGreeting === 'boolean' ? p.showGreeting : d.showGreeting,
    showQuotes: typeof p.showQuotes === 'boolean' ? p.showQuotes : d.showQuotes,
    showNotepad: typeof p.showNotepad === 'boolean' ? p.showNotepad : d.showNotepad,
    notepad: typeof p.notepad === 'string' ? p.notepad.slice(0, 5000) : d.notepad,
    notepadItems: sanitizeItems(p.notepadItems) ?? d.notepadItems,
    timerPos: isPos(p.timerPos) ? p.timerPos : d.timerPos,
    greetingPos: isPos(p.greetingPos) ? p.greetingPos : d.greetingPos,
    quotePos: isPos(p.quotePos) ? p.quotePos : d.quotePos,
    clock: {
      face: isFace(c.face) ? c.face : d.clock.face,
      h24: typeof c.h24 === 'boolean' ? c.h24 : d.clock.h24,
      name: typeof c.name === 'string' ? c.name.slice(0, 24) : d.clock.name,
      pos: isPos(c.pos) ? c.pos : d.clock.pos,
    },
  };
}

export function loadState(): SavedState {
  const raw = readJSON<unknown>(STATE_KEY);
  if (!raw) return defaultState();
  return merge(raw);
}

export function persistState(s: SavedState): void {
  writeJSON(STATE_KEY, s);
}

export function clearState(): void {
  removeKey(STATE_KEY);
}
