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

/** 스킨(테마) — classic이 기존 기본 디자인, 나머지 4종은 디자인 시안 기반 */
export type Skin = 'classic' | 'minimal' | 'pop' | 'focus' | 'paper'

export interface SkinMeta {
  id: Skin
  name: string
  desc: string
  /** 스와치 미리보기 색 (배경/글자/포인트 3색) */
  colors: { bg: string; text: string; accents: string[] }
  /** 항상 다크로 고정되는 스킨 여부 */
  alwaysDark?: boolean
}

export const SKINS: SkinMeta[] = [
  {
    id: 'classic', name: '클래식', desc: '기본 디자인 · 파랑 포인트',
    colors: { bg: '#f4f6fb', text: '#17203a', accents: ['#2563eb', '#16a34a', '#d97706'] },
  },
  {
    id: 'minimal', name: '미니멀 에디토리얼', desc: '세리프 + 여백 · 차분한 집중',
    colors: { bg: '#faf7f2', text: '#201d1a', accents: ['#b45309', '#3f6212', '#b3261e'] },
  },
  {
    id: 'pop', name: '플레이풀 팝', desc: '두꺼운 테두리 · 게임 감성',
    colors: { bg: '#fff6e3', text: '#33302e', accents: ['#7c3aed', '#ffc800', '#2ec4b6'] },
  },
  {
    id: 'focus', name: '다크 딥포커스', desc: '딥 네이비 + 민트 · 항상 다크',
    colors: { bg: '#0b0f14', text: '#e6edf3', accents: ['#2dd4a8', '#a78bfa', '#fbbf24'] },
    alwaysDark: true,
  },
  {
    id: 'paper', name: '소프트 페이퍼', desc: '파스텔 공책 · 부드러운 감성',
    colors: { bg: '#f7f4ec', text: '#4a443c', accents: ['#8b7cd8', '#3e7a5e', '#e58f7b'] },
  },
]

export interface Settings {
  darkMode: 'auto' | 'dark' | 'light'
  skin: Skin
  /** 글자 크기 배율 (1 = 100%) — html 루트 폰트 크기에 적용 */
  fontScale: number
  autoSpeak: boolean
  direction: 'en-ko' | 'ko-en'
  shuffle: boolean
  listenGapSec: number
  listenRepeat: number
  startDay: number
  currentDay: number
  /** 복습 알림 사용 여부 (네이티브 앱에서만 동작) */
  reminderOn: boolean
  /** 알림 시각 'HH:MM' (24시간) */
  reminderTime: string
}

export const DEFAULT_SETTINGS: Settings = {
  darkMode: 'auto',
  skin: 'classic',
  fontScale: 1,
  autoSpeak: false,
  direction: 'en-ko',
  shuffle: false,
  listenGapSec: 1.5,
  listenRepeat: 1,
  startDay: 1,
  currentDay: 1,
  reminderOn: false,
  reminderTime: '20:00',
}

/** 일별 학습 기록 (연속 학습일·통계용) */
export interface DailyLog {
  date: string // YYYY-MM-DD
  learned: number
  reviewed: number
  quizRight: number
  quizWrong: number
}
