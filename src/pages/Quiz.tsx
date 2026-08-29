// 문제집 — 6가지 유형, 오답 선택지는 같은 level·같은 품사에서 출제
// 문제 수 선택(10/20/30) · ◀▶ 빠른 이동 · 오늘의 테스트(50문제) · 진단 테스트 입구
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSettings } from '../App'
import { LoadFailed } from '../components/LoadState'
import { loadDay, loadDays, trackOfDay } from '../lib/data'
import { bumpDailyLog, getState, putState, saveDailyTestScore } from '../lib/db'
import {
  buildQuiz, checkTypedAnswer, countAvailable, QUIZ_TYPE_LABELS,
  type QuizQuestion, type QuizType,
} from '../lib/quiz'
import { speak } from '../lib/tts'
import { useAsync } from '../lib/useAsync'
import type { Word } from '../lib/types'

const COUNTS = [10, 20, 30] as const

/** 문제별 결과 — 뒤로 돌아가 확인할 수 있게 보관 */
interface QResult {
  picked: string // 고른 선택지 또는 입력한 답 ('(건너뜀)' 포함)
  ok: boolean
}

export default function Quiz() {
  const nav = useNavigate()
  const location = useLocation()
  const { settings } = useSettings()
  const initial = location.state as
    | { day?: number; count?: number; autostart?: boolean; daily?: boolean }
    | null
  const initialDay = initial?.day ?? settings.currentDay

  const [day, setDay] = useState(initialDay)
  const [scope, setScope] = useState<'day' | 'track'>('day')
  const [type, setType] = useState<QuizType | 'mix'>('mix')
  const [count, setCount] = useState<number>(10)
  const [daily, setDaily] = useState(false) // 오늘의 테스트 모드 표시용
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null)
  const [loadError, setLoadError] = useState<Error | null>(null)
  const [starting, setStarting] = useState(false)
  const [idx, setIdx] = useState(0)
  const [results, setResults] = useState<(QResult | null)[]>([])
  const [typed, setTyped] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<number | null>(null)

  /** 현재 범위의 단어 (유형별 가능한 문제 수를 미리 보여주기 위해 읽어 둔다) */
  const scopeWords = useAsync(async () => {
    if (scope === 'day') return loadDay(day)
    const t = trackOfDay(day)
    return loadDays(Array.from({ length: t.to - t.from + 1 }, (_, i) => t.from + i))
  }, [day, scope])

  /** 유형별로 이 범위에서 만들 수 있는 문제 수 (mix는 단어 수) */
  const capacity = useMemo(() => {
    const ws = scopeWords.data
    if (!ws) return null
    const m = { mix: ws.length } as Record<QuizType | 'mix', number>
    for (const t of Object.keys(QUIZ_TYPE_LABELS) as QuizType[]) m[t] = countAvailable(ws, t)
    return m
  }, [scopeWords.data])

  /** 지금 고른 유형으로 실제 출제될 문제 수 */
  const actualCount = capacity ? Math.min(count, capacity[type]) : count

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }
  useEffect(() => clearTimer, [])

  const start = useCallback(async (n?: number, isDaily = false) => {
    setStarting(true)
    setLoadError(null)
    try {
    const words = scope === 'day' || isDaily
      ? await loadDay(day)
      : await loadDays(
          Array.from({ length: trackOfDay(day).to - trackOfDay(day).from + 1 },
            (_, i) => trackOfDay(day).from + i))
    const qs = await buildQuiz(words, n ?? count, type === 'mix' ? undefined : type)
    clearTimer()
    savedDaily.current = false
    setDaily(isDaily)
    setQuestions(qs)
    setResults(Array(qs.length).fill(null))
    setIdx(0); setTyped('')
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setStarting(false)
    }
  }, [day, scope, type, count])

  // 오늘의 테스트 완료 시 날짜별 점수 기록 (통계·홈 표시용)
  const savedDaily = useRef(false)
  useEffect(() => {
    if (daily && questions && questions.length > 0 && idx >= questions.length && !savedDaily.current) {
      savedDaily.current = true
      const right = results.filter((r) => r?.ok).length
      void saveDailyTestScore({ day, right, total: questions.length })
    }
  }, [daily, questions, idx, results, day])

  // 홈 '오늘의 테스트'에서 넘어오면 바로 시작
  const autostarted = useRef(false)
  useEffect(() => {
    if (initial?.autostart && !autostarted.current) {
      autostarted.current = true
      void start(initial.count ?? 50, initial.daily ?? false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const q = questions?.[idx]
  const answered = results[idx] ?? null

  // 듣기 문제는 (아직 안 푼 경우) 표시되자마자 자동 재생
  useEffect(() => {
    if (q?.type === 'listening' && !answered) void speak(q.word.word)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  /** idx를 이동 (자동 넘김 타이머가 있으면 취소) */
  const go = useCallback((delta: number) => {
    clearTimer()
    setTyped('')
    setIdx((i) => Math.max(0, Math.min((questions?.length ?? 0), i + delta)))
  }, [questions])

  /** 답을 확정하고 결과 기록 후 잠시 뒤 다음으로 */
  const finish = useCallback((picked: string, ok: boolean) => {
    if (!q || answered) return
    setResults((r) => { const nr = [...r]; nr[idx] = { picked, ok }; return nr })
    void record(q.word, ok)
    clearTimer()
    timerRef.current = window.setTimeout(() => go(1), ok ? 600 : 1400)
  }, [q, answered, idx, record, go])

  const answerChoice = (c: string) => finish(c, c === (q?.answer ?? ''))
  const answerTyped = () => {
    if (!q || answered || !typed.trim()) return
    finish(typed, checkTypedAnswer(q, typed))
  }

  /** ▶ 다음 — 안 푼 문제는 건너뛰기(오답 처리) */
  const goNext = () => {
    if (!answered && q) {
      setResults((r) => { const nr = [...r]; nr[idx] = { picked: '(건너뜀)', ok: false }; return nr })
      void record(q.word, false)
    }
    go(1)
  }

  if (loadError) {
    return (
      <LoadFailed what="문제집 단어" onRetry={() => { setLoadError(null); void start() }}>
        <button className="btn ghost mt8" onClick={() => nav('/')}>홈으로</button>
      </LoadFailed>
    )
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
          <h2 style={{ marginTop: 0 }}>문제 수</h2>
          <div className="seg">
            {COUNTS.map((n) => (
              <button key={n} className={count === n ? 'active' : ''} onClick={() => setCount(n)}>
                {n}문제
              </button>
            ))}
          </div>
        </div>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>유형</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button className={`btn sm ${type === 'mix' ? 'primary' : 'ghost'}`}
              onClick={() => setType('mix')}>섞어서</button>
            {(Object.keys(QUIZ_TYPE_LABELS) as QuizType[]).map((t) => {
              const max = capacity?.[t]
              // 이 범위에서 문제를 아예 만들 수 없는 유형은 고를 수 없게 한다
              const unavailable = max === 0
              return (
                <button key={t} disabled={unavailable}
                  className={`btn sm type-btn ${type === t ? 'primary' : 'ghost'}`}
                  onClick={() => setType(t)}>
                  <span>{QUIZ_TYPE_LABELS[t]}</span>
                  {max !== undefined && max < count && (
                    <span className="type-max">{max === 0 ? '없음' : `${max}문제`}</span>
                  )}
                </button>
              )
            })}
          </div>
          {capacity && actualCount < count && (
            <div className="dim small mt8">
              이 범위에서 <b>{QUIZ_TYPE_LABELS[type as QuizType] ?? '섞어서'}</b> 유형은
              {' '}<b>{actualCount}문제</b>까지 만들 수 있어요.
              {actualCount === 0 && ' 다른 범위나 유형을 골라 주세요.'}
            </div>
          )}
        </div>
        <button className="btn primary" onClick={() => void start()}
          disabled={starting || actualCount === 0}>
          {starting ? '문제 준비 중…' : `${actualCount}문제 시작`}
        </button>

        {/* 추가 기능: 진단 테스트 (홈에서 이동해 옴) */}
        <div className="card row spread mt16">
          <div>
            <b>진단 테스트</b>
            <div className="dim small">30문항으로 시작 Day 추천받기</div>
          </div>
          <button className="btn sm primary" onClick={() => nav('/diagnostic')}>시작</button>
        </div>
      </div>
    )
  }

  // ---- 결과 화면 ----
  const right = results.filter((r) => r?.ok).length
  if (idx >= questions.length) {
    const wrongWords = questions.filter((_, i) => results[i] && !results[i]!.ok).map((qq) => qq.word)
    const pct = questions.length ? Math.round((right / questions.length) * 100) : 0
    return (
      <div className="page center">
        <div className="card" style={{ padding: 28 }}>
          <div style={{ fontSize: '2.4rem' }}>{pct >= 80 ? '🏆' : pct >= 50 ? '💪' : '📚'}</div>
          {daily && <div className="badge primary">오늘의 테스트 · Day {day}</div>}
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
          <button className="btn primary mt16" onClick={() => void start(questions.length, daily)}>다시 풀기</button>
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
        <span className="badge primary">
          {daily ? '오늘의 테스트 · ' : ''}{q ? QUIZ_TYPE_LABELS[q.type] : ''}
        </span>
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
            answered ? (
              <div className="card center mt8"
                style={{ background: answered.ok ? 'var(--ok-soft)' : 'var(--bad-soft)' }}>
                {answered.ok
                  ? '⭕ 정답!'
                  : <>❌ {answered.picked === '(건너뜀)' ? '건너뜀' : <>입력: {answered.picked}</>} · 정답: <b>{q.answer}</b></>}
              </div>
            ) : (
              <>
                <input ref={inputRef} className="answer-input" value={typed} autoFocus
                  autoCapitalize="none" autoCorrect="off" spellCheck={false}
                  placeholder="정답 입력"
                  onChange={(e) => setTyped(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && answerTyped()} />
                <button className="btn primary mt8" onClick={answerTyped} disabled={!typed.trim()}>
                  확인
                </button>
              </>
            )
          ) : (
            q.choices.map((c) => (
              <button key={c} disabled={!!answered}
                className={`choice ${answered && c === q.answer ? 'correct' : ''} ${answered?.picked === c && c !== q.answer ? 'wrong' : ''}`}
                onClick={() => answerChoice(c)}>
                {c}
              </button>
            ))
          )}

          {/* 좌우 빠른 이동 — 이전 문제 결과 확인 / 다음으로 즉시 이동(안 풀면 건너뜀 처리) */}
          <div className="quiz-nav">
            <button className="btn sm ghost" onClick={() => go(-1)} disabled={idx === 0}>
              ◀ 이전
            </button>
            <span className="dim small">
              {answered ? (answered.ok ? '⭕ 맞힘' : '❌ 틀림') : '풀지 않고 넘기면 오답 처리'}
            </span>
            <button className="btn sm ghost" onClick={goNext}>
              {answered ? '다음 ▶' : '건너뛰기 ▶'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
