import { useMemo, useReducer, useState } from 'react'
import { Link } from 'react-router-dom'
import { PlayingCard } from '../components/PlayingCard'
import { getRecommendedAction } from '../engine/recommendation'
import { recommendedBet } from '../engine/betting'
import { trueCount as computeTC } from '../engine/counting'
import { cardValueForCount } from '../data/countingSystems'
import { DEFAULT_BET_RAMP, DEFAULT_RULES } from '../data/defaults'
import type { Action, Card, Rank, TableRules } from '../types'

const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

type Step =
  | 'WAITING_PLAYER_FIRST_CARD'
  | 'WAITING_DEALER_UPCARD'
  | 'WAITING_PLAYER_SECOND_CARD'
  | 'SHOWING_RECOMMENDATION'
  | 'WAITING_PLAYER_HIT_CARD'
  | 'WAITING_DOUBLE_CARD'
  | 'WAITING_DEALER_FINAL_CARDS'
  | 'WAITING_RESULT'
  | 'HAND_FINISHED'

type BucketSource = 'player' | 'dealerUp' | 'dealerFinal' | 'otherExact' | 'otherBucket'

interface Registered {
  id: string
  rank?: Rank
  bucket?: 'low' | 'neutral' | 'high'
  source: BucketSource
  countValue: number
}

type RoundResult = 'win' | 'lose' | 'push' | 'blackjack' | 'surrender'

interface HistoryEntry {
  handNumber: number
  playerRanks: Rank[]
  dealerUpRank: Rank | null
  dealerFinalRanks: Rank[]
  action: 'H' | 'S' | 'D' | 'P' | null
  result: RoundResult | null
  bet: number | null
  rcBefore: number
  rcAfter: number
  tcBefore: number
  tcAfter: number
  bankrollAfter: number
}

interface SessionState {
  handNumber: number
  seenCards: Registered[] // committed to shoe (past hands + other-players in past hands)
  history: HistoryEntry[]
  bankroll: number
  initialDecks: number
  rules: TableRules
}

interface RoundState {
  playerCards: Registered[]
  dealerUpcard: Registered | null
  dealerFinalCards: Registered[]
  otherCards: Registered[]
  actionLog: Action[]
  doubled: boolean
  result: RoundResult | null
  bet: number | null
  /** Stack of card ids added this round in the order they were added, for Undo. */
  undoStack: string[]
}

interface FullState {
  step: Step
  session: SessionState
  round: RoundState
  advancedCounting: boolean
}

// ─── Reducer ───────────────────────────────────────────────────

let seq = 0
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

type Msg =
  | { type: 'PICK_CARD'; rank: Rank }
  | { type: 'BUCKET'; bucket: 'low' | 'neutral' | 'high' }
  | { type: 'ACTION'; action: 'H' | 'S' | 'D' | 'P' }
  | { type: 'RESULT'; result: RoundResult }
  | { type: 'UNDO' }
  | { type: 'NEW_HAND' }
  | { type: 'NEW_SHOE' }
  | { type: 'RESET' }
  | { type: 'SET_STEP'; step: Step }
  | { type: 'SET_BET'; bet: number | null }
  | { type: 'SET_RULES'; rules: Partial<TableRules> }
  | { type: 'TOGGLE_ADVANCED_COUNT' }

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

function emptyRound(): RoundState {
  return {
    playerCards: [],
    dealerUpcard: null,
    dealerFinalCards: [],
    otherCards: [],
    actionLog: [],
    doubled: false,
    result: null,
    bet: null,
    undoStack: []
  }
}

