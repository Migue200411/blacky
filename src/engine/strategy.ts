import {
  DEALER_UPCARDS,
  HARD_TOTALS,
  PAIRS,
  SOFT_TOTALS,
  describeAction,
  resolveStrategyCell,
  type StrategyCell
} from '../data/basicStrategy'
import { DEVIATIONS, INSURANCE_INDEX } from '../data/deviations'
import type {
  Action,
  Card,
  Deviation,
  HandState,
  StrategyDecision,
  TableRules
} from '../types'
import { dealerUpValue, handTotal, isPair, pairRankTotal } from './hand'

function upcardIdx(dealer: number): number {
  const idx = DEALER_UPCARDS.indexOf(dealer as any)
  return idx === -1 ? DEALER_UPCARDS.length - 1 : idx
}

function canDouble(hand: HandState, rules: TableRules): boolean {
  if (hand.cards.length !== 2) return false
  if (hand.fromSplit && !rules.doubleAfterSplit) return false
  const t = handTotal(hand.cards).value
  switch (rules.doubleRule) {
    case 'any': return true
    case '9-11': return t >= 9 && t <= 11
    case '10-11': return t >= 10 && t <= 11
    case 'none': return false
  }
}

function canSurrender(hand: HandState, rules: TableRules): boolean {
  if (rules.surrender === 'none') return false
  if (hand.cards.length !== 2) return false
  if (hand.fromSplit) return false
  return true
}

function canSplit(hand: HandState, rules: TableRules, splitsSoFar: number): boolean {
  if (!isPair(hand.cards)) return false
  const maxSplits = Math.max(1, rules.maxSplitHands) - 1
  if (splitsSoFar >= maxSplits) return false
  // If re-split disabled, only the first split is allowed.
  if (splitsSoFar >= 1 && !rules.resplit) return false
  // Aces re-split is usually a separate rule.
  if (hand.cards[0].rank === 'A' && splitsSoFar >= 1 && !rules.resplitAces) return false
  return true
}

export interface StrategyInput {
  hand: HandState
  dealerUp: Card
  rules: TableRules
  trueCount: number
  splitsSoFar: number
}

function findDeviation(
  playerTotal: number,
  dealerUp: number,
  trueCountValue: number,
  opts: { isPair: boolean; isSoft: boolean }
): Deviation | undefined {
  // Collect every matching deviation for this hand vs upcard, then pick the
  // "strongest" one: for ge-direction, the highest index that still triggers;
  // for lt-direction, the lowest index that still triggers.
  const matches = DEVIATIONS.filter((d) => {
    if (d.playerTotal !== playerTotal) return false
    if (d.dealerUp !== dealerUp) return false
    // A pair-specific deviation only applies when the caller is looking for pair
    // deviations. Deviations without isPair only apply for non-pair queries.
    const devIsPair = d.isPair ?? false
    if (devIsPair !== opts.isPair) return false
    if (d.isSoft !== undefined && d.isSoft !== opts.isSoft) return false
    if (d.direction === 'ge') return trueCountValue >= d.index
    return trueCountValue < d.index
  })
  if (matches.length === 0) return undefined
  matches.sort((a, b) => {
    if (a.direction !== b.direction) return a.direction === 'ge' ? -1 : 1
    return a.direction === 'ge' ? b.index - a.index : a.index - b.index
  })
  return matches[0]
}

