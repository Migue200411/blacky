import { decideStrategy } from './strategy'
import { newHand } from './hand'
import { trueCount as computeTC } from './counting'
import { INSURANCE_INDEX } from '../data/deviations'
import type { Action, Card, Rounding, TableRules } from '../types'

export interface RecommendationInput {
  playerCards: Card[]
  dealerUpcard: Card
  rules: TableRules
  /** Optional. If both runningCount and decksRemaining are provided but trueCount is missing, it will be computed. */
  runningCount?: number
  decksRemaining?: number
  trueCount?: number
  rounding?: Rounding
  splitsSoFar?: number
}

export interface RecommendationResult {
  basicAction: Action
  adjustedAction: Action
  hasDeviation: boolean
  deviationIndex?: number
  trueCount: number
  runningCount?: number
  explanation: string
  insurance: {
    shouldTake: boolean
    reason: string
  } | null
}

/**
 * Public recommendation entry point used by the Asistente de Práctica page.
 *
 * Given the current hand, the dealer upcard, the mesa rules and (optionally) the
 * count state, returns the basic action, the count-adjusted action, whether
 * there is a deviation in play, and a human-readable explanation. Also returns
 * an insurance suggestion when the dealer shows an Ace and the mesa allows it.
 */
export function getRecommendedAction(input: RecommendationInput): RecommendationResult {
  const { playerCards, dealerUpcard, rules } = input
  const rounding = input.rounding ?? rules.rounding
  const rc = input.runningCount
  const decks = input.decksRemaining
  const tc = input.trueCount ?? (rc !== undefined && decks !== undefined && decks > 0
    ? computeTC(rc, decks, rounding)
    : 0)

  const decision = decideStrategy({
    hand: newHand(playerCards, rules.unit),
    dealerUp: dealerUpcard,
    rules,
    trueCount: tc,
    splitsSoFar: input.splitsSoFar ?? 0
  })

  const insurance =
    rules.insurance && dealerUpcard.rank === 'A'
      ? {
          shouldTake: tc >= INSURANCE_INDEX,
          reason:
            tc >= INSURANCE_INDEX
              ? `El true count es ${tc} (≥ ${INSURANCE_INDEX}). Toma el seguro.`
              : `El true count es ${tc}. No tomes seguro (índice = ${INSURANCE_INDEX}).`
        }
      : null

  return {
    basicAction: decision.basic,
    adjustedAction: decision.recommended,
    hasDeviation: !!decision.fromDeviation,
    deviationIndex: decision.fromDeviation?.index,
    trueCount: tc,
    runningCount: rc,
    explanation: decision.explanation,
    insurance
  }
}
