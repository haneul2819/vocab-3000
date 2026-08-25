// IndexedDB 접근 계층 (idb 라이브러리 사용)
// 저장소: states(단어 학습 상태) / meta(설정·일별 기록 등 키-값)
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { DailyLog, Settings, WordState } from './types'
import { DEFAULT_SETTINGS } from './types'

interface VocabDB extends DBSchema {
  states: {
    key: number
    value: WordState
    indexes: { 'by-due': number; 'by-status': string }
  }
  meta: {
    key: string
    value: unknown
  }
}

let dbPromise: Promise<IDBPDatabase<VocabDB>> | null = null

function db() {
  if (!dbPromise) {
    dbPromise = openDB<VocabDB>('vocab3000', 1, {
      upgrade(d) {
        const states = d.createObjectStore('states', { keyPath: 'id' })
        states.createIndex('by-due', 'dueAt')
        states.createIndex('by-status', 'status')
        d.createObjectStore('meta')
      },
    })
  }
  return dbPromise
}

export function newWordState(id: number): WordState {
  return {
    id, status: 'unseen', lastGrade: '', knowStreak: 0, wrongNote: false,
    srsStep: 0, dueAt: 0, quizRight: 0, quizWrong: 0, updatedAt: 0,
  }
}

export async function getState(id: number): Promise<WordState> {
  return (await (await db()).get('states', id)) ?? newWordState(id)
}

export async function getStates(ids: number[]): Promise<Map<number, WordState>> {
  const d = await db()
  const tx = d.transaction('states')
  const out = new Map<number, WordState>()
  await Promise.all(ids.map(async (id) => {
    out.set(id, (await tx.store.get(id)) ?? newWordState(id))
  }))
  return out
}

export async function getAllStates(): Promise<WordState[]> {
  return (await db()).getAll('states')
}

export async function putState(state: WordState): Promise<void> {
  await (await db()).put('states', state)
}

export async function putStates(states: WordState[]): Promise<void> {
  const d = await db()
  const tx = d.transaction('states', 'readwrite')
  for (const s of states) tx.store.put(s)
  await tx.done
}

/** 복습 기한이 지난 단어 상태 목록 */
export async function getDueStates(now = Date.now()): Promise<WordState[]> {
  const d = await db()
  const all = await d.getAllFromIndex('states', 'by-due', IDBKeyRange.bound(1, now))
  return all.filter((s) => s.status === 'learning' || s.status === 'confused')
}

// ---- meta (키-값) ----

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const v = await (await db()).get('meta', key)
  return (v as T) ?? fallback
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await (await db()).put('meta', value, key)
}

export async function getSettings(): Promise<Settings> {
  const saved = await getMeta<Partial<Settings>>('settings', {})
  return { ...DEFAULT_SETTINGS, ...saved }
}

export async function saveSettings(s: Settings): Promise<void> {
  await setMeta('settings', s)
}

// ---- 일별 학습 기록 ----

export function todayKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export async function getDailyLogs(): Promise<Record<string, DailyLog>> {
  return getMeta<Record<string, DailyLog>>('dailyLogs', {})
}

export async function bumpDailyLog(patch: Partial<Omit<DailyLog, 'date'>>): Promise<void> {
  const logs = await getDailyLogs()
  const key = todayKey()
  const cur = logs[key] ?? { date: key, learned: 0, reviewed: 0, quizRight: 0, quizWrong: 0 }
  logs[key] = {
    ...cur,
    learned: cur.learned + (patch.learned ?? 0),
    reviewed: cur.reviewed + (patch.reviewed ?? 0),
    quizRight: cur.quizRight + (patch.quizRight ?? 0),
    quizWrong: cur.quizWrong + (patch.quizWrong ?? 0),
  }
  await setMeta('dailyLogs', logs)
}

// ---- 오늘의 테스트 점수 기록 ----

/** 날짜별 오늘의 테스트 결과 (같은 날 여러 번 풀면 최근 결과로 갱신) */
export interface DailyTestScore {
  day: number
  right: number
  total: number
  at: number
}

export async function getDailyTestScores(): Promise<Record<string, DailyTestScore>> {
  return getMeta<Record<string, DailyTestScore>>('dailyTestScores', {})
}

export async function saveDailyTestScore(score: Omit<DailyTestScore, 'at'>): Promise<void> {
  const scores = await getDailyTestScores()
  scores[todayKey()] = { ...score, at: Date.now() }
  await setMeta('dailyTestScores', scores)
}

/** 연속 학습일 계산 (오늘 포함, 하루라도 기록이 있으면 인정) */
export async function getStreak(): Promise<number> {
  const logs = await getDailyLogs()
  let streak = 0
  const d = new Date()
  // 오늘 기록이 없으면 어제부터 센다
  if (!logs[todayKey(d)]) d.setDate(d.getDate() - 1)
  while (logs[todayKey(d)]) {
    streak += 1
    d.setDate(d.getDate() - 1)
  }
  return streak
}

// ---- 진도 초기화 / 내보내기 / 가져오기 ----

export async function resetProgress(): Promise<void> {
  const d = await db()
  await d.clear('states')
  await d.clear('meta')
}

export interface ExportData {
  app: 'vocab3000'
  version: 1
  exportedAt: string
  states: WordState[]
  meta: Record<string, unknown>
}

export async function exportAll(): Promise<ExportData> {
  const d = await db()
  const states = await d.getAll('states')
  const meta: Record<string, unknown> = {}
  let cursor = await d.transaction('meta').store.openCursor()
  while (cursor) {
    meta[String(cursor.key)] = cursor.value
    cursor = await cursor.continue()
  }
  return { app: 'vocab3000', version: 1, exportedAt: new Date().toISOString(), states, meta }
}

export async function importAll(data: ExportData): Promise<void> {
  if (data.app !== 'vocab3000') throw new Error('이 앱의 내보내기 파일이 아닙니다')
  const d = await db()
  const tx = d.transaction(['states', 'meta'], 'readwrite')
  await tx.objectStore('states').clear()
  await tx.objectStore('meta').clear()
  for (const s of data.states) tx.objectStore('states').put(s)
  for (const [k, v] of Object.entries(data.meta)) tx.objectStore('meta').put(v, k)
  await tx.done
}
