// 간격 반복 규칙 테스트 — CLAUDE.md의 규칙표를 그대로 검증한다.
// | 판정   | 다음 복습        | 비고                                    |
// | 모름   | 1일             | 오답 노트 등록, 연속 앎 초기화             |
// | 헷갈림 | 3일             | 오답 노트 등록, 연속 앎 초기화             |
// | 앎     | 7일 → 30일      | 3회 연속 앎이면 오답 노트 졸업 / 30일 뒤 완료 |
import { describe, expect, it } from 'vitest'
import { newWordState } from './db'
import { applyGrade, formatDue } from './srs'
import type { WordState } from './types'

const DAY = 24 * 60 * 60 * 1000
const NOW = 1_700_000_000_000

/** 지정한 판정을 순서대로 적용한 최종 상태 */
function after(grades: Parameters<typeof applyGrade>[1][], base?: Partial<WordState>): WordState {
  let s: WordState = { ...newWordState(1), ...base }
  for (const g of grades) s = applyGrade(s, g, NOW)
  return s
}

describe('모름 판정', () => {
  const s = after(['no'])
  it('1일 뒤에 다시 복습한다', () => {
    expect(s.dueAt).toBe(NOW + 1 * DAY)
  })
  it('학습중 상태가 되고 오답 노트에 들어간다', () => {
    expect(s.status).toBe('learning')
    expect(s.wrongNote).toBe(true)
  })
  it('연속 앎 횟수를 초기화한다', () => {
    expect(after(['know', 'know', 'no']).knowStreak).toBe(0)
  })
})

describe('헷갈림 판정', () => {
  const s = after(['fuzzy'])
  it('3일 뒤에 다시 복습한다', () => {
    expect(s.dueAt).toBe(NOW + 3 * DAY)
  })
  it('헷갈림 상태가 되고 오답 노트에 들어간다', () => {
    expect(s.status).toBe('confused')
    expect(s.wrongNote).toBe(true)
  })
})

describe('앎 판정', () => {
  it('첫 앎은 7일 뒤', () => {
    expect(after(['know']).dueAt).toBe(NOW + 7 * DAY)
  })
  it('두 번째 앎은 30일 뒤', () => {
    expect(after(['know', 'know']).dueAt).toBe(NOW + 30 * DAY)
  })
  it('세 번 연속 앎이면 완료되어 복습 큐에서 빠진다', () => {
    const s = after(['know', 'know', 'know'])
    expect(s.status).toBe('mastered')
    expect(s.dueAt).toBe(0)
  })
  it('미학습 단어도 첫 앎이면 학습중이 된다', () => {
    expect(after(['know']).status).toBe('learning')
  })
})

describe('오답 노트 졸업', () => {
  it('모름 뒤 3회 연속 앎이면 졸업한다', () => {
    const s = after(['no', 'know', 'know', 'know'])
    expect(s.wrongNote).toBe(false)
  })
  it('2회까지는 아직 오답 노트에 남는다', () => {
    const s = after(['no', 'know', 'know'])
    expect(s.wrongNote).toBe(true)
  })
  it('중간에 틀리면 연속이 끊겨 졸업하지 못한다', () => {
    const s = after(['no', 'know', 'know', 'fuzzy', 'know'])
    expect(s.wrongNote).toBe(true)
    expect(s.knowStreak).toBe(1)
  })
})

describe('상태 전이', () => {
  // 현재 구현의 실제 동작을 기록해 둔다.
  // 헷갈림 단어는 '학습중'을 거치지 않고 곧바로 '완료'로 넘어간다.
  // (srs.ts의 confused → learning 회복 분기는 어떤 판정 순서로도 도달하지 않는 죽은 코드)
  it('헷갈림 단어는 두 번째 앎까지 헷갈림으로 남는다', () => {
    expect(after(['fuzzy', 'know']).status).toBe('confused')
    expect(after(['fuzzy', 'know', 'know']).status).toBe('confused')
  })
  it('세 번째 앎에서 헷갈림 단어가 곧바로 완료된다', () => {
    expect(after(['fuzzy', 'know', 'know', 'know']).status).toBe('mastered')
  })
  it('판정할 때마다 갱신 시각을 남긴다', () => {
    expect(after(['know']).updatedAt).toBe(NOW)
  })
  it('마지막 판정을 기록한다', () => {
    expect(after(['know', 'fuzzy']).lastGrade).toBe('fuzzy')
  })
})

describe('복습일 표시', () => {
  it('예정일이 없으면 대시', () => {
    expect(formatDue(0, NOW)).toBe('-')
  })
  it('지난 예정일은 지금', () => {
    expect(formatDue(NOW - DAY, NOW)).toBe('지금')
  })
  it('남은 일수를 올림해 보여준다', () => {
    expect(formatDue(NOW + 3 * DAY, NOW)).toBe('3일 후')
    expect(formatDue(NOW + 2.2 * DAY, NOW)).toBe('3일 후')
  })
})
