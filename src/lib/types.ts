// 데이터 모델 타입 정의

export type Level = '초등' | '중고공통' | '선택'

export interface Meaning {
  pos: string
  ko: string[]
}

export interface Example {
  en: string
  ko: string
}

export interface Word {
  id: number
  word: string
  level: Level
  stars: string
  alt_spelling: string
  derived: string[]
  ipa: string
  pos: string[]
  meanings: Meaning[]
  examples: Example[]
  theme: string
  day: number
}

/** index.json의 경량 단어 색인 항목 */
export interface IndexWord {
  id: number
  w: string
  d: number
  l: Level
  ko: string
}

export interface DayMeta {
  day: number
  level: Level
  count: number
}

export interface DataIndex {
  days: DayMeta[]
  words: IndexWord[]
}

export interface GrammarItem {
  id: number
  sentence: string
  level: string // 초 | 중 | 고
}

export interface GrammarCategory {
  category: string
  items: GrammarItem[]
}

/** 오답 선택지 풀 항목 (level|품사 키) */
export interface DistractorEntry {
  id: number
  w: string
  ko: string
}

// 단어 학습 상태: unseen → learning → confused → mastered
export type WordStatus = 'unseen' | 'learning' | 'confused' | 'mastered'

/** IndexedDB에 저장되는 단어별 학습 상태 */
export interface WordState {
  id: number
  status: WordStatus
  /** 마지막 판정: know(앎) / fuzzy(헷갈림) / no(모름) */
  lastGrade: 'know' | 'fuzzy' | 'no' | ''
  /** 연속 '앎' 횟수 (오답 노트 졸업 판정용) */
  knowStreak: number
  /** 오답 노트 포함 여부 (모름·헷갈림 판정 시 true, 3연속 앎이면 졸업) */
  wrongNote: boolean
  /** 간격 반복 단계 인덱스 (srs.ts 참고) */
  srsStep: number
  /** 다음 복습 예정일 (epoch ms) */
  dueAt: number
  /** 문제집 정답/오답 누적 */
  quizRight: number
  quizWrong: number
  updatedAt: number
}

export interface Settings {
  darkMode: 'auto' | 'dark' | 'light'
  autoSpeak: boolean
  direction: 'en-ko' | 'ko-en'
  shuffle: boolean
  listenGapSec: number
  listenRepeat: number
  startDay: number
  currentDay: number
}

export const DEFAULT_SETTINGS: Settings = {
  darkMode: 'auto',
  autoSpeak: false,
  direction: 'en-ko',
  shuffle: false,
  listenGapSec: 1.5,
  listenRepeat: 1,
  startDay: 1,
  currentDay: 1,
}

/** 일별 학습 기록 (연속 학습일·통계용) */
export interface DailyLog {
  date: string // YYYY-MM-DD
  learned: number
  reviewed: number
  quizRight: number
  quizWrong: number
}
