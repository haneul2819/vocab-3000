// 단어 카드를 PNG 이미지로 그려 공유·저장하는 모듈 (캔버스 직접 그리기, 외부 의존성 없음)
// 색·폰트는 현재 스킨의 CSS 토큰을 읽어 화면과 같은 분위기로 만든다.
import type { Word } from './types'

const W = 720 // CSS px 기준 이미지 너비
const SCALE = 2 // 선명도를 위한 배율
const M = 26 // 카드 바깥 배경 여백
const P = 40 // 카드 안쪽 여백

function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v && v !== 'inherit' ? v : fallback
}

/** 공백 기준 줄바꿈 — 한 단어가 폭을 넘으면 글자 단위로 자름 */
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const w of text.split(/\s+/).filter(Boolean)) {
    const joined = line ? line + ' ' + w : w
    if (ctx.measureText(joined).width <= max) { line = joined; continue }
    if (line) { lines.push(line); line = '' }
    if (ctx.measureText(w).width <= max) { line = w; continue }
    let chunk = ''
    for (const ch of w) {
      if (chunk && ctx.measureText(chunk + ch).width > max) { lines.push(chunk); chunk = '' }
      chunk += ch
    }
    line = chunk
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** 단어 하나를 카드 모양 캔버스로 렌더링 */
export async function renderWordCanvas(word: Word): Promise<HTMLCanvasElement> {
  await document.fonts.ready // 스킨 웹폰트가 로드된 뒤에 그리기 (실패 시에도 resolve됨)

  const c = {
    bg: cssVar('--bg', '#f4f6fb'),
    surface: cssVar('--surface', '#ffffff'),
    surface2: cssVar('--surface-2', '#eef1f8'),
    text: cssVar('--text', '#17203a'),
    dim: cssVar('--text-dim', '#5b6579'),
    border: cssVar('--border', '#dde3ef'),
  }
  const body = cssVar('--font-body', 'sans-serif')
  const display = cssVar('--font-display', body)
  const CW = W - 2 * (M + P) // 내용 폭
  const CX = W / 2
  const LX = M + P

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!

  // draw=false로 한 번 훑어 전체 높이를 계산하고, 캔버스 크기를 정한 뒤 실제로 그린다
  const paint = (draw: boolean): number => {
    let y = M + P

    const center = (str: string, font: string, color: string, lh: number) => {
      ctx.font = font
      for (const line of wrap(ctx, str, CW)) {
        if (draw) {
          ctx.fillStyle = color
          ctx.textAlign = 'center'
          ctx.fillText(line, CX, y + lh * 0.75)
        }
        y += lh
      }
    }

    // 표제어 + IPA
    center(word.word, `800 52px ${display}`, c.text, 62)
    if (word.ipa) center(word.ipa, `23px ${body}`, c.dim, 32)
    y += 14

    // 뜻 (품사 배지 + 뜻, 첫 줄은 배지와 함께 가운데 정렬)
    for (const m of word.meanings) {
      ctx.font = `600 17px ${body}`
      const bw = ctx.measureText(m.pos).width + 22
      ctx.font = `25px ${body}`
      const lines = wrap(ctx, m.ko.join(', '), CW - bw - 12)
      const x0 = CX - (bw + 12 + ctx.measureText(lines[0]).width) / 2
      if (draw) {
        ctx.fillStyle = c.surface2
        roundRect(ctx, x0, y + 4, bw, 27, 13)
        ctx.fill()
        ctx.fillStyle = c.dim
        ctx.font = `600 17px ${body}`
        ctx.textAlign = 'center'
        ctx.fillText(m.pos, x0 + bw / 2, y + 23)
        ctx.fillStyle = c.text
        ctx.font = `25px ${body}`
        ctx.textAlign = 'left'
        ctx.fillText(lines[0], x0 + bw + 12, y + 26)
      }
      y += 36
      for (const line of lines.slice(1)) {
        if (draw) {
          ctx.fillStyle = c.text
          ctx.font = `25px ${body}`
          ctx.textAlign = 'center'
          ctx.fillText(line, CX, y + 26)
        }
        y += 36
      }
    }
    y += 16

    // 예문 상자 (영문 + 해석)
    for (const ex of word.examples) {
      ctx.font = `22px ${body}`
      const en = wrap(ctx, ex.en, CW - 36)
      ctx.font = `19px ${body}`
      const ko = wrap(ctx, ex.ko, CW - 36)
      const bh = 16 + en.length * 30 + 6 + ko.length * 26 + 14
      if (draw) {
        ctx.fillStyle = c.surface2
        roundRect(ctx, LX, y, CW, bh, 14)
        ctx.fill()
        ctx.textAlign = 'left'
        let ey = y + 16
        ctx.fillStyle = c.text
        ctx.font = `22px ${body}`
        for (const line of en) { ctx.fillText(line, LX + 18, ey + 22); ey += 30 }
        ey += 6
        ctx.fillStyle = c.dim
        ctx.font = `19px ${body}`
        for (const line of ko) { ctx.fillText(line, LX + 18, ey + 19); ey += 26 }
      }
      y += bh + 12
    }

    // 파생어
    if (word.derived.length > 0) {
      y += 2
      center(`파생어: ${word.derived.join(', ')}`, `19px ${body}`, c.dim, 27)
    }

    // 푸터 (구분선 + 앱 이름)
    y += 12
    if (draw) {
      ctx.strokeStyle = c.border
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(LX, y)
      ctx.lineTo(LX + CW, y)
      ctx.stroke()
    }
    y += 14
    center('기본 어휘 3000 단어장', `16px ${body}`, c.dim, 22)

    return y + P - 12 + M
  }

  const H = paint(false)
  canvas.width = W * SCALE
  canvas.height = H * SCALE
  ctx.scale(SCALE, SCALE)

  ctx.fillStyle = c.bg
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = c.surface
  roundRect(ctx, M, M, W - 2 * M, H - 2 * M, 22)
  ctx.fill()
  ctx.strokeStyle = c.border
  ctx.lineWidth = 1.5
  ctx.stroke()
  paint(true)
  return canvas
}

/** 단어 카드 이미지를 PNG Blob으로 */
export async function wordImageBlob(word: Word): Promise<Blob> {
  const canvas = await renderWordCanvas(word)
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('이미지 생성 실패'))), 'image/png'),
  )
}

/** 파일 공유(Web Share API Level 2)를 지원하는 환경인지 */
export function canShareImage(): boolean {
  if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return false
  try {
    return navigator.canShare({ files: [new File([new Blob()], 'x.png', { type: 'image/png' })] })
  } catch {
    return false
  }
}

/** OS 공유 시트 열기 — 미지원이면 'fallback' 반환(호출 쪽에서 저장으로 대체) */
export async function shareBlob(blob: Blob, name: string): Promise<'shared' | 'fallback'> {
  const file = new File([blob], `${name}.png`, { type: 'image/png' })
  if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `영단어 ${name}` })
    } catch {
      // 사용자가 공유 시트를 닫은 경우 — 추가 동작 없음
    }
    return 'shared'
  }
  return 'fallback'
}

/** Blob을 파일로 다운로드 */
export function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
}
