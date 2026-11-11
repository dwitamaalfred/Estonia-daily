import { describe, expect, it } from 'vitest';
import { buildGrid, currentStreak, dayState, periodAt, periodIndexFor } from './activity';
import { toDateKey } from './dates';

describe('monthly periods', () => {
  it('start at the start date and run for a month', () => {
    expect(periodAt('2026-11-11', 0)).toEqual({ index: 0, start: '2026-11-11', end: '2026-12-10' });
    expect(periodAt('2026-11-11', 1)).toEqual({ index: 1, start: '2026-12-11', end: '2027-01-10' });
    expect(periodAt('2026-11-11', 2)).toEqual({ index: 2, start: '2027-01-11', end: '2027-02-10' });
  });

  it('clamp to short months without drifting', () => {
    expect(periodAt('2027-01-31', 0)).toEqual({ index: 0, start: '2027-01-31', end: '2027-02-27' });
    expect(periodAt('2027-01-31', 1)).toEqual({ index: 1, start: '2027-02-28', end: '2027-03-30' });
    expect(periodAt('2027-01-31', 2)).toEqual({ index: 2, start: '2027-03-31', end: '2027-04-29' });
  });

  it('finds the period containing a day', () => {
    expect(periodIndexFor('2026-11-11', '2026-11-11')).toBe(0);
    expect(periodIndexFor('2026-11-11', '2026-12-10')).toBe(0);
    expect(periodIndexFor('2026-11-11', '2026-12-11')).toBe(1);
    expect(periodIndexFor('2026-11-11', '2027-03-01')).toBe(3);
  });
});

describe('day states', () => {
  const today = '2026-11-20';
  it('done when there was a correct answer, darker with more words learned', () => {
    expect(dayState('2026-11-12', today, { answers: 3, correct: 1, learned: 0 })).toEqual({ state: 'done', level: 1 });
    expect(dayState('2026-11-12', today, { answers: 9, correct: 8, learned: 2 }).level).toBe(2);
    expect(dayState('2026-11-12', today, { answers: 9, correct: 8, learned: 5 }).level).toBe(3);
    expect(dayState('2026-11-12', today, { answers: 9, correct: 8, learned: 10 }).level).toBe(4);
    expect(dayState(today, today, { answers: 1, correct: 1, learned: 0 }).state).toBe('done');
  });
  it('skipped for past days without a correct answer (even with wrong answers)', () => {
    expect(dayState('2026-11-12', today, undefined).state).toBe('skipped');
    expect(dayState('2026-11-12', today, { answers: 4, correct: 0, learned: 0 }).state).toBe('skipped');
  });
  it('upcoming for today without answers and future days', () => {
    expect(dayState(today, today, undefined).state).toBe('upcoming');
    expect(dayState('2026-11-21', today, undefined).state).toBe('upcoming');
  });
});

describe('grid', () => {
  const activity = {
    '2026-11-11': { answers: 2, correct: 2, learned: 1 },
    '2026-11-13': { answers: 1, correct: 0, learned: 0 },
  };
  const grid = buildGrid(periodAt('2026-11-11', 0), '2026-11-14', activity);

  it('uses weeks as Monday-first columns', () => {
    // 11 Nov 2026 is a Wednesday → two empty slots (Mon, Tue) in the first column.
    expect(grid.weeks[0].slice(0, 2)).toEqual([null, null]);
    expect(grid.weeks[0][2]?.key).toBe('2026-11-11');
    expect(grid.weeks[1][0]?.key).toBe('2026-11-16'); // a Monday
    expect(grid.weeks.every((w) => w.length === 7)).toBe(true);
    const days = grid.weeks.flat().filter(Boolean);
    expect(days).toHaveLength(30);
    expect(days[days.length - 1]?.key).toBe('2026-12-10');
  });

  it('assigns states and marks today', () => {
    const byKey = Object.fromEntries(grid.weeks.flat().filter(Boolean).map((d) => [d!.key, d!]));
    expect(byKey['2026-11-11'].state).toBe('done');
    expect(byKey['2026-11-12'].state).toBe('skipped');
    expect(byKey['2026-11-13'].state).toBe('skipped');
    expect(byKey['2026-11-14']).toMatchObject({ state: 'upcoming', isToday: true });
    expect(byKey['2026-12-01'].state).toBe('upcoming');
  });

  it('labels months', () => {
    expect(grid.monthLabels.map((m) => m.label)).toEqual(['Nov', 'Dec']);
    expect(grid.monthLabels[1].col).toBe(3); // 1 Dec 2026 is in the 4th week column
  });
});

describe('streak and midnight', () => {
  it('counts consecutive done days ending today or yesterday', () => {
    const a = {
      '2026-11-08': { answers: 1, correct: 1, learned: 0 },
      '2026-11-09': { answers: 1, correct: 1, learned: 0 },
      '2026-11-10': { answers: 1, correct: 1, learned: 0 },
    };
    expect(currentStreak(a, '2026-11-10')).toBe(3);
    expect(currentStreak(a, '2026-11-11')).toBe(3);
    expect(currentStreak(a, '2026-11-12')).toBe(0);
  });

  it('date keys follow the local clock at midnight', () => {
    expect(toDateKey(new Date(2026, 10, 11, 23, 59, 59))).toBe('2026-11-11');
    expect(toDateKey(new Date(2026, 10, 12, 0, 0, 0))).toBe('2026-11-12');
    expect(toDateKey(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
    expect(toDateKey(new Date(2027, 0, 1, 0, 0))).toBe('2027-01-01');
  });
});
