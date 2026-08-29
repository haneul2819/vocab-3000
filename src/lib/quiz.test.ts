// 출제 로직 테스트 — 오답 선택지 데이터는 실제 파일 대신 고정값을 넣어 검증한다.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DistractorEntry, Word } from './types'

// loadDistractors만 대체하고 shuffled/sample 같은 순수 함수는 실제 구현을 쓴다
const pools: Record<string, DistractorEntry[]> = {
  '초등|명사': [
    { id: 101, w: 'desk', ko: '책상' },
    { id: 102, w: 'chair', ko: '의자' },
    { id: 103, w: 'window', ko: '창문' },
    { id: 104, w: 'door', ko: '문' },
  ],
}
vi.mock('./data', async () => {
  const real = await vi.importActual<typeof import('./data')>('./data')
  return { ...real, loadDistractors: async () => pools }
})

const { buildQuiz, checkTypedAnswer, makeQuestion } = await import('./quiz')

function word(over: Partial<Word> = {}): Word {
  return {
    id: 1, word: 'apple', level: '초등', stars: '', alt_spelling: '',
    derived: [], ipa: 'ˈæpəl', pos: ['명사'],
    meanings: [{ pos: '명사', ko: ['사과'] }],
    examples: [{ en: 'I ate an apple.', ko: '나는 사과를 먹었다.' }],
    theme: '음식', day: 1, ...over,
  }
}

describe('단어 → 뜻', () => {
  it('정답을 포함해 4지선다를 만든다', async () => {
    const q = await makeQuestion(word(), 'word-to-meaning')
    expect(q).not.toBeNull()
    expect(q!.choices).toHaveLength(4)
    expect(q!.choices).toContain(q!.answer)
    expect(q!.prompt).toBe('apple')
  })
  it('선택지가 서로 겹치지 않는다', async () => {
    const q = await makeQuestion(word(), 'word-to-meaning')
    expect(new Set(q!.choices).size).toBe(4)
  })
})

describe('뜻 → 단어', () => {
  it('정답 단어가 선택지에 있다', async () => {
    const q = await makeQuestion(word(), 'meaning-to-word')
    expect(q!.answer).toBe('apple')
    expect(q!.choices).toContain('apple')
    expect(q!.choices).toHaveLength(4)
  })
})

describe('철자 입력', () => {
  it('글자 수를 힌트로 준다', async () => {
    const q = await makeQuestion(word(), 'spelling')
    expect(q!.answer).toBe('apple')
    expect(q!.hint).toBe('5글자')
  })
  it('다른 철자가 있으면 대체 정답으로 인정한다', async () => {
    const q = await makeQuestion(word({ word: 'color', alt_spelling: 'colour' }), 'spelling')
    expect(q!.altAnswers).toContain('colour')
  })
})

describe('예문 빈칸', () => {
  it('예문에서 대상 단어를 빈칸으로 만든다', async () => {
    const q = await makeQuestion(word(), 'example-blank')
    expect(q).not.toBeNull()
    expect(q!.answer).toBe('apple')
    expect(q!.prompt).not.toContain('apple')
    expect(q!.prompt).toContain('＿')
  })
  it('굴절형(-s, -ed)도 찾아낸다', async () => {
    const w = word({ word: 'play', examples: [{ en: 'She played outside.', ko: '그녀는 밖에서 놀았다.' }] })
    const q = await makeQuestion(w, 'example-blank')
    expect(q!.answer).toBe('played')
  })
  it('예문에 단어가 없으면 만들지 않는다', async () => {
    const w = word({ word: 'zebra', examples: [{ en: 'Nothing matches.', ko: '없음' }] })
    expect(await makeQuestion(w, 'example-blank')).toBeNull()
  })
})

describe('파생어', () => {
  it('파생어가 없으면 문제를 만들지 않는다', async () => {
    expect(await makeQuestion(word({ derived: [] }), 'derived')).toBeNull()
  })
  it('파생어가 있으면 그것이 정답이 된다', async () => {
    const q = await makeQuestion(word({ derived: ['apples'] }), 'derived')
    expect(q!.answer).toBe('apples')
    expect(q!.choices).toContain('apples')
  })
})

describe('문제 세트 만들기', () => {
  const words = Array.from({ length: 10 }, (_, i) =>
    word({ id: i + 1, word: `word${i}`, examples: [{ en: `A word${i} here.`, ko: '예문' }] }))

  it('요청한 개수만큼 만든다', async () => {
    expect(await buildQuiz(words, 5)).toHaveLength(5)
  })
  it('단어 수보다 많이 요청하면 가능한 만큼만 만든다', async () => {
    expect((await buildQuiz(words, 50)).length).toBeLessThanOrEqual(10)
  })
  it('유형을 고정하면 그 유형만 나온다', async () => {
    const qs = await buildQuiz(words, 5, 'word-to-meaning')
    expect(qs.every((q) => q.type === 'word-to-meaning')).toBe(true)
  })
  it('만들 수 없는 유형을 고정하면 빈 세트가 된다 (파생어 없음)', async () => {
    expect(await buildQuiz(words, 5, 'derived')).toHaveLength(0)
  })
})

describe('입력 답 채점', () => {
  const q = {
    type: 'spelling' as const, word: word(), prompt: '', choices: [],
    answer: 'apple', altAnswers: ['apples'],
  }
  it('정확히 맞으면 정답', () => {
    expect(checkTypedAnswer(q, 'apple')).toBe(true)
  })
  it('대소문자와 앞뒤 공백은 무시한다', () => {
    expect(checkTypedAnswer(q, '  APPLE ')).toBe(true)
  })
  it('대체 정답도 인정한다', () => {
    expect(checkTypedAnswer(q, 'Apples')).toBe(true)
  })
  it('빈 입력은 오답', () => {
    expect(checkTypedAnswer(q, '   ')).toBe(false)
  })
  it('틀린 답은 오답', () => {
    expect(checkTypedAnswer(q, 'apply')).toBe(false)
  })
})

beforeEach(() => { /* 각 테스트는 모듈 상태를 공유하지 않는다 */ })
