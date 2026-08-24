// 음성 재생 유틸 — Web Speech API(speechSynthesis) 기반.
// 재생 경로를 이 모듈 하나로 모아 두어, 추후 mp3 파일 재생으로
// 교체할 때 이 파일만 바꾸면 된다.

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

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  pickVoice()
  window.speechSynthesis.addEventListener('voiceschanged', pickVoice)
}

export function ttsAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/** 영어 텍스트를 읽는다. 완료(또는 실패) 시 resolve. */
export function speak(text: string, opts?: { rate?: number }): Promise<void> {
  return new Promise((resolve) => {
    if (!ttsAvailable() || !text) return resolve()
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
  return new Promise((resolve) => {
    if (!ttsAvailable() || !text) return resolve()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'ko-KR'
    u.rate = 1.0
    u.onend = () => resolve()
    u.onerror = () => resolve()
    window.speechSynthesis.speak(u)
  })
}

export function stopSpeaking(): void {
  if (ttsAvailable()) window.speechSynthesis.cancel()
}

export function pause(sec: number): Promise<void> {
  return new Promise((r) => setTimeout(r, sec * 1000))
}
