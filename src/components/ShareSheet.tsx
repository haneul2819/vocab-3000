// 단어 카드 길게 누르기 → 이미지 미리보기 + 공유/저장 시트
import { useEffect, useState } from 'react'
import { canShareImage, downloadBlob, shareBlob, wordImageBlob } from '../lib/shareCard'
import type { Word } from '../lib/types'

interface Props {
  word: Word
  onClose: () => void
}

export default function ShareSheet({ word, onClose }: Props) {
  const [blob, setBlob] = useState<Blob | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null
    wordImageBlob(word)
      .then((b) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(b)
        setBlob(b)
        setUrl(objectUrl)
      })
      .catch(() => { if (!cancelled) setMsg('이미지를 만들지 못했습니다') })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [word])

  const save = () => {
    if (!blob) return
    downloadBlob(blob, `${word.word}.png`)
    setMsg('이미지를 저장했습니다')
  }

  const share = async () => {
    if (!blob) return
    if ((await shareBlob(blob, word.word)) === 'fallback') save()
  }

  return (
    <div className="sheet-overlay" role="dialog" aria-label="단어 카드 이미지 공유" onClick={onClose}>
      <div className="share-sheet" onClick={(e) => e.stopPropagation()}>
        {url
          ? <img src={url} alt={`${word.word} 단어 카드 이미지`} />
          : <div className="dim small" style={{ textAlign: 'center', padding: '24px 0' }}>이미지 생성 중…</div>}
        <div className="share-actions">
          {canShareImage() && (
            <button className="btn primary" onClick={() => void share()} disabled={!blob}>공유</button>
          )}
          <button className="btn" onClick={save} disabled={!blob}>이미지 저장</button>
          <button className="btn" onClick={onClose}>닫기</button>
        </div>
        {msg && <div className="small dim" style={{ textAlign: 'center' }}>{msg}</div>}
      </div>
    </div>
  )
}
