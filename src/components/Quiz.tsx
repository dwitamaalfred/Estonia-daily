import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  applyAnswer,
  buildQuestion,
  confirmSure,
  dailyCapReached,
  isCorrect,
  learnedOn,
  newFlow,
  newScheduler,
  nextWord,
  randomDirection,
  recordResult,
  selectOption,
  SURE_MESSAGES,
  thinkAgain,
  type Flow,
  type Scheduler,
} from '../lib/quiz';
import { toDateKey } from '../lib/dates';
import { LEARN_STREAK, type AppState } from '../lib/types';
import { quizPool } from '../lib/words';
import { Modal } from './Modal';

interface Props {
  state: AppState;
  setState: (s: AppState) => void;
  now: Date;
}

type Blocker = 'empty' | 'cap' | 'done' | 'more' | null;

export function Quiz({ state, setState, now }: Props) {
  const sched = useRef<Scheduler>(newScheduler());
  const [flow, setFlow] = useState<Flow | null>(null);
  const [noOptions, setNoOptions] = useState(false);

  const pool = useMemo(() => quizPool(state.words), [state.words]);
  const capReached = dailyCapReached(state, now);
  const todayKey = toDateKey(now);
  const learnedToday = learnedOn(state, todayKey);
  const inResult = flow?.phase === 'result';

  const blocker: Blocker =
    state.words.length === 0
      ? 'empty'
      : state.words.length === 1
        ? 'more'
        : pool.length === 0
          ? 'done'
          : capReached
            ? 'cap'
            : noOptions
              ? 'more'
              : null;

  const showEmpty = !inResult && !!blocker && (blocker !== 'more' || !flow);

  const generate = useCallback(
    (prev: Flow | null): Flow | null => {
      // Try a few words: one may have no valid distractors (e.g. all synonyms).
      const s = sched.current;
      let candidates = pool;
      for (let attempt = 0; attempt < Math.min(pool.length, 8); attempt++) {
        const pick = nextWord(candidates, s, Math.random);
        if (!pick) break;
        const q = buildQuestion(pick.word, state.words, randomDirection(Math.random), Math.random);
        if (q) {
          sched.current = pick.sched;
          return newFlow(q, prev);
        }
        candidates = candidates.filter((w) => w.id !== pick.word.id);
        if (candidates.length === 0) break;
      }
      return null;
    },
    [pool, state.words],
  );

  // Keep a valid question on screen whenever the quiz can run.
  useEffect(() => {
    if (inResult) return; // let the learner read the feedback first
    const wordStillInPool = flow && pool.some((w) => w.id === flow.question.wordId);
    if (blocker && blocker !== 'more') {
      if (flow) setFlow(null);
      return;
    }
    if (!flow || !wordStillInPool) {
      const next = generate(flow);
      setFlow(next);
      setNoOptions(!next);
    }
  }, [blocker, flow, pool, generate, inResult]);

  // Re-check option availability after new uploads.
  useEffect(() => {
    setNoOptions(false);
  }, [state.words.length]);

  const resolve = (f: Flow) => {
    const correct = isCorrect(f);
    const at = new Date(f.selectedAt ?? Date.now());
    const res = applyAnswer(state, f.question.wordId, correct, f.sureConfirmed, at);
    sched.current = recordResult(sched.current, f.question.wordId, correct);
    setState(res.state);
    setFlow({ ...f, outcome: res.outcome });
  };

  const onSelect = (i: number) => {
    if (!flow) return;
    const f = selectOption(flow, i, Math.random, Date.now());
    if (f.phase === 'result') resolve(f);
    else setFlow(f);
  };

  const onNext = () => {
    if (!flow) return;
    const prev = flow;
    if (blocker && blocker !== 'more') return setFlow(null);
    const next = generate(prev);
    setFlow(next);
    setNoOptions(!next);
  };

  const q = flow?.question;
  const word = q ? state.words.find((w) => w.id === q.wordId) : undefined;
  const streak = inResult ? (flow?.outcome?.streak ?? 0) : (word?.correctStreak ?? 0);

  return (
    <div className="quiz">
      <div className="quiz__top">
        <h2 className="section-title">Daily quiz</h2>
        <span className="chip" title="Words learned today / daily cap">
          Today {Math.min(learnedToday, state.settings.dailyCap)}/{state.settings.dailyCap}
        </span>
      </div>

      {showEmpty ? (
        <EmptyState blocker={blocker!} />
      ) : !flow ? null : (
        <div className="card quiz__card" key={`${q!.wordId}-${sched.current.asked}`}>
          <div className="quiz__meta">
            <span className="tag">{q!.direction === 'en-et' ? 'English → Eesti' : 'Eesti → English'}</span>
            <span className="pips" aria-label={`Correct in a row: ${streak} of ${LEARN_STREAK}`}>
              {Array.from({ length: LEARN_STREAK }, (_, i) => (
                <span key={i} className={`pip ${i < streak ? 'pip--on' : ''}`} />
              ))}
            </span>
          </div>
          <p className="quiz__ask">{q!.direction === 'en-et' ? 'How do you say this in Estonian?' : 'What does this mean in English?'}</p>
          <p className="quiz__prompt" lang={q!.direction === 'en-et' ? 'en' : 'et'}>
            {q!.prompt}
          </p>
          <div className={`options options--${q!.options.length}`} role="group" aria-label="Answer options">
            {q!.options.map((o, i) => {
              let cls = 'option';
              let mark = '';
              if (inResult) {
                if (i === q!.correctIndex) {
                  cls += ' option--correct';
                  mark = '✓';
                } else if (i === flow.selected) {
                  cls += ' option--wrong';
                  mark = '✗';
                } else cls += ' option--dim';
              } else if (flow.phase === 'confirm' && i === flow.selected) cls += ' option--picked';
              return (
                <button
                  key={o.wordId}
                  type="button"
                  className={cls}
                  disabled={flow.phase !== 'question'}
                  onClick={() => onSelect(i)}
                  lang={q!.direction === 'en-et' ? 'et' : 'en'}
                >
                  <span>{o.text}</span>
                  {mark && (
                    <span className="option__mark" aria-label={mark === '✓' ? 'correct answer' : 'your answer, wrong'}>
                      {mark}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* "Are you sure?" */}
      <Modal open={flow?.phase === 'confirm'} onClose={() => flow && setFlow(thinkAgain(flow))} labelledBy="sure-title" className="sure">
        {flow && (
          <>
            <p className="sure__emoji" aria-hidden="true">
              🤔
            </p>
            <h3 id="sure-title" className="sure__title">
              {SURE_MESSAGES[Math.max(0, flow.messageIndex)]}
            </h3>
            <p className="muted">
              You picked <strong>{flow.selected !== null ? q?.options[flow.selected]?.text : ''}</strong>
            </p>
            <div className="dialog__actions">
              <button type="button" className="btn btn--ghost" onClick={() => setFlow(thinkAgain(flow))}>
                Let me think again
              </button>
              <button type="button" className="btn btn--primary" data-autofocus onClick={() => resolve(confirmSure(flow))}>
                Yes, I'm sure!
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* Result */}
      <Modal open={inResult} labelledBy="result-title" variant="sheet" className={flow?.outcome?.correct ? 'result result--ok' : 'result result--bad'}>
        {flow?.outcome && word && (
          <>
            <h3 id="result-title" className="result__title">
              {flow.outcome.correct ? 'Correct ✓' : 'Not quite'}
            </h3>
            <p className="result__answer">
              <span lang="et">{word.estonian_word}</span> = <span lang="en">{word.english_word}</span>
            </p>
            {word.sentence_estonian && (
              <blockquote className="sentence">
                <p lang="et" className="sentence__et">
                  {word.sentence_estonian}
                </p>
                {word.sentence_english && (
                  <p lang="en" className="sentence__en">
                    {word.sentence_english}
                  </p>
                )}
              </blockquote>
            )}
            <div className="result__badges">
              {flow.outcome.correct ? (
                <>
                  <span className="badge badge--xp">
                    +{flow.outcome.xpGained} XP{flow.sureConfirmed && ' (sure bonus!)'}
                  </span>
                  {flow.outcome.learnedNow ? (
                    <span className="badge badge--learned pop">Learned! 🎉</span>
                  ) : (
                    <span className="badge">1/2: one more time to learn it</span>
                  )}
                </>
              ) : (
                <span className="badge">Streak back to 0/2. It will come back soon.</span>
              )}
            </div>
            <button type="button" className="btn btn--primary btn--block" data-autofocus onClick={onNext}>
              Next →
            </button>
          </>
        )}
      </Modal>
    </div>
  );
}

function EmptyState({ blocker }: { blocker: Exclude<Blocker, null> }) {
  const content = {
    empty: { emoji: '📄', title: 'Upload a CSV to start', text: 'Use the Upload CSV button in the dashboard. Try the 30-word sample.' },
    more: { emoji: '➕', title: 'Upload more words', text: 'You need at least 2 different words in your library to make a quiz.' },
    done: { emoji: '🏆', title: 'All words learned 🎉', text: 'Tubli! Upload more words to keep going.' },
    cap: { emoji: '🌙', title: 'Done for today 🎉, come back tomorrow', text: 'You hit your daily goal. Head aega! (Goodbye!)' },
  }[blocker];
  return (
    <div className="card empty pop" role="status">
      <p className="empty__emoji" aria-hidden="true">
        {content.emoji}
      </p>
      <h3 className="empty__title">{content.title}</h3>
      <p className="muted">{content.text}</p>
    </div>
  );
}
