import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSettings } from '../App'
import ProgressRing from '../components/ProgressRing'
import { loadIndex, TRACKS, trackOfDay } from '../lib/data'
import {
  getAllStates, getDailyTestScores, getDueStates, getStreak, todayKey,
  type DailyTestScore,
} from '../lib/db'
import type { DataIndex, Level, WordState } from '../lib/types'

export default function Home() {
  const { settings } = useSettings()
  const nav = useNavigate()
  const [index, setIndex] = useState<DataIndex | null>(null)
  const [indexError, setIndexError] = useState(false)
  const [states, setStates] = useState<Map<number, WordState>>(new Map())
  const [dueCount, setDueCount] = useState(0)
  const [streak, setStreak] = useState(0)
  const [openTrack, setOpenTrack] = useState<Level | null>(null)
  const [todayScore, setTodayScore] = useState<DailyTestScore | null>(null)

  useEffect(() => {
    loadIndex().then(setIndex).catch(() => setIndexError(true))
    getAllStates().then((all) => setStates(new Map(all.map((s) => [s.id, s]))))
    getDueStates().then((d) => setDueCount(d.length))
    getStreak().then(setStreak)
    getDailyTestScores().then((s) => setTodayScore(s[todayKey()] ?? null))
  }, [])

  const day = settings.currentDay
  const track = trackOfDay(day)

  // Day별 진행률 — done: 학습한 단어(unseen 탈출), tested: 문제를 풀어본 단어
  const dayProgress = useMemo(() => {
    if (!index) return new Map<number, { done: number; tested: number; total: number }>()
    const m = new Map<number, { done: number; tested: number; total: number }>()
    for (const w of index.words) {
      const cur = m.get(w.d) ?? { done: 0, tested: 0, total: 0 }
      cur.total += 1
      const st = states.get(w.id)
      if (st && st.status !== 'unseen') cur.done += 1
      if (st && st.quizRight + st.quizWrong > 0) cur.tested += 1
      m.set(w.d, cur)
    }
    return m
  }, [index, states])

  const today = dayProgress.get(day) ?? { done: 0, tested: 0, total: 50 }

  return (
    <div className="page">
      <div className="row spread">
        <h1>보카3000</h1>
        <Link to="/settings" aria-label="설정" style={{ fontSize: '1.3rem' }}>⚙️</Link>
      </div>

      {/* 모르는 단어를 바로 찾아볼 수 있는 입구 */}
      <button className="search-entry" onClick={() => nav('/search')}
        aria-label="단어 검색 열기">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
        </svg>
        <span>단어 찾기</span>
      </button>

      {indexError && (
        <div className="card" role="alert" style={{ borderColor: 'var(--bad)' }}>
          <b>단어 목록을 불러오지 못했어요</b>
          <div className="dim small mt8">진도 표시가 정확하지 않을 수 있습니다. 앱을 다시 시작해 주세요.</div>
          <button className="btn sm mt8" onClick={() => location.reload()}>새로고침</button>
        </div>
      )}
      {/* 오늘 학습 카드 — 학습 진도와 테스트 진도를 따로 표시 */}
      <div className="card">
        <div className="row spread">
          <div>
            <span className="badge primary">{track.label}</span>
            <h2 style={{ margin: '8px 0 4px' }}>오늘 학습 · Day {day}</h2>
            <div className="dim small">
              학습 {today.done}/{today.total} · 테스트 {today.tested}/{today.total}
              {streak > 0 && <> · 🔥 연속 {streak}일</>}
            </div>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <div className="center">
              <ProgressRing value={today.total ? today.done / today.total : 0} size={62} stroke={6} />
              <div className="dim small" style={{ marginTop: 2 }}>학습</div>
            </div>
            <div className="center">
              <ProgressRing value={today.total ? today.tested / today.total : 0} size={62} stroke={6} />
              <div className="dim small" style={{ marginTop: 2 }}>테스트</div>
            </div>
          </div>
        </div>
        <div className="row mt16" style={{ gap: 8 }}>
          <button className="btn primary" style={{ flex: 1 }} onClick={() => nav(`/learn/${day}`)}>
            학습 시작
          </button>
        </div>
        <button className="btn ghost mt8" onClick={() => nav('/review')}>
          오늘 복습 대기 <b>{dueCount}</b>개
        </button>
      </div>

      {/* 오늘의 테스트 — 오늘 Day 단어 전체(50문제) 점검. 진단 테스트는 문제집으로 이동 */}
      <div className="card row spread">
        <div>
          <b>오늘의 테스트</b>
          <div className="dim small">
            Day {day} 단어 50문제 · 진행 {today.tested}/{today.total}
            {today.total > 0 && today.tested >= today.total && ' ✅ 완료'}
            {todayScore && <> · 오늘 점수 <b>{todayScore.right}/{todayScore.total}</b></>}
          </div>
        </div>
        <button className="btn sm primary"
          onClick={() => nav('/quiz', { state: { day, count: 50, autostart: true, daily: true } })}>
          시작
        </button>
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
