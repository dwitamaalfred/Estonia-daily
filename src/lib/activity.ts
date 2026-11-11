import { addDays, addMonthsKey, compareKeys, fromDateKey, monthShort, weekdayMondayFirst } from './dates';
import type { DayStats } from './types';

export interface Period {
  index: number;
  start: string;
  end: string;
}

/** Monthly period k after the start date: e.g. start 11 Nov → 11 Nov–10 Dec, 11 Dec–10 Jan, … */
export function periodAt(startDate: string, index: number): Period {
  const anchor = fromDateKey(startDate).getDate();
  const start = addMonthsKey(startDate, index, anchor);
  const end = addDays(addMonthsKey(startDate, index + 1, anchor), -1);
  return { index, start, end };
}

export function periodIndexFor(startDate: string, dayKey: string): number {
  if (compareKeys(dayKey, startDate) <= 0) return 0;
  let i = 0;
  while (compareKeys(periodAt(startDate, i).end, dayKey) < 0) i++;
  return i;
}

export type DayState = 'done' | 'skipped' | 'upcoming';

export interface GridDay {
  key: string;
  state: DayState;
  /** 0 for non-done days; 1–4 for done days (darker = more words learned). */
  level: number;
  correct: number;
  learned: number;
  isToday: boolean;
}

export function levelFor(learned: number): number {
  if (learned <= 0) return 1;
  if (learned <= 2) return 2;
  if (learned <= 5) return 3;
  return 4;
}

/**
 * done     = at least one correct answer that day
 * skipped  = a past day (since the start date) with no correct answer
 * upcoming = today without a correct answer yet, and future days
 */
export function dayState(dayKey: string, todayKey: string, stats: DayStats | undefined): { state: DayState; level: number } {
  if (stats && stats.correct > 0) return { state: 'done', level: levelFor(stats.learned) };
  if (compareKeys(dayKey, todayKey) < 0) return { state: 'skipped', level: 0 };
  return { state: 'upcoming', level: 0 };
}

export interface Grid {
  /** Columns = weeks (Monday-first); each has 7 slots, null where outside the period. */
  weeks: (GridDay | null)[][];
  monthLabels: { col: number; label: string }[];
}

export function buildGrid(period: Period, todayKey: string, activity: Record<string, DayStats>): Grid {
  const weeks: (GridDay | null)[][] = [];
  let col: (GridDay | null)[] = Array(weekdayMondayFirst(period.start)).fill(null);
  const firstsOfMonth: { col: number; key: string }[] = [];
  for (let key = period.start; compareKeys(key, period.end) <= 0; key = addDays(key, 1)) {
    if (col.length === 7) {
      weeks.push(col);
      col = [];
    }
    const stats = activity[key];
    const { state, level } = dayState(key, todayKey, stats);
    if (key === period.start || key.endsWith('-01')) firstsOfMonth.push({ col: weeks.length, key });
    col.push({ key, state, level, correct: stats?.correct ?? 0, learned: stats?.learned ?? 0, isToday: key === todayKey });
  }
  while (col.length < 7) col.push(null);
  weeks.push(col);

  // Month labels: one per month start; drop a label that would collide with the next one.
  const monthLabels: Grid['monthLabels'] = [];
  for (const f of firstsOfMonth) {
    const prev = monthLabels[monthLabels.length - 1];
    if (prev && f.col - prev.col < 2) monthLabels.pop();
    monthLabels.push({ col: f.col, label: monthShort(f.key) });
  }
  return { weeks, monthLabels };
}

/** Consecutive days with a correct answer, ending today (or yesterday if today isn't done yet). */
export function currentStreak(activity: Record<string, DayStats>, todayKey: string): number {
  const done = (k: string) => (activity[k]?.correct ?? 0) > 0;
  let key = done(todayKey) ? todayKey : addDays(todayKey, -1);
  let n = 0;
  while (done(key)) {
    n++;
    key = addDays(key, -1);
  }
  return n;
}
