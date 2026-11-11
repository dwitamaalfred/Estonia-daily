import { describe, expect, it } from 'vitest';
import { detectDelimiter, importCsv, parseCsv } from './csv';
import { createInitialState } from './types';

const NOW = new Date(2026, 10, 11, 9, 0);

describe('parseCsv', () => {
  it('parses comma-separated files', () => {
    const r = parseCsv('estonian_word,english_word,sentence_estonian,sentence_english\nkoer,dog,Koer haugub.,The dog barks.\n');
    expect(r.ok).toBe(true);
    expect(r.rows).toEqual([
      { line: 2, estonian_word: 'koer', english_word: 'dog', sentence_estonian: 'Koer haugub.', sentence_english: 'The dog barks.' },
    ]);
  });

  it('auto-detects semicolons (Excel in Estonian locale)', () => {
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';');
    expect(detectDelimiter('a,b,c')).toBe(',');
    const r = parseCsv('estonian_word;english_word;sentence_estonian;sentence_english\r\nkass;cat;Kass magab, ma loen.;The cat sleeps, I read.\r\n');
    expect(r.rows[0]).toMatchObject({ estonian_word: 'kass', english_word: 'cat', sentence_estonian: 'Kass magab, ma loen.' });
  });

  it('strips a UTF-8 BOM and accepts header names case-insensitively in any order', () => {
    const r = parseCsv('﻿ English_Word , ESTONIAN_WORD,Sentence_English,sentence_estonian\nhouse,maja,,\n');
    expect(r.ok).toBe(true);
    expect(r.rows[0]).toMatchObject({ estonian_word: 'maja', english_word: 'house', sentence_estonian: '', sentence_english: '' });
  });

  it('handles quoted fields, escaped quotes, delimiters and newlines inside quotes', () => {
    const csv = [
      'estonian_word,english_word,sentence_estonian,sentence_english',
      '"tere","hello","Tere, Mari!","Hello, Mari!"',
      '"ütle","say","Ta ütleb: ""Aitäh""","He says: ""Thanks"""',
      '"mitu","multi","Rida üks',
      'rida kaks","x"',
      'õun,apple,,',
    ].join('\n');
    const r = parseCsv(csv);
    expect(r.rows.map((x) => x.estonian_word)).toEqual(['tere', 'ütle', 'mitu', 'õun']);
    expect(r.rows[0].sentence_estonian).toBe('Tere, Mari!');
    expect(r.rows[1].sentence_estonian).toBe('Ta ütleb: "Aitäh"');
    expect(r.rows[2].sentence_estonian).toBe('Rida üks\nrida kaks');
    expect(r.rows[3].line).toBe(6);
  });

  it('keeps Estonian letters õ ä ö ü š ž and trims whitespace', () => {
    const r = parseCsv('estonian_word,english_word\n  šokolaad  , chocolate \nžürii,jury\nöö,night\n');
    expect(r.rows.map((x) => x.estonian_word)).toEqual(['šokolaad', 'žürii', 'öö']);
    expect(r.rows[0].english_word).toBe('chocolate');
  });

  it('ignores empty lines and reports invalid rows with line numbers', () => {
    const r = parseCsv('estonian_word,english_word\n\nkoer,dog\n,cat\n\n  ;  \nmaja,\n , \n');
    expect(r.rows).toHaveLength(1);
    expect(r.invalid.map((x) => x.line)).toEqual([4, 6, 7]);
    expect(r.invalid[0].reason).toContain('estonian_word');
  });

  it('rejects files without the required header', () => {
    expect(parseCsv('koer,dog\nkass,cat').ok).toBe(false);
    expect(parseCsv('').ok).toBe(false);
  });
});

describe('importCsv', () => {
  it('never adds duplicate pairs, within the file or against the library', () => {
    const csv = 'estonian_word,english_word\nkoer,dog\nKOER , Dog\nkass,cat\ntee,tea\ntee,road\n';
    const first = importCsv(createInitialState(), csv, NOW);
    expect(first.summary).toMatchObject({ ok: true, added: 4, duplicates: 1, duplicateLines: [3] });
    const second = importCsv(first.state, 'estonian_word,english_word\nkass,CAT\nhiir,mouse\n,x\n', NOW);
    expect(second.summary).toMatchObject({ added: 1, duplicates: 1 });
    expect(second.summary.invalid).toEqual([{ line: 4, reason: 'missing estonian_word' }]);
    expect(second.state.words).toHaveLength(5);
  });

  it('sets the start date on the first successful upload only', () => {
    const empty = importCsv(createInitialState(), 'estonian_word,english_word\n', NOW);
    expect(empty.state.startDate).toBeNull();
    const a = importCsv(createInitialState(), 'estonian_word,english_word\nkoer,dog', NOW);
    expect(a.state.startDate).toBe('2026-11-11');
    const b = importCsv(a.state, 'estonian_word,english_word\nkass,cat', new Date(2026, 11, 1));
    expect(b.state.startDate).toBe('2026-11-11');
  });
});
