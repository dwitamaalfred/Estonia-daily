import { useEffect, useMemo, useState } from 'react';
import { buildGrid, currentStreak, periodAt, periodIndexFor, type GridDay } from '../lib/activity';
import { formatLong, formatShort } from '../lib/dates';
import type { AppState } from '../lib/types';

interface Props {
  state: AppState;
  todayKey: string;
}

const ROW_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'];
const STATE_LABEL = { done: 'Done', skipped: 'Skipped', upcoming: 'Upcoming' } as const;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function describe(d: GridDay): string {
  return `${formatLong(d.key)}${d.isToday ? ' (today)' : ''}: ${STATE_LABEL[d.state]}. ${plural(d.correct, 'correct answer', 'correct answers')}, ${plural(d.learned, 'word', 'words')} learned.`;
}

export function ActivityGrid({ state, todayKey }: Props) {
  const { startDate, activity } = state;
  const currentIndex = startDate ? periodIndexFor(startDate, todayKey) : 0;
  const [index, setIndex] = useState(currentIndex);
  const [selected, setSelected] = useState<string | null>(null);

  // Jump to the current period when the day rolls over into a new one or after a reset.
  useEffect(() => setIndex(currentIndex), [currentIndex, startDate]);

  const period = startDate ? periodAt(startDate, index) : null;
  const grid = useMemo(() => (period ? buildGrid(period, todayKey, activity) : null), [period?.start, period?.end, todayKey, activity]);
  const streak = currentStreak(activity, todayKey);
  const selectedDay = grid?.weeks.flat().find((d) => d?.key === selected) ?? null;

  return (
    <div className="card">
      <div className="card__head">
        <h2 className="section-title">Daily activity</h2>
        <div className="stats">
          <span className="chip" aria-label={`Current streak: ${plural(streak, 'day', 'days')}`}>
            🔥 {plural(streak, 'day', 'days')}
          </span>
          <span className="chip chip--xp" aria-label={`Total XP: ${state.xp}`}>
            ⭐ {state.xp} XP
          </span>
        </div>
      </div>

      {!period || !grid ? (
        <p className="muted">Your calendar starts the day you upload your first CSV.</p>
      ) : (
        <>
          <div className="period-nav">
            <button
              type="button"
              className="icon-btn"
              aria-label="Previous period"
              disabled={index <= 0}
              onClick={() => {
                setIndex((i) => Math.max(0, i - 1));
                setSelected(null);
              }}
            >
              ‹
            </button>
            <span className="period-nav__label" aria-live="polite">
              {formatShort(period.start)} – {formatShort(period.end)}
              {index === currentIndex && <span className="muted"> · current</span>}
            </span>
            <button
              type="button"
              className="icon-btn"
              aria-label="Next period"
              disabled={index >= currentIndex}
              onClick={() => {
                setIndex((i) => Math.min(currentIndex, i + 1));
                setSelected(null);
              }}
            >
              ›
            </button>
          </div>

          <div className="grid-wrap">
            <div className="grid" style={{ ['--cols' as string]: grid.weeks.length }}>
              <div className="grid__months" aria-hidden="true">
                {grid.monthLabels.map((m) => (
                  <span key={`${m.col}-${m.label}`} style={{ gridColumn: m.col + 1 }}>
                    {m.label}
                  </span>
                ))}
              </div>
              <div className="grid__rows" aria-hidden="true">
                {ROW_LABELS.map((l, i) => (
                  <span key={i}>{l}</span>
                ))}
              </div>
              <div className="grid__cells" role="grid" aria-label="Daily activity calendar">
                {grid.weeks.map((week, c) => (
                  <div key={c} role="row" className="grid__col">
                    {week.map((d, r) =>
                      d ? (
                        <button
                          key={d.key}
                          type="button"
                          role="gridcell"
                          className={`cell cell--${d.state} ${d.level ? `cell--l${d.level}` : ''} ${d.isToday ? 'cell--today' : ''} ${selected === d.key ? 'cell--selected' : ''}`}
                          title={describe(d)}
                          aria-label={describe(d)}
                          aria-pressed={selected === d.key}
                          onClick={() => setSelected((s) => (s === d.key ? null : d.key))}
                        >
                          {d.state === 'done' && <span className="cell__mark" aria-hidden="true">✓</span>}
                        </button>
                      ) : (
                        <span key={`e${r}`} className="cell cell--empty" aria-hidden="true" />
                      ),
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="day-detail" aria-live="polite">
            {selectedDay ? describe(selectedDay) : 'Tap a day to see details.'}
          </p>

          <ul className="legend" aria-label="Legend">
            <li>
              <span className="cell cell--done cell--l3 legend__swatch" aria-hidden="true">
                <span className="cell__mark">✓</span>
              </span>
              Done
            </li>
            <li>
              <span className="cell cell--skipped legend__swatch" aria-hidden="true" />
              Skipped
            </li>
            <li>
              <span className="cell cell--upcoming legend__swatch" aria-hidden="true" />
              Upcoming
            </li>
            <li className="legend__scale" aria-label="Darker green means more words learned">
              <span className="muted">fewer</span>
              {[1, 2, 3, 4].map((l) => (
                <span key={l} className={`cell cell--done cell--l${l} legend__swatch legend__swatch--sm`} aria-hidden="true" />
              ))}
              <span className="muted">more words</span>
            </li>
          </ul>
        </>
      )}
    </div>
  );
}
