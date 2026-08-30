// 기기에 영어 음성이 없어 발음이 안 나올 때 안내한다.
// 안내가 없으면 사용자는 앱이 고장 났다고 생각하고 떠난다.
import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { englishVoiceStatus, type VoiceStatus } from '../lib/tts'

/** 한 번 닫으면 이 세션 동안 다시 띄우지 않는다 */
let dismissed = false

const GUIDE = Capacitor.isNativePlatform()
  ? '휴대전화 설정 → 접근성(또는 일반) → 텍스트 음성 변환에서 영어 음성을 설치해 주세요.'
  : '브라우저나 운영체제에 영어 음성이 설치되어 있어야 발음이 나옵니다.'

export default function VoiceNotice() {
  const [status, setStatus] = useState<VoiceStatus | null>(null)
  const [hidden, setHidden] = useState(dismissed)

  useEffect(() => { void englishVoiceStatus().then(setStatus) }, [])

  if (hidden || status === null || status === 'ok') return null

  return (
    <div className="voice-notice" role="status">
      <div>
        <b>발음이 나오지 않아요</b>
        <div className="small" style={{ marginTop: 3 }}>
          {status === 'missing'
            ? `이 기기에 영어 음성이 없습니다. ${GUIDE}`
            : `이 기기에서는 음성 재생을 지원하지 않습니다. ${GUIDE}`}
        </div>
      </div>
      <button className="btn sm ghost" aria-label="안내 닫기"
        onClick={() => { dismissed = true; setHidden(true) }}>닫기</button>
    </div>
  )
}

/** 설정 화면에서 쓰는 한 줄 상태 표시 */
export function VoiceStatusRow() {
  const [status, setStatus] = useState<VoiceStatus | null>(null)

  useEffect(() => { void englishVoiceStatus().then(setStatus) }, [])

  const label = status === null ? '확인 중…'
    : status === 'ok' ? '사용 가능'
    : status === 'missing' ? '영어 음성 없음'
    : '지원 안 함'

  return (
    <>
      <div className="row spread" style={{ minHeight: 44 }}>
        <span>발음 음성</span>
        <b className={status === 'ok' ? '' : 'dim'}>{label}</b>
      </div>
      {status && status !== 'ok' && (
        <div className="dim small">{GUIDE}</div>
      )}
    </>
  )
}
