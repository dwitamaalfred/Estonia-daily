import { describe, expect, it } from 'vitest';
import {
  applyAnswer,
  buildQuestion,
  confirmSure,
  dailyCapReached,
  isCorrect,
  newFlow,
  newScheduler,
  nextWord,
  pickDistractors,
  recordResult,
  selectOption,
  thinkAgain,
  type Flow,
  type Rng,
} from './quiz';
import { createInitialState, type AppState, type Word } from './types';
import { makeWord, norm } from './words';

/** Deterministic PRNG (mulberry32). */
function seeded(seed: number): Rng {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const always = (v: number): Rng => () => v;

let n = 0;
function w(est: string, eng: string, extra: Partial<Word> = {}): Word {
  n++;
  return { ...makeWord({ estonian_word: est, english_word: eng }, n), id: `id_${est}_${eng}_${n}`, ...extra };
}

function stateWith(words: Word[]): AppState {
  return { ...createInitialState(), words, startDate: '2026-11-01' };
}

const NOON = new Date(2026, 10, 11, 12, 0);

describe('2-in-a-row rule and XP', () => {
  it('learns a word after two correct answers in a row', () => {
    const koer = w('koer', 'dog');
    let s = stateWith([koer]);
    let r = applyAnswer(s, koer.id, true, false, NOON);
    expect(r.outcome).toMatchObject({ streak: 1, learnedNow: false, xpGained: 10 });
    expect(r.state.words[0].status).toBe('new');
    r = applyAnswer(r.state, koer.id, true, false, NOON);
    expect(r.outcome).toMatchObject({ streak: 2, learnedNow: true });
    expect(r.state.words[0]).toMatchObject({ status: 'learned', correctStreak: 2, learnedAt: '2026-11-11' });
    expect(r.state.activity['2026-11-11']).toEqual({ answers: 2, correct: 2, learned: 1 });
    expect(r.state.xp).toBe(20);
  });

  it('a wrong answer resets the streak to 0', () => {
    const koer = w('koer', 'dog');
    let s = stateWith([koer]);
    s = applyAnswer(s, koer.id, true, false, NOON).state;
    s = applyAnswer(s, koer.id, false, false, NOON).state;
    expect(s.words[0].correctStreak).toBe(0);
    s = applyAnswer(s, koer.id, true, false, NOON).state;
    expect(s.words[0]).toMatchObject({ correctStreak: 1, status: 'new' });
    expect(s.xp).toBe(20);
  });

  it('gives +5 bonus only when a "Yes, I\'m sure!" answer is correct', () => {
    const koer = w('koer', 'dog');
    const s = stateWith([koer]);
    expect(applyAnswer(s, koer.id, true, true, NOON).outcome.xpGained).toBe(15);
    expect(applyAnswer(s, koer.id, false, true, NOON).outcome.xpGained).toBe(0);
  });
});

describe('daily cap', () => {
  it('stops once the cap of learned words is reached for the local day', () => {
    const words = [w('a', '1'), w('b', '2'), w('c', '3')];
    let s: AppState = { ...stateWith(words), settings: { dailyCap: 2 } };
    for (const word of words.slice(0, 2)) {
      s = applyAnswer(s, word.id, true, false, NOON).state;
      expect(dailyCapReached(s, NOON)).toBe(false);
      s = applyAnswer(s, word.id, true, false, NOON).state;
    }
    expect(dailyCapReached(s, NOON)).toBe(true);
    expect(dailyCapReached(s, new Date(2026, 10, 12, 0, 0, 1))).toBe(false);
  });
});

describe('day crediting around midnight', () => {
  it('credits an answer to the local day it was given', () => {
    const koer = w('koer', 'dog');
    let s = stateWith([koer]);
    s = applyAnswer(s, koer.id, true, false, new Date(2026, 10, 11, 23, 59, 59, 999)).state;
    s = applyAnswer(s, koer.id, true, false, new Date(2026, 10, 12, 0, 0, 0, 0)).state;
    expect(s.activity['2026-11-11']).toEqual({ answers: 1, correct: 1, learned: 0 });
    expect(s.activity['2026-11-12']).toEqual({ answers: 1, correct: 1, learned: 1 });
    expect(s.words[0].learnedAt).toBe('2026-11-12');
  });
});

describe('scheduling', () => {
  const pool = ['a', 'b', 'c', 'd', 'e', 'f'].map((x) => w(x, x.toUpperCase()));

  it('never asks the same word twice in a row', () => {
    const rng = seeded(1);
    let sched = newScheduler();
    let last = '';
    for (let i = 0; i < 500; i++) {
      const r = nextWord(pool.slice(0, 2 + (i % 5)), sched, rng)!;
      expect(r.word.id).not.toBe(last);
      last = r.word.id;
      sched = recordResult(r.sched, r.word.id, rng() < 0.4);
    }
  });

  it('re-queues a wrong word after at least 3 other questions', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const rng = seeded(seed);
      let sched = newScheduler();
      const first = nextWord(pool, sched, rng)!;
      sched = recordResult(first.sched, first.word.id, false);
      const seen: string[] = [];
      for (let i = 0; i < 4; i++) {
        const r = nextWord(pool, sched, rng)!;
        seen.push(r.word.id);
        sched = recordResult(r.sched, r.word.id, true);
      }
      expect(seen.slice(0, 3)).not.toContain(first.word.id);
      expect(seen[3]).toBe(first.word.id);
    }
  });

  it('with a small pool the wrong word comes back at the end', () => {
    const small = pool.slice(0, 2);
    const rng = seeded(7);
    let sched = newScheduler();
    const first = nextWord(small, sched, rng)!;
    sched = recordResult(first.sched, first.word.id, false);
    const second = nextWord(small, sched, rng)!;
    expect(second.word.id).not.toBe(first.word.id);
    sched = recordResult(second.sched, second.word.id, true);
    expect(nextWord(small, sched, rng)!.word.id).toBe(first.word.id);
  });

  it('a pool of one keeps asking that word', () => {
    const r = nextWord([pool[0]], { asked: 3, lastWordId: pool[0].id, retry: [] }, seeded(1))!;
    expect(r.word.id).toBe(pool[0].id);
  });
});

