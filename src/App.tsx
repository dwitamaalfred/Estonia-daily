import { useAppState, useNow } from './useAppState';
import { UploadCsv } from './components/UploadCsv';
import { Quiz } from './components/Quiz';

export default function App() {
  const [state, setState] = useAppState();
  const now = useNow();
  return (
    <div className="app">
      <header className="app-header">
        <h1 className="brand">Estonia Daily</h1>
        <span className="chip chip--xp">⭐ {state.xp} XP</span>
      </header>
      <main className="layout">
        <section className="panel panel--quiz" aria-label="Quiz">
          <Quiz state={state} setState={setState} now={now} />
        </section>
        <section className="panel panel--dash" aria-label="Dashboard">
          <UploadCsv state={state} onChange={setState} />
        </section>
      </main>
    </div>
  );
}
