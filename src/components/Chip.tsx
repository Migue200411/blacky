interface Props {
  value: number
  className?: string
}

function chipStyle(v: number): { bg: string; border: string; text: string } {
  if (v >= 100) return { bg: '#1a1a1a', border: '#f2f2f2', text: '#f2f2f2' }
  if (v >= 25) return { bg: '#178a4a', border: '#f5f2ea', text: '#ffffff' }
  if (v >= 10) return { bg: '#1e5fa5', border: '#f5f2ea', text: '#ffffff' }
  if (v >= 5) return { bg: '#c2201f', border: '#f5f2ea', text: '#ffffff' }
  return { bg: '#f5f2ea', border: '#1a1a1a', text: '#111111' }
}

export function Chip({ value, className = '' }: Props) {
  const s = chipStyle(value)
  return (
    <div
      className={`chip ${className}`}
      style={{ background: s.bg, borderColor: s.border, color: s.text }}
    >
      {value}
    </div>
  )
}
