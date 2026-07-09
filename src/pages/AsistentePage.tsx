import { useEffect, useMemo, useReducer, useState } from 'react'
import { Link } from 'react-router-dom'
import { PlayingCard } from '../components/PlayingCard'
import { getRecommendedAction } from '../engine/recommendation'
import { recommendedBet } from '../engine/betting'
import { trueCount as computeTC } from '../engine/counting'
import { cardValueForCount } from '../data/countingSystems'
import { DEFAULT_BET_RAMP, DEFAULT_RULES } from '../data/defaults'
import type {
  Action,
  Aggression,
  BlackjackPayout,
  BlackjackVariant,
  Card,
  DoubleRule,
  Rank,
  Rounding,
  ShuffleType,
  SurrenderRule,
  TableRules
} from '../types'

const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

type Step =
  | 'WAITING_PLAYER_FIRST_CARD'
  | 'WAITING_DEALER_UPCARD'
  | 'WAITING_PLAYER_SECOND_CARD'
  | 'SHOWING_RECOMMENDATION'
  | 'WAITING_PLAYER_HIT_CARD'
  | 'WAITING_DOUBLE_CARD'
  | 'WAITING_SPLIT_CARD'
  | 'WAITING_DEALER_FINAL_CARDS'
  | 'WAITING_RESULT'
  | 'HAND_FINISHED'

type BucketSource = 'player' | 'dealerUp' | 'dealerHole' | 'other' | 'dealerFinal' | 'manualTick'

interface Registered {
  id: string
  rank?: Rank
  bucket?: 'low' | 'neutral' | 'high'
  source: BucketSource
  countValue: number
}

type HandStatus = 'pending' | 'active' | 'done' | 'busted' | 'surrendered'
type HandResult = 'win' | 'lose' | 'push' | 'blackjack' | 'surrender' | 'bust'

interface PlayerHand {
  id: number
  cards: Registered[]
  bet: number
  status: HandStatus
  result: HandResult | null
  doubled: boolean
  fromSplit: boolean
  isSplitAces: boolean
  /** True when this hand was just created by a split and still needs its second card. */
  needsSecondCard: boolean
}

interface HistoryEntry {
  handNumber: number
  hands: Array<{ ranks: Rank[]; bet: number; result: HandResult | null; doubled: boolean }>
  dealerUpRank: Rank | null
  dealerFinalRanks: Rank[]
  rcBefore: number
  rcAfter: number
  tcBefore: number
  tcAfter: number
  recommendedBet: number
  bankrollAfter: number
}

interface SessionState {
  handNumber: number
  seenCards: Registered[]
  history: HistoryEntry[]
  bankroll: number
  initialDecks: number
  rules: TableRules
}

interface RoundState {
  hands: PlayerHand[]
  activeHandIdx: number
  dealerUpcard: Registered | null
  dealerFinalCards: Registered[]
  otherCards: Registered[]
  undoStack: string[]
  currentBet: number | null
}

interface FullState {
  step: Step
  session: SessionState
  round: RoundState
  advancedCounting: boolean
}

// ─── State helpers ────────────────────────────────────────────

let seq = 0
let handSeq = 0
function newId(): string { seq += 1; return `c-${seq}` }
function makeCard(rank: Rank, source: BucketSource): Registered {
  return { id: newId(), rank, source, countValue: cardValueForCount(rank, 'HiLo') }
}
function makeBucket(bucket: 'low' | 'neutral' | 'high', source: BucketSource): Registered {
  return {
    id: newId(),
    bucket,
    source,
    countValue: bucket === 'low' ? 1 : bucket === 'neutral' ? 0 : -1
  }
}
function newHand(cards: Registered[] = [], bet = 0, opts: Partial<PlayerHand> = {}): PlayerHand {
  handSeq += 1
  return {
    id: handSeq,
    cards,
    bet,
    status: 'active',
    result: null,
    doubled: false,
    fromSplit: false,
    isSplitAces: false,
    needsSecondCard: false,
    ...opts
  }
}

function emptyRound(bet: number | null = null): RoundState {
  return {
    hands: [newHand()],
    activeHandIdx: 0,
    dealerUpcard: null,
    dealerFinalCards: [],
    otherCards: [],
    undoStack: [],
    currentBet: bet
  }
}

function initial(): FullState {
  const rules: TableRules = { ...DEFAULT_RULES, betRamp: DEFAULT_BET_RAMP }
  return {
    step: 'WAITING_PLAYER_FIRST_CARD',
    session: {
      handNumber: 1,
      seenCards: [],
      history: [],
      bankroll: rules.bankroll,
      initialDecks: rules.decks,
      rules
    },
    round: emptyRound(),
    advancedCounting: false
  }
}

function activeHand(round: RoundState): PlayerHand | undefined {
  return round.hands[round.activeHandIdx]
}

function updateActiveHand(round: RoundState, patch: Partial<PlayerHand>): RoundState {
  const hands = round.hands.slice()
  const idx = round.activeHandIdx
  if (!hands[idx]) return round
  hands[idx] = { ...hands[idx], ...patch }
  return { ...round, hands }
}

// ─── Reducer ────────────────────────────────────────────────

type Msg =
  | { type: 'PICK_CARD'; rank: Rank }
  | { type: 'BUCKET'; bucket: 'low' | 'neutral' | 'high' }
  | { type: 'ACTION'; action: 'H' | 'S' | 'D' | 'P' | 'R' }
  | { type: 'RESULT_ACTIVE'; result: HandResult }
  | { type: 'RESULT_ALL_LOSE' } // dealer beats everyone (e.g., dealer BJ or higher)
  | { type: 'RESULT_ALL_WIN' } // dealer busted
  | { type: 'RESULT_ALL_PUSH' } // dealer ties everyone
  | { type: 'UNDO' }
  | { type: 'NEW_HAND' }
  | { type: 'NEW_SHOE' }
  | { type: 'RESET' }
  | { type: 'SET_BET'; bet: number | null }
  | { type: 'SET_RULES'; rules: Partial<TableRules> }
  | { type: 'TOGGLE_ADVANCED_COUNT' }
  | { type: 'ADVANCE_TO_DEALER' }

