// 암기 카드 화면 — 학습 / 셀프 테스트 / 오답 노트 / 듣기 모드
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSettings } from '../App'
import WordCard from '../components/WordCard'
import { loadDay, shuffled } from '../lib/data'
import { useAsync } from '../lib/useAsync'
import { Loading, LoadFailed } from '../components/LoadState'
import { bumpDailyLog, getStates, putState } from '../lib/db'
import { applyGrade, type Grade } from '../lib/srs'
import { pause, speak, speakKo, stopSpeaking } from '../lib/tts'
import { keepScreenOn, releaseScreen } from '../lib/wakeLock'
import type { Word, WordState } from '../lib/types'

type Mode = 'study' | 'self' | 'wrong' | 'listen'

const MODE_LABELS: Record<Mode, string> = {
  study: '학습', self: '셀프 테스트', wrong: '오답 노트', listen: '듣기',
}

export default function Learn() {
  const { day: dayParam } = useParams()
  const day = Number(dayParam) || 1
  const nav = useNavigate()
  const { settings, update } = useSettings()

  const { data: allWords, loading, error, retry } = useAsync(() => loadDay(day), [day])
  const [states, setStates] = useState<Map<number, WordState>>(new Map())
  const [mode, setMode] = useState<Mode>('study')
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [finished, setFinished] = useState(false)

  // 단어가 준비되면 학습 상태를 함께 불러온다
  useEffect(() => {
    if (!allWords) return
    void getStates(allWords.map((w) => w.id)).then(setStates)
  }, [allWords])

  // 모드·셔플 설정에 따른 카드 목록
  const cards = useMemo(() => {
    let list = allWords ?? []
    if (mode === 'wrong') {
      list = list.filter((w) => states.get(w.id)?.wrongNote)
    }
    return settings.shuffle ? shuffled(list) : list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allWords, mode, settings.shuffle])

  const current = cards[idx] as Word | undefined

  // 카드가 열릴 때: 학습 모드는 뒷면 자동 공개, 자동 재생 옵션 처리
  useEffect(() => {
    setFlipped(mode === 'study')
    if (current && settings.autoSpeak && settings.direction === 'en-ko' && mode !== 'listen') {
      void speak(current.word)
    }
  }, [idx, mode, current, settings.autoSpeak, settings.direction])

  const grade = useCallback(async (g: Grade) => {
    if (!current) return
    const prev = states.get(current.id) ?? { ...(await getStates([current.id])).get(current.id)! }
    const next = applyGrade(prev, g)
    await putState(next)
    await bumpDailyLog({ learned: 1 })
    setStates((m) => new Map(m).set(current.id, next))
    if (idx + 1 >= cards.length) setFinished(true)
    else setIdx(idx + 1)
  }, [current, states, idx, cards.length])

  // ---- 듣기 모드 ----
  const [listening, setListening] = useState(false)
  const listenStop = useRef(false)

  const startListen = useCallback(async () => {
    setListening(true)
    listenStop.current = false
    void keepScreenOn() // 흘려듣기 중 화면이 꺼지면 재생이 끊긴다
    for (let r = 0; r < Math.max(1, settings.listenRepeat); r++) {
      for (let i = 0; i < cards.length; i++) {
        if (listenStop.current) break
        const w = cards[i]
        setIdx(i)
        await speak(w.word)
        if (listenStop.current) break
        await pause(0.4)
        const firstKo = w.meanings[0]?.ko[0]
        if (firstKo) await speakKo(firstKo)
        if (listenStop.current) break
        await pause(0.4)
        for (const ex of w.examples) {
          if (listenStop.current) break
          await speak(ex.en)
          await pause(0.3)
        }
        await pause(settings.listenGapSec)
      }
      if (listenStop.current) break
    }
    void releaseScreen()
    setListening(false)
  }, [cards, settings.listenGapSec, settings.listenRepeat])

  const stopListen = () => {
    listenStop.current = true
    stopSpeaking()
    void releaseScreen()
    setListening(false)
  }

  // 화면을 벗어나면 재생과 화면 꺼짐 방지를 모두 정리한다
  useEffect(() => () => { listenStop.current = true; stopSpeaking(); void releaseScreen() }, [])

  // Day를 진행 중 Day로 기억
  useEffect(() => {
    if (settings.currentDay !== day) update({ currentDay: day })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day])

  if (loading) return <Loading />
  if (error || !allWords) {
    return (
      <LoadFailed what={`Day ${day} 단어`} onRetry={retry}>
        <button className="btn ghost mt8" onClick={() => nav('/')}>홈으로</button>
      </LoadFailed>
    )
  }

  if (finished) {
    return (
      <div className="page center">
        <div className="card" style={{ padding: 32 }}>
          <div style={{ fontSize: '2.5rem' }}>🎉</div>
          <h2>Day {day} {MODE_LABELS[mode]} 완료!</h2>
          <p className="dim small mt8">{cards.length}개 단어를 살펴봤어요.</p>
          <button className="btn primary mt16"
            onClick={() => nav('/quiz', { state: { day, count: 50, autostart: true, daily: true } })}>
            오늘의 테스트 시작 (50문제)
          </button>
          <button className="btn ghost mt8" onClick={() => { setIdx(0); setFinished(false) }}>
            다시 보기
          </button>
          <button className="btn mt8" onClick={() => nav('/')}>홈으로</button>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="row spread">
        <button className="btn sm ghost" onClick={() => nav(-1)}>← 뒤로</button>
        <b>Day {day}</b>
        <span className="dim small progress-text">{cards.length ? idx + 1 : 0}/{cards.length}</span>
      </div>

      {/* 모드 선택 */}
      <div className="seg mt8">
        {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
          <button key={m} className={mode === m ? 'active' : ''}
            onClick={() => { stopListen(); setMode(m); setIdx(0); setFinished(false) }}>
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      {/* 토글: 방향·셔플 */}
      <div className="row" style={{ marginBottom: 10, gap: 8 }}>
        <button className="btn sm ghost"
          onClick={() => update({ direction: settings.direction === 'en-ko' ? 'ko-en' : 'en-ko' })}>
          {settings.direction === 'en-ko' ? '영 → 한' : '한 → 영'}
        </button>
        <button className={`btn sm ${settings.shuffle ? 'primary' : 'ghost'}`}
          onClick={() => update({ shuffle: !settings.shuffle })}>
          🔀 셔플
        </button>
        <button className={`btn sm ${settings.autoSpeak ? 'primary' : 'ghost'}`}
          onClick={() => update({ autoSpeak: !settings.autoSpeak })}>
          🔊 자동
        </button>
      </div>

      {mode === 'wrong' && cards.length === 0 && (
        <div className="card center dim">
          오답 노트가 비어 있어요.<br />
          <span className="small">학습 중 ‘모름·헷갈림’으로 표시한 단어가 여기 모입니다. 3회 연속 ‘앎’이면 졸업!</span>
        </div>
      )}

      {mode === 'listen' ? (
        <div className="card center">
          <p className="dim small">
            화면을 어둡게 하고 단어 → 뜻 → 예문 순서로 자동 재생합니다.<br />
            간격 {settings.listenGapSec}초 · 반복 {settings.listenRepeat}회 (설정에서 변경)
          </p>
          <button className="btn primary mt16" onClick={() => void startListen()}>▶ 듣기 시작</button>
        </div>
      ) : (
        current && (
          <>
            <WordCard word={current} direction={settings.direction}
              flipped={flipped} onFlip={() => setFlipped((f) => !f)}
              onSwipeLeft={() => {
                if (idx + 1 >= cards.length) setFinished(true)
                else setIdx(idx + 1)
              }}
              onSwipeRight={idx > 0 ? () => setIdx(idx - 1) : undefined} />
            {/* 제스처를 쓰기 어려운 사용자를 위한 대체 경로 (스와이프와 같은 동작) */}
            <div className="card-nav">
              <button className="btn sm ghost" aria-label="이전 단어"
                disabled={idx === 0} onClick={() => setIdx(idx - 1)}>◀ 이전</button>
              <span className="dim small" aria-live="polite">
                {cards.length ? idx + 1 : 0} / {cards.length}
              </span>
              <button className="btn sm ghost" aria-label="다음 단어"
                onClick={() => {
                  if (idx + 1 >= cards.length) setFinished(true)
                  else setIdx(idx + 1)
                }}>다음 ▶</button>
            </div>
            <div className="small dim center" style={{ marginTop: 6 }}>
              좌우로 밀거나 위 버튼으로 이동해요 (판정은 아래 버튼)
            </div>
          </>
        )
      )}

      {/* 판정 버튼 — 하단 고정, 한 손 조작 */}
      {mode !== 'listen' && current && (
        <div className="grade-bar">
          <button className="btn bad" onClick={() => void grade('no')}>모름</button>
          <button className="btn warn" onClick={() => void grade('fuzzy')}>헷갈림</button>
          <button className="btn ok" onClick={() => void grade('know')}>앎</button>
        </div>
      )}

      {/* 듣기 모드 오버레이 (화면 어둡게) */}
      {listening && current && (
        <div className="listen-overlay" onClick={stopListen}>
          <div className="dim small">듣기 모드 · {idx + 1}/{cards.length}</div>
          <div className="word">{current.word}</div>
          <div>{current.meanings[0]?.ko[0]}</div>
          <button className="btn ghost sm" style={{ color: '#cbd5e1', borderColor: '#334155' }}>
            탭하면 중지
          </button>
        </div>
      )}
    </div>
  )
}
