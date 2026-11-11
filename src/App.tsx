import { useState } from 'react';
import { useAppState, useNow } from './useAppState';
import { toDateKey } from './lib/dates';
import { Quiz } from './components/Quiz';
import { ActivityGrid } from './components/ActivityGrid';
import { WordCount } from './components/WordCount';
import { Dictionary } from './components/Dictionary';
import { UploadCsv } from './components/UploadCsv';
import { SettingsDialog } from './components/SettingsDialog';

export default function App() {
  const [state, setState] = useAppState();
  const now = useNow();
  const todayKey = toDateKey(now);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="brand">
          <span className="brand__flag" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          Estonia Daily
        </h1>
        <span className="chip chip--xp" aria-label={`${state.xp} XP`}>
          ⭐ {state.xp}
        </span>
        <button type="button" className="icon-btn" aria-label="Settings" onClick={() => setSettingsOpen(true)}>
          ⚙︎
        </button>
      </header>

      <main className="layout">
        <section className="panel panel--quiz" aria-label="Quiz">
          <Quiz state={state} setState={setState} now={now} />
        </section>
        <section className="panel panel--dash" aria-label="Dashboard">
          <h2 className="visually-hidden">Dashboard</h2>
          <ActivityGrid state={state} todayKey={todayKey} />
          <WordCount state={state} />
          <Dictionary state={state} setState={setState} />
          <div className="card">
            <div className="card__head">
              <h2 className="section-title">Add words</h2>
            </div>
            <UploadCsv state={state} onChange={setState} />
          </div>
        </section>
      </main>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} state={state} setState={setState} todayKey={todayKey} />
    </div>
  );
}