function reducer(state: FullState, msg: Msg): FullState {
  switch (msg.type) {
    case 'PICK_CARD':
      return handlePickCard(state, msg.rank)
    case 'BUCKET': {
      const b = makeBucket(msg.bucket, 'other')
      const r = {
        ...state.round,
        otherCards: [...state.round.otherCards, b],
        undoStack: [...state.round.undoStack, b.id]
      }
      return { ...state, round: r }
    }
    case 'ACTION':
      return handleAction(state, msg.action)
    case 'RESULT_ACTIVE': {
      let round = updateActiveHand(state.round, { status: 'done', result: msg.result })
      // Advance to the next pending/active hand; if none, close the round.
      const hands = round.hands.slice()
      const next = advanceActive(hands, round.activeHandIdx)
      round = { ...round, hands, activeHandIdx: next.idx }
      // If every hand is already settled, jump straight to HAND_FINISHED.
      const allSettled = hands.every((h) => h.status === 'done' || h.status === 'busted' || h.status === 'surrendered')
      const step: Step = allSettled ? 'HAND_FINISHED' : next.step
      return { ...state, round, step }
    }
    case 'RESULT_ALL_LOSE':
    case 'RESULT_ALL_WIN':
    case 'RESULT_ALL_PUSH': {
      const forcedResult: HandResult =
        msg.type === 'RESULT_ALL_WIN' ? 'win'
        : msg.type === 'RESULT_ALL_LOSE' ? 'lose'
        : 'push'
      const hands = state.round.hands.map((h) => {
        if (h.result) return h // already settled (surrender, bust, blackjack)
        if (h.status === 'busted' || h.status === 'surrendered') return h
        return { ...h, status: 'done' as HandStatus, result: forcedResult }
      })
      return { ...state, round: { ...state.round, hands }, step: 'HAND_FINISHED' }
    }
    case 'UNDO':
      return handleUndo(state)
    case 'NEW_HAND':
      return handleFinishHand(state)
    case 'NEW_SHOE':
      return {
        ...state,
        session: { ...state.session, seenCards: [], handNumber: 1 },
        round: emptyRound(),
        step: 'WAITING_PLAYER_FIRST_CARD'
      }
    case 'RESET':
      return { ...initial(), session: { ...initial().session, rules: state.session.rules } }
    case 'SET_BET':
      return { ...state, round: { ...state.round, currentBet: msg.bet } }
    case 'SET_RULES': {
      const rules = { ...state.session.rules, ...msg.rules }
      const initialDecks = 'decks' in msg.rules ? rules.decks : state.session.initialDecks
      return { ...state, session: { ...state.session, rules, initialDecks } }
    }
    case 'TOGGLE_ADVANCED_COUNT':
      return { ...state, advancedCounting: !state.advancedCounting }
    case 'ADVANCE_TO_DEALER':
      return { ...state, step: 'WAITING_DEALER_FINAL_CARDS' }
  }
}

function handlePickCard(state: FullState, rank: Rank): FullState {
  const round = state.round
  const active = activeHand(round)
  const card = makeCard(rank, sourceForStep(state.step))
  const undoStack = [...round.undoStack, card.id]

  switch (state.step) {
    case 'WAITING_PLAYER_FIRST_CARD': {
      if (!active) return state
      const hands = round.hands.slice()
      hands[round.activeHandIdx] = { ...active, cards: [card] }
      return { ...state, round: { ...round, hands, undoStack }, step: 'WAITING_DEALER_UPCARD' }
    }
    case 'WAITING_DEALER_UPCARD':
      return { ...state, round: { ...round, dealerUpcard: card, undoStack }, step: 'WAITING_PLAYER_SECOND_CARD' }
    case 'WAITING_PLAYER_SECOND_CARD': {
      if (!active) return state
      const hands = round.hands.slice()
      hands[round.activeHandIdx] = { ...active, cards: [...active.cards, card] }
      return { ...state, round: { ...round, hands, undoStack }, step: 'SHOWING_RECOMMENDATION' }
    }
    case 'WAITING_PLAYER_HIT_CARD': {
      if (!active) return state
      const cards = [...active.cards, card]
      const total = handTotalValue(cards.map((c) => c.rank!))
      const busted = total > 21
      const hands = round.hands.slice()
      hands[round.activeHandIdx] = {
        ...active,
        cards,
        status: busted ? 'busted' : 'active',
        result: busted ? 'bust' : null
      }
      let step: Step = 'SHOWING_RECOMMENDATION'
      let newActiveIdx = round.activeHandIdx
      if (busted) {
        const next = advanceActive(hands, round.activeHandIdx)
        newActiveIdx = next.idx
        step = next.step
      }
      return {
        ...state,
        round: { ...round, hands, undoStack, activeHandIdx: newActiveIdx },
        step
      }
    }
    case 'WAITING_DOUBLE_CARD': {
      if (!active) return state
      const cards = [...active.cards, card]
      const total = handTotalValue(cards.map((c) => c.rank!))
      const busted = total > 21
      const hands = round.hands.slice()
      hands[round.activeHandIdx] = {
        ...active,
        cards,
        bet: active.bet * 2,
        doubled: true,
        status: busted ? 'busted' : 'done',
        result: busted ? 'bust' : null
      }
      const next = advanceActive(hands, round.activeHandIdx)
      return {
        ...state,
        round: { ...round, hands, undoStack, activeHandIdx: next.idx },
        step: next.step
      }
    }
    case 'WAITING_SPLIT_CARD': {
      // Assign this card to whichever split hand needsSecondCard first.
      const hands = round.hands.slice()
      const idx = hands.findIndex((h) => h.needsSecondCard)
      if (idx === -1) return state
      const h = hands[idx]
      const cards = [...h.cards, card]
      hands[idx] = { ...h, cards, needsSecondCard: false }
      // If aces and no hitSplitAces, close it immediately.
      const rules = state.session.rules
      const isSplitAces = h.isSplitAces
      if (isSplitAces && !rules.hitSplitAces) {
        hands[idx].status = 'done'
      }
      const stillPending = hands.some((x) => x.needsSecondCard)
      let step: Step = 'WAITING_SPLIT_CARD'
      let newActiveIdx = round.activeHandIdx
      if (!stillPending) {
        // Move to the first non-done hand as active
        const firstActive = hands.findIndex((x) => x.status === 'active')
        if (firstActive === -1) {
          // All hands done (probably split aces closed) — proceed to dealer.
          step = 'WAITING_DEALER_FINAL_CARDS'
          newActiveIdx = 0
        } else {
          newActiveIdx = firstActive
          step = 'SHOWING_RECOMMENDATION'
        }
      }
      return { ...state, round: { ...round, hands, undoStack, activeHandIdx: newActiveIdx }, step }
    }
    case 'WAITING_DEALER_FINAL_CARDS': {
      const dealerFinal = [...round.dealerFinalCards, card]
      return { ...state, round: { ...round, dealerFinalCards: dealerFinal, undoStack } }
    }
    default:
      return state
  }
}

