import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { importCsv } from './csv';
import { createInitialState } from './types';

describe('public/sample-words.csv', () => {
  it('contains 30 valid, unique words with 3–7 word sentences', () => {
    const text = readFileSync(new URL('../../public/sample-words.csv', import.meta.url), 'utf8');
    const { state, summary } = importCsv(createInitialState(), text, new Date());
    expect(summary).toMatchObject({ added: 30, duplicates: 0, invalid: [] });
    for (const w of state.words) {
      const n = w.sentence_estonian.split(/\s+/).length;
      expect(n, w.sentence_estonian).toBeGreaterThanOrEqual(3);
      expect(n, w.sentence_estonian).toBeLessThanOrEqual(7);
      expect(w.sentence_english).not.toBe('');
    }
  });
});
