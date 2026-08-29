// 데이터 로딩 중 · 실패 화면 (모든 화면이 같은 모습을 쓰도록 한 곳에 모음)

export function Loading({ label = '로딩 중…' }: { label?: string }) {
  return <div className="page center dim" role="status" aria-live="polite">{label}</div>
}

/** 앞말의 받침 유무에 따라 조사를 고른다 ('단어를' / '목록을') */
function josa(word: string, withBatchim: string, withoutBatchim: string): string {
  const code = word.charCodeAt(word.length - 1)
  // 한글 음절이 아니면 받침 없는 형태로 (영문·숫자 끝)
  if (code < 0xac00 || code > 0xd7a3) return withoutBatchim
  return (code - 0xac00) % 28 ? withBatchim : withoutBatchim
}

interface FailedProps {
  /** 무엇을 못 불러왔는지 (예: 'Day 7 단어') */
  what: string
  onRetry: () => void
  /** 함께 보여줄 보조 동작 (예: 홈으로) */
  children?: React.ReactNode
}

/** 데이터를 못 읽었을 때 — 원인을 알리고 다시 시도할 수 있게 한다 */
export function LoadFailed({ what, onRetry, children }: FailedProps) {
  return (
    <div className="page center" role="alert">
      <div className="card" style={{ padding: 28, maxWidth: 380 }}>
        <div style={{ fontSize: '2rem' }}>📡</div>
        <h2 style={{ fontSize: '1.15rem', margin: '10px 0 6px' }}>
          {what}{josa(what, '을', '를')} 불러오지 못했어요
        </h2>
        <p className="dim small" style={{ margin: 0 }}>
          앱을 다시 시작하거나 아래 버튼을 눌러 주세요.
          학습 기록은 안전하게 저장되어 있습니다.
        </p>
        <button className="btn primary mt16" onClick={onRetry}>다시 시도</button>
        {children}
      </div>
    </div>
  )
}
