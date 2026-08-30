// 발음 재생 가능 여부 판정 — 소리가 안 나는데 안내가 없으면
// 사용자는 앱이 고장 났다고 생각하므로, 판정이 정확해야 한다.
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }))
vi.mock('@capacitor-community/text-to-speech', () => ({ TextToSpeech: {} }))

type FakeVoice = { lang: string; name: string; localService: boolean }

/** 브라우저 음성 목록을 흉내 낸다 (없으면 speechSynthesis 자체를 없앤다) */
function stubBrowser(voices: FakeVoice[] | null) {
  const win: Record<string, unknown> = {
    setTimeout: (fn: () => void) => { fn(); return 0 },
  }
  if (voices !== null) {
    win.speechSynthesis = {
      getVoices: () => voices,
      addEventListener: () => {},
      removeEventListener: () => {},
      cancel: () => {},
      speak: () => {},
    }
  }
  ;(globalThis as unknown as { window: unknown }).window = win
}

/** 모듈 캐시를 비우고 새로 불러온다 (판정 결과가 캐시되므로) */
async function freshTts() {
  vi.resetModules()
  return import('./tts')
}

beforeEach(() => { vi.resetModules() })

describe('영어 음성 감지', () => {
  it('영어 음성이 있으면 사용 가능', async () => {
    stubBrowser([{ lang: 'en-US', name: 'English', localService: true }])
    const { englishVoiceStatus } = await freshTts()
    expect(await englishVoiceStatus()).toBe('ok')
  })

  it('en-GB 같은 다른 영어 지역도 인정한다', async () => {
    stubBrowser([{ lang: 'en-GB', name: 'British', localService: true }])
    const { englishVoiceStatus } = await freshTts()
    expect(await englishVoiceStatus()).toBe('ok')
  })

  it('한국어 음성만 있으면 영어 음성 없음으로 본다', async () => {
    stubBrowser([{ lang: 'ko-KR', name: '한국어', localService: true }])
    const { englishVoiceStatus } = await freshTts()
    expect(await englishVoiceStatus()).toBe('missing')
  })

  it('음성 목록이 비어 있으면 영어 음성 없음', async () => {
    stubBrowser([])
    const { englishVoiceStatus } = await freshTts()
    expect(await englishVoiceStatus()).toBe('missing')
  })

  it('음성 기능 자체가 없으면 지원 안 함', async () => {
    stubBrowser(null)
    const { englishVoiceStatus } = await freshTts()
    expect(await englishVoiceStatus()).toBe('unsupported')
  })

  it('판정 결과를 캐시해 매번 다시 확인하지 않는다', async () => {
    let calls = 0
    ;(globalThis as unknown as { window: unknown }).window = {
      setTimeout: (fn: () => void) => { fn(); return 0 },
      speechSynthesis: {
        getVoices: () => { calls += 1; return [{ lang: 'en-US', name: 'e', localService: true }] },
        addEventListener: () => {}, removeEventListener: () => {},
        cancel: () => {}, speak: () => {},
      },
    }
    const { englishVoiceStatus } = await freshTts()
    await englishVoiceStatus()
    const afterFirst = calls
    await englishVoiceStatus()
    expect(calls).toBe(afterFirst)
  })
})
