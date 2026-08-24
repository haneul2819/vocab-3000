// 데이터 로딩 계층 — public/data/의 청크를 필요할 때만 가져오고 메모리에 캐시한다.
import type { DataIndex, DistractorEntry, GrammarCategory, Level, Word } from './types'

const BASE = import.meta.env.BASE_URL + 'data'

let indexCache: DataIndex | null = null
const dayCache = new Map<number, Word[]>()
let grammarCache: GrammarCategory[] | null = null
let distractorCache: Record<string, DistractorEntry[]> | null = null

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`데이터 로딩 실패: ${path} (${res.status})`)
  return res.json() as Promise<T>
}

export async function loadIndex(): Promise<DataIndex> {
  if (!indexCache) indexCache = await fetchJson<DataIndex>(`${BASE}/index.json`)
  return indexCache
}

export async function loadDay(day: number): Promise<Word[]> {
  const cached = dayCache.get(day)
  if (cached) return cached
  const words = await fetchJson<Word[]>(`${BASE}/days/day-${String(day).padStart(2, '0')}.json`)
  dayCache.set(day, words)
  return words
}

export async function loadDays(days: number[]): Promise<Word[]> {
  const lists = await Promise.all([...new Set(days)].map(loadDay))
  return lists.flat()
}

/** id 목록으로 단어 전체 데이터를 가져온다 (해당 Day 청크 로딩) */
export async function loadWordsByIds(ids: number[]): Promise<Word[]> {
  const index = await loadIndex()
  const idSet = new Set(ids)
  const days = new Set<number>()
  for (const iw of index.words) if (idSet.has(iw.id)) days.add(iw.d)
  const all = await loadDays([...days])
  const byId = new Map(all.map((w) => [w.id, w]))
  return ids.map((id) => byId.get(id)).filter((w): w is Word => !!w)
}

export async function loadGrammar(): Promise<GrammarCategory[]> {
  if (!grammarCache) grammarCache = await fetchJson<GrammarCategory[]>(`${BASE}/grammar.json`)
  return grammarCache
}

export async function loadDistractors(): Promise<Record<string, DistractorEntry[]>> {
  if (!distractorCache) {
    distractorCache = await fetchJson<Record<string, DistractorEntry[]>>(`${BASE}/distractors.json`)
  }
  return distractorCache
}

// 트랙 정의 (Day 범위)
export const TRACKS: { level: Level; label: string; from: number; to: number }[] = [
  { level: '초등', label: '초등', from: 1, to: 16 },
  { level: '중고공통', label: '중·고 공통', from: 17, to: 40 },
  { level: '선택', label: '심화(선택)', from: 41, to: 60 },
]

export function trackOfDay(day: number) {
  return TRACKS.find((t) => day >= t.from && day <= t.to) ?? TRACKS[0]
}

/** 배열 셔플 (Fisher–Yates) */
export function shuffled<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function sample<T>(arr: T[], n: number): T[] {
  return shuffled(arr).slice(0, n)
}
