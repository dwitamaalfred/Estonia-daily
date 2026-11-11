import { useEffect, useState } from 'react';
import type { AppState } from '../lib/types';
import { resetProgress } from '../lib/words';
import { Modal } from './Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  state: AppState;
  setState: (s: AppState) => void;
  todayKey: string;
}

export const MAX_DAILY_CAP = 100;

export function SettingsDialog({ open, onClose, state, setState, todayKey }: Props) {
  const [cap, setCap] = useState(String(state.settings.dailyCap));
  const [confirmReset, setConfirmReset] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCap(String(state.settings.dailyCap));
      setConfirmReset(false);
      setDone(null);
    }
  }, [open]);

  const n = Number(cap);
  const capValid = Number.isInteger(n) && n >= 1 && n <= MAX_DAILY_CAP;

  return (
    <Modal open={open} onClose={onClose} labelledBy="settings-title">
      <h3 id="settings-title">Settings</h3>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!capValid) return;
          setState({ ...state, settings: { ...state.settings, dailyCap: n } });
          setDone('Daily cap saved.');
        }}
      >
        <label className="field">
          <span>Daily cap (words learned per day)</span>
          <div className="field__row">
            <input type="number" inputMode="numeric" min={1} max={MAX_DAILY_CAP} step={1} value={cap} onChange={(e) => setCap(e.target.value)} aria-invalid={!capValid} />
            <button type="submit" className="btn btn--primary" disabled={!capValid || n === state.settings.dailyCap}>
              Save
            </button>
          </div>
        </label>
        {!capValid && <p className="form__error">Enter a whole number from 1 to {MAX_DAILY_CAP}.</p>}
      </form>

      <hr className="divider" />

      {!confirmReset ? (
        <button type="button" className="btn btn--ghost danger-text" onClick={() => setConfirmReset(true)}>
          Reset all progress
        </button>
      ) : (
        <div className="danger-zone" role="alert">
          <p>
            <strong>Reset all progress?</strong> XP, streaks, the activity calendar and learned status are cleared. Your word library is kept.
          </p>
          <div className="dialog__actions">
            <button type="button" className="btn btn--ghost" onClick={() => setConfirmReset(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => {
                setState(resetProgress(state, todayKey));
                setConfirmReset(false);
                setDone('All progress has been reset.');
              }}
            >
              Yes, reset
            </button>
          </div>
        </div>
      )}

      {done && (
        <p className="form__ok" role="status">
          {done}
        </p>
      )}

      <div className="dialog__actions">
        <button type="button" className="btn btn--primary" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
