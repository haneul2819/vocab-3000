// 암기 카드 컴포넌트 — 앞면(단어/IPA/발음)·뒷면(뜻/예문/파생어)
// 오른쪽 스와이프 = '앎' 판정 (탭 뒤집기·세로 스크롤·핀치 줌과 공존)
import { useEffect, useRef, useState } from 'react'
import { speak } from '../lib/tts'
import type { Word } from '../lib/types'

interface Props {
  word: Word
  flipped: boolean
  /** 영→한(en-ko): 앞면 단어 / 한→영(ko-en): 앞면 뜻 */
  direction: 'en-ko' | 'ko-en'
  onFlip: () => void
  /** 오른쪽으로 밀어 넘겼을 때 (없으면 스와이프 비활성) */
  onSwipeRight?: () => void
}

/** 스와이프 확정 임계값(px) */
const SWIPE_THRESHOLD = 90

function Front({ word, direction }: { word: Word; direction: Props['direction'] }) {
  if (direction === 'ko-en') {
    return (
      <>
        {word.meanings.map((m) => (
          <div className="meaning-line" key={m.pos}>
            <span className="badge">{m.pos}</span> {m.ko.join(', ')}
          </div>
        ))}
        <div className="dim small mt8">단어를 떠올린 뒤 탭해서 확인</div>
      </>
    )
  }
  return (
    <>
      <div className="headword">{word.word}</div>
      {word.ipa && <div className="ipa">{word.ipa}</div>}
      <button className="speak-btn" aria-label="단어 발음 듣기"
        onClick={(e) => { e.stopPropagation(); void speak(word.word) }}>🔊</button>
    </>
  )
}

function Back({ word, direction }: { word: Word; direction: Props['direction'] }) {
  return (
    <>
      {direction === 'ko-en' ? (
        <>
          <div className="headword">{word.word}</div>
          {word.ipa && <div className="ipa">{word.ipa}</div>}
          <button className="speak-btn" aria-label="단어 발음 듣기"
            onClick={(e) => { e.stopPropagation(); void speak(word.word) }}>🔊</button>
        </>
      ) : (
        <>
          {/* 학습 모드(뒷면 자동 공개)에서도 단어가 보이도록 표제어를 함께 표시 */}
          <div className="headword" style={{ fontSize: '1.6rem' }}>{word.word}</div>
          {word.ipa && (
            <div className="ipa" style={{ fontSize: '0.95rem' }}>
              {word.ipa}{' '}
              <button className="speak-btn" style={{ minWidth: 36, minHeight: 36, fontSize: '0.95rem' }}
                aria-label="단어 발음 듣기"
                onClick={(e) => { e.stopPropagation(); void speak(word.word) }}>🔊</button>
            </div>
          )}
          {word.meanings.map((m) => (
            <div className="meaning-line" key={m.pos}>
              <span className="badge">{m.pos}</span> {m.ko.join(', ')}
            </div>
          ))}
        </>
      )}
      {word.examples.map((ex, i) => (
        <div className="example" key={i}>
          <div className="row spread">
            <span>{ex.en}</span>
            <button className="speak-btn" style={{ minWidth: 36, minHeight: 36, fontSize: '0.95rem' }}
              aria-label="예문 듣기"
              onClick={(e) => { e.stopPropagation(); void speak(ex.en) }}>🔊</button>
          </div>
          <div className="ko">{ex.ko}</div>
        </div>
      ))}
      {word.derived.length > 0 && (
        <div className="small dim">파생어: {word.derived.join(', ')}</div>
      )}
      {word.alt_spelling && (
        <div className="small dim">다른 철자: {word.alt_spelling}</div>
      )}
    </>
  )
}

export default function WordCard({ word, flipped, direction, onFlip, onSwipeRight }: Props) {
  const [dx, setDx] = useState(0)
  const [exiting, setExiting] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  // 드래그 추적 상태 (렌더와 무관한 값은 ref로)
  const drag = useRef<{ id: number; x: number; y: number; active: boolean } | null>(null)
  const suppressClick = useRef(false)
  const fired = useRef(false)

  // 단어가 바뀌면 위치 초기화
  useEffect(() => {
    setDx(0)
    setExiting(false)
    drag.current = null
    fired.current = false
  }, [word.id])

  const reset = () => {
    drag.current = null
    setDx(0)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (!onSwipeRight || exiting) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    // 두 번째 손가락이 닿으면 핀치 줌으로 간주하고 드래그 취소
    if (drag.current) { reset(); return }
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, active: false }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || e.pointerId !== d.id) return
    const mx = e.clientX - d.x
    const my = e.clientY - d.y
    if (!d.active) {
      // 가로 이동이 우세할 때만 스와이프 시작 (세로는 스크롤에 양보)
      if (Math.abs(mx) > 12 && Math.abs(mx) > Math.abs(my) * 1.2) {
        d.active = true
        suppressClick.current = true
        cardRef.current?.setPointerCapture(e.pointerId)
      } else if (Math.abs(my) > 14) {
        drag.current = null
        return
      } else {
        return
      }
    }
    setDx(Math.max(0, mx)) // 오른쪽 방향만
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || e.pointerId !== d.id) return
    drag.current = null
    if (d.active && dx > SWIPE_THRESHOLD && onSwipeRight && !fired.current) {
      fired.current = true
      setExiting(true)
      window.setTimeout(onSwipeRight, 180)
    } else {
      setDx(0)
    }
  }

  const onPointerCancel = () => reset() // 핀치 줌 시작 등으로 취소되면 원위치

  const onClick = () => {
    // 드래그 직후 발생하는 click은 뒤집기로 처리하지 않음
    if (suppressClick.current) { suppressClick.current = false; return }
    onFlip()
  }

  const past = dx > SWIPE_THRESHOLD
  return (
    <div ref={cardRef} className="flashcard" role="button" aria-label="카드 뒤집기 (오른쪽으로 밀면 앎)"
      onClick={onClick}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove}
      onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}
      style={{
        transform: exiting
          ? 'translateX(130%) rotate(8deg)'
          : dx ? `translateX(${dx}px) rotate(${dx / 40}deg)` : undefined,
        opacity: exiting ? 0 : 1,
        transition: exiting ? 'transform 0.18s ease-in, opacity 0.18s ease-in'
          : dx ? 'none' : 'transform 0.15s ease',
      }}>
      {onSwipeRight && dx > 8 && !exiting && (
        <div className={`swipe-know${past ? ' on' : ''}`}>앎 ✓</div>
      )}
      {flipped ? <Back word={word} direction={direction} /> : <Front word={word} direction={direction} />}
    </div>
  )
}
