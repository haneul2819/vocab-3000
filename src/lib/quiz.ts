// 문제집 출제 로직
// 유형: 단어→뜻 4지선다, 뜻→단어 4지선다, 철자 입력, 듣고 쓰기,
//       예문 빈칸, 파생어 문제
// 오답 선택지는 같은 level·같은 품사 풀(distractors.json)에서 뽑는다.
import { loadDistractors, sample, shuffled } from './data'
import type { Word } from './types'

export type QuizType =
  | 'word-to-meaning'
  | 'meaning-to-word'
  | 'spelling'
  | 'listening'
  | 'example-blank'
  | 'derived'

export const QUIZ_TYPE_LABELS: Record<QuizType, string> = {
  'word-to-meaning': '단어 → 뜻',
  'meaning-to-word': '뜻 → 단어',
  spelling: '철자 입력',
  listening: '듣고 쓰기',
  'example-blank': '예문 빈칸',
  derived: '파생어',
}

export interface QuizQuestion {
  type: QuizType
  word: Word
  /** 문제 지문 (유형별 의미가 다름) */
  prompt: string
  /** 4지선다 선택지 (입력형이면 빈 배열) */
  choices: string[]
  /** 정답 (선택지 문자열 또는 입력 정답) */
  answer: string
  /** 입력형에서 대체 정답 (영미 철자 변이 등) */
  altAnswers: string[]
  /** 보조 정보 (예문 한국어 번역 등) */
  hint?: string
}

function firstMeaning(w: Word): string {
  const m = w.meanings[0]
  return m && m.ko.length ? `${m.ko[0]}` : ''
}

function meaningLabel(w: Word): string {
  const m = w.meanings[0]
  if (!m) return ''
  return `(${m.pos}) ${m.ko.slice(0, 2).join(', ')}`
}

/** 같은 level·같은 품사에서 오답 뜻 3개를 뽑는다 */
async function meaningDistractors(w: Word, n = 3): Promise<string[]> {
  const pools = await loadDistractors()
  const pos = w.meanings[0]?.pos ?? w.pos[0]
  const pool = (pools[`${w.level}|${pos}`] ?? [])
    .filter((e) => e.id !== w.id && e.ko !== firstMeaning(w))
  const picked = sample(pool, n).map((e) => e.ko)
  // 풀이 모자라면 다른 품사라도 같은 level에서 보충
  if (picked.length < n) {
    const extra = Object.entries(pools)
      .filter(([k]) => k.startsWith(`${w.level}|`))
      .flatMap(([, v]) => v)
      .filter((e) => e.id !== w.id && !picked.includes(e.ko))
    picked.push(...sample(extra, n - picked.length).map((e) => e.ko))
  }
  return picked
}

/** 같은 level·같은 품사에서 오답 단어 3개를 뽑는다 */
async function wordDistractors(w: Word, n = 3): Promise<string[]> {
  const pools = await loadDistractors()
  const pos = w.meanings[0]?.pos ?? w.pos[0]
  const pool = (pools[`${w.level}|${pos}`] ?? []).filter((e) => e.id !== w.id)
  const picked = [...new Set(sample(pool, n * 2).map((e) => e.w))].slice(0, n)
  if (picked.length < n) {
    const extra = Object.entries(pools)
      .filter(([k]) => k.startsWith(`${w.level}|`))
      .flatMap(([, v]) => v)
      .filter((e) => e.id !== w.id && !picked.includes(e.w))
    picked.push(...[...new Set(sample(extra, n * 2).map((e) => e.w))].slice(0, n - picked.length))
  }
  return picked
}

