import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import NavBar from './components/NavBar'
import Home from './pages/Home'
import Diagnostic from './pages/Diagnostic'
import Learn from './pages/Learn'
import Quiz from './pages/Quiz'
import Grammar from './pages/Grammar'
import Review from './pages/Review'
import Stats from './pages/Stats'
import SettingsPage from './pages/Settings'
import { getSettings, saveSettings } from './lib/db'
import { attachBackButton } from './lib/backButton'
import { attachPinchFontZoom } from './lib/pinchFontZoom'
import { applySkin } from './lib/skin'
import type { Settings } from './lib/types'
import { DEFAULT_SETTINGS, SKINS } from './lib/types'

interface SettingsCtx {
  settings: Settings
  update: (patch: Partial<Settings>) => void
}

const Ctx = createContext<SettingsCtx>({ settings: DEFAULT_SETTINGS, update: () => {} })
export const useSettings = () => useContext(Ctx)

export default function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [ready, setReady] = useState(false)
  /** 핀치로 조절 중인 배율 (조절 중에만 값이 있고, 안내 표시에 쓰임) */
  const [pinching, setPinching] = useState<number | null>(null)
  /** 뒤로가기를 한 번 더 누르면 종료된다는 안내 */
  const [exitHint, setExitHint] = useState(false)
  const nav = useNavigate()
  const location = useLocation()

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s)
      setReady(true)
    })
  }, [])

  // 스킨 + 다크모드 적용 (auto는 시스템 설정 따름, focus 스킨은 항상 다크)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const alwaysDark = SKINS.find((s) => s.id === settings.skin)?.alwaysDark ?? false
      const dark = alwaysDark || settings.darkMode === 'dark'
        || (settings.darkMode === 'auto' && mq.matches)
      applySkin(settings.skin, dark)
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [settings.darkMode, settings.skin])

  // 글자 크기: 루트 폰트 크기를 조절해 rem 단위 텍스트 전체를 스케일
  useEffect(() => {
    document.documentElement.style.fontSize = `${16 * settings.fontScale}px`
  }, [settings.fontScale])

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      void saveSettings(next)
      return next
    })
  }, [])

  // 두 손가락 핀치 = 화면 전체 확대 대신 글자 크기만 조절
  // (앱 틀은 화면에 고정되고 rem 텍스트만 커진다)
  const fontScaleRef = useRef(settings.fontScale)
  fontScaleRef.current = settings.fontScale
  useEffect(() => attachPinchFontZoom({
    getScale: () => fontScaleRef.current,
    // 조절 중에는 저장 없이 화면에만 반영 (매 프레임 저장 방지)
    onPreview: (scale) => {
      document.documentElement.style.fontSize = `${16 * scale}px`
      setPinching(scale)
    },
    onCommit: (scale) => {
      setPinching(null)
      if (scale !== fontScaleRef.current) update({ fontScale: scale })
    },
  }), [update])

  // 안드로이드 하드웨어 뒤로가기 — 앱이 곧바로 꺼지지 않게 한다
  const atRootRef = useRef(location.pathname === '/')
  atRootRef.current = location.pathname === '/'
  useEffect(() => attachBackButton({
    goBack: () => nav(-1),
    isAtRoot: () => atRootRef.current,
    showExitHint: () => {
      setExitHint(true)
      window.setTimeout(() => setExitHint(false), 2000)
    },
  }), [nav])

  if (!ready) return null

  return (
    <Ctx.Provider value={{ settings, update }}>
      <div className="app">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/diagnostic" element={<Diagnostic />} />
          <Route path="/learn/:day" element={<Learn />} />
          <Route path="/quiz" element={<Quiz />} />
          <Route path="/grammar" element={<Grammar />} />
          <Route path="/review" element={<Review />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <NavBar />
        {pinching !== null && (
          <div className="zoom-toast">글자 크기 {Math.round(pinching * 100)}%</div>
        )}
        {exitHint && (
          <div className="exit-toast" role="status">한 번 더 누르면 종료됩니다</div>
        )}
      </div>
    </Ctx.Provider>
  )
}
