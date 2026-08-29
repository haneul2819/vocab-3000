// 안드로이드 하드웨어 뒤로가기 처리
// 기본 동작(앱 즉시 종료)을 막고 다음 순서로 처리한다:
//   1) 열려 있는 오버레이(공유 시트 등)가 있으면 그것만 닫는다
//   2) 이전 화면이 있으면 뒤로 간다
//   3) 홈이면 "한 번 더 누르면 종료" 안내 후 2초 안에 다시 누를 때만 종료
import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'

/** 오버레이가 스스로 등록하는 닫기 처리기. true를 반환하면 뒤로가기를 소비한 것으로 본다 */
type OverlayHandler = () => boolean

const overlays: OverlayHandler[] = []

/**
 * 오버레이(시트·다이얼로그)가 열려 있는 동안 등록한다.
 * 나중에 등록된 것이 먼저 처리된다. 반환된 함수로 해제한다.
 */
export function registerOverlay(handler: OverlayHandler): () => void {
  overlays.push(handler)
  return () => {
    const i = overlays.indexOf(handler)
    if (i >= 0) overlays.splice(i, 1)
  }
}

interface Options {
  /** 이전 화면으로 이동 */
  goBack: () => void
  /** 지금 홈(루트)인지 */
  isAtRoot: () => boolean
  /** 종료 안내 문구 표시 */
  showExitHint: () => void
}

/** 리스너를 등록하고 해제 함수를 돌려준다. 네이티브가 아니면 아무것도 하지 않는다. */
export function attachBackButton(opts: Options): () => void {
  if (!Capacitor.isNativePlatform()) return () => {}

  let exitArmedUntil = 0
  const handle = () => {
    // 1) 오버레이 우선 (가장 최근 것부터)
    for (let i = overlays.length - 1; i >= 0; i--) {
      if (overlays[i]()) return
    }
    // 2) 이전 화면
    if (!opts.isAtRoot()) {
      opts.goBack()
      return
    }
    // 3) 홈에서는 두 번 눌러야 종료
    const now = Date.now()
    if (now < exitArmedUntil) {
      void App.exitApp()
      return
    }
    exitArmedUntil = now + 2000
    opts.showExitHint()
  }

  const listener = App.addListener('backButton', handle)
  return () => { void listener.then((l) => l.remove()) }
}
