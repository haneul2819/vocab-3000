// 통계 — 오늘의 테스트 기록, Day별 정답률, 상태 분포, 연속 학습일
import { useEffect, useMemo, useState } from 'react'
import { loadIndex } from '../lib/data'
import {
  getAllStates, getDailyLogs, getDailyTestScores, getStreak, type DailyTestScore,
} from '../lib/db'
import type { DataIndex, WordState, WordStatus } from '../lib/types'

const STATUS_LABELS: Record<WordStatus, string> = {
  unseen: '미학습', learning: '학습중', confused: '헷갈림', mastered: '완료',
}
const STATUS_COLORS: Record<WordStatus, string> = {
  unseen: 'var(--text-dim)', learning: 'var(--primary)',
  confused: 'var(--warn)', mastered: 'var(--ok)',
}

export default function Stats() {
  const [index, setIndex] = useState<DataIndex | null>(null)
  const [indexError, setIndexError] = useState(false)
  const [states, setStates] = useState<WordState[]>([])
  const [streak, setStreak] = useState(0)
  const [totalDays, setTotalDays] = useState(0)
  const [testScores, setTestScores] = useState<[string, DailyTestScore][]>([])

  useEffect(() => {
    loadIndex().then(setIndex).catch(() => setIndexError(true))
    getAllStates().then(setStates)
    getStreak().then(setStreak)
    getDailyLogs().then((l) => setTotalDays(Object.keys(l).length))
    getDailyTestScores().then((s) =>
      setTestScores(Object.entries(s).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 14)))
  }, [])

  const stateMap = useMemo(() => new Map(states.map((s) => [s.id, s])), [states])

  // 상태 분포
  const statusCount = useMemo(() => {
    const c: Record<WordStatus, number> = { unseen: 0, learning: 0, confused: 0, mastered: 0 }
    if (!index) return c
    for (const w of index.words) {
      const st = stateMap.get(w.id)
      c[st?.status ?? 'unseen'] += 1
    }
    return c
  }, [index, stateMap])

  // Day별 문제집 정답률
  const dayStats = useMemo(() => {
    if (!index) return []
    const byDay = new Map<number, { right: number; wrong: number; seen: number; total: number }>()
    for (const w of index.words) {
      const cur = byDay.get(w.d) ?? { right: 0, wrong: 0, seen: 0, total: 0 }
      cur.total += 1
      const st = stateMap.get(w.id)
      if (st) {
        cur.right += st.quizRight
        cur.wrong += st.quizWrong
        if (st.status !== 'unseen') cur.seen += 1
      }
      byDay.set(w.d, cur)
    }
    return [...byDay.entries()]
      .sort((a, b) => a[0] - b[0])
      .filter(([, v]) => v.seen > 0 || v.right + v.wrong > 0)
  }, [index, stateMap])

  const total = index?.words.length ?? 3000

  return (
    <div className="page">
      <h1>통계</h1>
      {indexError && (
        <div className="card" role="alert" style={{ borderColor: 'var(--bad)' }}>
          <b>통계 데이터를 불러오지 못했어요</b>
          <div className="dim small mt8">수치가 실제와 다를 수 있습니다.</div>
          <button className="btn sm mt8" onClick={() => location.reload()}>새로고침</button>
        </div>
      )}


      <div className="stat-grid">
        <div className="card center">
          <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>🔥 {streak}</div>
          <div className="dim small">연속 학습일</div>
        </div>
        <div className="card center">
          <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{totalDays}</div>
          <div className="dim small">총 학습일</div>
        </div>
      </div>

      {testScores.length > 0 && (
        <>
          <h2>오늘의 테스트 기록</h2>
          <div className="card">
            {testScores.map(([date, s]) => {
              const pct = s.total ? Math.round((s.right / s.total) * 100) : 0
              return (
                <div className="bar-row" key={date}>
                  <span style={{ width: 76 }} className="small">{date.slice(5)}</span>
                  <div className="bar-track">
                    <div className="bar-fill" style={{
                      width: `${pct}%`,
                      background: pct >= 80 ? 'var(--ok)' : pct >= 50 ? 'var(--primary)' : 'var(--warn)',
                    }} />
                  </div>
                  <span className="progress-text small" style={{ width: 96, textAlign: 'right' }}>
                    Day {s.day} · {s.right}/{s.total}
                  </span>
                </div>
              )
            })}
            <div className="dim small mt8">최근 14일 · 같은 날 여러 번 풀면 마지막 점수</div>
          </div>
        </>
      )}

      <h2>단어 상태 분포</h2>
      <div className="card">
        {/* 누적 막대 */}
        <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden' }}>
          {(Object.keys(STATUS_LABELS) as WordStatus[]).map((s) =>
            statusCount[s] > 0 ? (
              <div key={s} style={{
                width: `${(statusCount[s] / total) * 100}%`,
                background: STATUS_COLORS[s],
              }} />
            ) : null)}
        </div>
        <div className="mt8">
          {(Object.keys(STATUS_LABELS) as WordStatus[]).map((s) => (
            <div className="bar-row" key={s}>
              <span style={{
                width: 10, height: 10, borderRadius: 5, background: STATUS_COLORS[s], display: 'inline-block',
              }} />
              <span style={{ width: 64 }}>{STATUS_LABELS[s]}</span>
              <div className="bar-track">
                <div className="bar-fill" style={{
                  width: `${(statusCount[s] / total) * 100}%`, background: STATUS_COLORS[s],
                }} />
              </div>
              <span className="progress-text small">{statusCount[s]}</span>
            </div>
          ))}
        </div>
      </div>

      <h2>Day별 학습·정답률</h2>
      {dayStats.length === 0 ? (
        <div className="card center dim">아직 기록이 없어요. 학습과 문제집을 진행해 보세요!</div>
      ) : (
        <div className="card">
          {dayStats.map(([day, v]) => {
            const attempts = v.right + v.wrong
            const pct = attempts ? Math.round((v.right / attempts) * 100) : null
            return (
              <div className="bar-row" key={day}>
                <span style={{ width: 56 }}>Day {day}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{
                    width: `${(v.seen / v.total) * 100}%`,
                  }} />
                </div>
                <span className="progress-text small" style={{ width: 86, textAlign: 'right' }}>
                  {v.seen}/{v.total}{pct !== null && <> · {pct}%</>}
                </span>
              </div>
            )
          })}
          <div className="dim small mt8">막대: 학습한 단어 비율 · %: 문제집 정답률</div>
        </div>
      )}
    </div>
  )
}