describe('distractors', () => {
  it('never share the correct English meaning (case-insensitive) and never repeat', () => {
    const big = w('suur', 'big');
    const library = [
      big,
      w('pikk', 'Big'),
      w('tohutu', ' BIG '),
      w('väike', 'small'),
      w('pisike', 'small'),
      w('ilus', 'beautiful'),
      w('kiire', 'fast'),
    ];
    for (let seed = 1; seed <= 100; seed++) {
      for (const dir of ['en-et', 'et-en'] as const) {
        const q = buildQuestion(big, library, dir, seeded(seed))!;
        expect(q.options.length).toBe(4);
        const texts = q.options.map((o) => norm(o.text));
        expect(new Set(texts).size).toBe(texts.length);
        const meanings = q.options.map((o) => norm(library.find((x) => x.id === o.wordId)!.english_word));
        expect(meanings.filter((m) => m === 'big')).toHaveLength(1);
        expect(q.options[q.correctIndex].wordId).toBe(big.id);
      }
    }
  });

  it('excludes homonyms with the same Estonian form (tee = tea / road)', () => {
    const tea = w('tee', 'tea');
    const library = [tea, w('tee', 'road'), w('koer', 'dog')];
    for (let seed = 1; seed <= 30; seed++) {
      const d = pickDistractors(tea, library, 'et-en', seeded(seed));
      expect(d.map((x) => x.english_word)).toEqual(['dog']);
    }
  });

  it('shows fewer options when the library is small, min 2', () => {
    const a = w('koer', 'dog');
    expect(buildQuestion(a, [a, w('kass', 'cat')], 'en-et', seeded(1))!.options).toHaveLength(2);
    expect(buildQuestion(a, [a], 'en-et', seeded(1))).toBeNull();
    expect(buildQuestion(a, [a, w('peni', 'dog')], 'en-et', seeded(1))).toBeNull();
  });

  it('uses learned words as distractors too', () => {
    const a = w('koer', 'dog');
    const learned = w('kass', 'cat', { status: 'learned', correctStreak: 2 });
    expect(buildQuestion(a, [a, learned], 'et-en', seeded(1))!.options.map((o) => o.text).sort()).toEqual(['cat', 'dog']);
  });
});

describe('"Are you sure?" pop-up', () => {
  const koer = w('koer', 'dog');
  const q = buildQuestion(koer, [koer, w('kass', 'cat'), w('maja', 'house')], 'en-et', seeded(3))!;
  const wrongIndex = (q.correctIndex + 1) % q.options.length;

  it('appears for both right and wrong answers', () => {
    const right = selectOption(newFlow(q, null), q.correctIndex, always(0), 1);
    const wrong = selectOption(newFlow(q, null), wrongIndex, always(0), 1);
    expect(right.phase).toBe('confirm');
    expect(wrong.phase).toBe('confirm');
    expect(isCorrect(confirmSure(right))).toBe(true);
    expect(isCorrect(confirmSure(wrong))).toBe(false);
  });

  it('is skipped when the dice say no', () => {
    expect(selectOption(newFlow(q, null), q.correctIndex, always(0.99), 1).phase).toBe('result');
  });

  it('is never shown twice in a row, even after "Let me think again"', () => {
    let flow = selectOption(newFlow(q, null), wrongIndex, always(0), 1);
    expect(flow.phase).toBe('confirm');
    flow = thinkAgain(flow);
    expect(flow).toMatchObject({ phase: 'question', selected: null });
    flow = selectOption(flow, q.correctIndex, always(0), 2);
    expect(flow.phase).toBe('result');
    // Next question: allowed again.
    expect(selectOption(newFlow(q, flow), 0, always(0), 3).phase).toBe('confirm');
    // Over many random answers there are never two consecutive pop-ups, and the rate is ≈20 %.
    const rng = seeded(42);
    let prev: Flow | null = null;
    let shown = 0;
    let lastShown = false;
    for (let i = 0; i < 5000; i++) {
      let f = selectOption(newFlow(q, prev), Math.floor(rng() * q.options.length), rng, i);
      const isShown = f.phase === 'confirm';
      expect(isShown && lastShown).toBe(false);
      if (isShown) {
        shown++;
        f = confirmSure(f);
      }
      lastShown = isShown;
      prev = f;
    }
    expect(shown / 5000).toBeGreaterThan(0.16);
    expect(shown / 5000).toBeLessThan(0.23);
  });

  it('rotates messages so the same one is not repeated back to back', () => {
    const rng = seeded(9);
    let prev: Flow | null = null;
    let lastMsg = -1;
    for (let i = 0; i < 200; i++) {
      const f = selectOption(newFlow(q, prev), 0, rng, i);
      if (f.phase === 'confirm') {
        expect(f.messageIndex).not.toBe(lastMsg);
        lastMsg = f.messageIndex;
      }
      prev = f;
    }
  });
});
