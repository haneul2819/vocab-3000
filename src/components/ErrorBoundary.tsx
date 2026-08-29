// 앱 최상위 에러 경계 — 렌더 중 예외가 나도 흰 화면 대신 복구 안내를 보여준다.
// 학습 기록은 IndexedDB에 있으므로 화면이 깨져도 안전하다는 점을 함께 알린다.
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 개발 중에는 원인을 볼 수 있게 남긴다 (배포 빌드에서도 기기 로그로만 남음)
    console.error('처리되지 않은 오류:', error, info.componentStack)
  }

  private reset = () => {
    this.setState({ error: null })
    // 해시 라우터라 홈으로 돌린 뒤 다시 그린다
    window.location.hash = '#/'
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="page center" role="alert">
        <div className="card" style={{ padding: 28, maxWidth: 400 }}>
          <div style={{ fontSize: '2rem' }}>🙏</div>
          <h2 style={{ fontSize: '1.15rem', margin: '10px 0 6px' }}>문제가 생겼어요</h2>
          <p className="dim small" style={{ margin: 0 }}>
            화면을 그리는 중 오류가 났습니다.
            <b> 학습 기록은 그대로 저장되어 있으니 안심하세요.</b>
          </p>
          <button className="btn primary mt16" onClick={this.reset}>홈으로 돌아가기</button>
          <button className="btn ghost mt8" onClick={() => window.location.reload()}>앱 새로고침</button>
          <details className="mt16" style={{ textAlign: 'left' }}>
            <summary className="dim small" style={{ cursor: 'pointer' }}>오류 내용 보기</summary>
            <pre className="small dim" style={{
              whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 8,
            }}>{error.message}</pre>
          </details>
        </div>
      </div>
    )
  }
}
