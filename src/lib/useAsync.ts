// 비동기 데이터 로딩 상태를 한 곳에서 관리한다.
// 로딩 · 실패 · 성공 세 상태를 돌려주고, 실패하면 다시 시도할 수 있다.
// (데이터 청크를 못 읽을 때 화면이 '로딩 중…'에서 멈추던 문제를 막는다)
import { useCallback, useEffect, useRef, useState } from 'react'

export interface AsyncState<T> {
  data: T | null
  /** 첫 로딩 중이거나 재시도 중 */
  loading: boolean
  /** 실패 사유 (성공 시 null) */
  error: Error | null
  /** 다시 시도 */
  retry: () => void
}

/**
 * @param run  실행할 비동기 작업. deps가 바뀌면 다시 실행된다.
 * @param deps 의존성 (예: [day])
 */
export function useAsync<T>(run: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [nonce, setNonce] = useState(0)
  // 최신 run만 반영해 이전 요청 결과가 화면을 덮어쓰지 않게 한다
  const runRef = useRef(run)
  runRef.current = run

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    runRef.current()
      .then((v) => { if (!cancelled) { setData(v); setLoading(false) } })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e : new Error(String(e)))
        setLoading(false)
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])

  const retry = useCallback(() => setNonce((n) => n + 1), [])
  return { data, loading, error, retry }
}
