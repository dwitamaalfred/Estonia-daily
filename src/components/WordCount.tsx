import type { AppState } from '../lib/types';

export function WordCount({ state }: { state: AppState }) {
  const total = state.words.length;
  const learned = state.words.filter((w) => w.status === 'learned').length;
  const pct = total ? Math.round((learned / total) * 100) : 0;
  return (
    <div className="card">
      <div className="card__head">
        <h2 className="section-title">Words learned</h2>
        <span className="count" aria-hidden="true">
          <strong>{learned}</strong>/{total}
        </span>
      </div>
      <div
        className="progress"
        role="progressbar"
        aria-label="Words learned"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={learned}
        aria-valuetext={`${learned} of ${total} words learned`}
      >
        <div className="progress__bar" style={{ width: `${pct}%` }} />
      </div>
      <p className="hint">
        {total === 0 ? 'No words yet. Upload a CSV below.' : `${pct}% of your library · ${total - learned} still in the quiz`}
      </p>
    </div>
  );
}