function handleAction(state: FullState, action: 'H' | 'S' | 'D' | 'P' | 'R'): FullState {
  const round = state.round
  const active = activeHand(round)
  if (!active) return state
  const rules = state.session.rules

  switch (action) {
    case 'H':
      return { ...state, step: 'WAITING_PLAYER_HIT_CARD' }
    case 'S': {
      const hands = round.hands.slice()
      hands[round.activeHandIdx] = { ...active, status: 'done' }
      const next = advanceActive(hands, round.activeHandIdx)
      return { ...state, round: { ...round, hands, activeHandIdx: next.idx }, step: next.step }
    }
    case 'D':
      if (active.cards.length !== 2) return state
      return { ...state, step: 'WAITING_DOUBLE_CARD' }
    case 'R': {
      const hands = round.hands.slice()
      hands[round.activeHandIdx] = { ...active, status: 'surrendered', result: 'surrender' }
      const next = advanceActive(hands, round.activeHandIdx)
      return { ...state, round: { ...round, hands, activeHandIdx: next.idx }, step: next.step }
    }
    case 'P': {
      if (active.cards.length !== 2) return state
      const [c1, c2] = active.cards
      const isAces = c1.rank === 'A'
      // Enforce max hands per split.
      if (round.hands.length >= rules.maxSplitHands) return state
      const hands = round.hands.slice()
      const handA = newHand([c1], active.bet, { fromSplit: true, isSplitAces: isAces, needsSecondCard: true, status: 'active' })
      const handB = newHand([c2], active.bet, { fromSplit: true, isSplitAces: isAces, needsSecondCard: true, status: 'pending' })
      hands.splice(round.activeHandIdx, 1, handA, handB)
      return {
        ...state,
        round: { ...round, hands, activeHandIdx: round.activeHandIdx },
        step: 'WAITING_SPLIT_CARD'
      }
    }
  }
}

function advanceActive(hands: PlayerHand[], fromIdx: number): { idx: number; step: Step } {
  for (let i = fromIdx + 1; i < hands.length; i++) {
    if (hands[i].status === 'pending' || hands[i].status === 'active') {
      // Mark as active
      hands[i] = { ...hands[i], status: 'active' }
      return { idx: i, step: 'SHOWING_RECOMMENDATION' }
    }
  }
  return { idx: fromIdx, step: 'WAITING_DEALER_FINAL_CARDS' }
}

function handleUndo(state: FullState): FullState {
  const stack = state.round.undoStack
  if (stack.length === 0) return state
  const lastId = stack[stack.length - 1]
  const round = removeCardById(state.round, lastId)
  round.undoStack = stack.slice(0, -1)
  // Recompute step from resulting state.
  const active = activeHand(round)
  const totalHands = round.hands.length
  let step = state.step
  if (totalHands === 1) {
    const h = active!
    if (h.cards.length === 0 && !round.dealerUpcard) step = 'WAITING_PLAYER_FIRST_CARD'
    else if (h.cards.length === 1 && !round.dealerUpcard) step = 'WAITING_DEALER_UPCARD'
    else if (h.cards.length === 1 && round.dealerUpcard) step = 'WAITING_PLAYER_SECOND_CARD'
    else if (h.cards.length >= 2 && round.dealerUpcard) step = 'SHOWING_RECOMMENDATION'
  } else {
    if (round.hands.some((h) => h.needsSecondCard)) step = 'WAITING_SPLIT_CARD'
    else step = 'SHOWING_RECOMMENDATION'
  }
  return { ...state, round, step }
}

function removeCardById(round: RoundState, id: string): RoundState {
  const hands = round.hands.map((h) => ({ ...h, cards: h.cards.filter((c) => c.id !== id) }))
  const dealerUpcard = round.dealerUpcard?.id === id ? null : round.dealerUpcard
  const dealerFinalCards = round.dealerFinalCards.filter((c) => c.id !== id)
  const otherCards = round.otherCards.filter((c) => c.id !== id)
  return { ...round, hands, dealerUpcard, dealerFinalCards, otherCards }
}

function handleFinishHand(state: FullState): FullState {
  const round = state.round
  const rc = runningCountValue(state)
  const decksLeft = decksRemaining(state)
  const tc = computeTC(rc, decksLeft, state.session.rules.rounding)
  const rcBefore = runningCountBeforeRound(state)
  const tcBefore = computeTC(rcBefore, decksRemainingBeforeRound(state), state.session.rules.rounding)
  const nextBet = recommendedBet(state.session.rules, tc, state.session.bankroll)

  // Compute bankroll delta over all hands + settlements.
  const bankrollDelta = round.hands.reduce((sum, h) => sum + handBankrollDelta(h, state.session.rules), 0)
  const bankroll = state.session.bankroll + bankrollDelta

  const historyEntry: HistoryEntry = {
    handNumber: state.session.handNumber,
    hands: round.hands.map((h) => ({
      ranks: h.cards.map((c) => c.rank!).filter(Boolean) as Rank[],
      bet: h.bet,
      result: h.result,
      doubled: h.doubled
    })),
    dealerUpRank: round.dealerUpcard?.rank ?? null,
    dealerFinalRanks: round.dealerFinalCards.map((c) => c.rank!).filter(Boolean) as Rank[],
    rcBefore,
    rcAfter: rc,
    tcBefore,
    tcAfter: tc,
    recommendedBet: nextBet.bet,
    bankrollAfter: bankroll
  }

  // Move round cards to seen. On CSM, the seen pile is cleared each hand so
  // the count never accumulates meaningfully.
  const roundRegisters = allRoundCards(round).filter(Boolean)
  const isCsm = state.session.rules.shuffleType === 'csm'
  const seenCards = isCsm ? [] : [...state.session.seenCards, ...roundRegisters]

  return {
    ...state,
    session: {
      ...state.session,
      bankroll,
      handNumber: state.session.handNumber + 1,
      seenCards,
      history: [...state.session.history, historyEntry]
    },
    round: emptyRound(),
    step: 'WAITING_PLAYER_FIRST_CARD'
  }
}

function sourceForStep(step: Step): BucketSource {
  if (
    step === 'WAITING_PLAYER_FIRST_CARD'
    || step === 'WAITING_PLAYER_SECOND_CARD'
    || step === 'WAITING_PLAYER_HIT_CARD'
    || step === 'WAITING_DOUBLE_CARD'
    || step === 'WAITING_SPLIT_CARD'
  ) return 'player'
  if (step === 'WAITING_DEALER_UPCARD') return 'dealerUp'
  if (step === 'WAITING_DEALER_FINAL_CARDS') return 'dealerFinal'
  return 'other'
}

function allRoundCards(round: RoundState): Registered[] {
  const hs = round.hands.flatMap((h) => h.cards)
  return [
    ...hs,
    ...(round.dealerUpcard ? [round.dealerUpcard] : []),
    ...round.dealerFinalCards,
    ...round.otherCards
  ]
}

