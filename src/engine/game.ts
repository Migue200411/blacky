import { buildShoe, drawCard } from './deck'
import { handTotal, isPair, newHand } from './hand'
import { runningCountFromCards, updateRunningCount } from './counting'
import type {
  Card,
  DealerState,
  HandResult,
  HandState,
  Phase,
  ShoeState,
  TableRules
} from '../types'

export interface GameState {
  rules: TableRules
  shoe: ShoeState
  runningCount: number
  phase: Phase
  bet: number
  hands: HandState[]
  activeHandIdx: number
  dealer: DealerState
  bankroll: number
  message?: string
  splitsSoFar: number
  insuranceTaken: boolean
  insuranceCost: number
  lastRoundNet: number
}

export function initGame(rules: TableRules): GameState {
  const shoe = buildShoe(rules.decks, rules.penetration, rules.burnCards)
  return {
    rules,
    shoe,
    runningCount: 0,
    phase: 'betting',
    bet: Math.max(rules.minBet, rules.unit),
    hands: [],
    activeHandIdx: 0,
    dealer: { cards: [], holeHidden: true, finished: false, busted: false, blackjack: false },
    bankroll: rules.bankroll,
    splitsSoFar: 0,
    insuranceTaken: false,
    insuranceCost: 0,
    lastRoundNet: 0
  }
}

function drawAndCount(state: GameState): { card: Card; state: GameState } {
  const { card, shoe } = drawCard(state.shoe)
  const runningCount = updateRunningCount(state.runningCount, card, state.rules.countingSystem)
  return { card, state: { ...state, shoe, runningCount } }
}

export function reshuffleIfNeeded(state: GameState): GameState {
  if (!state.shoe.needsShuffle) return state
  const shoe = buildShoe(state.rules.decks, state.rules.penetration, state.rules.burnCards)
  return { ...state, shoe, runningCount: 0, message: 'Nuevo zapato barajado.' }
}

export function startRound(state: GameState, bet: number): GameState {
  let s: GameState = reshuffleIfNeeded(state)
  const clampedBet = Math.max(s.rules.minBet, Math.min(s.rules.maxBet, Math.min(bet, s.bankroll)))
  s = { ...s, bet: clampedBet, phase: 'dealing', hands: [], insuranceTaken: false, insuranceCost: 0, splitsSoFar: 0, lastRoundNet: 0 }

  const isEuropean = s.rules.variant === 'european'
  const cardsToDeal = isEuropean ? 3 : 4
  const drawn: Card[] = []
  for (let i = 0; i < cardsToDeal; i++) {
    const r = drawAndCount(s)
    s = r.state
    drawn.push(r.card)
  }

  const playerCards = [drawn[0], drawn[2]]
  let dealerCards: Card[]
  let holeHidden: boolean
  let dealerBJ: boolean

  if (isEuropean) {
    // European: dealer receives only the visible upcard. No hole is dealt.
    dealerCards = [drawn[1]]
    holeHidden = false
    dealerBJ = false // Dealer cannot have BJ yet — only 1 card.
  } else {
    // American: dealer gets an upcard + a hidden hole card. Roll back the hole's
    // contribution to the running count; it re-adds when revealed.
    const holeCard = drawn[3]
    const rollback = updateRunningCount(0, holeCard, s.rules.countingSystem)
    s = { ...s, runningCount: s.runningCount - rollback }
    dealerCards = [drawn[1], holeCard]
    holeHidden = true
    dealerBJ = handTotal(dealerCards).isBlackjack
  }

  const player = newHand(playerCards, clampedBet)
  const dealer: DealerState = {
    cards: dealerCards,
    holeHidden,
    finished: false,
    busted: false,
    blackjack: dealerBJ
  }

  s = { ...s, hands: [player], activeHandIdx: 0, dealer, bankroll: s.bankroll - clampedBet }

  // Insurance is only offered in american tables when dealer shows an Ace.
  if (!isEuropean) {
    const dealerShowsAce = dealerCards[0].rank === 'A'
    if (dealerShowsAce && s.rules.insurance) {
      return { ...s, phase: 'insurance' }
    }
    return handleBlackjackCheck(s)
  }

  // European: player blackjack still resolves immediately (dealer has no hole to peek).
  if (player.blackjack) {
    return revealAndSettle(s)
  }
  return { ...s, phase: 'playerTurn' }
}

function revealHoleAndAddCount(state: GameState): GameState {
  if (!state.dealer.holeHidden) return state
  const hole = state.dealer.cards[1]
  if (!hole) return state
  const runningCount = updateRunningCount(state.runningCount, hole, state.rules.countingSystem)
  return { ...state, runningCount, dealer: { ...state.dealer, holeHidden: false } }
}

