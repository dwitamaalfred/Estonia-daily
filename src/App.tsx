import { useAppState } from './useAppState';
import { UploadCsv } from './components/UploadCsv';

export default function App() {
  const [state, setState] = useAppState();
  return (
    <div className="app">
      <header className="app-header">
        <h1 className="brand">Estonia Daily</h1>
      </header>
      <main className="layout">
        <section className="panel" aria-label="Quiz">
          <p>Words in library: {state.words.length}</p>
        </section>
        <section className="panel" aria-label="Dashboard">
          <UploadCsv state={state} onChange={setState} />
        </section>
      </main>
    </div>
  );
}
