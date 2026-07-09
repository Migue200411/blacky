import type { Card, Rank, ShoeState, Suit } from '../types'

const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const SUITS: Suit[] = ['♠', '♥', '♦', '♣']

let cardCounter = 0

export function buildShoe(decks: number, penetration: number, burnCards: number = 0): ShoeState {
  const cards: Card[] = []
  for (let d = 0; d < decks; d++) {
    for (const s of SUITS) {
      for (const r of RANKS) {
        cards.push({ rank: r, suit: s, id: `c${++cardCounter}` })
      }
    }
  }
  shuffle(cards)
  // Burn the top N cards face-down (not counted, not shown).
  const burn = Math.max(0, Math.min(burnCards | 0, cards.length - 1))
  for (let i = 0; i < burn; i++) cards.pop()
  const cutIndex = Math.floor(cards.length * (1 - penetration))
  return { cards, played: [], decks, cutIndex, needsShuffle: false }
}

// Fisher–Yates with crypto randomness for fairness in simulation.
export function shuffle<T>(arr: T[]): void {
  const random = new Uint32Array(1)
  const cryptoObj = globalThis.crypto
  for (let i = arr.length - 1; i > 0; i--) {
    let j: number
    if (cryptoObj?.getRandomValues) {
      cryptoObj.getRandomValues(random)
      j = random[0] % (i + 1)
    } else {
      j = Math.floor(Math.random() * (i + 1))
    }
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
}

export function drawCard(shoe: ShoeState): { card: Card; shoe: ShoeState } {
  const cards = shoe.cards.slice()
  const played = shoe.played.slice()
  const card = cards.pop()
  if (!card) throw new Error('Shoe empty')
  played.push(card)
  const needsShuffle = cards.length <= shoe.cutIndex
  return { card, shoe: { ...shoe, cards, played, needsShuffle } }
}

export function decksRemaining(shoe: ShoeState): number {
  return shoe.cards.length / 52
}

export function cardsRemaining(shoe: ShoeState): number {
  return shoe.cards.length
}

export function cardRankValues(rank: Rank): { hard: number; soft?: number } {
  if (rank === 'A') return { hard: 1, soft: 11 }
  if (rank === 'J' || rank === 'Q' || rank === 'K') return { hard: 10 }
  if (rank === '10') return { hard: 10 }
  return { hard: parseInt(rank, 10) }
}
