import { useAppState } from './useAppState';

export default function App() {
  const [state] = useAppState();
  return (
    <div className="app">
      <header className="app-header">
        <h1 className="brand">Estonia Daily</h1>
      </header>
      <main className="layout">
        <section className="panel" aria-label="Quiz">
          <p>Words in library: {state.words.length}</p>
        </section>
        <section className="panel" aria-label="Dashboard" />
      </main>
    </div>
  );
}
