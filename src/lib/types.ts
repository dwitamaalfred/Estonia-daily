export type WordStatus = 'new' | 'learned';

export interface Word {
  /** Stable internal id (not shown to the user). */
  id: string;
  estonian_word: string;
  english_word: string;
  sentence_estonian: string;
  sentence_english: string;
  status: WordStatus;
  /** Correct answers in a row (0–2). 2 = learned. */
  correctStreak: number;
  /** Local date key (YYYY-MM-DD) of the day the word was learned, or null. */
  learnedAt: string | null;
  /** Epoch ms when the word was learned; used to sort "newest first". */
  learnedTs: number | null;
  /** Epoch ms when the word was added to the library. */
  addedAt: number;
}

export interface DayStats {
  /** Total answers given that day. */
  answers: number;
  /** Correct answers given that day. */
  correct: number;
  /** Words that reached "learned" that day. */
  learned: number;
}

export interface Settings {
  dailyCap: number;
}

export interface AppState {
  version: 1;
  words: Word[];
  /** Keyed by local date key (YYYY-MM-DD). */
  activity: Record<string, DayStats>;
  xp: number;
  /** Local date key of the first successful CSV upload. */
  startDate: string | null;
  settings: Settings;
}

export const DEFAULT_DAILY_CAP = 10;
export const LEARN_STREAK = 2;
export const XP_CORRECT = 10;
export const XP_SURE_BONUS = 5;

export function createInitialState(): AppState {
  return {
    version: 1,
    words: [],
    activity: {},
    xp: 0,
    startDate: null,
    settings: { dailyCap: DEFAULT_DAILY_CAP },
  };
}
