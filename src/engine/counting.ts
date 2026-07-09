import { cardValueForCount } from '../data/countingSystems'
import type { Card, CountingSystem, Rounding, ShoeState } from '../types'

export function updateRunningCount(
  running: number,
  card: Card,
  system: CountingSystem
): number {
  return running + cardValueForCount(card.rank, system)
}

export function runningCountFromCards(cards: Card[], system: CountingSystem): number {
  let rc = 0
  for (const c of cards) rc += cardValueForCount(c.rank, system)
  return rc
}

export function decksRemainingFromShoe(shoe: ShoeState): number {
  return Math.max(shoe.cards.length / 52, 0.25)
}

export function trueCount(running: number, decksLeft: number, rounding: Rounding = 'floor'): number {
  if (decksLeft <= 0) return 0
  const raw = running / decksLeft
  switch (rounding) {
    case 'round': return Math.round(raw)
    case 'truncate': return raw >= 0 ? Math.floor(raw) : Math.ceil(raw)
    case 'floor':
    default: return Math.floor(raw)
  }
}
