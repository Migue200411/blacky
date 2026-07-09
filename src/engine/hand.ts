import { cardRankValues } from './deck'
import type { Card, HandState } from '../types'

export interface HandTotal {
  value: number
  isSoft: boolean
  isBlackjack: boolean
  isBust: boolean
}

export function handTotal(cards: Card[]): HandTotal {
  let total = 0
  let aces = 0
  let count = 0
  for (const c of cards) {
    if (!c) continue // guard against undefined slots
    const v = cardRankValues(c.rank)
    total += v.hard
    if (c.rank === 'A') aces++
    count++
  }
  let isSoft = false
  // Promote aces from 1 to 11 while safe.
  let acesLeft = aces
  while (acesLeft > 0 && total + 10 <= 21) {
    total += 10
    acesLeft--
    isSoft = true
  }
  const isBlackjack = count === 2 && total === 21
  return { value: total, isSoft, isBlackjack, isBust: total > 21 }
}

export function isPair(cards: Card[]): boolean {
  if (cards.length !== 2) return false
  return effectiveRankValue(cards[0]) === effectiveRankValue(cards[1])
}

export function effectiveRankValue(c: Card): number {
  const v = cardRankValues(c.rank)
  return v.hard === 1 ? 11 : v.hard // treat Ace as 11 for pair matching
}

export function pairRankTotal(cards: Card[]): number {
  if (!isPair(cards)) return 0
  const v = effectiveRankValue(cards[0])
  return v * 2 // 22 for A,A ; 20 for T,T; etc.
}

export function dealerUpValue(card: Card): number {
  if (card.rank === 'A') return 11
  const v = cardRankValues(card.rank)
  return v.hard === 1 ? 11 : v.hard
}

export function newHand(cards: Card[], bet: number, opts: Partial<HandState> = {}): HandState {
  const t = handTotal(cards)
  return {
    cards,
    bet,
    doubled: false,
    surrendered: false,
    fromSplit: false,
    isSplitAces: false,
    finished: false,
    busted: t.isBust,
    blackjack: t.isBlackjack,
    ...opts
  }
}

export function playDealer(
  cards: Card[],
  hitsSoft17: boolean,
  draw: () => Card
): Card[] {
  const hand = cards.slice()
  while (true) {
    const t = handTotal(hand)
    if (t.value > 21) return hand
    if (t.value >= 18) return hand
    if (t.value === 17) {
      if (t.isSoft && hitsSoft17) {
        hand.push(draw())
        continue
      }
      return hand
    }
    hand.push(draw())
  }
}
