// 트랙 구분과 셔플·표본 추출 검증
import { describe, expect, it } from 'vitest'
import { sample, shuffled, TRACKS, trackOfDay } from './data'

describe('트랙 구분', () => {
  it('Day 1~16은 초등', () => {
    expect(trackOfDay(1).level).toBe('초등')
    expect(trackOfDay(16).level).toBe('초등')
  })
  it('Day 17~40은 중·고 공통', () => {
    expect(trackOfDay(17).level).toBe('중고공통')
    expect(trackOfDay(40).level).toBe('중고공통')
  })
  it('Day 41~60은 심화', () => {
    expect(trackOfDay(41).level).toBe('선택')
    expect(trackOfDay(60).level).toBe('선택')
  })
  it('범위를 벗어나면 초등으로 되돌린다', () => {
    expect(trackOfDay(0).level).toBe('초등')
    expect(trackOfDay(99).level).toBe('초등')
  })
  it('세 트랙이 Day 1~60을 빈틈없이 덮는다', () => {
    const covered = new Set<number>()
    for (const t of TRACKS) for (let d = t.from; d <= t.to; d++) covered.add(d)
    expect(covered.size).toBe(60)
  })
})

describe('셔플', () => {
  const src = [1, 2, 3, 4, 5]
  it('원본을 바꾸지 않는다', () => {
    shuffled(src)
    expect(src).toEqual([1, 2, 3, 4, 5])
  })
  it('같은 원소를 모두 보존한다', () => {
    expect([...shuffled(src)].sort()).toEqual([1, 2, 3, 4, 5])
  })
  it('빈 배열도 처리한다', () => {
    expect(shuffled([])).toEqual([])
  })
})

describe('표본 추출', () => {
  const src = [1, 2, 3, 4, 5]
  it('요청한 개수만큼 뽑는다', () => {
    expect(sample(src, 3)).toHaveLength(3)
  })
  it('원본보다 많이 요청하면 있는 만큼만 준다', () => {
    expect(sample(src, 99)).toHaveLength(5)
  })
  it('중복 없이 뽑는다', () => {
    const picked = sample(src, 5)
    expect(new Set(picked).size).toBe(5)
  })
})