function runningCountValue(state: FullState): number {
  const seenSum = state.session.seenCards.reduce((a, c) => a + c.countValue, 0)
  const roundSum = allRoundCards(state.round).reduce((a, c) => a + c.countValue, 0)
  return seenSum + roundSum
}

function runningCountBeforeRound(state: FullState): number {
  return state.session.seenCards.reduce((a, c) => a + c.countValue, 0)
}

function decksRemaining(state: FullState): number {
  const total = state.session.initialDecks * 52
  const seen = state.session.seenCards.length + allRoundCards(state.round).length + state.session.rules.burnCards
  return Math.max(0.25, (total - seen) / 52)
}

function decksRemainingBeforeRound(state: FullState): number {
  const total = state.session.initialDecks * 52
  return Math.max(0.25, (total - state.session.seenCards.length - state.session.rules.burnCards) / 52)
}

function handBankrollDelta(h: PlayerHand, rules: TableRules): number {
  const baseBet = h.doubled ? h.bet / 2 : h.bet
  const totalBet = h.bet
  switch (h.result) {
    case 'blackjack': {
      const isNatural = h.cards.length === 2 && handTotalValue(h.cards.map((c) => c.rank!)) === 21
      if (!isNatural) return baseBet
      const mult = rules.blackjackPayout === '3:2' ? 1.5 : rules.blackjackPayout === '6:5' ? 1.2 : 1
      return baseBet * mult
    }
    case 'win': return totalBet
    case 'push': return 0
    case 'lose': return -totalBet
    case 'bust': return -totalBet
    case 'surrender': return -baseBet / 2
    default: return 0
  }
}

function handTotalValue(ranks: Rank[]): number {
  let total = 0, aces = 0
  for (const r of ranks) {
    if (r === 'A') { total += 1; aces++ }
    else if (r === 'J' || r === 'Q' || r === 'K' || r === '10') total += 10
    else total += parseInt(r, 10)
  }
  while (aces > 0 && total + 10 <= 21) { total += 10; aces-- }
  return total
}

function handIsSoft(ranks: Rank[]): boolean {
  if (!ranks.includes('A')) return false
  let base = 0
  for (const r of ranks) {
    if (r === 'A') base += 1
    else if (r === 'J' || r === 'Q' || r === 'K' || r === '10') base += 10
    else base += parseInt(r, 10)
  }
  return base + 10 <= 21
}

function isPairEligible(ranks: Rank[]): boolean {
  if (ranks.length !== 2) return false
  const norm = (r: Rank) => (r === 'A' ? 'A' : r === 'J' || r === 'Q' || r === 'K' || r === '10' ? '10' : r)
  return norm(ranks[0]) === norm(ranks[1])
}

const STEP_TITLE: Record<Step, string> = {
  WAITING_PLAYER_FIRST_CARD: 'Selecciona tu primera carta',
  WAITING_DEALER_UPCARD: 'Selecciona la carta visible del dealer',
  WAITING_PLAYER_SECOND_CARD: 'Selecciona tu segunda carta',
  SHOWING_RECOMMENDATION: 'Elige tu acción',
  WAITING_PLAYER_HIT_CARD: 'Selecciona la carta que recibiste',
  WAITING_DOUBLE_CARD: 'Selecciona la carta del double',
  WAITING_SPLIT_CARD: 'Selecciona la carta para la mano recién dividida',
  WAITING_DEALER_FINAL_CARDS: 'Registra las cartas finales del dealer',
  WAITING_RESULT: 'Marca el resultado de la mano',
  HAND_FINISHED: 'Mano finalizada'
}

// Session-lived cache: state survives navigation within the same tab and only
// resets when the page is reloaded (module scope is per-load).
let cachedState: FullState | null = null

// ─── Component ────────────────────────────────────────────────

