import { NavLink } from 'react-router-dom'

// 스킨 색을 따라가는 스트로크 SVG 아이콘 (currentColor)
const icon = (paths: string) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    dangerouslySetInnerHTML={{ __html: paths }} />
)

const items = [
  { to: '/', ico: icon('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>'), label: '홈' },
  { to: '/quiz', ico: icon('<path d="M4 20l4-1L20.5 6.5a2.1 2.1 0 0 0-3-3L5 16l-1 4z"/>'), label: '문제집' },
  { to: '/grammar', ico: icon('<path d="M2 5c3-1.4 6-1.4 9 0v14c-3-1.4-6-1.4-9 0z"/><path d="M22 5c-3-1.4-6-1.4-9 0v14c3-1.4 6-1.4 9 0z"/>'), label: '문법' },
  { to: '/review', ico: icon('<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>'), label: '복습' },
  { to: '/stats', ico: icon('<path d="M4 20v-8M10 20V5M16 20v-5M21 20H3"/>'), label: '통계' },
]

export default function NavBar() {
  return (
    <nav className="navbar">
      {items.map((it) => (
        <NavLink key={it.to} to={it.to} end={it.to === '/'}
          className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="ico">{it.ico}</span>
          <span>{it.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