function handleBlackjackCheck(state: GameState): GameState {
  const dealer = state.dealer
  const dealerBJ = dealer.blackjack
  const player = state.hands[0]
  if (dealerBJ || player.blackjack) {
    // Reveal hole (and re-add its running-count contribution) before settling.
    return revealAndSettle(revealHoleAndAddCount(state))
  }
  return { ...state, phase: 'playerTurn' }
}

export function takeInsurance(state: GameState, accept: boolean): GameState {
  if (state.phase !== 'insurance') return state
  const cost = accept ? Math.floor(state.bet / 2) : 0
  const s: GameState = { ...state, insuranceTaken: accept, insuranceCost: cost, bankroll: state.bankroll - cost }
  return handleBlackjackCheck(s)
}

function activeHand(state: GameState): HandState {
  return state.hands[state.activeHandIdx]
}

function updateHand(state: GameState, patch: Partial<HandState>): GameState {
  const hands = state.hands.slice()
  hands[state.activeHandIdx] = { ...hands[state.activeHandIdx], ...patch }
  return { ...state, hands }
}

function advanceHandOrDealer(state: GameState): GameState {
  const next = state.activeHandIdx + 1
  if (next < state.hands.length) {
    return { ...state, activeHandIdx: next }
  }
  return startDealerTurn(state)
}

export function hit(state: GameState): GameState {
  if (state.phase !== 'playerTurn') return state
  const hand = activeHand(state)
  if (hand.finished) return advanceHandOrDealer(state)
  const r = drawAndCount(state)
  let s = r.state
  const cards = [...hand.cards, r.card]
  const t = handTotal(cards)
  const busted = t.isBust
  s = updateHand(s, { cards, busted, finished: busted })
  if (busted) return advanceHandOrDealer(s)
  return s
}

export function stand(state: GameState): GameState {
  if (state.phase !== 'playerTurn') return state
  const s = updateHand(state, { finished: true })
  return advanceHandOrDealer(s)
}

export function doubleDown(state: GameState): GameState {
  if (state.phase !== 'playerTurn') return state
  const hand = activeHand(state)
  if (state.bankroll < hand.bet) return { ...state, message: 'Bankroll insuficiente para doblar.' }
  const r = drawAndCount(state)
  let s = r.state
  const cards = [...hand.cards, r.card]
  const t = handTotal(cards)
  s = { ...s, bankroll: s.bankroll - hand.bet }
  s = updateHand(s, {
    cards,
    bet: hand.bet * 2,
    doubled: true,
    finished: true,
    busted: t.isBust
  })
  return advanceHandOrDealer(s)
}

export function split(state: GameState): GameState {
  if (state.phase !== 'playerTurn') return state
  const hand = activeHand(state)
  if (!isPair(hand.cards)) return { ...state, message: 'No es una pareja.' }
  if (state.bankroll < hand.bet) return { ...state, message: 'Bankroll insuficiente para dividir.' }

  const [c1, c2] = hand.cards
  const isAces = c1.rank === 'A'
  const handA: HandState = { ...hand, cards: [c1], fromSplit: true, isSplitAces: isAces, finished: false, busted: false, blackjack: false }
  const handB: HandState = { ...hand, cards: [c2], fromSplit: true, isSplitAces: isAces, finished: false, busted: false, blackjack: false }

  // Deal one card to each.
  let s: GameState = { ...state, bankroll: state.bankroll - hand.bet, splitsSoFar: state.splitsSoFar + 1 }
  const r1 = drawAndCount(s); s = r1.state; handA.cards = [c1, r1.card]
  const r2 = drawAndCount(s); s = r2.state; handB.cards = [c2, r2.card]

  if (isAces && !s.rules.hitSplitAces) {
    handA.finished = true
    handB.finished = true
  }

  const hands = [...s.hands]
  hands.splice(s.activeHandIdx, 1, handA, handB)
  s = { ...s, hands }

  // If active hand is finished (split aces auto-stand), advance.
  if (handA.finished && handB.finished) return startDealerTurn(s)
  if (handA.finished) return { ...s, activeHandIdx: s.activeHandIdx + 1 }
  return s
}

export function surrender(state: GameState): GameState {
  if (state.phase !== 'playerTurn') return state
  const s = updateHand(state, { surrendered: true, finished: true })
  return advanceHandOrDealer(s)
}

function startDealerTurn(state: GameState): GameState {
  // Reveal hole and add its count contribution now (single source of truth).
  const revealed = revealHoleAndAddCount(state)

  const anyLive = revealed.hands.some(h => !h.busted && !h.surrendered)
  if (!anyLive) {
    return revealAndSettle(revealed)
  }

  // Play dealer while updating count on each new card.
  let s: GameState = revealed
  const cards: Card[] = [...revealed.dealer.cards]
  while (true) {
    const t = handTotal(cards)
    if (t.value > 21) break
    if (t.value >= 18) break
    if (t.value === 17) {
      if (t.isSoft && s.rules.dealerHitsSoft17) {
        const r = drawAndCount(s); s = r.state; cards.push(r.card); continue
      }
      break
    }
    const r = drawAndCount(s); s = r.state; cards.push(r.card)
  }
  const dt = handTotal(cards)
  // A natural blackjack drawn out by the dealer only occurs in European tables
  // (in American we would have flagged it at startRound and never reached here).
  const isBJ = cards.length === 2 && dt.value === 21
  const finalDealer: DealerState = { cards, holeHidden: false, finished: true, busted: dt.isBust, blackjack: isBJ }
  return revealAndSettle({ ...s, dealer: finalDealer })
}

