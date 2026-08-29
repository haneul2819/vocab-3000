// 문법 — 범주별 예문 열람(level 필터, 예문 듣기·전체/반복 듣기) + 빈칸/어순 배열 문제
import { useEffect, useMemo, useRef, useState } from 'react'
import { loadGrammar, sample, shuffled } from '../lib/data'
import { useAsync } from '../lib/useAsync'
import { Loading, LoadFailed } from '../components/LoadState'
import { pause, speak, stopSpeaking } from '../lib/tts'
import type { GrammarItem } from '../lib/types'

const LEVELS = ['전체', '초', '중', '고'] as const
type LevelFilter = (typeof LEVELS)[number]

// ---- 문법 문제 생성 ----

interface GrammarQuestion {
  kind: 'blank' | 'order'
  sentence: string
  prompt: string
  answer: string
  choices: string[] // blank: 4지선다 / order: 어절 목록
}

function cleanSentence(s: string): string {
  // "A boy/The boy/..." 같은 대안 표기는 첫 번째 안만 사용
  return s.split('/').length > 2 ? s : s
}

function makeBlank(item: GrammarItem, pool: GrammarItem[]): GrammarQuestion | null {
  const words = item.sentence.split(/\s+/).filter((w) => /[a-zA-Z]/.test(w))
  if (words.length < 3) return null
  // 3글자 이상 단어 중 하나를 빈칸으로
  const candidates = words.filter((w) => w.replace(/[^a-zA-Z]/g, '').length >= 3)
  if (!candidates.length) return null
  const target = candidates[Math.floor(Math.random() * candidates.length)]
  const answer = target.replace(/[^a-zA-Z']/g, '')
  const blanked = item.sentence.replace(target, target.replace(/[a-zA-Z']+/, '____'))
  // 오답: 같은 범주 다른 문장의 단어들
  const others = pool.flatMap((p) => p.sentence.split(/\s+/))
    .map((w) => w.replace(/[^a-zA-Z']/g, ''))
    .filter((w) => w.length >= 3 && w.toLowerCase() !== answer.toLowerCase())
  const wrong = [...new Set(sample(others, 12))].slice(0, 3)
  if (wrong.length < 3) return null
  return {
    kind: 'blank', sentence: item.sentence, prompt: blanked,
    answer, choices: shuffled([answer, ...wrong]),
  }
}

function makeOrder(item: GrammarItem): GrammarQuestion | null {
  const words = cleanSentence(item.sentence).split(/\s+/)
  if (words.length < 3 || words.length > 9) return null
  return {
    kind: 'order', sentence: item.sentence,
    prompt: '어순에 맞게 배열하세요', answer: words.join(' '),
    choices: shuffled(words),
  }
}

export default function Grammar() {
  const { data: loadedCats, loading, error, retry } = useAsync(() => loadGrammar(), [])
  const cats = loadedCats ?? []
  const [level, setLevel] = useState<LevelFilter>('전체')
  const [openCat, setOpenCat] = useState<string | null>(null)
  const [tab, setTab] = useState<'browse' | 'quiz'>('browse')

  // 문제 상태
  const [q, setQ] = useState<GrammarQuestion | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [ordered, setOrdered] = useState<string[]>([])
  const [orderPool, setOrderPool] = useState<string[]>([])
  const [orderResult, setOrderResult] = useState<null | boolean>(null)
  const [score, setScore] = useState({ right: 0, total: 0 })

  // ---- 파트별 전체/반복 듣기 ----
  const [playing, setPlaying] = useState<{ cat: string; idx: number; repeat: boolean } | null>(null)
  const playStop = useRef(false)

  const stopPlay = () => {
    playStop.current = true
    stopSpeaking()
    setPlaying(null)
  }

  const playCategory = async (cat: string, items: GrammarItem[], repeat: boolean) => {
    stopSpeaking() // 진행 중이던 재생 정리
    playStop.current = false
    setOpenCat(cat) // 재생 중인 파트를 펼쳐서 진행 위치가 보이게
    do {
      for (let i = 0; i < items.length; i++) {
        if (playStop.current) break
        setPlaying({ cat, idx: i, repeat })
        await speak(items[i].sentence)
        if (playStop.current) break
        await pause(0.6)
      }
    } while (repeat && !playStop.current)
    if (!playStop.current) setPlaying(null)
  }

  useEffect(() => () => { playStop.current = true; stopSpeaking() }, []) // 화면 이탈 시 정지

  const filtered = useMemo(() =>
    cats.map((c) => ({
      ...c,
      items: level === '전체' ? c.items : c.items.filter((i) => i.level === level),
    })).filter((c) => c.items.length > 0), [cats, level])

  const allItems = useMemo(() => filtered.flatMap((c) => c.items), [filtered])

  const nextQuestion = () => {
    setPicked(null); setOrderResult(null)
    for (let tries = 0; tries < 20; tries++) {
      const item = allItems[Math.floor(Math.random() * allItems.length)]
      if (!item) break
      const gq = Math.random() < 0.5 ? makeBlank(item, allItems) : makeOrder(item)
      if (gq) {
        setQ(gq)
        if (gq.kind === 'order') { setOrdered([]); setOrderPool(gq.choices) }
        return
      }
    }
    setQ(null)
  }

  const pickBlank = (c: string) => {
    if (!q || picked) return
    setPicked(c)
    const ok = c === q.answer
    setScore((s) => ({ right: s.right + (ok ? 1 : 0), total: s.total + 1 }))
    setTimeout(nextQuestion, ok ? 700 : 1600)
  }

  const pickOrderWord = (w: string, i: number) => {
    if (orderResult !== null) return
    const nextOrdered = [...ordered, w]
    const nextPool = orderPool.filter((_, j) => j !== i)
    setOrdered(nextOrdered)
    setOrderPool(nextPool)
    if (!nextPool.length && q) {
      const ok = nextOrdered.join(' ') === q.answer
      setOrderResult(ok)
      setScore((s) => ({ right: s.right + (ok ? 1 : 0), total: s.total + 1 }))
      setTimeout(nextQuestion, ok ? 800 : 2200)
    }
  }

  if (loading) return <Loading />
  if (error) return <LoadFailed what="문법 예문" onRetry={retry} />

  return (
    <div className="page">
      <h1>문법</h1>
      <div className="seg">
        <button className={tab === 'browse' ? 'active' : ''} onClick={() => setTab('browse')}>예문 보기</button>
        <button className={tab === 'quiz' ? 'active' : ''} onClick={() => { stopPlay(); setTab('quiz'); if (!q) nextQuestion() }}>문제 풀기</button>
      </div>
      <div className="seg">
        {LEVELS.map((l) => (
          <button key={l} className={level === l ? 'active' : ''}
            onClick={() => { stopPlay(); setLevel(l); setQ(null); if (tab === 'quiz') setTimeout(nextQuestion, 0) }}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'browse' ? (
        filtered.map((c) => {
          const open = openCat === c.category
          const isPlayingThis = playing?.cat === c.category
          return (
            <div className="card" key={c.category}>
              <button className="row spread" style={{ width: '100%' }}
                onClick={() => setOpenCat(open ? null : c.category)}>
                <b style={{ textAlign: 'left' }}>{c.category}</b>
                <span className="dim small">
                  {isPlayingThis && <>🔊 {playing.idx + 1}/{c.items.length}{playing.repeat && ' 🔁'} · </>}
                  {c.items.length}문장 {open ? '▲' : '▼'}
                </span>
              </button>
              {open && (
                <div className="row mt8" style={{ gap: 8 }}>
                  {isPlayingThis ? (
                    <button className="btn sm bad" style={{ flex: 1 }} onClick={stopPlay}>
                      ⏹ 듣기 중지
                    </button>
                  ) : (
                    <>
                      <button className="btn sm primary" style={{ flex: 1 }}
                        onClick={() => void playCategory(c.category, c.items, false)}>
                        ▶ 전체 듣기
                      </button>
                      <button className="btn sm ghost" style={{ flex: 1 }}
                        onClick={() => void playCategory(c.category, c.items, true)}>
                        🔁 반복 듣기
                      </button>
                    </>
                  )}
                </div>
              )}
              {open && c.items.map((it, i) => (
                <div key={it.id} className="row spread mt8"
                  style={{
                    borderTop: '1px solid var(--border)', paddingTop: 8,
                    background: isPlayingThis && playing.idx === i ? 'var(--primary-soft)' : undefined,
                    borderRadius: isPlayingThis && playing.idx === i ? 8 : undefined,
                  }}>
                  <div>
                    <span className={`badge ${it.level === '초' ? 'ok' : it.level === '중' ? 'primary' : 'warn'}`}>{it.level}</span>{' '}
                    <span style={{ fontSize: '0.93rem' }}>{it.sentence}</span>
                  </div>
                  <button className="speak-btn" style={{ minWidth: 38, minHeight: 38, fontSize: '1rem' }}
                    aria-label="예문 듣기" onClick={() => void speak(it.sentence)}>🔊</button>
                </div>
              ))}
            </div>
          )
        })
      ) : (
        <>
          <div className="dim small center" style={{ marginBottom: 8 }}>
            정답 {score.right}/{score.total}
          </div>
          {q ? (
            <>
              <div className="card center" style={{ padding: 24 }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, lineHeight: 1.6 }}>
                  {q.kind === 'blank' ? q.prompt : q.prompt}
                </div>
              </div>
              {q.kind === 'blank' ? (
                q.choices.map((c) => (
                  <button key={c} disabled={!!picked}
                    className={`choice ${picked && c === q.answer ? 'correct' : ''} ${picked === c && c !== q.answer ? 'wrong' : ''}`}
                    onClick={() => pickBlank(c)}>
                    {c}
                  </button>
                ))
              ) : (
                <>
                  <div className="card" style={{
                    minHeight: 56,
                    background: orderResult === null ? 'var(--surface)' : orderResult ? 'var(--ok-soft)' : 'var(--bad-soft)',
                  }}>
                    {ordered.join(' ') || <span className="dim small">아래 단어를 순서대로 탭하세요</span>}
                    {orderResult === false && (
                      <div className="small mt8">정답: <b>{q.answer}</b></div>
                    )}
                  </div>
                  <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                    {orderPool.map((w, i) => (
                      <button key={`${w}-${i}`} className="btn sm" onClick={() => pickOrderWord(w, i)}>
                        {w}
                      </button>
                    ))}
                  </div>
                  {ordered.length > 0 && orderResult === null && (
                    <button className="btn ghost sm mt8" onClick={() => {
                      if (q) { setOrdered([]); setOrderPool(shuffled(q.choices)) }
                    }}>
                      처음부터 다시
                    </button>
                  )}
                </>
              )}
            </>
          ) : (
            <div className="card center dim">이 범위에서 만들 문제가 없어요.</div>
          )}
        </>
      )}
    </div>
  )
}
