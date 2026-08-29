// 복습 — 간격 반복 due 큐 + 7일마다 누적 테스트(100문항, 80% 미만 재시험 안내)
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettings } from '../App'
import { Loading, LoadFailed } from '../components/LoadState'
import WordCard from '../components/WordCard'
import { loadWordsByIds } from '../lib/data'
import { bumpDailyLog, getAllStates, getDueStates, getMeta, putState, setMeta } from '../lib/db'
import { applyGrade, type Grade } from '../lib/srs'
import { buildQuiz, checkTypedAnswer, type QuizQuestion } from '../lib/quiz'
import { speak } from '../lib/tts'
import type { Word } from '../lib/types'

const CUMUL_COUNT = 100
const CUMUL_INTERVAL_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000

export default function Review() {
  const nav = useNavigate()
  const { settings } = useSettings()
  const [dueWords, setDueWords] = useState<Word[] | null>(null)
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [mode, setMode] = useState<'queue' | 'cumulative'>('queue')

  // 누적 테스트 상태
  const [lastCumulAt, setLastCumulAt] = useState(0)
  const [lastCumulScore, setLastCumulScore] = useState<number | null>(null)
  const [cumulQs, setCumulQs] = useState<QuizQuestion[] | null>(null)
  const [cIdx, setCIdx] = useState(0)
  const [cRight, setCRight] = useState(0)
  const [cPicked, setCPicked] = useState<string | null>(null)
  const [cTyped, setCTyped] = useState('')
  const [cRevealed, setCRevealed] = useState<null | boolean>(null)

  const [loadError, setLoadError] = useState<Error | null>(null)

  const reload = useCallback(async () => {
    const due = await getDueStates()
    setDueWords(await loadWordsByIds(due.map((s) => s.id)))
    setIdx(0)
    setFlipped(false)
    setLastCumulAt(await getMeta('lastCumulativeAt', 0))
    setLastCumulScore(await getMeta<number | null>('lastCumulativeScore', null))
  }, [])

  useEffect(() => { void reload().catch((e: unknown) => setLoadError(e instanceof Error ? e : new Error(String(e)))) }, [reload])

  const current = dueWords?.[idx]

  const grade = useCallback(async (g: Grade) => {
    if (!current || !dueWords) return
    const states = await getAllStates()
    const st = states.find((s) => s.id === current.id)
    if (st) {
      await putState(applyGrade(st, g))
      await bumpDailyLog({ reviewed: 1 })
    }
    setFlipped(false)
    setIdx((i) => i + 1)
  }, [current, dueWords])

  // ---- 누적 테스트 ----
  const cumulDueIn = lastCumulAt ? lastCumulAt + CUMUL_INTERVAL_DAYS * DAY_MS - Date.now() : 0
  const cumulAvailable = cumulDueIn <= 0

  const startCumulative = async () => {
    const states = await getAllStates()
    const seen = states.filter((s) => s.status !== 'unseen')
    const words = await loadWordsByIds(seen.map((s) => s.id))
    if (words.length < 10) return
    setCumulQs(await buildQuiz(words, Math.min(CUMUL_COUNT, words.length)))
    setCIdx(0); setCRight(0); setCPicked(null); setCTyped(''); setCRevealed(null)
  }

  const cq = cumulQs?.[cIdx]

  useEffect(() => {
    if (cq?.type === 'listening') void speak(cq.word.word)
  }, [cq])

  const finishCumulative = async (right: number, total: number) => {
    const pct = Math.round((right / total) * 100)
    await setMeta('lastCumulativeAt', Date.now())
    await setMeta('lastCumulativeScore', pct)
    setLastCumulAt(Date.now())
    setLastCumulScore(pct)
  }

  const cumulNext = (ok: boolean) => {
    if (!cumulQs) return
    const newRight = cRight + (ok ? 1 : 0)
    setCRight(newRight)
    setCPicked(null); setCTyped(''); setCRevealed(null)
    if (cIdx + 1 >= cumulQs.length) {
      void finishCumulative(newRight, cumulQs.length)
    }
    setCIdx((i) => i + 1)
  }

  const cumulChoice = (c: string) => {
    if (!cq || cPicked) return
    setCPicked(c)
    setTimeout(() => cumulNext(c === cq.answer), c === cq.answer ? 450 : 1200)
  }

  const cumulTyped = () => {
    if (!cq || cRevealed !== null) return
    const ok = checkTypedAnswer(cq, cTyped)
    setCRevealed(ok)
    setTimeout(() => cumulNext(ok), ok ? 550 : 1500)
  }

  if (loadError) {
    return (
      <LoadFailed what="복습할 단어" onRetry={() => { setLoadError(null); void reload().catch((e: unknown) => setLoadError(e instanceof Error ? e : new Error(String(e)))) }}>
        <button className="btn ghost mt8" onClick={() => nav('/')}>홈으로</button>
      </LoadFailed>
    )
  }
  if (dueWords === null) return <Loading />

  // ---- 누적 테스트 진행 화면 ----
  if (mode === 'cumulative' && cumulQs) {
    if (cIdx >= cumulQs.length) {
      const pct = Math.round((cRight / cumulQs.length) * 100)
      return (
        <div className="page center">
          <div className="card" style={{ padding: 28 }}>
            <div style={{ fontSize: '2.4rem' }}>{pct >= 80 ? '🏆' : '📚'}</div>
            <h2>누적 테스트 {cRight}/{cumulQs.length} ({pct}%)</h2>
            {pct < 80 ? (
              <p className="dim small mt8">
                80%가 안 됐어요. 오답 노트와 복습 큐를 정리한 뒤<br />
                <b>재시험</b>을 봐 주세요!
              </p>
            ) : (
              <p className="dim small mt8">훌륭해요! 다음 누적 테스트는 7일 후에 열려요.</p>
            )}
            {pct < 80 && (
              <button className="btn warn mt16" onClick={() => void startCumulative()}>재시험 보기</button>
            )}
            <button className="btn ghost mt8" onClick={() => { setCumulQs(null); setMode('queue') }}>
              복습으로 돌아가기
            </button>
          </div>
        </div>
      )
    }
    return (
      <div className="page">
        <div className="row spread">
          <button className="btn sm ghost" onClick={() => { setCumulQs(null); setMode('queue') }}>← 중단</button>
          <span className="dim small progress-text">{cIdx + 1}/{cumulQs.length}</span>
        </div>
        {cq && (
          <>
            <div className="card center" style={{ padding: 24 }}>
              {cq.type === 'listening' ? (
                <button className="speak-btn" style={{ width: 60, height: 60, fontSize: '1.5rem' }}
                  onClick={() => void speak(cq.word.word)}>🔊</button>
              ) : (
                <div style={{ fontSize: cq.type === 'example-blank' ? '1.1rem' : '1.5rem', fontWeight: 800, lineHeight: 1.5 }}>
                  {cq.prompt}
                </div>
              )}
            </div>
            {cq.choices.length ? (
              cq.choices.map((c) => (
                <button key={c} disabled={!!cPicked}
                  className={`choice ${cPicked && c === cq.answer ? 'correct' : ''} ${cPicked === c && c !== cq.answer ? 'wrong' : ''}`}
                  onClick={() => cumulChoice(c)}>
                  {c}
                </button>
              ))
            ) : (
              <>
                <input className="answer-input" value={cTyped} autoFocus
                  autoCapitalize="none" autoCorrect="off" spellCheck={false}
                  onChange={(e) => setCTyped(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && cumulTyped()} />
                {cRevealed === null ? (
                  <button className="btn primary mt8" onClick={cumulTyped} disabled={!cTyped.trim()}>확인</button>
                ) : (
                  <div className="card center mt8"
                    style={{ background: cRevealed ? 'var(--ok-soft)' : 'var(--bad-soft)' }}>
                    {cRevealed ? '⭕ 정답!' : <>❌ 정답: <b>{cq.answer}</b></>}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    )
  }

  // ---- 복습 큐 화면 ----
  const remaining = dueWords.length - idx

  return (
    <div className="page">
      <h1>복습</h1>

      {remaining > 0 && current ? (
        <>
          <div className="row spread" style={{ marginBottom: 8 }}>
            <span className="badge primary">오늘 복습 대기 {remaining}개</span>
            <span className="dim small progress-text">{idx + 1}/{dueWords.length}</span>
          </div>
          <WordCard word={current} direction={settings.direction}
            flipped={flipped} onFlip={() => setFlipped((f) => !f)} />
          <div className="grade-bar">
            <button className="btn bad" onClick={() => void grade('no')}>모름</button>
            <button className="btn warn" onClick={() => void grade('fuzzy')}>헷갈림</button>
            <button className="btn ok" onClick={() => void grade('know')}>앎</button>
          </div>
          <p className="dim small center mt8">모름 → 1일 · 헷갈림 → 3일 · 앎 → 7일 → 30일 간격으로 다시 나와요</p>
        </>
      ) : (
        <div className="card center">
          {dueWords.length === 0 ? (
            <>🎉 오늘 복습할 카드가 없어요!<div className="dim small mt8">학습을 진행하면 여기에 복습 카드가 쌓입니다.</div></>
          ) : (
            <>✅ 오늘 복습을 모두 마쳤어요!</>
          )}
          <button className="btn ghost mt16" onClick={() => nav('/')}>홈으로</button>
        </div>
      )}

      {/* 누적 테스트 카드 */}
      <div className="card mt16">
        <div className="row spread">
          <div>
            <b>누적 테스트</b>
            <div className="dim small">
              7일마다 100문항 · 80% 미만이면 재시험
              {lastCumulScore !== null && <> · 지난 점수 {lastCumulScore}%</>}
            </div>
          </div>
          {cumulAvailable ? (
            <button className="btn sm primary"
              onClick={() => { setMode('cumulative'); void startCumulative() }}>
              시작
            </button>
          ) : (
            <span className="badge">{Math.ceil(cumulDueIn / DAY_MS)}일 후</span>
          )}
        </div>
      </div>
    </div>
  )
}
