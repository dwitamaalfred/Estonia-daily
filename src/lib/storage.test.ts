import { describe, expect, it } from 'vitest';
import { deserialize } from './storage';
import { createInitialState } from './types';
import { editWord, makeWord, markNotLearned, pairKey, resetProgress } from './words';

describe('storage', () => {
  it('returns a fresh state for missing or corrupt data', () => {
    expect(deserialize(null)).toEqual(createInitialState());
    expect(deserialize('{not json')).toEqual(createInitialState());
  });

  it('round-trips a state and drops invalid words', () => {
    const s = createInitialState();
    s.words.push(makeWord({ estonian_word: 'koer', english_word: 'dog' }, 1));
    const raw = JSON.parse(JSON.stringify(s));
    raw.words.push({ estonian_word: '', english_word: 'x' });
    const back = deserialize(JSON.stringify(raw));
    expect(back.words).toHaveLength(1);
    expect(back.words[0].estonian_word).toBe('koer');
  });
});

describe('words', () => {
  it('identifies pairs case-insensitively and trimmed', () => {
    expect(pairKey('  Õun ', 'Apple')).toBe(pairKey('õun', 'apple '));
    expect(pairKey('tee', 'tea')).not.toBe(pairKey('tee', 'road'));
  });

  it('editing cannot create a duplicate pair', () => {
    const s = createInitialState();
    const a = makeWord({ estonian_word: 'koer', english_word: 'dog' }, 1);
    const b = makeWord({ estonian_word: 'kass', english_word: 'cat' }, 1);
    s.words.push(a, b);
    const r = editWord(s, b.id, { estonian_word: 'KOER', english_word: ' Dog' });
    expect(r.ok).toBe(false);
    const ok = editWord(s, b.id, { estonian_word: 'kass', english_word: 'Cat', sentence_estonian: 'Kass magab.' });
    expect(ok.ok).toBe(true);
  });

  it('mark as not learned and reset progress', () => {
    const s = createInitialState();
    const a = { ...makeWord({ estonian_word: 'koer', english_word: 'dog' }, 1), status: 'learned' as const, correctStreak: 2, learnedAt: '2026-11-11' };
    s.words.push(a);
    s.xp = 50;
    const m = markNotLearned(s, a.id);
    expect(m.words[0]).toMatchObject({ status: 'new', correctStreak: 0, learnedAt: null });
    const r = resetProgress(s, '2026-11-12');
    expect(r.xp).toBe(0);
    expect(r.words[0].status).toBe('new');
    expect(r.startDate).toBe('2026-11-12');
  });
});

import { sortNewestFirst } from './words';

describe('dictionary order', () => {
  it('shows newest first (learn time for Learned, upload time for All, file order within an upload)', () => {
    const a = { ...makeWord({ estonian_word: 'a', english_word: '1' }, 100), status: 'learned' as const, learnedTs: 500 };
    const b = { ...makeWord({ estonian_word: 'b', english_word: '2' }, 100), status: 'learned' as const, learnedTs: 900 };
    const c = makeWord({ estonian_word: 'c', english_word: '3' }, 200);
    expect(sortNewestFirst([a, b], 'learned').map((w) => w.estonian_word)).toEqual(['b', 'a']);
    expect(sortNewestFirst([a, b, c], 'all').map((w) => w.estonian_word)).toEqual(['c', 'a', 'b']);
  });
});
