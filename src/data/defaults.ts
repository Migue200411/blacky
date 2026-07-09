import type { TableRules, UserStats } from '../types'

export const DEFAULT_BET_RAMP = [
  { tc: 0, units: 1 },
  { tc: 1, units: 1 },
  { tc: 2, units: 2 },
  { tc: 3, units: 4 },
  { tc: 4, units: 6 },
  { tc: 5, units: 8 }
]

export const DEFAULT_RULES: TableRules = {
  decks: 6,
  penetration: 0.75,
  dealerHitsSoft17: false,
  blackjackPayout: '3:2',
  doubleRule: 'any',
  doubleAfterSplit: true,
  surrender: 'late',
  resplit: true,
  resplitAces: false,
  hitSplitAces: false,
  insurance: true,
  bankroll: 1000,
  minBet: 5,
  maxBet: 500,
  unit: 5,
  countingSystem: 'HiLo',
  rounding: 'floor',
  aggression: 'moderate',
  betRamp: DEFAULT_BET_RAMP,
  variant: 'american',
  enhc: true
}

export const EMPTY_STATS: UserStats = {
  handsPlayed: 0,
  handsWon: 0,
  handsLost: 0,
  handsPushed: 0,
  totalNet: 0,
  biggestWin: 0,
  biggestLoss: 0,
  bestSession: 0,
  worstSession: 0,
  currentSession: 0,
  decisions: {
    total: 0,
    correct: 0,
    byCategory: {
      hard: { total: 0, correct: 0 },
      soft: { total: 0, correct: 0 },
      pair: { total: 0, correct: 0 },
      surrender: { total: 0, correct: 0 },
      insurance: { total: 0, correct: 0 },
      deviation: { total: 0, correct: 0 }
    }
  },
  counting: { drills: 0, correct: 0, totalError: 0 },
  trueCount: { drills: 0, correct: 0, totalError: 0 },
  history: []
}
