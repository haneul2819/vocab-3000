// 스킨 적용 유틸 — data-skin 속성, 스킨별 웹폰트 로드, theme-color 갱신
import type { Skin } from './types'

/** 스킨별 Google Fonts 스타일시트 (classic은 시스템 폰트만 사용) */
const SKIN_FONTS: Record<Skin, string | null> = {
  classic: null,
  minimal:
    'https://fonts.googleapis.com/css2?family=Hahmlet:wght@500;600;700&family=IBM+Plex+Sans+KR:wght@400;500;700&family=IBM+Plex+Mono:wght@400&display=swap',
  pop: 'https://fonts.googleapis.com/css2?family=Jua&family=Noto+Sans+KR:wght@400;500;700&display=swap',
  focus:
    'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Noto+Sans+KR:wght@400;500;700&display=swap',
  paper:
    'https://fonts.googleapis.com/css2?family=Gowun+Dodum&family=Noto+Sans+KR:wght@400;500;700&display=swap',
}

/** 브라우저 상단바 색 (라이트/다크) */
const THEME_COLOR: Record<Skin, { light: string; dark: string }> = {
  classic: { light: '#2563eb', dark: '#0f172a' },
  minimal: { light: '#faf7f2', dark: '#17140f' },
  pop: { light: '#fff6e3', dark: '#2b2440' },
  focus: { light: '#0b0f14', dark: '#0b0f14' },
  paper: { light: '#f7f4ec', dark: '#211d16' },
}

const FONT_LINK_ID = 'skin-fonts'

/**
 * 스킨과 다크 여부를 문서에 적용한다.
 * 폰트는 선택된 스킨의 것만 로드 (오프라인이면 폴백 스택으로 자연 강등,
 * PWA 런타임 캐시에 저장돼 이후에는 오프라인에서도 동작).
 */
export function applySkin(skin: Skin, dark: boolean): void {
  const root = document.documentElement
  root.dataset.skin = skin
  root.dataset.theme = dark ? 'dark' : 'light'

  const href = SKIN_FONTS[skin]
  let link = document.getElementById(FONT_LINK_ID) as HTMLLinkElement | null
  if (href) {
    if (!link) {
      link = document.createElement('link')
      link.id = FONT_LINK_ID
      link.rel = 'stylesheet'
      document.head.appendChild(link)
    }
    if (link.href !== href) link.href = href
  } else if (link) {
    link.remove()
  }

  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (meta) meta.content = THEME_COLOR[skin][dark ? 'dark' : 'light']
}
