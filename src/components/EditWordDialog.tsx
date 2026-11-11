import { useEffect, useState, type FormEvent } from 'react';
import type { Word } from '../lib/types';
import type { WordInput } from '../lib/words';
import { Modal } from './Modal';

interface Props {
  word: Word | null;
  onSave: (input: WordInput) => string | null; // returns an error message or null
  onCancel: () => void;
}

const FIELDS: { key: keyof WordInput; label: string; lang: string; required?: boolean }[] = [
  { key: 'estonian_word', label: 'Estonian word', lang: 'et', required: true },
  { key: 'english_word', label: 'English word', lang: 'en', required: true },
  { key: 'sentence_estonian', label: 'Sentence (Estonian)', lang: 'et' },
  { key: 'sentence_english', label: 'Sentence (English)', lang: 'en' },
];

export function EditWordDialog({ word, onSave, onCancel }: Props) {
  const [form, setForm] = useState<Required<WordInput>>({ estonian_word: '', english_word: '', sentence_estonian: '', sentence_english: '' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (word) {
      setForm({
        estonian_word: word.estonian_word,
        english_word: word.english_word,
        sentence_estonian: word.sentence_estonian,
        sentence_english: word.sentence_english,
      });
      setError(null);
    }
  }, [word]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(onSave(form));
  };

  return (
    <Modal open={!!word} onClose={onCancel} labelledBy="edit-title">
      <form onSubmit={submit} className="form">
        <h3 id="edit-title">Edit word</h3>
        {FIELDS.map((f) => (
          <label key={f.key} className="field">
            <span>
              {f.label}
              {f.required && <span aria-hidden="true"> *</span>}
            </span>
            <input
              type="text"
              lang={f.lang}
              required={f.required}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              value={form[f.key]}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
            />
          </label>
        ))}
        {error && (
          <p className="form__error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog__actions">
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary">
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