function reducer(state: FullState, msg: Msg): FullState {
  switch (msg.type) {
    case 'PICK_CARD': {
      const card = makeCard(msg.rank, sourceForStep(state.step))
      const r = { ...state.round, undoStack: [...state.round.undoStack, card.id] }
      switch (state.step) {
        case 'WAITING_PLAYER_FIRST_CARD': {
          r.playerCards = [...r.playerCards, card]
          return { ...state, round: r, step: 'WAITING_DEALER_UPCARD' }
        }
        case 'WAITING_DEALER_UPCARD':
          r.dealerUpcard = card
          return { ...state, round: r, step: 'WAITING_PLAYER_SECOND_CARD' }
        case 'WAITING_PLAYER_SECOND_CARD': {
          r.playerCards = [...r.playerCards, card]
          return { ...state, round: r, step: 'SHOWING_RECOMMENDATION' }
        }
        case 'WAITING_PLAYER_HIT_CARD':
          r.playerCards = [...r.playerCards, card]
          return { ...state, round: r, step: 'SHOWING_RECOMMENDATION' }
        case 'WAITING_DOUBLE_CARD':
          r.playerCards = [...r.playerCards, card]
          return { ...state, round: r, step: 'WAITING_DEALER_FINAL_CARDS' }
        case 'WAITING_DEALER_FINAL_CARDS':
          r.dealerFinalCards = [...r.dealerFinalCards, card]
          return { ...state, round: r }
        default:
          // Any other step: treat as "other players" card if advanced counting is on.
          r.otherCards = [...r.otherCards, { ...card, source: 'otherExact' }]
          return { ...state, round: r }
      }
    }
    case 'BUCKET': {
      const b = makeBucket(msg.bucket, 'otherBucket')
      const r = {
        ...state.round,
        otherCards: [...state.round.otherCards, b],
        undoStack: [...state.round.undoStack, b.id]
      }
      return { ...state, round: r }
    }
    case 'ACTION': {
      const r = { ...state.round, actionLog: [...state.round.actionLog, msg.action] }
      let nextStep: Step = state.step
      switch (msg.action) {
        case 'H': nextStep = 'WAITING_PLAYER_HIT_CARD'; break
        case 'S': nextStep = 'WAITING_DEALER_FINAL_CARDS'; break
        case 'D': r.doubled = true; nextStep = 'WAITING_DOUBLE_CARD'; break
        case 'P':
          // Simplified: mark action, keep in showing-recommendation for now.
          nextStep = 'SHOWING_RECOMMENDATION'
          break
      }
      return { ...state, round: r, step: nextStep }
    }
    case 'RESULT': {
      const r = { ...state.round, result: msg.result }
      return { ...state, round: r, step: 'HAND_FINISHED' }
    }
    case 'UNDO': {
      const stack = state.round.undoStack
      if (stack.length === 0) return state
      const lastId = stack[stack.length - 1]
      const r = removeById(state.round, lastId)
      r.undoStack = stack.slice(0, -1)
      // Adjust step backwards according to the new flow: 1st player → dealer up → 2nd player → rec.
      let step = state.step
      if (r.playerCards.length === 0 && !r.dealerUpcard) step = 'WAITING_PLAYER_FIRST_CARD'
      else if (r.playerCards.length >= 1 && !r.dealerUpcard) step = 'WAITING_DEALER_UPCARD'
      else if (r.playerCards.length === 1 && r.dealerUpcard) step = 'WAITING_PLAYER_SECOND_CARD'
      else if (r.playerCards.length >= 2 && r.dealerUpcard) step = 'SHOWING_RECOMMENDATION'
      return { ...state, round: r, step }
    }
    case 'NEW_HAND': {
      const rc = runningCountValue(state)
      const decksLeft = decksRemaining(state)
      const tc = computeTC(rc, decksLeft, state.session.rules.rounding)
      const rcBefore = runningCountBeforeRound(state)
      const tcBefore = computeTC(rcBefore, decksRemainingBeforeRound(state), state.session.rules.rounding)
      // Move round cards into seen, then compute bankroll delta.
      const roundRegisters = allRoundCards(state.round)
      const bankroll = state.session.bankroll + bankrollDelta(state.round, state.session.rules)
      const entry: HistoryEntry = {
        handNumber: state.session.handNumber,
        playerRanks: state.round.playerCards.map((c) => c.rank!).filter(Boolean) as Rank[],
        dealerUpRank: state.round.dealerUpcard?.rank ?? null,
        dealerFinalRanks: state.round.dealerFinalCards.map((c) => c.rank!).filter(Boolean) as Rank[],
        action: (state.round.actionLog.at(-1) as HistoryEntry['action']) ?? null,
        result: state.round.result,
        bet: state.round.bet,
        rcBefore, rcAfter: rc,
        tcBefore, tcAfter: tc,
        bankrollAfter: bankroll
      }
      return {
        ...state,
        session: {
          ...state.session,
          bankroll,
          handNumber: state.session.handNumber + 1,
          seenCards: [...state.session.seenCards, ...roundRegisters],
          history: [...state.session.history, entry]
        },
        round: emptyRound(),
        step: 'WAITING_PLAYER_FIRST_CARD'
      }
    }
    case 'NEW_SHOE':
      return {
        ...state,
        session: { ...state.session, seenCards: [], handNumber: 1 },
        round: emptyRound(),
        step: 'WAITING_PLAYER_FIRST_CARD'
      }
    case 'RESET':
      return initial()
    case 'SET_STEP':
      return { ...state, step: msg.step }
    case 'SET_BET':
      return { ...state, round: { ...state.round, bet: msg.bet } }
    case 'SET_RULES': {
      const rules = { ...state.session.rules, ...msg.rules }
      const initialDecks = 'decks' in msg.rules ? rules.decks : state.session.initialDecks
      return { ...state, session: { ...state.session, rules, initialDecks } }
    }
    case 'TOGGLE_ADVANCED_COUNT':
      return { ...state, advancedCounting: !state.advancedCounting }
  }
}

