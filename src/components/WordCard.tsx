// 암기 카드 컴포넌트 — 앞면(단어/IPA/발음)·뒷면(뜻/예문/파생어)
// 오른쪽 스와이프 = '앎' 판정 (탭 뒤집기·세로 스크롤·핀치 줌과 공존)
// 길게 누르기(0.5초) = 이미지 공유/저장 시트
import { useEffect, useRef, useState } from 'react'
import { speak } from '../lib/tts'
import type { Word } from '../lib/types'
import ShareSheet from './ShareSheet'

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
/** 길게 누르기 판정 시간(ms) / 취소 이동 허용(px) */
const PRESS_MS = 500
const PRESS_SLOP = 10

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
  const [shareOpen, setShareOpen] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  // 드래그 추적 상태 (렌더와 무관한 값은 ref로)
  const drag = useRef<{ id: number; x: number; y: number; active: boolean } | null>(null)
  const suppressClick = useRef(false)
  const fired = useRef(false)
  const pressTimer = useRef<number | null>(null)

  const clearPress = () => {
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
  }

  // 단어가 바뀌면 위치 초기화
  useEffect(() => {
    setDx(0)
    setExiting(false)
    setShareOpen(false)
    drag.current = null
    fired.current = false
    clearPress()
  }, [word.id])

  useEffect(() => clearPress, []) // 언마운트 시 타이머 정리

  const reset = () => {
    drag.current = null
    setDx(0)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (exiting) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    // 두 번째 손가락이 닿으면 핀치 줌으로 간주하고 드래그·길게 누르기 취소
    if (drag.current) { clearPress(); reset(); return }
    // 이전 제스처가 click 없이 끝났으면(pointercancel 등) 억제 플래그가 남으므로 새 제스처에서 초기화
    suppressClick.current = false
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, active: false }
    // 길게 누르기 → 이미지 공유/저장 시트 (이동하면 취소)
    clearPress()
    pressTimer.current = window.setTimeout(() => {
      pressTimer.current = null
      drag.current = null // 이후 이동이 스와이프로 이어지지 않게
      suppressClick.current = true // 손을 뗄 때의 click이 뒤집기로 처리되지 않게
      setShareOpen(true)
    }, PRESS_MS)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || e.pointerId !== d.id) return
    const mx = e.clientX - d.x
    const my = e.clientY - d.y
    // 손가락이 이동하면 길게 누르기가 아님
    if (pressTimer.current !== null && (Math.abs(mx) > PRESS_SLOP || Math.abs(my) > PRESS_SLOP)) {
      clearPress()
    }
    if (!d.active) {
      // 가로 이동이 우세할 때만 스와이프 시작 (세로는 스크롤에 양보)
      if (onSwipeRight && Math.abs(mx) > 12 && Math.abs(mx) > Math.abs(my) * 1.2) {
        d.active = true
        suppressClick.current = true
        cardRef.current?.setPointerCapture(e.pointerId)
      } else if (Math.abs(my) > 14) {
        clearPress()
        drag.current = null
        return
      } else {
        return
      }
    }
    setDx(Math.max(0, mx)) // 오른쪽 방향만
  }

  const onPointerUp = (e: React.PointerEvent) => {
    clearPress()
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

  const onPointerCancel = () => { clearPress(); reset() } // 핀치 줌 시작 등으로 취소되면 원위치

  const onClick = () => {
    // 드래그 직후 발생하는 click은 뒤집기로 처리하지 않음
    if (suppressClick.current) { suppressClick.current = false; return }
    onFlip()
  }

  const past = dx > SWIPE_THRESHOLD
  return (
    <>
    <div ref={cardRef} className="flashcard" role="button"
      aria-label="카드 뒤집기 (오른쪽으로 밀면 앎, 길게 누르면 이미지 공유)"
      onClick={onClick}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove}
      onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}
      onContextMenu={(e) => e.preventDefault()} /* 모바일 길게 누르기의 기본 메뉴 억제 */
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
    {shareOpen && <ShareSheet word={word} onClose={() => setShareOpen(false)} />}
    </>
  )
}
