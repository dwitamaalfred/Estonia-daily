import type { AppState, Word } from './types';

/** Normalise a single field for comparison: trim, Unicode NFC, lower case. */
export function norm(s: string): string {
  return s.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
}

/** A word is identified by the (estonian, english) pair, case-insensitive and trimmed. */
export function pairKey(estonian: string, english: string): string {
  return `${norm(estonian)}\u0000${norm(english)}`;
}

export function wordKey(w: Pick<Word, 'estonian_word' | 'english_word'>): string {
  return pairKey(w.estonian_word, w.english_word);
}

let counter = 0;
export function newId(): string {
  counter += 1;
  return `w_${Date.now().toString(36)}_${counter.toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export interface WordInput {
  estonian_word: string;
  english_word: string;
  sentence_estonian?: string;
  sentence_english?: string;
}

export function makeWord(input: WordInput, addedAt: number): Word {
  return {
    id: newId(),
    estonian_word: input.estonian_word.trim(),
    english_word: input.english_word.trim(),
    sentence_estonian: (input.sentence_estonian ?? '').trim(),
    sentence_english: (input.sentence_english ?? '').trim(),
    status: 'new',
    correctStreak: 0,
    learnedAt: null,
    learnedTs: null,
    addedAt,
  };
}

export const quizPool = (words: Word[]) => words.filter((w) => w.status === 'new');
export const dictionary = (words: Word[]) => words.filter((w) => w.status === 'learned');

export type EditResult = { ok: true; state: AppState } | { ok: false; error: string };

export function editWord(state: AppState, id: string, input: WordInput): EditResult {
  const est = input.estonian_word.trim();
  const eng = input.english_word.trim();
  if (!est || !eng) return { ok: false, error: 'Estonian and English word are required.' };
  const key = pairKey(est, eng);
  if (state.words.some((w) => w.id !== id && wordKey(w) === key)) {
    return { ok: false, error: `"${est} – ${eng}" is already in your library.` };
  }
  return {
    ok: true,
    state: {
      ...state,
      words: state.words.map((w) =>
        w.id === id
          ? {
              ...w,
              estonian_word: est,
              english_word: eng,
              sentence_estonian: (input.sentence_estonian ?? '').trim(),
              sentence_english: (input.sentence_english ?? '').trim(),
            }
          : w,
      ),
    },
  };
}

export function deleteWord(state: AppState, id: string): AppState {
  return { ...state, words: state.words.filter((w) => w.id !== id) };
}

export function markNotLearned(state: AppState, id: string): AppState {
  return {
    ...state,
    words: state.words.map((w) =>
      w.id === id ? { ...w, status: 'new', correctStreak: 0, learnedAt: null, learnedTs: null } : w,
    ),
  };
}

/** Reset progress but keep the word library. */
export function resetProgress(state: AppState, todayKey: string): AppState {
  return {
    ...state,
    words: state.words.map((w) => ({
      ...w,
      status: 'new',
      correctStreak: 0,
      learnedAt: null,
      learnedTs: null,
    })),
    activity: {},
    xp: 0,
    startDate: state.words.length > 0 ? todayKey : null,
  };
}

export type DictionaryFilter = 'learned' | 'all';

/** Newest first: by learn time for the dictionary, by upload time for the whole library (file order within an upload). */
export function sortNewestFirst(words: Word[], filter: DictionaryFilter): Word[] {
  const indexed = words.map((w, i) => ({ w, i }));
  indexed.sort((a, b) => {
    const ta = filter === 'learned' ? (a.w.learnedTs ?? 0) : a.w.addedAt;
    const tb = filter === 'learned' ? (b.w.learnedTs ?? 0) : b.w.addedAt;
    return tb - ta || a.i - b.i;
  });
  return indexed.map((x) => x.w);
}

