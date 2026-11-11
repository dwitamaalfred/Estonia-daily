import { createInitialState, DEFAULT_DAILY_CAP, type AppState, type Word } from './types';

export const STORAGE_KEY = 'estonia-daily:v1';

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

function sanitizeWord(x: unknown): Word | null {
  if (!isObj(x)) return null;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const est = str(x.estonian_word).trim();
  const eng = str(x.english_word).trim();
  if (!est || !eng) return null;
  const status = x.status === 'learned' ? 'learned' : 'new';
  const streak = typeof x.correctStreak === 'number' ? Math.max(0, Math.min(2, Math.floor(x.correctStreak))) : 0;
  return {
    id: str(x.id) || `w_${Math.random().toString(36).slice(2)}`,
    estonian_word: est,
    english_word: eng,
    sentence_estonian: str(x.sentence_estonian),
    sentence_english: str(x.sentence_english),
    status,
    correctStreak: status === 'learned' ? 2 : Math.min(streak, 1),
    learnedAt: typeof x.learnedAt === 'string' ? x.learnedAt : null,
    learnedTs: typeof x.learnedTs === 'number' ? x.learnedTs : null,
    addedAt: typeof x.addedAt === 'number' ? x.addedAt : 0,
  };
}

/** Parse and defensively validate stored JSON. Falls back to a fresh state. */
export function deserialize(raw: string | null): AppState {
  const base = createInitialState();
  if (!raw) return base;
  try {
    const data: unknown = JSON.parse(raw);
    if (!isObj(data)) return base;
    const words = Array.isArray(data.words) ? data.words.map(sanitizeWord).filter((w): w is Word => !!w) : [];
    const activity: AppState['activity'] = {};
    if (isObj(data.activity)) {
      for (const [k, v] of Object.entries(data.activity)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !isObj(v)) continue;
        const n = (x: unknown) => (typeof x === 'number' && x >= 0 ? Math.floor(x) : 0);
        activity[k] = { answers: n(v.answers), correct: n(v.correct), learned: n(v.learned) };
      }
    }
    const settings = isObj(data.settings) ? data.settings : {};
    const cap = typeof settings.dailyCap === 'number' && settings.dailyCap >= 1 ? Math.floor(settings.dailyCap) : DEFAULT_DAILY_CAP;
    return {
      version: 1,
      words,
      activity,
      xp: typeof data.xp === 'number' && data.xp >= 0 ? Math.floor(data.xp) : 0,
      startDate: typeof data.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.startDate) ? data.startDate : null,
      settings: { dailyCap: cap },
    };
  } catch {
    return base;
  }
}

export function loadState(): AppState {
  try {
    return deserialize(localStorage.getItem(STORAGE_KEY));
  } catch {
    return createInitialState();
  }
}

export function saveState(state: AppState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
