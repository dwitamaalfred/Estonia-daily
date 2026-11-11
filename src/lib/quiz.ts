import { toDateKey } from './dates';
import { LEARN_STREAK, XP_CORRECT, XP_SURE_BONUS, type AppState, type DayStats, type Word } from './types';
import { norm } from './words';

export type Rng = () => number;
export type Direction = 'en-et' | 'et-en';

export interface QuizOption {
  text: string;
  wordId: string;
}

export interface Question {
  wordId: string;
  direction: Direction;
  prompt: string;
  options: QuizOption[];
  correctIndex: number;
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const answerText = (w: Word, d: Direction) => (d === 'en-et' ? w.estonian_word : w.english_word);

/**
 * Wrong options: random library words in the answer's language that never share the
 * correct answer's English meaning (or Estonian form, e.g. tee = tea / road), with no repeats.
 */
export function pickDistractors(word: Word, library: readonly Word[], direction: Direction, rng: Rng, max = 3): Word[] {
  const eng = norm(word.english_word);
  const est = norm(word.estonian_word);
  const used = new Set([norm(answerText(word, direction))]);
  const out: Word[] = [];
  for (const w of shuffle(library, rng)) {
    if (out.length >= max) break;
    if (w.id === word.id) continue;
    if (norm(w.english_word) === eng || norm(w.estonian_word) === est) continue;
    const t = norm(answerText(w, direction));
    if (used.has(t)) continue;
    used.add(t);
    out.push(w);
  }
  return out;
}

/** Returns null when fewer than 2 options are possible. */
export function buildQuestion(word: Word, library: readonly Word[], direction: Direction, rng: Rng): Question | null {
  const distractors = pickDistractors(word, library, direction, rng);
  if (distractors.length < 1) return null;
  const options = shuffle([word, ...distractors], rng).map((w) => ({ text: answerText(w, direction), wordId: w.id }));
  return {
    wordId: word.id,
    direction,
    prompt: direction === 'en-et' ? word.english_word : word.estonian_word,
    options,
    correctIndex: options.findIndex((o) => o.wordId === word.id),
  };
}

export const randomDirection = (rng: Rng): Direction => (rng() < 0.5 ? 'en-et' : 'et-en');

// ---------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------

export interface Scheduler {
  /** Number of questions asked so far in this session. */
  asked: number;
  lastWordId: string | null;
  /** Wrongly answered words, eligible again from question number `dueAt`. */
  retry: { wordId: string; dueAt: number }[];
}

export const MIN_GAP_AFTER_WRONG = 3;

export const newScheduler = (): Scheduler => ({ asked: 0, lastWordId: null, retry: [] });

/**
 * Pick the next word:
 * 1. never the previous word (unless it is the only one in the pool);
 * 2. a wrongly answered word whose gap of ≥3 other questions has passed;
 * 3. otherwise a random word that isn't waiting to be retried;
 * 4. otherwise (small pool) the waiting word that is due soonest.
 */
export function nextWord(pool: readonly Word[], sched: Scheduler, rng: Rng): { word: Word; sched: Scheduler } | null {
  if (pool.length === 0) return null;
  const upcoming = sched.asked + 1;
  const ids = new Set(pool.map((w) => w.id));
  const retry = sched.retry.filter((r) => ids.has(r.wordId));
  let candidates = pool.filter((w) => w.id !== sched.lastWordId);
  if (candidates.length === 0) candidates = [...pool];
  const candidateIds = new Set(candidates.map((w) => w.id));
  const waiting = retry.filter((r) => candidateIds.has(r.wordId)).sort((a, b) => a.dueAt - b.dueAt);
  const waitingIds = new Set(retry.map((r) => r.wordId));

  let chosenId: string;
  if (waiting.length > 0 && waiting[0].dueAt <= upcoming) {
    chosenId = waiting[0].wordId;
  } else {
    const fresh = candidates.filter((w) => !waitingIds.has(w.id));
    if (fresh.length > 0) chosenId = fresh[Math.floor(rng() * fresh.length)].id;
    else chosenId = waiting.length > 0 ? waiting[0].wordId : candidates[0].id;
  }
  const word = pool.find((w) => w.id === chosenId)!;
  return {
    word,
    sched: { asked: upcoming, lastWordId: word.id, retry: retry.filter((r) => r.wordId !== word.id) },
  };
}

/** After an answer: a wrong word comes back after at least 3 other questions. */
export function recordResult(sched: Scheduler, wordId: string, correct: boolean): Scheduler {
  const retry = sched.retry.filter((r) => r.wordId !== wordId);
  if (!correct) retry.push({ wordId, dueAt: sched.asked + MIN_GAP_AFTER_WRONG + 1 });
  return { ...sched, retry };
}

// ---------------------------------------------------------------------------
// Answers, XP, daily cap
// ---------------------------------------------------------------------------

export interface AnswerOutcome {
  correct: boolean;
  xpGained: number;
  streak: number;
  learnedNow: boolean;
  dayKey: string;
}

const emptyDay = (): DayStats => ({ answers: 0, correct: 0, learned: 0 });

/** Apply an answer given at time `at` (credited to that local day). */
export function applyAnswer(
  state: AppState,
  wordId: string,
  correct: boolean,
  sureConfirmed: boolean,
  at: Date,
): { state: AppState; outcome: AnswerOutcome } {
  const dayKey = toDateKey(at);
  const word = state.words.find((w) => w.id === wordId);
  const day = { ...(state.activity[dayKey] ?? emptyDay()) };
  day.answers += 1;
  let xpGained = 0;
  let streak = 0;
  let learnedNow = false;
  let words = state.words;

  if (word) {
    if (correct) {
      day.correct += 1;
      xpGained = XP_CORRECT + (sureConfirmed ? XP_SURE_BONUS : 0);
      streak = Math.min(LEARN_STREAK, word.correctStreak + 1);
      learnedNow = streak >= LEARN_STREAK;
      if (learnedNow) day.learned += 1;
    }
    const updated: Word = learnedNow
      ? { ...word, correctStreak: streak, status: 'learned', learnedAt: dayKey, learnedTs: at.getTime() }
      : { ...word, correctStreak: streak };
    words = state.words.map((w) => (w.id === wordId ? updated : w));
  }

  return {
    state: { ...state, words, xp: state.xp + xpGained, activity: { ...state.activity, [dayKey]: day } },
    outcome: { correct, xpGained, streak, learnedNow, dayKey },
  };
}

export function learnedOn(state: AppState, dayKey: string): number {
  return state.activity[dayKey]?.learned ?? 0;
}

export function dailyCapReached(state: AppState, now: Date): boolean {
  return learnedOn(state, toDateKey(now)) >= state.settings.dailyCap;
}

// ---------------------------------------------------------------------------
// "Are you sure?" flow
// ---------------------------------------------------------------------------

/** 0.24 with "never twice in a row" works out to ≈20 % of answers. */
export const SURE_PROBABILITY = 0.24;

export const SURE_MESSAGES = [
  "Are you sure? You're not guessing, right? 🤨",
  'Kas oled kindel? 👀',
  'Hmm… final answer? 🧐',
  'Päriselt? Really really sure? 😏',
  'Bold choice! Are you confident? 🤔',
];

export type Phase = 'question' | 'confirm' | 'result';

export interface Flow {
  question: Question;
  phase: Phase;
  selected: number | null;
  /** Epoch ms of the tap that gave the answer. */
  selectedAt: number | null;
  /** Whether the previous answer showed the "Are you sure?" pop-up. */
  sureShownLast: boolean;
  sureConfirmed: boolean;
  messageIndex: number;
  outcome: AnswerOutcome | null;
}

export function newFlow(question: Question, prev: Flow | null): Flow {
  return {
    question,
    phase: 'question',
    selected: null,
    selectedAt: null,
    sureShownLast: prev?.sureShownLast ?? false,
    sureConfirmed: false,
    messageIndex: prev?.messageIndex ?? -1,
    outcome: null,
  };
}

export function shouldAskSure(sureShownLast: boolean, rng: Rng): boolean {
  return !sureShownLast && rng() < SURE_PROBABILITY;
}

/** Tap an option. Correctness is never consulted, so the pop-up appears for right and wrong answers alike. */
export function selectOption(flow: Flow, index: number, rng: Rng, nowMs: number): Flow {
  if (flow.phase !== 'question') return flow;
  if (shouldAskSure(flow.sureShownLast, rng)) {
    const n = SURE_MESSAGES.length;
    const step = 1 + Math.floor(rng() * (n - 1));
    return {
      ...flow,
      phase: 'confirm',
      selected: index,
      selectedAt: nowMs,
      sureShownLast: true,
      messageIndex: flow.messageIndex < 0 ? Math.floor(rng() * n) : (flow.messageIndex + step) % n,
    };
  }
  return { ...flow, phase: 'result', selected: index, selectedAt: nowMs, sureShownLast: false, sureConfirmed: false };
}

export function confirmSure(flow: Flow): Flow {
  if (flow.phase !== 'confirm') return flow;
  return { ...flow, phase: 'result', sureConfirmed: true };
}

/** "Let me think again": back to the same question, no penalty. */
export function thinkAgain(flow: Flow): Flow {
  if (flow.phase !== 'confirm') return flow;
  return { ...flow, phase: 'question', selected: null, selectedAt: null };
}

export const isCorrect = (flow: Flow) => flow.selected === flow.question.correctIndex;
