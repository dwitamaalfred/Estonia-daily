import { useMemo, useState } from 'react';
import type { AppState, Word } from '../lib/types';
import { deleteWord, editWord, markNotLearned, norm } from '../lib/words';
import { ConfirmDialog } from './ConfirmDialog';
import { EditWordDialog } from './EditWordDialog';

interface Props {
  state: AppState;
  setState: (s: AppState) => void;
}

type Filter = 'learned' | 'all';

/** Newest first: by learn time for the dictionary, by upload time for the whole library (file order within an upload). */
export function sortNewestFirst(words: Word[], filter: Filter): Word[] {
  const indexed = words.map((w, i) => ({ w, i }));
  indexed.sort((a, b) => {
    const ta = filter === 'learned' ? (a.w.learnedTs ?? 0) : a.w.addedAt;
    const tb = filter === 'learned' ? (b.w.learnedTs ?? 0) : b.w.addedAt;
    return tb - ta || a.i - b.i;
  });
  return indexed.map((x) => x.w);
}

export function Dictionary({ state, setState }: Props) {
  const [filter, setFilter] = useState<Filter>('learned');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Word | null>(null);
  const [deleting, setDeleting] = useState<Word | null>(null);

  const rows = useMemo(() => {
    const q = norm(query);
    const base = filter === 'learned' ? state.words.filter((w) => w.status === 'learned') : state.words;
    const matched = q
      ? base.filter((w) => [w.estonian_word, w.english_word, w.sentence_estonian, w.sentence_english].some((f) => norm(f).includes(q)))
      : base;
    return sortNewestFirst(matched, filter);
  }, [state.words, filter, query]);

  const learnedCount = state.words.filter((w) => w.status === 'learned').length;

  return (
    <div className="card">
      <div className="card__head">
        <h2 className="section-title">Dictionary</h2>
        <div className="segmented" role="radiogroup" aria-label="Show">
          {(['learned', 'all'] as const).map((f) => (
            <button key={f} type="button" role="radio" aria-checked={filter === f} className={filter === f ? 'is-active' : ''} onClick={() => setFilter(f)}>
              {f === 'learned' ? `Learned (${learnedCount})` : `All (${state.words.length})`}
            </button>
          ))}
        </div>
      </div>
      <input
        type="search"
        placeholder="Search words or sentences…"
        aria-label="Search dictionary"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
      />

      {rows.length === 0 ? (
        <p className="muted table-empty">
          {query
            ? 'No matches.'
            : filter === 'learned'
              ? 'No learned words yet. Answer a word correctly twice in a row to add it here.'
              : 'Your library is empty.'}
        </p>
      ) : (
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Dictionary table (scrolls sideways)">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Estonian word</th>
                <th scope="col">English word</th>
                <th scope="col">Sentence (Estonian)</th>
                <th scope="col">Sentence (English)</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => (
                <tr key={w.id}>
                  <td lang="et" className="strong">
                    {w.estonian_word}
                    {filter === 'all' && (
                      <span className={`status status--${w.status}`}>{w.status === 'learned' ? 'learned' : `new · ${w.correctStreak}/2`}</span>
                    )}
                  </td>
                  <td lang="en">{w.english_word}</td>
                  <td lang="et" className="sentence-cell">
                    {w.sentence_estonian || <span className="muted">–</span>}
                  </td>
                  <td lang="en" className="sentence-cell muted">
                    {w.sentence_english || '–'}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="icon-btn" aria-label={`Edit ${w.estonian_word}`} title="Edit" onClick={() => setEditing(w)}>
                        ✎
                      </button>
                      {w.status === 'learned' && (
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Mark ${w.estonian_word} as not learned`}
                          title="Mark as not learned"
                          onClick={() => setState(markNotLearned(state, w.id))}
                        >
                          ↺
                        </button>
                      )}
                      <button type="button" className="icon-btn icon-btn--danger" aria-label={`Delete ${w.estonian_word}`} title="Delete" onClick={() => setDeleting(w)}>
                        🗑
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <EditWordDialog
        word={editing}
        onCancel={() => setEditing(null)}
        onSave={(input) => {
          if (!editing) return null;
          const r = editWord(state, editing.id, input);
          if (!r.ok) return r.error;
          setState(r.state);
          setEditing(null);
          return null;
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        title={`Delete "${deleting?.estonian_word}"?`}
        confirmLabel="Delete"
        danger
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) setState(deleteWord(state, deleting.id));
          setDeleting(null);
        }}
      >
        <p className="muted">It will be removed from your library and the quiz.</p>
      </ConfirmDialog>
    </div>
  );
}
