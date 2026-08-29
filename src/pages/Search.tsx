// 단어 검색 — 영단어·뜻 양방향 검색, 결과에서 바로 카드 열기
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettings } from '../App'
import WordCard from '../components/WordCard'
import { Loading, LoadFailed } from '../components/LoadState'
import { loadIndex, loadWordsByIds, trackOfDay } from '../lib/data'
import { getMeta, setMeta } from '../lib/db'
import { useAsync } from '../lib/useAsync'
import type { IndexWord, Word } from '../lib/types'

const MAX_RESULTS = 40
const RECENT_KEY = 'recentSearches'
const MAX_RECENT = 8

/** 영문 검색은 시작 일치를 위로, 그 외에는 포함 일치 */
function rank(w: IndexWord, q: string): number {
  const word = w.w.toLowerCase()
  if (word === q) return 0
  if (word.startsWith(q)) return 1
  if (word.includes(q)) return 2
  if (w.ko.startsWith(q)) return 3
  if (w.ko.includes(q)) return 4
  return 99
}

export default function Search() {
  const nav = useNavigate()
  const { settings } = useSettings()
  const { data: index, loading, error, retry } = useAsync(() => loadIndex(), [])
  const [query, setQuery] = useState('')
  const [recent, setRecent] = useState<string[]>([])
  const [picked, setPicked] = useState<Word | null>(null)
  const [flipped, setFlipped] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void getMeta<string[]>(RECENT_KEY, []).then(setRecent)
    inputRef.current?.focus()
  }, [])

  const q = query.trim().toLowerCase()

  const results = useMemo(() => {
    if (!index || q.length < 1) return []
    return index.words
      .map((w) => ({ w, r: rank(w, q) }))
      .filter((x) => x.r < 99)
      .sort((a, b) => a.r - b.r || a.w.w.localeCompare(b.w.w))
      .slice(0, MAX_RESULTS)
      .map((x) => x.w)
  }, [index, q])

  /** 결과를 눌러 카드를 연다 (최근 검색어도 함께 저장) */
  const open = async (iw: IndexWord) => {
    const [word] = await loadWordsByIds([iw.id])
    if (!word) return
    setPicked(word)
    setFlipped(true)
    const next = [iw.w, ...recent.filter((r) => r !== iw.w)].slice(0, MAX_RECENT)
    setRecent(next)
    void setMeta(RECENT_KEY, next)
  }

  if (loading) return <Loading />
  if (error) return <LoadFailed what="단어 목록" onRetry={retry} />

  return (
    <div className="page">
      <div className="row spread">
        <h1 style={{ margin: 0 }}>단어 찾기</h1>
        <button className="btn sm ghost" onClick={() => nav('/')}>닫기</button>
      </div>

      <input ref={inputRef} className="answer-input mt16" value={query}
        type="search" autoCapitalize="none" autoCorrect="off" spellCheck={false}
        aria-label="영단어 또는 뜻으로 검색"
        placeholder="영단어 또는 뜻 (예: apple, 사과)"
        onChange={(e) => setQuery(e.target.value)} />

      {/* 최근 검색어 — 입력 전에만 보여준다 */}
      {!q && recent.length > 0 && (
        <div className="mt16">
          <div className="row spread">
            <span className="dim small">최근 검색</span>
            <button className="btn sm ghost" onClick={() => { setRecent([]); void setMeta(RECENT_KEY, []) }}>
              지우기
            </button>
          </div>
          <div className="row mt8" style={{ flexWrap: 'wrap', gap: 8 }}>
            {recent.map((r) => (
              <button key={r} className="btn sm ghost" onClick={() => setQuery(r)}>{r}</button>
            ))}
          </div>
        </div>
      )}

      {q && (
        <div className="dim small mt16" aria-live="polite">
          {results.length === 0
            ? '찾는 단어가 없어요. 철자나 뜻을 다시 확인해 보세요.'
            : `${results.length}개${results.length === MAX_RESULTS ? ' 이상' : ''} 찾음`}
        </div>
      )}

      {results.map((w) => (
        <button key={w.id} className="search-row" onClick={() => void open(w)}>
          <div>
            <b>{w.w}</b>
            <div className="dim small">{w.ko}</div>
          </div>
          <span className="badge">Day {w.d} · {trackOfDay(w.d).label}</span>
        </button>
      ))}

      {/* 고른 단어 카드 */}
      {picked && (
        <div className="sheet-overlay" role="dialog" aria-label={`${picked.word} 단어 카드`}
          onClick={() => setPicked(null)}>
          <div className="search-sheet" onClick={(e) => e.stopPropagation()}>
            <WordCard word={picked} direction={settings.direction}
              flipped={flipped} onFlip={() => setFlipped((f) => !f)} />
            <div className="row mt8" style={{ gap: 8 }}>
              <button className="btn sm" style={{ flex: 1 }}
                onClick={() => nav(`/learn/${picked.day}`)}>
                Day {picked.day} 학습하기
              </button>
              <button className="btn sm ghost" style={{ flex: 1 }} onClick={() => setPicked(null)}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
