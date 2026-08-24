// 원형 진행률 표시
interface Props {
  value: number // 0~1
  size?: number
  stroke?: number
  label?: string
}

export default function ProgressRing({ value, size = 72, stroke = 7, label }: Props) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="var(--primary)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v)}
          style={{ transition: 'stroke-dashoffset 0.4s ease' }} />
      </svg>
      <span className="label">{label ?? `${Math.round(v * 100)}%`}</span>
    </div>
  )
}