export function decideStrategy(input: StrategyInput): StrategyDecision {
  const { hand, dealerUp, rules, trueCount, splitsSoFar } = input
  const dealer = dealerUpValue(dealerUp)
  const t = handTotal(hand.cards)
  const canD = canDouble(hand, rules)
  const canR = canSurrender(hand, rules)
  const canS = canSplit(hand, rules, splitsSoFar)
  const upIdx = upcardIdx(dealer)

  // 1. Determine the basic-strategy cell + category. If the hand is a pair but
  //    the PAIRS table indicates a non-split action, we treat it as its hard/soft
  //    total (5-5 → hard 10, 4-4 sometimes → hard 8, etc).
  let cell: StrategyCell
  let category: 'hard' | 'soft' | 'pair'
  let treatAsPair = false
  if (canS) {
    const pairKey = pairRankTotal(hand.cards)
    const pairCell = PAIRS[pairKey]?.[upIdx] ?? 'H'
    if (pairCell === 'P') {
      cell = pairCell
      category = 'pair'
      treatAsPair = true
    } else if (t.isSoft && SOFT_TOTALS[t.value]) {
      cell = SOFT_TOTALS[t.value][upIdx]
      category = 'soft'
    } else {
      const hkey = Math.min(21, Math.max(5, t.value))
      cell = HARD_TOTALS[hkey][upIdx]
      category = 'hard'
    }
  } else if (t.isSoft && SOFT_TOTALS[t.value]) {
    cell = SOFT_TOTALS[t.value][upIdx]
    category = 'soft'
  } else {
    const key = Math.min(21, Math.max(5, t.value))
    cell = HARD_TOTALS[key][upIdx]
    category = 'hard'
  }

  const basic: Action = resolveStrategyCell(cell, { canDouble: canD, canSurrender: canR })

  // 2. Deviations. If the hand is a pair, pair-specific deviations always take
  //    priority. If none applies and we're treating the pair as a split (P),
  //    stick with the split. Otherwise (playing as hard/soft), check general
  //    deviations for that underlying total.
  let deviation: Deviation | undefined
  if (canS) {
    deviation = findDeviation(t.value, dealer, trueCount, { isPair: true, isSoft: t.isSoft })
    if (!deviation && !treatAsPair) {
      deviation = findDeviation(t.value, dealer, trueCount, { isPair: false, isSoft: t.isSoft })
    }
  } else {
    deviation = findDeviation(t.value, dealer, trueCount, { isPair: false, isSoft: t.isSoft })
  }

  let recommended = basic
  if (deviation) {
    if (deviation.deviationAction === 'D' && !canD) recommended = 'H'
    else if (deviation.deviationAction === 'R' && !canR) recommended = 'H'
    else recommended = deviation.deviationAction
  }

  const explanation = buildExplanation({
    category,
    playerTotal: t.value,
    isSoft: t.isSoft,
    dealer,
    basic,
    cell,
    deviation,
    trueCount,
    canD,
    canR
  })

  return { recommended, basic, fromDeviation: deviation, explanation }
}

interface BuildExplanationInput {
  category: 'hard' | 'soft' | 'pair'
  playerTotal: number
  isSoft: boolean
  dealer: number
  basic: Action
  cell: StrategyCell
  deviation?: Deviation
  trueCount: number
  canD: boolean
  canR: boolean
}

function buildExplanation(i: BuildExplanationInput): string {
  const dealerStr = i.dealer === 11 ? 'A' : String(i.dealer)
  const category =
    i.category === 'hard' ? 'mano dura'
    : i.category === 'soft' ? 'mano suave'
    : 'pareja'
  let text = `Tienes ${category} con total ${i.playerTotal} contra ${dealerStr} del dealer. `
  text += `Estrategia básica: ${describeAction(i.cell)}. `
  if (i.deviation) {
    text += `El true count es ${i.trueCount}, el índice para esta jugada es ${i.deviation.index} `
    text += `(${i.deviation.direction === 'ge' ? '≥' : '<'}). ${i.deviation.explanation}`
  } else {
    text += `No hay desviación relevante para el true count actual (${i.trueCount}).`
  }
  return text
}

export function shouldTakeInsurance(trueCount: number): boolean {
  return trueCount >= INSURANCE_INDEX
}

export function actionAvailable(action: Action, hand: HandState, rules: TableRules, splitsSoFar: number): boolean {
  switch (action) {
    case 'H': return true
    case 'S': return true
    case 'D': return canDouble(hand, rules)
    case 'P': return canSplit(hand, rules, splitsSoFar)
    case 'R': return canSurrender(hand, rules)
    case 'I': return rules.insurance
  }
}