export function AsistentePage() {
  const [state, dispatch] = useReducer(reducer, undefined, () => cachedState ?? initial())
  useEffect(() => {
    cachedState = state
  }, [state])
  const [showRulesPanel, setShowRulesPanel] = useState(false)
  const [showExplanation, setShowExplanation] = useState(false)
  const [showCount, setShowCount] = useState(true)
  const [historyOpen, setHistoryOpen] = useState<number | null>(null)

  const { session, round, step, advancedCounting } = state
  const isCsm = session.rules.shuffleType === 'csm'
  const rc = runningCountValue(state)
  const decks = decksRemaining(state)
  const tc = isCsm ? 0 : computeTC(rc, decks, session.rules.rounding)

  const activeH = activeHand(round)
  const playerRanks = activeH ? (activeH.cards.map((c) => c.rank!) as Rank[]) : []
  const activeTotal = playerRanks.length > 0 ? handTotalValue(playerRanks) : 0
  const activeSoft = handIsSoft(playerRanks)

  const recommendation = useMemo(() => {
    if (!activeH || activeH.cards.length < 2 || !round.dealerUpcard || !round.dealerUpcard.rank) return null
    return getRecommendedAction({
      playerCards: activeH.cards.map((c) => ({ rank: c.rank!, suit: '♠', id: c.id })) as Card[],
      dealerUpcard: { rank: round.dealerUpcard.rank!, suit: '♠', id: round.dealerUpcard.id } as Card,
      rules: session.rules,
      runningCount: isCsm ? undefined : rc,
      decksRemaining: isCsm ? undefined : decks,
      rounding: session.rules.rounding,
      trueCount: isCsm ? 0 : undefined
    })
  }, [activeH, round.dealerUpcard, session.rules, rc, decks, isCsm])

  const canPlayerSplit = useMemo(() => {
    if (!activeH || activeH.cards.length !== 2) return false
    if (activeH.doubled || activeH.fromSplit && activeH.isSplitAces && !session.rules.resplitAces) return false
    if (round.hands.length >= session.rules.maxSplitHands) return false
    return isPairEligible(playerRanks)
  }, [activeH, playerRanks, round.hands.length, session.rules])

  const nextBet = useMemo(
    () => recommendedBet(session.rules, tc, session.bankroll),
    [session.rules, tc, session.bankroll]
  )

  const cardsSeen = session.seenCards.length + allRoundCards(round).length
  const totalCards = session.initialDecks * 52

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-3xl text-chip-gold">Asistente Rápido</h1>
          <p className="text-white/70 text-sm">Registra la mano paso a paso. Soporta split y adapta reglas.</p>
        </div>
        <Link to="/" className="btn-ghost">← Volver</Link>
      </div>

      <div className="rounded-lg border border-chip-gold/40 bg-chip-gold/5 text-xs text-white/85 px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>
          <strong>Modo:</strong>{' '}
          {session.rules.variant === 'american' ? 'Estadounidense' : 'Europeo'}
          {' · '}
          {isCsm ? 'CSM (barajado continuo)' : `${session.rules.decks} mazos, penetración ${Math.round(session.rules.penetration * 100)}%`}
          {session.rules.burnCards > 0 && ` · ${session.rules.burnCards} quemadas`}
        </span>
        <button onClick={() => setShowRulesPanel((v) => !v)} className="ml-auto btn-ghost !py-0.5 !px-2 text-[11px]">
          {showRulesPanel ? 'Ocultar configuración' : 'Configuración de mesa'}
        </button>
      </div>

      {showRulesPanel && (
        <RulesPanel rules={session.rules} onChange={(patch) => dispatch({ type: 'SET_RULES', rules: patch })} />
      )}

      {/* Session state */}
      <section className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Metric label="Mano" value={String(session.handNumber)} />
        <Metric label="RC" value={showCount && !isCsm ? fmt(rc) : '—'} />
        <Metric label="TC" value={showCount && !isCsm ? fmt(tc) : '—'} highlight />
        <Metric label="Mazos" value={isCsm ? '—' : decks.toFixed(2)} />
        <Metric label="Vistas" value={`${cardsSeen}/${totalCards}`} />
      </section>

      {isCsm && (
        <div className="rounded-lg border border-chip-red/40 bg-chip-red/10 text-xs text-white/85 px-3 py-2">
          <strong>Conteo desactivado por CSM.</strong> En máquinas continuas el zapato se remezcla cada mano, así que RC/TC no ayudan. Usa solo estrategia básica.
        </div>
      )}

      {/* Bet suggestion */}
      <section className="card-panel p-3 flex flex-wrap items-center gap-2 text-sm">
        <div className="font-display text-chip-gold">Próxima apuesta</div>
        <div>
          {isCsm ? (
            <span className="text-white/70">Apuesta plana recomendada: <strong>${session.rules.minBet}</strong></span>
          ) : (
            <>
              TC <strong>{fmt(tc)}</strong> · Sugerida{' '}
              <strong className="text-chip-gold tabular-nums">${nextBet.bet}</strong>{' '}
              <span className="text-white/60">({Math.round(nextBet.bet / session.rules.unit)} u)</span>
            </>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs">
          <span className="text-white/60">Apuesta ahora</span>
          <input
            type="number"
            min={0}
            value={round.currentBet ?? ''}
            placeholder={String(nextBet.bet)}
            onChange={(e) => dispatch({ type: 'SET_BET', bet: e.target.value ? parseInt(e.target.value, 10) : null })}
            className="bg-black/40 rounded px-2 py-0.5 border border-white/10 w-20"
          />
          <button
            className="btn-ghost !py-0.5 !px-2 text-[11px]"
            onClick={() => {
              dispatch({ type: 'SET_BET', bet: nextBet.bet })
              // Also assign to the current (first) hand.
              if (round.hands[0]) {
                round.hands[0].bet = nextBet.bet
              }
            }}
          >
            Usar
          </button>
        </div>
      </section>

      {/* Step + player hands */}
      <section className="card-panel p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-display text-lg text-chip-gold">{STEP_TITLE[step]}</div>
          <button className="btn-ghost !py-1 !px-2 text-xs" disabled={round.undoStack.length === 0} onClick={() => dispatch({ type: 'UNDO' })}>
            Deshacer
          </button>
        </div>

        {/* Dealer view */}
        <div>
          <div className="label mb-1">Dealer</div>
          <div className="flex gap-1 flex-wrap min-h-[4.5rem] items-center">
            {round.dealerUpcard ? (
              <PlayingCard card={{ rank: round.dealerUpcard.rank!, suit: '♠', id: round.dealerUpcard.id }} small />
            ) : (
              <span className="text-white/40 text-sm">Sin carta</span>
            )}
            {round.dealerFinalCards.map((c) => (
              <PlayingCard key={c.id} card={{ rank: c.rank!, suit: '♠', id: c.id }} small />
            ))}
          </div>
        </div>

        {/* Player hands table (multi-hand aware) */}
        <div className="space-y-2">
          {round.hands.map((h, i) => {
            const total = handTotalValue(h.cards.map((c) => c.rank!) as Rank[])
            const soft = handIsSoft(h.cards.map((c) => c.rank!) as Rank[])
            const isActiveHand = i === round.activeHandIdx && (h.status === 'active' || step === 'SHOWING_RECOMMENDATION')
            return (
              <div
                key={h.id}
                className={`rounded-lg border p-3 ${isActiveHand ? 'border-chip-gold bg-chip-gold/10' : 'border-white/10 bg-black/30'}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-2">
                  <div>
                    <span className="text-white/60">Mano {i + 1}</span>{' '}
                    {round.hands.length > 1 && <span className={statusBadgeClass(h.status)}>{statusLabel(h.status)}</span>}
                    {h.doubled && <span className="ml-1 px-1.5 py-0.5 rounded bg-chip-gold text-neutral-900 text-[10px]">Doblada</span>}
                    {h.isSplitAces && <span className="ml-1 px-1.5 py-0.5 rounded bg-chip-blue text-white text-[10px]">Split A-A</span>}
                  </div>
                  <div className="text-white/70">
                    Apuesta: <strong>${h.bet || round.currentBet || 0}</strong> · Total: <strong>{total}{soft ? ' soft' : ''}</strong>
                  </div>
                </div>
                <div className="flex gap-1 flex-wrap min-h-[4.5rem] items-center">
                  {h.cards.length === 0 ? (
                    <span className="text-white/40 text-sm">Vacía</span>
                  ) : h.cards.map((c) => (
                    <PlayingCard key={c.id} card={{ rank: c.rank!, suit: '♠', id: c.id }} small />
                  ))}
                  {h.needsSecondCard && <span className="text-chip-gold text-xs ml-2">Esperando 2ª carta</span>}
                </div>
              </div>
            )
          })}
        </div>

        {/* Card picker or action buttons */}
        {isCardPickingStep(step) && (
          <RankPicker onPick={(r) => dispatch({ type: 'PICK_CARD', rank: r })} />
        )}

        {step === 'SHOWING_RECOMMENDATION' && recommendation && (
          <>
            <div className="rounded-lg border border-chip-gold/40 bg-chip-gold/5 p-3 space-y-1">
              <div className="text-sm">
                <span className="text-white/60">Recomendación (Mano {round.activeHandIdx + 1}):</span>{' '}
                <strong className="text-chip-gold text-lg">{labelAction(recommendation.adjustedAction)}</strong>
                {recommendation.hasDeviation && !isCsm && <span className="ml-2 text-[11px]">desviación TC ≥ {recommendation.deviationIndex}</span>}
              </div>
              <div className="text-[11px] text-white/70">
                Básica: {labelAction(recommendation.basicAction)}
                {!isCsm && ` · TC actual ${fmt(tc)}`}
                {isCsm && ' · CSM: solo estrategia básica'}
              </div>
              {showExplanation && (
                <div className="text-xs text-white/80 border-t border-white/10 pt-2">{recommendation.explanation}</div>
              )}
              <button className="text-[11px] underline text-white/60" onClick={() => setShowExplanation((v) => !v)}>
                {showExplanation ? 'Ocultar explicación' : 'Ver explicación completa'}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <ActionButton label="Pedí carta" onClick={() => dispatch({ type: 'ACTION', action: 'H' })} disabled={activeH?.isSplitAces && !session.rules.hitSplitAces} />
              <ActionButton label="Me planté" onClick={() => dispatch({ type: 'ACTION', action: 'S' })} tone="secondary" />
              <ActionButton
                label="Doblé"
                onClick={() => dispatch({ type: 'ACTION', action: 'D' })}
                tone="primary"
                disabled={activeH?.cards.length !== 2 || (activeH?.fromSplit && !session.rules.doubleAfterSplit) || session.rules.doubleRule === 'none'}
              />
              {canPlayerSplit && (
                <ActionButton
                  label="Dividí"
                  onClick={() => dispatch({ type: 'ACTION', action: 'P' })}
                  tone="primary"
                />
              )}
              {session.rules.surrender !== 'none' && !activeH?.fromSplit && activeH?.cards.length === 2 && (
                <ActionButton label="Me rendí" onClick={() => dispatch({ type: 'ACTION', action: 'R' })} tone="danger" />
              )}
            </div>

            <div className="border-t border-white/10 pt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
              <ActionButton
                label={round.hands.length > 1 ? 'Todas ganaron' : 'Gané'}
                onClick={() => dispatch({ type: 'RESULT_ALL_WIN' })}
                tone="secondary"
              />
              <ActionButton
                label={round.hands.length > 1 ? 'Todas perdieron' : 'Perdí'}
                onClick={() => dispatch({ type: 'RESULT_ALL_LOSE' })}
                tone="danger"
              />
              <ActionButton
                label="Empate"
                onClick={() => dispatch({ type: round.hands.length > 1 ? 'RESULT_ACTIVE' : 'RESULT_ALL_PUSH', result: 'push' } as Msg)}
                tone="ghost"
              />
              <ActionButton label="Blackjack" onClick={() => dispatch({ type: 'RESULT_ACTIVE', result: 'blackjack' })} tone="primary" />
            </div>
          </>
        )}

        {step === 'WAITING_DEALER_FINAL_CARDS' && (
          <>
            <div className="text-xs text-white/60">Registra las cartas del dealer al descubrirlas. Cuando termines, marca el resultado.</div>
            <RankPicker onPick={(r) => dispatch({ type: 'PICK_CARD', rank: r })} />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <ActionButton label="Gané" onClick={() => dispatch({ type: 'RESULT_ALL_WIN' })} tone="secondary" />
              <ActionButton label="Dealer se pasó" onClick={() => dispatch({ type: 'RESULT_ALL_WIN' })} tone="primary" />
              <ActionButton label="Empate" onClick={() => dispatch({ type: 'RESULT_ALL_PUSH' })} tone="ghost" />
              <ActionButton label="Perdí" onClick={() => dispatch({ type: 'RESULT_ALL_LOSE' })} tone="danger" />
            </div>
            <div className="text-[11px] text-white/60">
              Si tuviste manos con resultados distintos (por split), usa los botones de resultado en el turno de cada mano.
            </div>
          </>
        )}

        {step === 'HAND_FINISHED' && (
          <div className="space-y-2">
            <div className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-1 text-sm">
              <div className="font-semibold">Resumen de la mano:</div>
              {round.hands.map((h, i) => {
                const delta = handBankrollDelta(h, session.rules)
                return (
                  <div key={h.id} className="flex justify-between text-xs">
                    <span>Mano {i + 1}: {h.cards.map((c) => c.rank).join(' ')} → {resultLabel(h.result)}</span>
                    <span className={delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-chip-red' : 'text-white/70'}>
                      {delta >= 0 ? '+' : ''}${delta.toFixed(0)}
                    </span>
                  </div>
                )
              })}
              <div className="border-t border-white/10 pt-1 flex justify-between font-semibold">
                <span>Neto</span>
                <span className={`tabular-nums ${round.hands.reduce((s, h) => s + handBankrollDelta(h, session.rules), 0) > 0 ? 'text-emerald-400' : 'text-chip-red'}`}>
                  {(() => {
                    const n = round.hands.reduce((s, h) => s + handBankrollDelta(h, session.rules), 0)
                    return `${n >= 0 ? '+' : ''}$${n.toFixed(0)}`
                  })()}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-primary" onClick={() => dispatch({ type: 'NEW_HAND' })}>Nueva mano</button>
              <button className="btn-ghost" onClick={() => confirm('Nuevo zapato: reinicia el conteo. ¿Continuar?') && dispatch({ type: 'NEW_SHOE' })}>
                Nuevo zapato
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Other players quick counting */}
      {!isCsm && (
        <section className="card-panel p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-display text-lg text-chip-gold">Cartas vistas de otros jugadores</div>
            <label className="text-xs text-white/70 flex items-center gap-1">
              <input
                type="checkbox"
                checked={advancedCounting}
                onChange={() => dispatch({ type: 'TOGGLE_ADVANCED_COUNT' })}
                className="accent-chip-gold"
              />
              Rango exacto
            </label>
          </div>
          {!advancedCounting ? (
            <div className="grid grid-cols-3 gap-2">
              <button className="btn-secondary py-3 text-sm" onClick={() => dispatch({ type: 'BUCKET', bucket: 'low' })}>
                <div>Baja</div>
                <div className="text-xs text-emerald-300">+1 · 2-6</div>
              </button>
              <button className="btn-ghost py-3 text-sm" onClick={() => dispatch({ type: 'BUCKET', bucket: 'neutral' })}>
                <div>Neutra</div>
                <div className="text-xs text-white/60">0 · 7-9</div>
              </button>
              <button className="btn-danger py-3 text-sm" onClick={() => dispatch({ type: 'BUCKET', bucket: 'high' })}>
                <div>Alta</div>
                <div className="text-xs">-1 · 10-A</div>
              </button>
            </div>
          ) : (
            <RankPicker
              onPick={(r) => {
                const v = cardValueForCount(r, 'HiLo')
                dispatch({ type: 'BUCKET', bucket: v > 0 ? 'low' : v < 0 ? 'high' : 'neutral' })
              }}
            />
          )}
          <div className="grid grid-cols-3 gap-2 text-center text-[11px] text-white/70">
            <div>Bajas: <strong className="text-emerald-400">{countBucket(state, 'low')}</strong></div>
            <div>Neutras: <strong>{countBucket(state, 'neutral')}</strong></div>
            <div>Altas: <strong className="text-chip-red">{countBucket(state, 'high')}</strong></div>
          </div>
        </section>
      )}

      {/* Global controls */}
      <section className="card-panel p-3 flex flex-wrap gap-2">
        <button className="btn-ghost text-xs" onClick={() => confirm('Nuevo zapato: reinicia running count. ¿Continuar?') && dispatch({ type: 'NEW_SHOE' })}>
          Nuevo zapato
        </button>
        <button className="btn-danger text-xs" onClick={() => confirm('Reiniciar toda la sesión. ¿Confirmar?') && dispatch({ type: 'RESET' })}>
          Reiniciar todo
        </button>
        <button className="btn-ghost text-xs ml-auto" onClick={() => setShowCount((v) => !v)}>
          {showCount ? 'Ocultar conteo' : 'Mostrar conteo'}
        </button>
      </section>

      {/* History */}
      {session.history.length > 0 && (
        <section className="card-panel p-4 space-y-2 text-sm">
          <div className="font-display text-lg text-chip-gold">Historial ({session.history.length})</div>
          <ul className="space-y-1 text-xs">
            {session.history.slice().reverse().slice(0, 15).map((h) => (
              <li key={h.handNumber} className="border-t border-white/5 pt-1">
                <button onClick={() => setHistoryOpen(historyOpen === h.handNumber ? null : h.handNumber)} className="w-full text-left flex justify-between">
                  <span>Mano {h.handNumber} · {h.hands.length} mano{h.hands.length !== 1 ? 's' : ''} · RC {fmt(h.rcBefore)}→{fmt(h.rcAfter)}</span>
                  <span>{historyOpen === h.handNumber ? '▲' : '▼'}</span>
                </button>
                {historyOpen === h.handNumber && (
                  <div className="pl-2 border-l border-white/10 mt-1 text-white/70 space-y-0.5">
                    {h.hands.map((sub, i) => (
                      <div key={i}>Mano {i + 1}: {sub.ranks.join(' ')} → {resultLabel(sub.result)} · ${sub.bet}{sub.doubled ? ' (D)' : ''}</div>
                    ))}
                    <div>Dealer: {h.dealerUpRank ?? '—'} + {h.dealerFinalRanks.join(' ') || '—'}</div>
                    <div>Bankroll: ${h.bankrollAfter.toFixed(0)}</div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function isCardPickingStep(step: Step): boolean {
  return step === 'WAITING_PLAYER_FIRST_CARD'
    || step === 'WAITING_DEALER_UPCARD'
    || step === 'WAITING_PLAYER_SECOND_CARD'
    || step === 'WAITING_PLAYER_HIT_CARD'
    || step === 'WAITING_DOUBLE_CARD'
    || step === 'WAITING_SPLIT_CARD'
}

// ─── UI helpers ────────────────────────────────────────────────

function RankPicker({ onPick }: { onPick: (r: Rank) => void }) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(3rem, 1fr))' }}>
      {RANKS.map((r) => (
        <button
          key={r}
          onClick={() => onPick(r)}
          className="rounded-lg bg-white/5 hover:bg-chip-gold hover:text-neutral-900 border border-white/10 text-lg font-bold py-3"
        >
          {r}
        </button>
      ))}
    </div>
  )
}

function ActionButton({ label, onClick, tone = 'secondary', disabled }: { label: string; onClick: () => void; tone?: 'primary' | 'secondary' | 'ghost' | 'danger'; disabled?: boolean }) {
  const cls = tone === 'primary' ? 'btn-primary' : tone === 'ghost' ? 'btn-ghost' : tone === 'danger' ? 'btn-danger' : 'btn-secondary'
  return (
    <button className={`${cls} py-3`} onClick={onClick} disabled={disabled}>
      {label}
    </button>
  )
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-2 ${highlight ? 'border-chip-gold/50 bg-chip-gold/10' : 'border-white/10 bg-black/30'}`}>
      <div className="label">{label}</div>
      <div className="text-xl font-display tabular-nums">{value}</div>
    </div>
  )
}

function statusBadgeClass(s: HandStatus): string {
  const base = 'ml-1 px-1.5 py-0.5 rounded text-[10px] '
  switch (s) {
    case 'active': return base + 'bg-chip-gold text-neutral-900'
    case 'pending': return base + 'bg-white/10 text-white/70'
    case 'done': return base + 'bg-emerald-600 text-white'
    case 'busted': return base + 'bg-chip-red text-white'
    case 'surrendered': return base + 'bg-purple-600 text-white'
  }
}

function statusLabel(s: HandStatus): string {
  return { active: 'Activa', pending: 'Pendiente', done: 'Terminada', busted: 'Bust', surrendered: 'Rendida' }[s]
}

function fmt(n: number): string { return n > 0 ? `+${n}` : String(n) }

function labelAction(a: Action): string {
  return { H: 'Pedir', S: 'Plantarse', D: 'Doblar', P: 'Dividir', R: 'Rendirse', I: 'Seguro' }[a]
}

function resultLabel(r: HandResult | null): string {
  if (!r) return '—'
  return { win: 'Ganó', lose: 'Perdió', push: 'Empate', blackjack: 'Blackjack', surrender: 'Rendido', bust: 'Bust' }[r]
}

function countBucket(state: FullState, bucket: 'low' | 'neutral' | 'high'): number {
  const all = [...state.session.seenCards, ...allRoundCards(state.round)]
  return all.filter((c) => {
    if (c.bucket) return c.bucket === bucket
    if (c.countValue > 0) return bucket === 'low'
    if (c.countValue < 0) return bucket === 'high'
    return bucket === 'neutral'
  }).length
}

// ─── Rules panel ───────────────────────────────────────────────

function RulesPanel({ rules, onChange }: { rules: TableRules; onChange: (patch: Partial<TableRules>) => void }) {
  return (
    <section className="card-panel p-4 space-y-3">
      <div className="font-display text-lg text-chip-gold">Configuración de la mesa</div>
      <div className="grid sm:grid-cols-2 gap-3">
        <FieldButtons label="Tipo de juego" value={rules.variant}
          options={[
            { v: 'american' as BlackjackVariant, label: 'Americano', hint: 'Dealer con carta oculta.' },
            { v: 'european' as BlackjackVariant, label: 'Europeo', hint: 'Sin carta oculta inicial.' }
          ]}
          onChange={(v) => onChange({ variant: v })}
        />
        <FieldButtons label="Barajado" value={rules.shuffleType}
          options={[
            { v: 'shoe' as ShuffleType, label: 'Zapato', hint: 'Permite conteo.' },
            { v: 'csm' as ShuffleType, label: 'CSM', hint: 'Conteo desactivado.' }
          ]}
          onChange={(v) => onChange({ shuffleType: v })}
        />
        <FieldButtons label="Mazos" value={rules.decks}
          options={[1, 2, 4, 6, 8].map((n) => ({ v: n as TableRules['decks'], label: String(n) }))}
          onChange={(v) => onChange({ decks: v })}
        />
        <FieldNumber label="Penetración %" value={Math.round(rules.penetration * 100)} min={10} max={95}
          onChange={(n) => onChange({ penetration: n / 100 })}
          disabled={rules.shuffleType === 'csm'}
        />
        <FieldNumber label="Quemadas" value={rules.burnCards} min={0} max={52} onChange={(n) => onChange({ burnCards: n })} />
        <FieldButtons label="Dealer soft 17" value={rules.dealerHitsSoft17 ? 'H17' : 'S17'}
          options={[{ v: 'S17', label: 'S17' }, { v: 'H17', label: 'H17' }]}
          onChange={(v) => onChange({ dealerHitsSoft17: v === 'H17' })}
        />
        <FieldButtons label="Pago BJ" value={rules.blackjackPayout}
          options={[
            { v: '3:2' as BlackjackPayout, label: '3:2' },
            { v: '6:5' as BlackjackPayout, label: '6:5' },
            { v: '1:1' as BlackjackPayout, label: '1:1' }
          ]}
          onChange={(v) => onChange({ blackjackPayout: v })}
        />
        <FieldButtons label="Surrender" value={rules.surrender}
          options={[
            { v: 'none' as SurrenderRule, label: 'No' },
            { v: 'late' as SurrenderRule, label: 'Late' },
            { v: 'early' as SurrenderRule, label: 'Early' }
          ]}
          onChange={(v) => onChange({ surrender: v })}
        />
        <FieldButtons label="Doblar" value={rules.doubleRule}
          options={[
            { v: 'any' as DoubleRule, label: 'Cualquier 2' },
            { v: '9-11' as DoubleRule, label: '9-11' },
            { v: '10-11' as DoubleRule, label: '10-11' },
            { v: 'none' as DoubleRule, label: 'No' }
          ]}
          onChange={(v) => onChange({ doubleRule: v })}
        />
        <FieldToggle label="DAS (doblar tras split)" value={rules.doubleAfterSplit} onChange={(v) => onChange({ doubleAfterSplit: v })} />
        <FieldToggle label="Re-split" value={rules.resplit} onChange={(v) => onChange({ resplit: v })} />
        <FieldToggle label="Re-split ases" value={rules.resplitAces} onChange={(v) => onChange({ resplitAces: v })} />
        <FieldToggle label="Hit tras split de ases" value={rules.hitSplitAces} onChange={(v) => onChange({ hitSplitAces: v })} />
        <FieldToggle label="Insurance" value={rules.insurance} onChange={(v) => onChange({ insurance: v })} />
        <FieldButtons label="Máx manos split" value={rules.maxSplitHands}
          options={[2, 3, 4].map((n) => ({ v: n, label: String(n) }))}
          onChange={(v) => onChange({ maxSplitHands: v })}
        />
        {rules.variant === 'european' && (
          <FieldButtons label="ENHC / OBBO" value={rules.enhc ? 'enhc' : 'obbo'}
            options={[
              { v: 'enhc', label: 'ENHC (pierdo dobles/splits)' },
              { v: 'obbo', label: 'OBBO (sólo original)' }
            ]}
            onChange={(v) => onChange({ enhc: v === 'enhc' })}
          />
        )}
        <FieldNumber label="Unidad" value={rules.unit} min={1} max={1000000} onChange={(n) => onChange({ unit: n })} />
        <FieldNumber label="Mesa mín" value={rules.minBet} min={1} max={1000000} onChange={(n) => onChange({ minBet: n })} />
        <FieldNumber label="Mesa máx" value={rules.maxBet} min={rules.minBet} max={10000000} onChange={(n) => onChange({ maxBet: n })} />
        <FieldButtons label="Estilo apuesta" value={rules.aggression}
          options={[
            { v: 'conservative' as Aggression, label: 'Conservador' },
            { v: 'moderate' as Aggression, label: 'Moderado' },
            { v: 'aggressive' as Aggression, label: 'Agresivo' }
          ]}
          onChange={(v) => onChange({ aggression: v })}
        />
        <FieldButtons label="Redondeo TC" value={rules.rounding}
          options={[
            { v: 'floor' as Rounding, label: 'Floor' },
            { v: 'round' as Rounding, label: 'Round' },
            { v: 'truncate' as Rounding, label: 'Truncate' }
          ]}
          onChange={(v) => onChange({ rounding: v })}
        />
      </div>
      {rules.blackjackPayout !== '3:2' && (
        <div className="text-[11px] text-chip-red">
          Pago {rules.blackjackPayout}: mesa desfavorable. Prefiere 3:2 cuando puedas.
        </div>
      )}
    </section>
  )
}

interface FieldButtonsProps<T> {
  label: string
  value: T
  options: Array<{ v: T; label: string; hint?: string }>
  onChange: (v: T) => void
}
function FieldButtons<T extends string | number>({ label, value, options, onChange }: FieldButtonsProps<T>) {
  return (
    <div>
      <div className="label mb-1">{label}</div>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <button
            key={String(o.v)}
            onClick={() => onChange(o.v)}
            className={`btn-ghost !py-0.5 !px-2 text-[11px] ${value === o.v ? '!bg-chip-gold !text-neutral-900' : ''}`}
            title={o.hint}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function FieldNumber({ label, value, min, max, onChange, disabled }: { label: string; value: number; min?: number; max?: number; onChange: (n: number) => void; disabled?: boolean }) {
  return (
    <div>
      <div className="label mb-1">{label}</div>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => {
          const n = parseFloat(e.target.value || '0')
          if (!Number.isFinite(n)) return
          onChange(Math.max(min ?? -Infinity, Math.min(max ?? Infinity, n)))
        }}
        className="w-full bg-black/40 rounded px-2 py-1 border border-white/10 text-sm tabular-nums disabled:opacity-40"
      />
    </div>
  )
}

function FieldToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-12 h-6 rounded-full transition ${value ? 'bg-chip-gold' : 'bg-white/15'}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition ${value ? 'left-6' : 'left-0.5'}`} />
      </button>
    </div>
  )
}
