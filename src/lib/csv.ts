import type { AppState, Word } from './types';
import { makeWord, pairKey, wordKey } from './words';
import { toDateKey } from './dates';

export const CSV_HEADER = ['estonian_word', 'english_word', 'sentence_estonian', 'sentence_english'] as const;
export const CSV_TEMPLATE = `${CSV_HEADER.join(',')}\n`;

export interface CsvRecord {
  /** 1-based line number in the file where the record starts (header = line 1). */
  line: number;
  fields: string[];
}

/** Choose "," or ";" by counting unquoted occurrences in the first non-empty line. */
export function detectDelimiter(text: string): ',' | ';' {
  let commas = 0;
  let semis = 0;
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (c === '\n' || c === '\r')) {
      if (commas || semis) break;
    } else if (!inQuotes && c === ',') commas++;
    else if (!inQuotes && c === ';') semis++;
  }
  return semis > commas ? ';' : ',';
}

/** RFC 4180-style tokenizer: quoted fields, "" escapes, CRLF/LF, newlines inside quotes. */
export function tokenize(text: string, delimiter: string): CsvRecord[] {
  const records: CsvRecord[] = [];
  let field = '';
  let fields: string[] = [];
  let inQuotes = false;
  let line = 1;
  let recordLine = 1;

  const endRecord = () => {
    fields.push(field);
    records.push({ line: recordLine, fields });
    fields = [];
    field = '';
  };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else {
        if (c === '\n') line++;
        field += c;
      }
      continue;
    }
    if (c === '"') inQuotes = true;
    else if (c === delimiter) {
      fields.push(field);
      field = '';
    } else if (c === '\r' || c === '\n') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      endRecord();
      line++;
      recordLine = line;
    } else field += c;
  }
  if (field !== '' || fields.length > 0) endRecord();
  return records;
}

export interface ParsedRow {
  line: number;
  estonian_word: string;
  english_word: string;
  sentence_estonian: string;
  sentence_english: string;
}

export interface InvalidRow {
  line: number;
  reason: string;
}

export interface ParseResult {
  ok: boolean;
  /** Set when the file as a whole can't be read (e.g. missing header). */
  error?: string;
  rows: ParsedRow[];
  invalid: InvalidRow[];
}

export function parseCsv(input: string): ParseResult {
  const text = input.replace(/^﻿/, '').normalize('NFC');
  const delimiter = detectDelimiter(text);
  const records = tokenize(text, delimiter).filter((r) => r.fields.some((f) => f.trim() !== ''));
  if (records.length === 0) {
    return { ok: false, error: 'The file is empty.', rows: [], invalid: [] };
  }
  const header = records[0].fields.map((h) => h.replace(/^﻿/, '').trim().toLowerCase());
  const idx = Object.fromEntries(CSV_HEADER.map((h) => [h, header.indexOf(h)])) as Record<(typeof CSV_HEADER)[number], number>;
  if (idx.estonian_word < 0 || idx.english_word < 0) {
    return {
      ok: false,
      error: `Missing header. The first line must be: ${CSV_HEADER.join(',')}`,
      rows: [],
      invalid: [],
    };
  }
  const get = (fields: string[], i: number) => (i >= 0 ? (fields[i] ?? '').trim() : '');
  const rows: ParsedRow[] = [];
  const invalid: InvalidRow[] = [];
  for (const rec of records.slice(1)) {
    const row: ParsedRow = {
      line: rec.line,
      estonian_word: get(rec.fields, idx.estonian_word),
      english_word: get(rec.fields, idx.english_word),
      sentence_estonian: get(rec.fields, idx.sentence_estonian),
      sentence_english: get(rec.fields, idx.sentence_english),
    };
    if (!row.estonian_word || !row.english_word) {
      const missing = [!row.estonian_word && 'estonian_word', !row.english_word && 'english_word'].filter(Boolean).join(' and ');
      invalid.push({ line: rec.line, reason: `missing ${missing}` });
    } else rows.push(row);
  }
  return { ok: true, rows, invalid };
}

export interface ImportSummary {
  ok: boolean;
  error?: string;
  added: number;
  duplicates: number;
  duplicateLines: number[];
  invalid: InvalidRow[];
}

/** Parse a CSV and merge new, non-duplicate words into the state. */
export function importCsv(state: AppState, text: string, now: Date): { state: AppState; summary: ImportSummary } {
  const parsed = parseCsv(text);
  if (!parsed.ok) {
    return { state, summary: { ok: false, error: parsed.error, added: 0, duplicates: 0, duplicateLines: [], invalid: [] } };
  }
  const seen = new Set(state.words.map(wordKey));
  const fresh: Word[] = [];
  const duplicateLines: number[] = [];
  const ts = now.getTime();
  for (const row of parsed.rows) {
    const key = pairKey(row.estonian_word, row.english_word);
    if (seen.has(key)) {
      duplicateLines.push(row.line);
      continue;
    }
    seen.add(key);
    fresh.push(makeWord(row, ts));
  }
  const next: AppState =
    fresh.length > 0
      ? { ...state, words: [...state.words, ...fresh], startDate: state.startDate ?? toDateKey(now) }
      : state;
  return {
    state: next,
    summary: {
      ok: true,
      added: fresh.length,
      duplicates: duplicateLines.length,
      duplicateLines,
      invalid: parsed.invalid,
    },
  };
}
