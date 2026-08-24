import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSettings } from '../App'
import ProgressRing from '../components/ProgressRing'
import { loadIndex, TRACKS, trackOfDay } from '../lib/data'
import { getAllStates, getDueStates, getStreak } from '../lib/db'
import type { DataIndex, Level, WordState } from '../lib/types'

export default function Home() {
  const { settings } = useSettings()
  const nav = useNavigate()
  const [index, setIndex] = useState<DataIndex | null>(null)
  const [states, setStates] = useState<Map<number, WordState>>(new Map())
  const [dueCount, setDueCount] = useState(0)
  const [streak, setStreak] = useState(0)
  const [openTrack, setOpenTrack] = useState<Level | null>(null)

  useEffect(() => {
    loadIndex().then(setIndex)
    getAllStates().then((all) => setStates(new Map(all.map((s) => [s.id, s]))))
    getDueStates().then((d) => setDueCount(d.length))
    getStreak().then(setStreak)
  }, [])

  const day = settings.currentDay
  const track = trackOfDay(day)

  // Day별 진행률 (mastered 또는 learning 이상 상태 단어 비율)
  const dayProgress = useMemo(() => {
    if (!index) return new Map<number, { done: number; total: number }>()
    const m = new Map<number, { done: number; total: number }>()
    for (const w of index.words) {
      const cur = m.get(w.d) ?? { done: 0, total: 0 }
      cur.total += 1
      const st = states.get(w.id)
      if (st && st.status !== 'unseen') cur.done += 1
      m.set(w.d, cur)
    }
    return m
  }, [index, states])

  const today = dayProgress.get(day) ?? { done: 0, total: 50 }

  return (
    <div className="page">
      <div className="row spread">
        <h1>기본 어휘 3000</h1>
        <Link to="/settings" aria-label="설정" style={{ fontSize: '1.3rem' }}>⚙️</Link>
      </div>

      {/* 오늘 학습 카드 */}
      <div className="card">
        <div className="row spread">
          <div>
            <span className="badge primary">{track.label}</span>
            <h2 style={{ margin: '8px 0 4px' }}>오늘 학습 · Day {day}</h2>
            <div className="dim small">
              {today.done}/{today.total} 단어 학습
              {streak > 0 && <> · 🔥 연속 {streak}일</>}
            </div>
          </div>
          <ProgressRing value={today.total ? today.done / today.total : 0} />
        </div>
        <div className="row mt16" style={{ gap: 8 }}>
          <button className="btn primary" onClick={() => nav(`/learn/${day}`)}>
            학습 시작
          </button>
        </div>
        <button className="btn ghost mt8" onClick={() => nav('/review')}>
          오늘 복습 대기 <b>{dueCount}</b>개
        </button>
      </div>

      {/* 진단 테스트 */}
      <div className="card row spread">
        <div>
          <b>진단 테스트</b>
          <div className="dim small">30문항으로 시작 Day 추천받기</div>
        </div>
        <button className="btn sm primary" onClick={() => nav('/diagnostic')}>시작</button>
      </div>

      {/* 트랙 선택 */}
      <h2>트랙 선택</h2>
      {TRACKS.map((t) => {
        const days = index?.days.filter((d) => d.level === t.level) ?? []
        const done = days.reduce((acc, d) => acc + (dayProgress.get(d.day)?.done ?? 0), 0)
        const total = days.reduce((acc, d) => acc + d.count, 0)
        const open = openTrack === t.level
        return (
          <div className="card" key={t.level}>
            <button className="row spread" style={{ width: '100%' }}
              onClick={() => setOpenTrack(open ? null : t.level)}>
              <div style={{ textAlign: 'left' }}>
                <b>{t.label}</b>
                <div className="dim small">Day {t.from}–{t.to} · {done}/{total} 단어</div>
              </div>
              <span className="dim">{open ? '▲' : '▼'}</span>
            </button>
            {open && (
              <div className="mt8" style={{
                display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6,
              }}>
                {days.map((d) => {
                  const p = dayProgress.get(d.day)
                  const ratio = p && p.total ? p.done / p.total : 0
                  return (
                    <button key={d.day} onClick={() => nav(`/learn/${d.day}`)}
                      style={{
                        padding: '9px 0', borderRadius: 10, fontWeight: 700, fontSize: '0.82rem',
                        background: ratio >= 1 ? 'var(--ok-soft)' : ratio > 0 ? 'var(--primary-soft)' : 'var(--surface-2)',
                        color: ratio >= 1 ? 'var(--ok)' : ratio > 0 ? 'var(--primary)' : 'var(--text-dim)',
                      }}>
                      {d.day}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      <p className="footer-note">
        단어 목록: 교육부 고시 제2022-33호 영어과 교육과정 기본 어휘.<br />
        뜻·예문·음성은 본 앱에서 자체 제작. 교육부 공식 앱이 아닙니다.
      </p>
    </div>
  )
}
