// 두 손가락 핀치 = 글자 크기 조절
// 브라우저 기본 확대(화면 전체가 커지고 좌우로 밀리는 동작)를 막고,
// 대신 루트 폰트 크기만 바꿔 앱 틀은 화면에 고정된 채 글자만 커지게 한다.

/** 핀치로 조절 가능한 배율 범위 (설정 화면 선택지보다 넉넉하게) */
export const FONT_SCALE_MIN = 0.8
export const FONT_SCALE_MAX = 1.8
/** 배율 반올림 단위 — 손가락 떨림으로 값이 계속 바뀌는 것을 막는다 */
const STEP = 0.05

function distance(a: Touch, b: Touch): number {
  return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY)
}

function clamp(v: number): number {
  return Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, v))
}

interface Options {
  /** 현재 저장된 배율 (핀치 시작 기준값) */
  getScale: () => number
  /** 핀치 중 실시간 미리보기 — 저장 없이 화면에만 반영 */
  onPreview: (scale: number) => void
  /** 손을 뗐을 때 최종 배율 */
  onCommit: (scale: number) => void
}

/** 문서 전체에 핀치 리스너를 붙이고, 해제 함수를 돌려준다. */
export function attachPinchFontZoom(opts: Options): () => void {
  let baseDistance = 0
  let baseScale = 1
  let current = 1
  let active = false

  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 2) return
    baseDistance = distance(e.touches[0], e.touches[1])
    if (!baseDistance) return
    baseScale = opts.getScale()
    current = baseScale
    active = true
  }

  const onTouchMove = (e: TouchEvent) => {
    if (!active || e.touches.length !== 2) return
    // 브라우저 기본 확대를 막는다 (passive: false 로 등록해야 동작)
    e.preventDefault()
    const ratio = distance(e.touches[0], e.touches[1]) / baseDistance
    const next = clamp(Math.round((baseScale * ratio) / STEP) * STEP)
    if (next !== current) {
      current = next
      opts.onPreview(next)
    }
  }

  const onTouchEnd = (e: TouchEvent) => {
    // 손가락이 하나라도 떨어지면 핀치 종료
    if (!active || e.touches.length >= 2) return
    active = false
    opts.onCommit(current)
  }

  // iOS Safari는 별도 gesture 이벤트로도 확대하므로 함께 막는다
  const blockGesture = (e: Event) => e.preventDefault()

  document.addEventListener('touchstart', onTouchStart, { passive: true })
  document.addEventListener('touchmove', onTouchMove, { passive: false })
  document.addEventListener('touchend', onTouchEnd)
  document.addEventListener('touchcancel', onTouchEnd)
  document.addEventListener('gesturestart', blockGesture)
  document.addEventListener('gesturechange', blockGesture)
  document.addEventListener('gestureend', blockGesture)

  return () => {
    document.removeEventListener('touchstart', onTouchStart)
    document.removeEventListener('touchmove', onTouchMove)
    document.removeEventListener('touchend', onTouchEnd)
    document.removeEventListener('touchcancel', onTouchEnd)
    document.removeEventListener('gesturestart', blockGesture)
    document.removeEventListener('gesturechange', blockGesture)
    document.removeEventListener('gestureend', blockGesture)
  }
}
