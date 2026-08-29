// 진단 테스트 — 각 등급 10문항(총 30), 정답률로 시작 Day 추천
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettings } from '../App'
import { loadIndex, sample, shuffled, TRACKS } from '../lib/data'
import { useAsync } from '../lib/useAsync'
import { Loading, LoadFailed } from '../components/LoadState'
import type { IndexWord, Level } from '../lib/types'

interface DiagQuestion {
  word: IndexWord
  choices: string[] // 한국어 뜻 4개
  answer: string
}

const PER_LEVEL = 10

export default function Diagnostic() {
  const nav = useNavigate()
  const { update } = useSettings()
  const [questions, setQuestions] = useState<DiagQuestion[]>([])
  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [rightByLevel, setRightByLevel] = useState<Record<Level, number>>({
    초등: 0, 중고공통: 0, 선택: 0,
  })
  const [done, setDone] = useState(false)

  const { data: index, loading, error, retry } = useAsync(() => loadIndex(), [])

  useEffect(() => {
    if (!index) return
    const qs: DiagQuestion[] = []
    for (const t of TRACKS) {
      const pool = index.words.filter((w) => w.l === t.level && w.ko)
      for (const w of sample(pool, PER_LEVEL)) {
        const wrong = sample(pool.filter((x) => x.id !== w.id && x.ko !== w.ko), 3).map((x) => x.ko)
        if (wrong.length < 3) continue
        qs.push({ word: w, choices: shuffled([w.ko, ...wrong]), answer: w.ko })
      }
    }
    setQuestions(qs)
  }, [index])

  const q = questions[idx] as DiagQuestion | undefined

  const pick = (choice: string) => {
    if (!q || picked) return
    setPicked(choice)
    if (choice === q.answer) {
      setRightByLevel((r) => ({ ...r, [q.word.l]: r[q.word.l] + 1 }))
    }
    setTimeout(() => {
      setPicked(null)
      if (idx + 1 >= questions.length) setDone(true)
      else setIdx(idx + 1)
    }, 550)
  }

  // 정답률 기반 시작 Day 추천
  const recommend = useMemo(() => {
    const e = rightByLevel['초등'] / PER_LEVEL
    const m = rightByLevel['중고공통'] / PER_LEVEL
    const a = rightByLevel['선택'] / PER_LEVEL
    // 초등을 충분히 모르면 Day 1부터, 등급별 정답률에 따라 트랙 안에서 위치 추천
    if (e < 0.7) return Math.max(1, Math.round(e * 16) || 1)
    if (m < 0.7) return 17 + Math.round(m * 23)
    if (a < 0.6) return 41 + Math.round(a * 19)
    return 41 // 모두 우수 → 심화 트랙 처음부터 빠르게 복습 권장
  }, [rightByLevel])

  if (error) {
    return (
      <LoadFailed what="진단 테스트 문제" onRetry={retry}>
        <button className="btn ghost mt8" onClick={() => nav('/')}>홈으로</button>
      </LoadFailed>
    )
  }
  if (loading || !questions.length) return <Loading label="문제 준비 중…" />

  if (done) {
    return (
      <div className="page">
        <h1>진단 결과</h1>
        <div className="card">
          {TRACKS.map((t) => (
            <div className="bar-row" key={t.level}>
              <span style={{ width: 76 }}>{t.label}</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${(rightByLevel[t.level] / PER_LEVEL) * 100}%` }} />
              </div>
              <span className="progress-text">{rightByLevel[t.level]}/{PER_LEVEL}</span>
            </div>
          ))}
        </div>
        <div className="card center">
          <div className="dim small">추천 시작 위치</div>
          <h2 style={{ fontSize: '1.6rem', margin: '6px 0' }}>Day {recommend}</h2>
          <button className="btn primary mt8" onClick={() => {
            update({ startDay: recommend, currentDay: recommend })
            nav(`/learn/${recommend}`)
          }}>
            Day {recommend}부터 시작하기
          </button>
          <button className="btn ghost mt8" onClick={() => nav('/')}>홈으로</button>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="row spread">
        <button className="btn sm ghost" onClick={() => nav('/')}>← 그만두기</button>
        <span className="dim small progress-text">{idx + 1}/{questions.length}</span>
      </div>
      {q && (
        <>
          <div className="card center" style={{ padding: 28 }}>
            <span className="badge">{q.word.l}</span>
            <div style={{ fontSize: '2rem', fontWeight: 800, margin: '10px 0' }}>{q.word.w}</div>
            <div className="dim small">알맞은 뜻을 고르세요</div>
          </div>
          {q.choices.map((c) => (
            <button key={c} disabled={!!picked}
              className={`choice ${picked && c === q.answer ? 'correct' : ''} ${picked === c && c !== q.answer ? 'wrong' : ''}`}
              onClick={() => pick(c)}>
              {c}
            </button>
          ))}
        </>
      )}
    </div>
  )
}
