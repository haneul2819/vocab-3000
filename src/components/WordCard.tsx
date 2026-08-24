// 암기 카드 컴포넌트 — 앞면(단어/IPA/발음)·뒷면(뜻/예문/파생어)
import { speak } from '../lib/tts'
import type { Word } from '../lib/types'

interface Props {
  word: Word
  flipped: boolean
  /** 영→한(en-ko): 앞면 단어 / 한→영(ko-en): 앞면 뜻 */
  direction: 'en-ko' | 'ko-en'
  onFlip: () => void
}

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

export default function WordCard({ word, flipped, direction, onFlip }: Props) {
  return (
    <div className="flashcard" onClick={onFlip} role="button" aria-label="카드 뒤집기">
      {flipped ? <Back word={word} direction={direction} /> : <Front word={word} direction={direction} />}
    </div>
  )
}
