// 문제집 출제 로직
// 유형: 단어→뜻 4지선다, 뜻→단어 4지선다, 철자 입력, 듣고 쓰기,
//       예문 빈칸, 파생어 문제
// 오답 선택지는 같은 level·같은 품사 풀(distractors.json)에서 뽑는다.
import { loadDistractors, sample, shuffled } from './data'
import type { DistractorEntry, Word } from './types'

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

// 품사 풀이 4지선다를 못 채울 때 넓혀 갈 유사 품사군.
// 관사 문제에 명사 오답이 섞이면 뜻을 몰라도 정답이 보이므로,
// 무작정 등급 전체로 넓히기 전에 성격이 비슷한 품사부터 빌려 온다.
const POS_GROUPS: string[][] = [
  ['명사', '대명사'],
  ['동사', '조동사'],
  ['형용사', '부사'],
  ['관사', '한정사', '수사', '대명사'],
  ['전치사', '접속사'],
  ['감탄사'],
]

/** 주어진 품사와 같은 군에 속한 품사 목록 (자기 자신 제외) */
function similarPos(pos: string): string[] {
  const group = POS_GROUPS.find((g) => g.includes(pos))
  return group ? group.filter((p) => p !== pos) : []
}

/**
 * 오답 후보를 넓은 순서대로 모은다: 같은 품사 → 유사 품사군 → 같은 등급 전체.
 * 앞 단계에서 충분히 모이면 뒤 단계는 쓰지 않는다.
 */
function distractorPool(
  pools: Record<string, DistractorEntry[]>, level: string, pos: string,
): DistractorEntry[][] {
  const same = pools[`${level}|${pos}`] ?? []
  const similar = similarPos(pos).flatMap((p) => pools[`${level}|${p}`] ?? [])
  const anyPos = Object.entries(pools)
    .filter(([k]) => k.startsWith(`${level}|`))
    .flatMap(([, v]) => v)
  return [same, similar, anyPos]
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

/** 같은 등급에서 오답 뜻 3개를 뽑는다 (같은 품사 → 유사 품사 → 전체 순) */
async function meaningDistractors(w: Word, n = 3): Promise<string[]> {
  const pools = await loadDistractors()
  const pos = w.meanings[0]?.pos ?? w.pos[0]
  const picked: string[] = []
  for (const stage of distractorPool(pools, w.level, pos)) {
    if (picked.length >= n) break
    const candidates = stage.filter(
      (e) => e.id !== w.id && e.ko !== firstMeaning(w) && !picked.includes(e.ko))
    picked.push(...sample(candidates, n - picked.length).map((e) => e.ko))
  }
  return picked.slice(0, n)
}

/** 같은 등급에서 오답 단어 3개를 뽑는다 (같은 품사 → 유사 품사 → 전체 순) */
async function wordDistractors(w: Word, n = 3): Promise<string[]> {
  const pools = await loadDistractors()
  const pos = w.meanings[0]?.pos ?? w.pos[0]
  const picked: string[] = []
  for (const stage of distractorPool(pools, w.level, pos)) {
    if (picked.length >= n) break
    const candidates = stage.filter(
      (e) => e.id !== w.id && e.w !== w.word && !picked.includes(e.w))
    picked.push(...[...new Set(sample(candidates, (n - picked.length) * 2).map((e) => e.w))]
      .slice(0, n - picked.length))
  }
  return picked.slice(0, n)
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

/**
 * 주어진 단어 목록으로 각 유형의 문제를 몇 개까지 만들 수 있는지 센다.
 * 오답 선택지는 등급 전체 풀(1,000개 이상)에서 항상 채워지므로 여기서는 세지 않고,
 * 유형별로 문제 자체가 성립하는 조건만 확인한다. (문제 수 안내에 쓰임)
 */
export function countAvailable(words: Word[], type: QuizType): number {
  switch (type) {
    case 'word-to-meaning':
    case 'meaning-to-word':
      return words.filter((w) => w.meanings[0]?.ko.length).length
    case 'spelling':
    case 'listening':
      return words.length
    case 'example-blank':
      return words.filter((w) => blankExample(w)).length
    case 'derived':
      return words.filter((w) => w.derived.length > 0).length
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
