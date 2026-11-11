import { useRef, useState } from 'react';
import { CSV_TEMPLATE, importCsv, type ImportSummary } from '../lib/csv';
import type { AppState } from '../lib/types';

interface Props {
  state: AppState;
  onChange: (s: AppState) => void;
}

const TEMPLATE_HREF = `data:text/csv;charset=utf-8,${encodeURIComponent(CSV_TEMPLATE)}`;

/** Read a file as UTF-8; fall back to Windows-1257 (Baltic) if the bytes aren't valid UTF-8. */
async function readText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    try {
      return new TextDecoder('windows-1257').decode(buf);
    } catch {
      return new TextDecoder('utf-8').decode(buf);
    }
  }
}

function lines(list: number[]): string {
  if (list.length <= 12) return list.join(', ');
  return `${list.slice(0, 12).join(', ')} and ${list.length - 12} more`;
}

export function UploadCsv({ state, onChange }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const text = await readText(file);
      const res = importCsv(state, text, new Date());
      if (res.summary.added > 0) onChange(res.state);
      setSummary(res.summary);
    } catch {
      setSummary({ ok: false, error: 'Could not read that file.', added: 0, duplicates: 0, duplicateLines: [], invalid: [] });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="upload">
      <div className="upload__actions">
        <button type="button" className="btn btn--primary" onClick={() => input.current?.click()} disabled={busy}>
          <span aria-hidden="true">⬆︎</span> {busy ? 'Reading…' : 'Upload CSV'}
        </button>
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv,text/plain"
          className="visually-hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <a className="link" href={TEMPLATE_HREF} download="estonia-daily-template.csv">
          Download template
        </a>
        <a className="link" href="/sample-words.csv" download="sample-words.csv">
          Sample (30 words)
        </a>
      </div>
      <p className="hint">
        Columns: <code>estonian_word, english_word, sentence_estonian, sentence_english</code>
      </p>

      {summary && (
        <div className={`summary ${summary.ok ? '' : 'summary--error'}`} role="status" aria-live="polite">
          {summary.ok ? (
            <>
              <ul className="summary__list">
                <li>
                  <strong>{summary.added}</strong> added
                </li>
                <li>
                  <strong>{summary.duplicates}</strong> duplicates skipped
                  {summary.duplicates > 0 && <span className="muted"> (rows {lines(summary.duplicateLines)})</span>}
                </li>
                <li>
                  <strong>{summary.invalid.length}</strong> invalid rows
                  {summary.invalid.length > 0 && <span className="muted"> (rows {lines(summary.invalid.map((r) => r.line))})</span>}
                </li>
              </ul>
              {summary.invalid.length > 0 && (
                <details className="summary__details">
                  <summary>Why were rows invalid?</summary>
                  <ul>
                    {summary.invalid.slice(0, 50).map((r) => (
                      <li key={r.line}>
                        Row {r.line}: {r.reason}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          ) : (
            <p>{summary.error}</p>
          )}
          <button type="button" className="btn btn--ghost btn--small" onClick={() => setSummary(null)}>
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
