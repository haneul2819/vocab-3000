// 간격 반복(SRS) 로직
// 규칙: 모름 → 1일 / 헷갈림 → 3일 / 앎 → 7일 → 30일 → 90일 → 180일 (모두 통과하면 졸업)
// 30일에서 멈추면 두 달 뒤 상당수를 잊으므로 장기 확인 단계를 둔다.
import type { WordState } from './types'

const DAY_MS = 24 * 60 * 60 * 1000

/** 앎 단계 간격(일). srsStep이 이 배열을 순서대로 진행한다 */
const KNOW_INTERVALS = [7, 30, 90, 180]

export type Grade = 'know' | 'fuzzy' | 'no'

/**
 * 판정 결과를 반영한 새 상태를 반환한다.
 * - 모름: learning 상태, 1일 뒤 복습, 연속 앎 초기화
 * - 헷갈림: confused 상태, 3일 뒤 복습, 연속 앎 초기화
 * - 앎: 7일 → 30일 → 90일 → 180일 간격으로 진행.
 *   마지막 간격까지 모두 통과하고 연속 3회 이상 '앎'이면 mastered(졸업)
 * - 헷갈림 단어는 연속 3회 '앎'이면 다시 learning(학습중)으로 돌아온다
 */
export function applyGrade(state: WordState, grade: Grade, now = Date.now()): WordState {
  const s: WordState = { ...state, lastGrade: grade, updatedAt: now }
  if (grade === 'no') {
    s.status = 'learning'
    s.knowStreak = 0
    s.srsStep = 0
    s.wrongNote = true
    s.dueAt = now + 1 * DAY_MS
  } else if (grade === 'fuzzy') {
    s.status = 'confused'
    s.knowStreak = 0
    s.srsStep = 0
    s.wrongNote = true
    s.dueAt = now + 3 * DAY_MS
  } else {
    s.knowStreak += 1
    if (s.knowStreak >= 3) s.wrongNote = false // 오답 노트 졸업
    // 마지막 간격까지 모두 지나왔으면 졸업, 아니면 다음 간격을 잡는다
    const finishedAll = s.srsStep >= KNOW_INTERVALS.length
    if (finishedAll && s.knowStreak >= 3) {
      // 졸업: 더 이상 복습 큐에 올라오지 않는다
      s.status = 'mastered'
      s.dueAt = 0
    } else {
      s.status = state.status === 'unseen' ? 'learning' : state.status
      // 헷갈렸던 단어도 연속 3회 맞히면 학습중으로 회복한다
      if (s.status === 'confused' && s.knowStreak >= 3) s.status = 'learning'
      const stepDays = KNOW_INTERVALS[Math.min(s.srsStep, KNOW_INTERVALS.length - 1)]
      s.dueAt = now + stepDays * DAY_MS
      s.srsStep = Math.min(s.srsStep + 1, KNOW_INTERVALS.length)
    }
  }
  return s
}

/** 오답 노트 졸업 조건: 연속 3회 '앎' */
export function isGraduatedFromWrongNote(state: WordState): boolean {
  return state.knowStreak >= 3
}

export function formatDue(dueAt: number, now = Date.now()): string {
  if (!dueAt) return '-'
  const diff = dueAt - now
  if (diff <= 0) return '지금'
  const days = Math.ceil(diff / DAY_MS)
  return `${days}일 후`
}
