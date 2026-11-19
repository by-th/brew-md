// Safe localStorage helpers. Every access is guarded so the app keeps working
// in private-mode browsers or when storage is full/blocked (spec §15.3).

export function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore: storage unavailable or quota exceeded. Preferences just won't
    // persist this session.
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // no-op
  }
}
