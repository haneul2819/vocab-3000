// 플레이스토어용 휴대폰 스크린샷 촬영 (1080×2340)
// 사용: 개발 서버(포트 5190) 실행 중에  node scripts/store_screenshots.mjs
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { join } from 'path'

const BASE = 'http://localhost:5190'
const OUT = join(fileURLToPath(new URL('../store/assets/', import.meta.url)), '/')
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 360, height: 780 },
  deviceScaleFactor: 3,
  locale: 'ko-KR',
  hasTouch: true,
  isMobile: true,
})
const page = await ctx.newPage()

// 1) 앱 첫 로드 (IndexedDB 스키마 생성)
await page.goto(BASE + '/#/')
await page.waitForSelector('.card')

// 2) 보기 좋은 시드 데이터 주입
await page.evaluate(async () => {
  const req = indexedDB.open('vocab3000', 1)
  const db = await new Promise((res, rej) => {
    req.onsuccess = () => res(req.result)
    req.onerror = () => rej(req.error)
  })
  const now = Date.now()
  const DAY = 86400000
  const tx = db.transaction(['states', 'meta'], 'readwrite')
  const st = tx.objectStore('states')
  // Day 1(1–50): 대부분 학습·테스트 완료, 일부 헷갈림(복습 대기)
  for (let id = 1; id <= 50; id++) {
    const status = id <= 20 ? 'mastered' : id <= 42 ? 'learning' : id <= 46 ? 'confused' : 'unseen'
    st.put({
      id, status, lastGrade: status === 'confused' ? 'fuzzy' : 'know',
      knowStreak: 2, wrongNote: status === 'confused', srsStep: 2,
      dueAt: status === 'confused' ? now - 1000 : now + 3 * DAY,
      quizRight: id <= 44 ? 3 : 0, quizWrong: id <= 44 ? 1 : 0, updatedAt: now,
    })
  }
  // Day 2 일부 진행
  for (let id = 51; id <= 68; id++) {
    st.put({ id, status: 'learning', lastGrade: 'know', knowStreak: 1, wrongNote: false,
      srsStep: 1, dueAt: now + 2 * DAY, quizRight: 1, quizWrong: 0, updatedAt: now })
  }
  const meta = tx.objectStore('meta')
  const key = (t) => {
    const x = new Date(t)
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  }
  const logs = {}, scores = {}
  const rights = [46, 43, 47, 41, 44, 48, 45]
  for (let i = 0; i < 7; i++) {
    const t = now - i * DAY
    logs[key(t)] = { date: key(t), learned: 45, reviewed: 10, quizRight: rights[i], quizWrong: 50 - rights[i] }
    if (i < 6) scores[key(t)] = { day: 1, right: rights[i], total: 50, at: t }
  }
  meta.put(logs, 'dailyLogs')
  meta.put(scores, 'dailyTestScores')
  meta.put({ darkMode: 'auto', skin: 'classic', fontScale: 1, autoSpeak: false,
    direction: 'en-ko', shuffle: false, listenGapSec: 1.5, listenRepeat: 1,
    startDay: 1, currentDay: 1 }, 'settings')
  await new Promise((r) => { tx.oncomplete = r })
})

const shot = async (name) => {
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(600)
  await page.screenshot({ path: OUT + name })
  console.log('saved', name)
}

// 홈
await page.goto(BASE + '/#/')
await page.reload()
await page.waitForSelector('.card')
await shot('screen-1-home.png')

// 암기 카드 (학습 모드: 단어+뜻+예문)
await page.goto(BASE + '/#/learn/1')
await page.waitForSelector('.flashcard')
await shot('screen-2-learn.png')

// 문제집 (단어→뜻 문제 화면)
await page.goto(BASE + '/#/quiz')
await page.waitForSelector('text=문제 수')
await page.click('button:has-text("단어 → 뜻")')
await page.click('button:has-text("10문제 시작")')
await page.waitForSelector('.choice')
await shot('screen-3-quiz.png')

// 문법 (첫 파트 펼침)
await page.goto(BASE + '/#/grammar')
await page.waitForSelector('.card button')
await page.locator('.card > button').first().click()
await page.waitForSelector('text=전체 듣기')
await shot('screen-4-grammar.png')

// 통계
await page.goto(BASE + '/#/stats')
await page.waitForSelector('text=오늘의 테스트 기록')
await shot('screen-5-stats.png')

// 설정 (스킨 선택)
await page.goto(BASE + '/#/settings')
await page.waitForSelector('.skin-grid, .card')
await shot('screen-6-settings.png')

await browser.close()
console.log('done')
