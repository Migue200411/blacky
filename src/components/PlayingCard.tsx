import type { Card } from '../types'

interface Props {
  card?: Card
  hidden?: boolean
  small?: boolean
  className?: string
}

export function PlayingCard({ card, hidden, small, className = '' }: Props) {
  const size = small ? 'w-10 h-14 text-sm' : 'w-16 h-24 sm:w-20 sm:h-28 text-2xl'
  if (hidden || !card) {
    return (
      <div
        className={`${size} rounded-lg bg-gradient-to-br from-chip-blue to-blue-900 border-2 border-white/40 shadow-card animate-dealIn flex items-center justify-center ${className}`}
      >
        <div className="w-3/4 h-3/4 rounded border border-white/40 flex items-center justify-center text-white/70 font-display">
          BJ
        </div>
      </div>
    )
  }
  const red = card.suit === '♥' || card.suit === '♦'
  return (
    <div
      className={`${size} rounded-lg bg-card-bg text-card-black shadow-card border border-black/20 relative flex flex-col justify-between p-1 sm:p-1.5 animate-dealIn ${className}`}
    >
      <div className={`flex flex-col items-start leading-none font-semibold ${red ? 'text-card-red' : 'text-card-black'}`}>
        <span>{card.rank}</span>
        <span className="text-[0.9em]">{card.suit}</span>
      </div>
      <div className={`self-center text-[1.5em] ${red ? 'text-card-red' : 'text-card-black'}`}>{card.suit}</div>
      <div className={`self-end rotate-180 flex flex-col items-start leading-none font-semibold ${red ? 'text-card-red' : 'text-card-black'}`}>
        <span>{card.rank}</span>
        <span className="text-[0.9em]">{card.suit}</span>
      </div>
    </div>
  )
}