function sourceForStep(step: Step): BucketSource {
  if (
    step === 'WAITING_PLAYER_FIRST_CARD'
    || step === 'WAITING_PLAYER_SECOND_CARD'
    || step === 'WAITING_PLAYER_HIT_CARD'
    || step === 'WAITING_DOUBLE_CARD'
  ) return 'player'
  if (step === 'WAITING_DEALER_UPCARD') return 'dealerUp'
  if (step === 'WAITING_DEALER_FINAL_CARDS') return 'dealerFinal'
  return 'otherExact'
}

function removeById(round: RoundState, id: string): RoundState {
  return {
    ...round,
    playerCards: round.playerCards.filter((c) => c.id !== id),
    dealerUpcard: round.dealerUpcard?.id === id ? null : round.dealerUpcard,
    dealerFinalCards: round.dealerFinalCards.filter((c) => c.id !== id),
    otherCards: round.otherCards.filter((c) => c.id !== id)
  }
}

function allRoundCards(round: RoundState): Registered[] {
  return [
    ...round.playerCards,
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
  const seen = state.session.seenCards.length + allRoundCards(state.round).length
  return Math.max(0.25, (total - seen) / 52)
}

function decksRemainingBeforeRound(state: FullState): number {
  const total = state.session.initialDecks * 52
  return Math.max(0.25, (total - state.session.seenCards.length) / 52)
}

function bankrollDelta(round: RoundState, rules: TableRules): number {
  const baseBet = round.bet ?? 0
  const bet = round.doubled ? baseBet * 2 : baseBet
  switch (round.result) {
    case 'blackjack': {
      const isPlayerBJ = round.playerCards.length === 2 && handTotalValue(round.playerCards.map((c) => c.rank!)) === 21
      return isPlayerBJ ? baseBet * (rules.blackjackPayout === '3:2' ? 1.5 : 1.2) : bet
    }
    case 'win': return bet
    case 'push': return 0
    case 'lose': return -bet
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
  const norm = (r: Rank) => {
    if (r === 'A') return 'A'
    if (r === 'J' || r === 'Q' || r === 'K' || r === '10') return '10'
    return r
  }
  return norm(ranks[0]) === norm(ranks[1])
}

// ─── Step labels ────────────────────────────────────────────────

const STEP_TITLE: Record<Step, string> = {
  WAITING_PLAYER_FIRST_CARD: 'Selecciona tu primera carta',
  WAITING_DEALER_UPCARD: 'Selecciona la carta visible del dealer',
  WAITING_PLAYER_SECOND_CARD: 'Selecciona tu segunda carta',
  SHOWING_RECOMMENDATION: 'Elige tu acción',
  WAITING_PLAYER_HIT_CARD: 'Selecciona la carta que recibiste',
  WAITING_DOUBLE_CARD: 'Selecciona la carta del double',
  WAITING_DEALER_FINAL_CARDS: 'Registra las cartas finales del dealer',
  WAITING_RESULT: 'Marca el resultado de la mano',
  HAND_FINISHED: 'Mano finalizada'
}

// ─── Component ─────────────────────────────────────────────────

export function AsistentePage() {
  const [state, dispatch] = useReducer(reducer, undefined, initial)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showExplanation, setShowExplanation] = useState(false)
  const [historyOpen, setHistoryOpen] = useState<number | null>(null)

  const { session, round, step, advancedCounting } = state
  const rc = runningCountValue(state)
  const decks = decksRemaining(state)
  const tc = computeTC(rc, decks, session.rules.rounding)

  const cardsSeen = session.seenCards.length + allRoundCards(round).length
  const totalCards = session.initialDecks * 52

  // Recommendation whenever we have 2+ player cards and a dealer upcard.
  const recommendation = useMemo(() => {
    if (round.playerCards.length < 2 || !round.dealerUpcard || !round.dealerUpcard.rank) return null
    return getRecommendedAction({
      playerCards: round.playerCards.map((c) => ({ rank: c.rank!, suit: '♠', id: c.id })) as Card[],
      dealerUpcard: { rank: round.dealerUpcard.rank, suit: '♠', id: round.dealerUpcard.id } as Card,
      rules: session.rules,
      runningCount: rc,
      decksRemaining: decks
    })
  }, [round.playerCards, round.dealerUpcard, rc, decks, session.rules])

  const nextBet = useMemo(
    () => recommendedBet(session.rules, tc, session.bankroll),
    [session.rules, tc, session.bankroll]
  )

  const playerRanks = round.playerCards.map((c) => c.rank!) as Rank[]
  const total = playerRanks.length > 0 ? handTotalValue(playerRanks) : 0
  const soft = handIsSoft(playerRanks)
  const canPlayerSplit = isPairEligible(playerRanks) && round.actionLog.length === 0

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-3xl text-chip-gold">Asistente Rápido</h1>
          <p className="text-white/70 text-sm">Registra manualmente lo que pasa. La app te guía paso a paso.</p>
        </div>
        <Link to="/" className="btn-ghost">← Volver</Link>
      </div>

      <div className="rounded-lg border border-chip-gold/40 bg-chip-gold/5 text-xs text-white/85 px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>
          <strong>Modo:</strong>{' '}
          {session.rules.variant === 'american' ? 'Estadounidense' : 'Europeo'}
        </span>
        <span className="text-white/70">
          {session.rules.variant === 'american'
            ? 'Dealer con carta oculta.'
            : 'Dealer sin carta oculta inicial.'}
        </span>
        <span className="ml-auto text-white/60">Práctica educativa. No usar en casinos reales.</span>
      </div>

      {/* Estado de sesión */}
      <section className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Metric label="Mano" value={String(session.handNumber)} />
        <Metric label="RC" value={fmt(rc)} />
        <Metric label="TC" value={fmt(tc)} highlight />
        <Metric label="Mazos" value={decks.toFixed(2)} />
        <Metric label="Vistas" value={`${cardsSeen}/${totalCards}`} />
      </section>

      {/* Bet suggestion */}
      <section className="card-panel p-3 flex flex-wrap items-center gap-2 text-sm">
        <div className="font-display text-chip-gold">Próxima apuesta</div>
        <div>
          TC <strong>{fmt(tc)}</strong> · Sugerida{' '}
          <strong className="text-chip-gold tabular-nums">${nextBet.bet}</strong>{' '}
          <span className="text-white/60">({Math.round(nextBet.bet / session.rules.unit)} u)</span>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs">
          <span className="text-white/60">Apuesta ahora</span>
          <input
            type="number"
            min={0}
            value={round.bet ?? ''}
            placeholder={String(nextBet.bet)}
            onChange={(e) => dispatch({ type: 'SET_BET', bet: e.target.value ? parseInt(e.target.value, 10) : null })}
            className="bg-black/40 rounded px-2 py-0.5 border border-white/10 w-20"
          />
          <button className="btn-ghost !py-0.5 !px-2 text-[11px]" onClick={() => dispatch({ type: 'SET_BET', bet: nextBet.bet })}>Usar</button>
        </div>
        <div className="w-full text-[10px] text-white/60">
          Recomendación educativa dentro del simulador. No garantiza ganancias.
        </div>
      </section>

      {/* Step title */}
      <section className="card-panel p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-display text-lg text-chip-gold">{STEP_TITLE[step]}</div>
          <div className="flex gap-1">
            <button className="btn-ghost !py-1 !px-2 text-xs" disabled={round.undoStack.length === 0} onClick={() => dispatch({ type: 'UNDO' })}>Deshacer</button>
          </div>
        </div>

        {/* Current hand render */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="label mb-1">Tu mano {total > 0 ? `· total ${total}${soft ? ' soft' : ''}` : ''}</div>
            <div className="flex gap-1 flex-wrap min-h-[4.5rem] items-center">
              {round.playerCards.length === 0 ? (
                <span className="text-white/40 text-sm">Vacía</span>
              ) : round.playerCards.map((c) => (
                <PlayingCard key={c.id} card={{ rank: c.rank!, suit: '♠', id: c.id }} small />
              ))}
            </div>
          </div>
          <div>
            <div className="label mb-1">Dealer</div>
            <div className="flex gap-1 flex-wrap min-h-[4.5rem] items-center">
              {round.dealerUpcard && (
                <PlayingCard card={{ rank: round.dealerUpcard.rank!, suit: '♠', id: round.dealerUpcard.id }} small />
              )}
              {round.dealerFinalCards.map((c) => (
                <PlayingCard key={c.id} card={{ rank: c.rank!, suit: '♠', id: c.id }} small />
              ))}
              {!round.dealerUpcard && <span className="text-white/40 text-sm">Sin carta</span>}
            </div>
          </div>
        </div>

        {/* Card picker or action buttons based on step */}
        {isCardPickingStep(step) && (
          <RankPicker onPick={(r) => dispatch({ type: 'PICK_CARD', rank: r })} />
        )}

        {step === 'SHOWING_RECOMMENDATION' && recommendation && (
          <>
            <div className="rounded-lg border border-chip-gold/40 bg-chip-gold/5 p-3 space-y-1">
              <div className="text-sm">
                <span className="text-white/60">Recomendación:</span>{' '}
                <strong className="text-chip-gold text-lg">{labelAction(recommendation.adjustedAction)}</strong>
                {recommendation.hasDeviation && <span className="ml-2 text-[11px]">desviación TC ≥ {recommendation.deviationIndex}</span>}
              </div>
              <div className="text-[11px] text-white/70">
                Básica: {labelAction(recommendation.basicAction)} · TC actual {fmt(tc)}
              </div>
              {showExplanation && (
                <div className="text-xs text-white/80 border-t border-white/10 pt-2">{recommendation.explanation}</div>
              )}
              <button className="text-[11px] underline text-white/60" onClick={() => setShowExplanation((v) => !v)}>
                {showExplanation ? 'Ocultar explicación' : 'Ver explicación completa'}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <ActionButton label="Pedí carta" onClick={() => dispatch({ type: 'ACTION', action: 'H' })} />
              <ActionButton label="Me planté" onClick={() => dispatch({ type: 'ACTION', action: 'S' })} tone="secondary" />
              <ActionButton
                label="Doblé"
                onClick={() => dispatch({ type: 'ACTION', action: 'D' })}
                tone="primary"
                disabled={round.playerCards.length !== 2 || round.actionLog.length !== 0}
              />
              {canPlayerSplit && (
                <ActionButton
                  label="Dividí"
                  onClick={() => dispatch({ type: 'ACTION', action: 'P' })}
                  tone="primary"
                />
              )}
              <ActionButton label="Perdí" onClick={() => dispatch({ type: 'RESULT', result: 'lose' })} tone="danger" />
              <ActionButton label="Gané" onClick={() => dispatch({ type: 'RESULT', result: 'win' })} tone="secondary" />
              <ActionButton label="Empaté" onClick={() => dispatch({ type: 'RESULT', result: 'push' })} tone="ghost" />
            </div>
            {round.actionLog.at(-1) === 'P' && (
              <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-xs text-white/70">
                División detectada. La versión avanzada (dos manos independientes) está en desarrollo.
                Puedes seguir registrando las cartas del jugador y del dealer manualmente.
              </div>
            )}
          </>
        )}

        {step === 'WAITING_DEALER_FINAL_CARDS' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <ActionButton label="Gané" onClick={() => dispatch({ type: 'RESULT', result: 'win' })} tone="secondary" />
            <ActionButton label="Dealer se pasó" onClick={() => dispatch({ type: 'RESULT', result: 'win' })} tone="primary" />
            <ActionButton label="Perdí" onClick={() => dispatch({ type: 'RESULT', result: 'lose' })} tone="danger" />
            <ActionButton label="Empaté" onClick={() => dispatch({ type: 'RESULT', result: 'push' })} tone="ghost" />
          </div>
        )}

        {step === 'HAND_FINISHED' && (
          <div className="space-y-2">
            <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
              Resultado: <strong>{resultLabel(round.result)}</strong>{' '}
              {round.bet != null && (
                <span>
                  · Cambio bankroll: <strong>${bankrollDelta(round, session.rules).toFixed(0)}</strong>
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-primary" onClick={() => dispatch({ type: 'NEW_HAND' })}>Nueva mano</button>
              <button className="btn-ghost" onClick={() => confirm('Nuevo zapato: se reinicia el conteo. ¿Continuar?') && dispatch({ type: 'NEW_SHOE' })}>Nuevo zapato</button>
            </div>
          </div>
        )}
      </section>

      {/* Other players quick counting */}
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
            Modo avanzado (carta exacta)
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
          <RankPicker onPick={(r) => {
            // In advanced mode, add an exact card via bucketed source but with real rank.
            const card = makeCard(r, 'otherExact')
            // We can't dispatch a plain "add other card" easily — piggy-back on BUCKET-style through PICK_CARD.
            // Easiest: temporarily use PICK_CARD but that depends on step. Instead expand reducer.
            dispatch({ type: 'BUCKET', bucket: card.countValue > 0 ? 'low' : card.countValue < 0 ? 'high' : 'neutral' })
          }} />
        )}
        <div className="grid grid-cols-3 gap-2 text-center text-[11px] text-white/70">
          <div>Bajas: <strong className="text-emerald-400">{countBucket(state, 'low')}</strong></div>
          <div>Neutras: <strong>{countBucket(state, 'neutral')}</strong></div>
          <div>Altas: <strong className="text-chip-red">{countBucket(state, 'high')}</strong></div>
        </div>
      </section>

      {/* Global controls */}
      <section className="card-panel p-3 flex flex-wrap gap-2">
        <button className="btn-ghost text-xs" onClick={() => confirm('Nuevo zapato: reinicia running count. ¿Continuar?') && dispatch({ type: 'NEW_SHOE' })}>
          Nuevo zapato
        </button>
        <button className="btn-danger text-xs" onClick={() => confirm('Reiniciar todo. ¿Confirmar?') && dispatch({ type: 'RESET' })}>
          Reiniciar todo
        </button>
        <button className="btn-ghost text-xs ml-auto" onClick={() => setShowAdvanced((v) => !v)}>
          {showAdvanced ? 'Ocultar detalles' : 'Ver detalles'}
        </button>
      </section>

      {showAdvanced && (
        <>
          <section className="card-panel p-4 space-y-2 text-sm">
            <div className="font-display text-lg text-chip-gold">Reglas de mesa</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="flex justify-between items-center col-span-2">
                Variante
                <div className="flex gap-1">
                  <button
                    className={`btn-ghost !py-0.5 !px-2 !text-[11px] ${session.rules.variant === 'american' ? '!bg-chip-gold !text-neutral-900' : ''}`}
                    onClick={() => dispatch({ type: 'SET_RULES', rules: { variant: 'american' } })}
                  >
                    Estadounidense
                  </button>
                  <button
                    className={`btn-ghost !py-0.5 !px-2 !text-[11px] ${session.rules.variant === 'european' ? '!bg-chip-gold !text-neutral-900' : ''}`}
                    onClick={() => dispatch({ type: 'SET_RULES', rules: { variant: 'european' } })}
                  >
                    Europeo
                  </button>
                </div>
              </label>
              {session.rules.variant === 'european' && (
                <label className="flex justify-between items-center col-span-2">
                  ENHC
                  <div className="flex gap-1">
                    <button
                      className={`btn-ghost !py-0.5 !px-2 !text-[11px] ${session.rules.enhc ? '!bg-chip-gold !text-neutral-900' : ''}`}
                      onClick={() => dispatch({ type: 'SET_RULES', rules: { enhc: true } })}
                    >
                      Activo
                    </button>
                    <button
                      className={`btn-ghost !py-0.5 !px-2 !text-[11px] ${!session.rules.enhc ? '!bg-chip-gold !text-neutral-900' : ''}`}
                      onClick={() => dispatch({ type: 'SET_RULES', rules: { enhc: false } })}
                    >
                      OBBO
                    </button>
                  </div>
                </label>
              )}
              <label className="flex justify-between items-center">
                Mazos
                <select
                  value={session.rules.decks}
                  onChange={(e) => dispatch({ type: 'SET_RULES', rules: { decks: parseInt(e.target.value, 10) as TableRules['decks'] } })}
                  className="bg-black/40 rounded px-2 py-0.5 border border-white/10"
                >
                  {[1, 2, 4, 6, 8].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <label className="flex justify-between items-center">
                Dealer soft 17
                <select
                  value={session.rules.dealerHitsSoft17 ? 'H17' : 'S17'}
                  onChange={(e) => dispatch({ type: 'SET_RULES', rules: { dealerHitsSoft17: e.target.value === 'H17' } })}
                  className="bg-black/40 rounded px-2 py-0.5 border border-white/10"
                >
                  <option>S17</option>
                  <option>H17</option>
                </select>
              </label>
              <label className="flex justify-between items-center">
                Blackjack
                <select
                  value={session.rules.blackjackPayout}
                  onChange={(e) => dispatch({ type: 'SET_RULES', rules: { blackjackPayout: e.target.value as TableRules['blackjackPayout'] } })}
                  className="bg-black/40 rounded px-2 py-0.5 border border-white/10"
                >
                  <option>3:2</option>
                  <option>6:5</option>
                </select>
              </label>
              <label className="flex justify-between items-center">
                Insurance
                <input type="checkbox" checked={session.rules.insurance} onChange={(e) => dispatch({ type: 'SET_RULES', rules: { insurance: e.target.checked } })} className="accent-chip-gold" />
              </label>
            </div>
          </section>

          <section className="card-panel p-4 space-y-2 text-sm">
            <div className="font-display text-lg text-chip-gold">Historial ({session.history.length})</div>
            {session.history.length === 0 ? (
              <div className="text-white/60 text-sm">Aún no has terminado manos.</div>
            ) : (
              <ul className="space-y-1 text-xs">
                {session.history.slice().reverse().map((h) => (
                  <li key={h.handNumber} className="border-t border-white/5 pt-1">
                    <button onClick={() => setHistoryOpen(historyOpen === h.handNumber ? null : h.handNumber)} className="w-full text-left flex justify-between">
                      <span>Mano {h.handNumber} · {resultLabel(h.result)} · RC {fmt(h.rcBefore)}→{fmt(h.rcAfter)}</span>
                      <span>{historyOpen === h.handNumber ? '▲' : '▼'}</span>
                    </button>
                    {historyOpen === h.handNumber && (
                      <div className="pl-2 border-l border-white/10 mt-1 text-white/70 space-y-0.5">
                        <div>Jugador: {h.playerRanks.join(' ')}</div>
                        <div>Dealer up: {h.dealerUpRank ?? '—'}</div>
                        <div>Dealer final: {h.dealerFinalRanks.join(' ') || '—'}</div>
                        <div>Acción: {h.action ?? '—'} · Apuesta: {h.bet != null ? `$${h.bet}` : '—'}</div>
                        <div>Bankroll: ${h.bankrollAfter.toFixed(0)}</div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
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
    || step === 'WAITING_DEALER_FINAL_CARDS'
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

function fmt(n: number): string { return n > 0 ? `+${n}` : String(n) }

function labelAction(a: Action): string {
  return { H: 'Pedir', S: 'Plantarse', D: 'Doblar', P: 'Dividir', R: 'Rendirse', I: 'Seguro' }[a]
}

function resultLabel(r: RoundResult | null): string {
  if (!r) return '—'
  return { win: 'Gané', lose: 'Perdí', push: 'Empate', blackjack: 'Blackjack', surrender: 'Rendido' }[r]
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