/** 예문에서 대상 단어(굴절형 포함)를 찾아 빈칸 처리한다 */
function blankExample(w: Word): { text: string; blanked: string } | null {
  for (const ex of w.examples) {
    const tokens = ex.en.split(/(\s+)/)
    const base = w.word.toLowerCase()
    for (let i = 0; i < tokens.length; i++) {
      const clean = tokens[i].toLowerCase().replace(/[^a-z']/g, '')
      if (!clean) continue
      const stem = clean.replace(/(ies|ied|ier|iest|ing|ed|es|s|er|est|d)$/,'')
      if (clean === base || stem === base || stem === base.slice(0, -1) ||
          (base.endsWith('y') && stem === base.slice(0, -1))) {
        const answer = tokens[i].replace(/[^a-zA-Z']/g, '')
        const blankedTokens = [...tokens]
        blankedTokens[i] = tokens[i].replace(/[a-zA-Z']+/, '＿'.repeat(Math.min(answer.length, 8)))
        return { text: blankedTokens.join(''), blanked: answer }
      }
    }
  }
  return null
}

/** 한 단어에 대해 지정 유형의 문제를 만든다. 만들 수 없으면 null */
export async function makeQuestion(w: Word, type: QuizType): Promise<QuizQuestion | null> {
  switch (type) {
    case 'word-to-meaning': {
      const answer = meaningLabel(w)
      if (!answer) return null
      const wrong = (await meaningDistractors(w)).map((ko) => `(${w.meanings[0].pos}) ${ko}`)
      if (wrong.length < 3) return null
      return { type, word: w, prompt: w.word, choices: shuffled([answer, ...wrong]), answer, altAnswers: [] }
    }
    case 'meaning-to-word': {
      const prompt = meaningLabel(w)
      if (!prompt) return null
      const wrong = await wordDistractors(w)
      if (wrong.length < 3) return null
      return { type, word: w, prompt, choices: shuffled([w.word, ...wrong]), answer: w.word, altAnswers: [] }
    }
    case 'spelling':
      return {
        type, word: w, prompt: meaningLabel(w), choices: [], answer: w.word,
        altAnswers: w.alt_spelling ? [w.alt_spelling] : [],
        hint: `${w.word.length}글자`,
      }
    case 'listening':
      // 음성 재생 후 철자 입력 (재생은 화면 컴포넌트에서 담당)
      return {
        type, word: w, prompt: '', choices: [], answer: w.word,
        altAnswers: w.alt_spelling ? [w.alt_spelling] : [],
      }
    case 'example-blank': {
      const blanked = blankExample(w)
      if (!blanked) return null
      const ex = w.examples.find((e) => blankExample({ ...w, examples: [e] }))
      return {
        type, word: w, prompt: blanked.text, choices: [], answer: blanked.blanked,
        altAnswers: [w.word], hint: ex?.ko,
      }
    }
    case 'derived': {
      if (!w.derived.length) return null
      const target = w.derived[Math.floor(Math.random() * w.derived.length)]
      const wrong = await wordDistractors(w)
      if (wrong.length < 3) return null
      return {
        type, word: w,
        prompt: `"${w.word}" (${firstMeaning(w)})의 파생어는?`,
        choices: shuffled([target, ...wrong]), answer: target, altAnswers: [],
      }
    }
  }
}

/** 단어 목록에서 문제 세트를 만든다. 유형 미지정 시 단어별로 가능한 유형을 섞는다 */
export async function buildQuiz(
  words: Word[], count: number, type?: QuizType,
): Promise<QuizQuestion[]> {
  const questions: QuizQuestion[] = []
  const pool = shuffled(words)
  const allTypes: QuizType[] = [
    'word-to-meaning', 'meaning-to-word', 'spelling', 'listening', 'example-blank', 'derived',
  ]
  for (const w of pool) {
    if (questions.length >= count) break
    const tryTypes = type ? [type] : shuffled(allTypes)
    for (const t of tryTypes) {
      const q = await makeQuestion(w, t)
      if (q) { questions.push(q); break }
    }
  }
  return questions
}

/** 입력 답 채점 (대소문자·공백 무시, 영미 철자 변이 허용) */
export function checkTypedAnswer(q: QuizQuestion, typed: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase()
  const t = norm(typed)
  if (!t) return false
  return t === norm(q.answer) || q.altAnswers.some((a) => t === norm(a))
}
