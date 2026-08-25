// 음성 재생 유틸 — 웹은 Web Speech API, 네이티브 앱(Capacitor)은 안드로이드
// WebView에 speechSynthesis가 없으므로 네이티브 TTS 플러그인을 사용한다.
// 재생 경로를 이 모듈 하나로 모아 두어, 추후 mp3 파일 재생으로
// 교체할 때 이 파일만 바꾸면 된다.
import { Capacitor } from '@capacitor/core'
import { TextToSpeech } from '@capacitor-community/text-to-speech'

const isNative = Capacitor.isNativePlatform()

let voice: SpeechSynthesisVoice | null = null
let voicesReady = false

function pickVoice() {
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return
  // en-US 음성 우선, 없으면 아무 영어 음성
  voice =
    voices.find((v) => v.lang === 'en-US' && v.localService) ??
    voices.find((v) => v.lang === 'en-US') ??
    voices.find((v) => v.lang.startsWith('en')) ??
    null
  voicesReady = true
}

if (!isNative && typeof window !== 'undefined' && 'speechSynthesis' in window) {
  pickVoice()
  window.speechSynthesis.addEventListener('voiceschanged', pickVoice)
}

export function ttsAvailable(): boolean {
  if (isNative) return true
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/** 네이티브 TTS 재생 — 완료 시 resolve, 엔진 없음 등 실패는 조용히 무시 */
async function speakNative(text: string, lang: string, rate: number): Promise<void> {
  try {
    await TextToSpeech.stop() // 겹침 방지
    await TextToSpeech.speak({ text, lang, rate, category: 'playback' })
  } catch {
    // 기기에 TTS 엔진이 없거나 언어 미지원 — 앱 동작은 계속
  }
}

/** 영어 텍스트를 읽는다. 완료(또는 실패) 시 resolve. */
export function speak(text: string, opts?: { rate?: number }): Promise<void> {
  if (!text) return Promise.resolve()
  if (isNative) return speakNative(text, 'en-US', opts?.rate ?? 0.95)
  return new Promise((resolve) => {
    if (!ttsAvailable()) return resolve()
    if (!voicesReady) pickVoice()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-US'
    if (voice) u.voice = voice
    u.rate = opts?.rate ?? 0.95
    u.onend = () => resolve()
    u.onerror = () => resolve()
    window.speechSynthesis.cancel() // 겹침 방지
    window.speechSynthesis.speak(u)
  })
}

/** 한국어 텍스트를 읽는다(듣기 모드의 뜻 재생용). */
export function speakKo(text: string): Promise<void> {
  if (!text) return Promise.resolve()
  if (isNative) return speakNative(text, 'ko-KR', 1.0)
  return new Promise((resolve) => {
    if (!ttsAvailable()) return resolve()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'ko-KR'
    u.rate = 1.0
    u.onend = () => resolve()
    u.onerror = () => resolve()
    window.speechSynthesis.speak(u)
  })
}

export function stopSpeaking(): void {
  if (isNative) {
    void TextToSpeech.stop().catch(() => {})
    return
  }
  if (ttsAvailable()) window.speechSynthesis.cancel()
}

export function pause(sec: number): Promise<void> {
  return new Promise((r) => setTimeout(r, sec * 1000))
}