function revealAndSettle(state: GameState): GameState {
  const dealerT = handTotal(state.dealer.cards)
  const dealerVal = dealerT.value
  const dealerBJ = state.dealer.blackjack

  let net = 0
  // Insurance settlement
  if (state.insuranceTaken) {
    if (dealerBJ) net += state.insuranceCost * 3 // win 2:1 plus stake back
  }

  const hands = state.hands.map(h => {
    if (h.surrendered) {
      const refund = h.bet / 2
      net += refund
      return { ...h, result: 'surrender' as HandResult, payout: refund }
    }
    if (h.busted) {
      return { ...h, result: 'bust' as HandResult, payout: 0 }
    }
    const pt = handTotal(h.cards).value
    // Player blackjack
    if (h.blackjack && !dealerBJ) {
      const pay = state.rules.blackjackPayout === '3:2' ? h.bet * 2.5 : h.bet * 2.2
      net += pay
      return { ...h, result: 'blackjack' as HandResult, payout: pay }
    }
    if (dealerBJ && !h.blackjack) {
      // European OBBO (non-ENHC): only the original wager is lost; any extra
      // bet from doubling is refunded. Splits are already independent hands so
      // each pays original-only from its own perspective.
      const isEuroOBBO = state.rules.variant === 'european' && !state.rules.enhc
      if (isEuroOBBO && h.doubled) {
        const originalBet = h.bet / 2
        net += originalBet
        return { ...h, result: 'lose' as HandResult, payout: originalBet }
      }
      return { ...h, result: 'lose' as HandResult, payout: 0 }
    }
    if (dealerBJ && h.blackjack) {
      net += h.bet
      return { ...h, result: 'push' as HandResult, payout: h.bet }
    }
    if (state.dealer.busted) {
      const pay = h.bet * 2
      net += pay
      return { ...h, result: 'dealerBust' as HandResult, payout: pay }
    }
    if (pt > dealerVal) {
      const pay = h.bet * 2
      net += pay
      return { ...h, result: 'win' as HandResult, payout: pay }
    }
    if (pt < dealerVal) {
      return { ...h, result: 'lose' as HandResult, payout: 0 }
    }
    net += h.bet
    return { ...h, result: 'push' as HandResult, payout: h.bet }
  })

  const totalWagered = state.hands.reduce((sum, h) => sum + h.bet, 0)
  const roundNet = net - totalWagered - state.insuranceCost

  return {
    ...state,
    hands,
    bankroll: state.bankroll + net,
    phase: 'roundOver',
    lastRoundNet: roundNet
  }
}

export function nextRound(state: GameState): GameState {
  return { ...state, phase: 'betting', hands: [], dealer: { cards: [], holeHidden: true, finished: false, busted: false, blackjack: false }, activeHandIdx: 0, splitsSoFar: 0, insuranceTaken: false, insuranceCost: 0 }
}

/** Force a brand-new shoe: reshuffle and reset the running count, preserving bankroll and rules. */
export function forceNewShoe(state: GameState): GameState {
  const shoe = buildShoe(state.rules.decks, state.rules.penetration, state.rules.burnCards)
  return {
    ...state,
    shoe,
    runningCount: 0,
    phase: 'betting',
    hands: [],
    dealer: { cards: [], holeHidden: true, finished: false, busted: false, blackjack: false },
    activeHandIdx: 0,
    splitsSoFar: 0,
    insuranceTaken: false,
    insuranceCost: 0,
    message: 'Zapato nuevo barajado.'
  }
}

// Helper for UI: recompute running count from currently visible cards
// (used when the user wants to compare their manual count vs the engine).
export function visibleRunningCount(state: GameState): number {
  const cards: Card[] = []
  for (const h of state.hands) cards.push(...h.cards)
  cards.push(state.dealer.cards[0])
  if (!state.dealer.holeHidden && state.dealer.cards[1]) cards.push(state.dealer.cards[1])
  // Add discarded cards from shoe.played except those still visible.
  // Simpler approach: derive from full played list minus hole if hidden.
  const played = state.shoe.played.slice()
  if (state.dealer.holeHidden) {
    // Remove the hole card from played to avoid double counting hidden card.
    const hole = state.dealer.cards[1]
    const idx = played.findIndex(c => c.id === hole?.id)
    if (idx !== -1) played.splice(idx, 1)
  }
  return runningCountFromCards(played, state.rules.countingSystem)
}
