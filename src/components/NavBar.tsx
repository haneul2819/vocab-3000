import { NavLink } from 'react-router-dom'

const items = [
  { to: '/', ico: '🏠', label: '홈' },
  { to: '/quiz', ico: '✏️', label: '문제집' },
  { to: '/grammar', ico: '📖', label: '문법' },
  { to: '/review', ico: '🔁', label: '복습' },
  { to: '/stats', ico: '📊', label: '통계' },
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
