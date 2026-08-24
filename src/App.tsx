import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
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

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      void saveSettings(next)
      return next
    })
  }, [])

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
      </div>
    </Ctx.Provider>
  )
}
