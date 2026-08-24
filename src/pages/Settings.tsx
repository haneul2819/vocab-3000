// 설정 — 다크모드, 듣기 옵션, 진도 초기화, 데이터 내보내기/가져오기
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettings } from '../App'
import { exportAll, importAll, resetProgress, type ExportData } from '../lib/db'
import { SKINS } from '../lib/types'

// 글자 크기 배율 선택지 (html 루트 폰트 크기에 적용)
const FONT_SCALES = [
  { v: 0.9, label: '작게' },
  { v: 1, label: '보통' },
  { v: 1.15, label: '크게' },
  { v: 1.3, label: '아주 크게' },
]

export default function SettingsPage() {
  const nav = useNavigate()
  const { settings, update } = useSettings()
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)
  const skinMeta = SKINS.find((s) => s.id === settings.skin)

  const doExport = async () => {
    const data = await exportAll()
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vocab3000-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setMsg('진도 데이터를 내보냈어요.')
  }

  const doImport = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as ExportData
      await importAll(data)
      setMsg('가져오기 완료! 앱을 새로고침합니다…')
      setTimeout(() => window.location.reload(), 800)
    } catch (e) {
      setMsg(`가져오기 실패: ${e instanceof Error ? e.message : '알 수 없는 오류'}`)
    }
  }

  const doReset = async () => {
    await resetProgress()
    setMsg('진도를 초기화했어요. 앱을 새로고침합니다…')
    setTimeout(() => window.location.reload(), 800)
  }

  return (
    <div className="page">
      <div className="row spread">
        <h1>설정</h1>
        <button className="btn sm ghost" onClick={() => nav('/')}>닫기</button>
      </div>

      <h2>화면</h2>
      <div className="card">
        <div className="dim small" style={{ marginBottom: 8 }}>스킨</div>
        <div className="skin-grid">
          {SKINS.map((s) => (
            <button key={s.id}
              className={`skin-option${settings.skin === s.id ? ' selected' : ''}`}
              onClick={() => update({ skin: s.id })}>
              <span className="swatch" style={{ background: s.colors.bg }}>
                <b style={{ color: s.colors.text, fontSize: '0.95rem' }}>가 Aa</b>
                <span className="dots">
                  {s.colors.accents.map((c) => <span key={c} style={{ background: c }} />)}
                </span>
              </span>
              <span className="name">{s.name}</span>
              <span className="desc">{s.desc}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="dim small" style={{ marginBottom: 6 }}>글자 크기</div>
        <div className="seg" style={{ marginBottom: 6 }}>
          {FONT_SCALES.map((f) => (
            <button key={f.v} className={settings.fontScale === f.v ? 'active' : ''}
              style={{ fontSize: `${0.88 * f.v}rem` }}
              onClick={() => update({ fontScale: f.v })}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="small dim">두 손가락으로 화면을 벌려(핀치 줌) 일시적으로 확대할 수도 있어요.</div>
      </div>
      <div className="card">
        <div className="dim small" style={{ marginBottom: 6 }}>다크 모드</div>
        {skinMeta?.alwaysDark ? (
          <div className="small dim">‘{skinMeta.name}’ 스킨은 항상 어두운 화면으로 표시됩니다.</div>
        ) : (
          <div className="seg" style={{ marginBottom: 0 }}>
            {(['auto', 'light', 'dark'] as const).map((m) => (
              <button key={m} className={settings.darkMode === m ? 'active' : ''}
                onClick={() => update({ darkMode: m })}>
                {m === 'auto' ? '시스템' : m === 'light' ? '밝게' : '어둡게'}
              </button>
            ))}
          </div>
        )}
      </div>

      <h2>학습</h2>
      <div className="card">
        <label className="row spread" style={{ minHeight: 44 }}>
          <span>카드 열릴 때 자동 발음</span>
          <input type="checkbox" checked={settings.autoSpeak}
            onChange={(e) => update({ autoSpeak: e.target.checked })}
            style={{ width: 22, height: 22 }} />
        </label>
        <div className="row spread" style={{ minHeight: 44 }}>
          <span>듣기 모드 간격</span>
          <div className="row">
            <button className="btn sm ghost"
              onClick={() => update({ listenGapSec: Math.max(0.5, settings.listenGapSec - 0.5) })}>−</button>
            <b style={{ width: 48, textAlign: 'center' }}>{settings.listenGapSec}초</b>
            <button className="btn sm ghost"
              onClick={() => update({ listenGapSec: Math.min(10, settings.listenGapSec + 0.5) })}>＋</button>
          </div>
        </div>
        <div className="row spread" style={{ minHeight: 44 }}>
          <span>듣기 모드 반복</span>
          <div className="row">
            <button className="btn sm ghost"
              onClick={() => update({ listenRepeat: Math.max(1, settings.listenRepeat - 1) })}>−</button>
            <b style={{ width: 48, textAlign: 'center' }}>{settings.listenRepeat}회</b>
            <button className="btn sm ghost"
              onClick={() => update({ listenRepeat: Math.min(5, settings.listenRepeat + 1) })}>＋</button>
          </div>
        </div>
      </div>

      <h2>데이터</h2>
      <div className="card">
        <button className="btn" onClick={() => void doExport()}>📤 데이터 내보내기 (JSON)</button>
        <button className="btn mt8" onClick={() => fileRef.current?.click()}>📥 데이터 가져오기 (JSON)</button>
        <input ref={fileRef} type="file" accept="application/json" hidden
          onChange={(e) => e.target.files?.[0] && void doImport(e.target.files[0])} />
        {!confirmReset ? (
          <button className="btn ghost mt8" style={{ color: 'var(--bad)' }}
            onClick={() => setConfirmReset(true)}>
            🗑 진도 초기화
          </button>
        ) : (
          <div className="mt8">
            <div className="small center" style={{ marginBottom: 8 }}>
              모든 학습 기록이 삭제됩니다. 정말 초기화할까요?
            </div>
            <div className="row">
              <button className="btn bad" onClick={() => void doReset()}>초기화</button>
              <button className="btn" onClick={() => setConfirmReset(false)}>취소</button>
            </div>
          </div>
        )}
        {msg && <div className="small center mt8" style={{ color: 'var(--primary)' }}>{msg}</div>}
      </div>

      <h2>정보</h2>
      <div className="card small dim" style={{ lineHeight: 1.6 }}>
        단어 목록: 교육부 고시 제2022-33호 영어과 교육과정 기본 어휘.<br />
        뜻·예문·음성은 본 앱에서 자체 제작.<br />
        본 앱은 교육부 공식 앱이 아니며, 무료로 제공됩니다.
      </div>
    </div>
  )
}
