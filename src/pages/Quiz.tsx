// 문제집 — 6가지 유형, 오답 선택지는 같은 level·같은 품사에서 출제
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSettings } from '../App'
import { loadDay, loadDays, trackOfDay } from '../lib/data'
import { bumpDailyLog, getState, putState } from '../lib/db'
import {
  buildQuiz, checkTypedAnswer, QUIZ_TYPE_LABELS,
  type QuizQuestion, type QuizType,
} from '../lib/quiz'
import { speak } from '../lib/tts'
import type { Word } from '../lib/types'

const COUNT = 10

export default function Quiz() {
  const nav = useNavigate()
  const location = useLocation()
  const { settings } = useSettings()
  const initialDay = (location.state as { day?: number } | null)?.day ?? settings.currentDay

  const [day, setDay] = useState(initialDay)
  const [scope, setScope] = useState<'day' | 'track'>('day')
  const [type, setType] = useState<QuizType | 'mix'>('mix')
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null)
  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  const [revealed, setRevealed] = useState<null | boolean>(null) // 입력형 채점 결과
  const [right, setRight] = useState(0)
  const [wrongWords, setWrongWords] = useState<Word[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const start = useCallback(async () => {
    const words = scope === 'day'
      ? await loadDay(day)
      : await loadDays(
          Array.from({ length: trackOfDay(day).to - trackOfDay(day).from + 1 },
            (_, i) => trackOfDay(day).from + i))
    const qs = await buildQuiz(words, COUNT, type === 'mix' ? undefined : type)
    setQuestions(qs)
    setIdx(0); setRight(0); setWrongWords([]); setPicked(null); setTyped(''); setRevealed(null)
  }, [day, scope, type])

  const q = questions?.[idx]

  // 듣기 문제는 표시되자마자 자동 재생
  useEffect(() => {
    if (q?.type === 'listening') void speak(q.word.word)
  }, [q])

  const record = useCallback(async (word: Word, ok: boolean) => {
    const st = await getState(word.id)
    await putState({
      ...st,
      quizRight: st.quizRight + (ok ? 1 : 0),
      quizWrong: st.quizWrong + (ok ? 0 : 1),
      updatedAt: Date.now(),
    })
    await bumpDailyLog(ok ? { quizRight: 1 } : { quizWrong: 1 })
  }, [])

  const next = useCallback(() => {
    setPicked(null); setTyped(''); setRevealed(null)
    setIdx((i) => i + 1)
  }, [])

  const answerChoice = (c: string) => {
    if (!q || picked) return
    setPicked(c)
    const ok = c === q.answer
    if (ok) setRight((r) => r + 1)
    else setWrongWords((w) => [...w, q.word])
    void record(q.word, ok)
    setTimeout(next, ok ? 600 : 1400)
  }

  const answerTyped = () => {
    if (!q || revealed !== null) return
    const ok = checkTypedAnswer(q, typed)
    setRevealed(ok)
    if (ok) setRight((r) => r + 1)
    else setWrongWords((w) => [...w, q.word])
    void record(q.word, ok)
    setTimeout(next, ok ? 700 : 1800)
  }

  // ---- 시작 화면 ----
  if (!questions) {
    return (
      <div className="page">
        <h1>문제집</h1>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>범위</h2>
          <div className="seg">
            <button className={scope === 'day' ? 'active' : ''} onClick={() => setScope('day')}>
              Day {day}
            </button>
            <button className={scope === 'track' ? 'active' : ''} onClick={() => setScope('track')}>
              {trackOfDay(day).label} 전체
            </button>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn sm ghost" onClick={() => setDay((d) => Math.max(1, d - 1))}>◀</button>
            <span style={{ flex: 1, textAlign: 'center', fontWeight: 700 }}>Day {day}</span>
            <button className="btn sm ghost" onClick={() => setDay((d) => Math.min(60, d + 1))}>▶</button>
          </div>
        </div>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>유형</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button className={`btn sm ${type === 'mix' ? 'primary' : 'ghost'}`}
              onClick={() => setType('mix')}>섞어서</button>
            {(Object.keys(QUIZ_TYPE_LABELS) as QuizType[]).map((t) => (
              <button key={t} className={`btn sm ${type === t ? 'primary' : 'ghost'}`}
                onClick={() => setType(t)}>
                {QUIZ_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
        <button className="btn primary" onClick={() => void start()}>10문제 시작</button>
      </div>
    )
  }

  // ---- 결과 화면 ----
  if (idx >= questions.length) {
    const pct = questions.length ? Math.round((right / questions.length) * 100) : 0
    return (
      <div className="page center">
        <div className="card" style={{ padding: 28 }}>
          <div style={{ fontSize: '2.4rem' }}>{pct >= 80 ? '🏆' : pct >= 50 ? '💪' : '📚'}</div>
          <h2>{right}/{questions.length} 정답 ({pct}%)</h2>
          {wrongWords.length > 0 && (
            <div className="mt8" style={{ textAlign: 'left' }}>
              <div className="dim small">틀린 단어</div>
              {wrongWords.map((w) => (
                <div key={w.id} className="row spread mt8">
                  <b>{w.word}</b>
                  <span className="dim small">{w.meanings[0]?.ko[0]}</span>
                </div>
              ))}
            </div>
          )}
          <button className="btn primary mt16" onClick={() => void start()}>다시 풀기</button>
          <button className="btn ghost mt8" onClick={() => setQuestions(null)}>범위·유형 바꾸기</button>
          <button className="btn mt8" onClick={() => nav('/')}>홈으로</button>
        </div>
      </div>
    )
  }

  const isTypedQuestion = q && (q.type === 'spelling' || q.type === 'listening' || q.type === 'example-blank')

  return (
    <div className="page">
      <div className="row spread">
        <button className="btn sm ghost" onClick={() => setQuestions(null)}>← 그만</button>
        <span className="badge primary">{q ? QUIZ_TYPE_LABELS[q.type] : ''}</span>
        <span className="dim small progress-text">{idx + 1}/{questions.length}</span>
      </div>

      {q && (
        <>
          <div className="card center" style={{ padding: 26 }}>
            {q.type === 'listening' ? (
              <>
                <button className="speak-btn" style={{ width: 64, height: 64, fontSize: '1.6rem' }}
                  onClick={() => void speak(q.word.word)}>🔊</button>
                <div className="dim small mt8">잘 듣고 단어를 입력하세요</div>
              </>
            ) : q.type === 'word-to-meaning' ? (
              <div style={{ fontSize: '2rem', fontWeight: 800 }}>{q.prompt}</div>
            ) : (
              <div style={{ fontSize: q.type === 'example-blank' ? '1.15rem' : '1.4rem', fontWeight: 700, lineHeight: 1.5 }}>
                {q.prompt}
              </div>
            )}
            {q.type === 'example-blank' && q.hint && (
              <div className="dim small mt8">{q.hint}</div>
            )}
            {q.type === 'spelling' && q.hint && (
              <div className="dim small mt8">힌트: {q.hint}</div>
            )}
          </div>

          {isTypedQuestion ? (
            <>
              <input ref={inputRef} className="answer-input" value={typed} autoFocus
                autoCapitalize="none" autoCorrect="off" spellCheck={false}
                placeholder="정답 입력"
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && answerTyped()} />
              {revealed === null ? (
                <button className="btn primary mt8" onClick={answerTyped} disabled={!typed.trim()}>
                  확인
                </button>
              ) : (
                <div className={`card center mt8 ${revealed ? '' : ''}`}
                  style={{ background: revealed ? 'var(--ok-soft)' : 'var(--bad-soft)' }}>
                  {revealed ? '⭕ 정답!' : <>❌ 정답: <b>{q.answer}</b></>}
                </div>
              )}
            </>
          ) : (
            q.choices.map((c) => (
              <button key={c} disabled={!!picked}
                className={`choice ${picked && c === q.answer ? 'correct' : ''} ${picked === c && c !== q.answer ? 'wrong' : ''}`}
                onClick={() => answerChoice(c)}>
                {c}
              </button>
            ))
          )}
        </>
      )}
    </div>
  )
}
