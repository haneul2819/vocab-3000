// 듣기 모드처럼 화면을 보지 않고 쓰는 기능 동안 화면이 꺼지지 않게 한다.
// 브라우저·WebView의 Screen Wake Lock을 쓰고, 지원하지 않으면 조용히 넘어간다.

type Sentinel = { release: () => Promise<void>; addEventListener: (t: string, f: () => void) => void }

let sentinel: Sentinel | null = null

function api(): { request: (type: 'screen') => Promise<Sentinel> } | null {
  const wl = (navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<Sentinel> } }).wakeLock
  return wl ?? null
}

/** 화면 꺼짐 방지 시작 (이미 걸려 있으면 아무 일도 하지 않음) */
export async function keepScreenOn(): Promise<void> {
  if (sentinel) return
  const wl = api()
  if (!wl) return
  try {
    sentinel = await wl.request('screen')
    // 다른 앱으로 갔다 오면 잠금이 풀리므로 참조를 비운다
    sentinel.addEventListener('release', () => { sentinel = null })
  } catch {
    // 배터리 절약 모드 등으로 거부될 수 있다 — 재생은 계속한다
    sentinel = null
  }
}

/** 화면 꺼짐 방지 해제 */
export async function releaseScreen(): Promise<void> {
  const s = sentinel
  sentinel = null
  if (!s) return
  try { await s.release() } catch { /* 이미 해제됨 */ }
}
