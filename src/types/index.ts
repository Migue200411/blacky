export type Suit = '♠' | '♥' | '♦' | '♣'
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'

export interface Card {
  rank: Rank
  suit: Suit
  id: string
}

export type Action = 'H' | 'S' | 'D' | 'P' | 'R' | 'I'

export type CountingSystem = 'HiLo' | 'KO' | 'OmegaII' | 'WongHalves'

export type Rounding = 'floor' | 'round' | 'truncate'

export type DoubleRule = 'any' | '9-11' | '10-11' | 'none'
export type SurrenderRule = 'none' | 'late' | 'early'
export type Aggression = 'conservative' | 'moderate' | 'aggressive'
export type BlackjackVariant = 'american' | 'european'

export interface TableRules {
  decks: 1 | 2 | 4 | 6 | 8
  penetration: 0.5 | 0.6 | 0.65 | 0.75 | 0.8 | 0.85
  dealerHitsSoft17: boolean
  blackjackPayout: '3:2' | '6:5'
  doubleRule: DoubleRule
  doubleAfterSplit: boolean
  surrender: SurrenderRule
  resplit: boolean
  resplitAces: boolean
  hitSplitAces: boolean
  insurance: boolean
  bankroll: number
  minBet: number
  maxBet: number
  unit: number
  countingSystem: CountingSystem
  rounding: Rounding
  aggression: Aggression
  betRamp: BetRampEntry[]
  variant: BlackjackVariant
  /** European No Hole Card: if dealer later completes blackjack, some tables
   *  make the player also lose doubles and splits. Only meaningful when variant='european'. */
  enhc: boolean
}

export interface BetRampEntry {
  tc: number
  units: number
}

export interface HandState {
  cards: Card[]
  bet: number
  doubled: boolean
  surrendered: boolean
  fromSplit: boolean
  isSplitAces: boolean
  finished: boolean
  busted: boolean
  blackjack: boolean
  result?: HandResult
  payout?: number
}

export type HandResult = 'win' | 'lose' | 'push' | 'blackjack' | 'surrender' | 'bust' | 'dealerBust'

export interface DealerState {
  cards: Card[]
  holeHidden: boolean
  finished: boolean
  busted: boolean
  blackjack: boolean
}

export type Phase =
  | 'idle'
  | 'betting'
  | 'dealing'
  | 'insurance'
  | 'playerTurn'
  | 'dealerTurn'
  | 'settle'
  | 'roundOver'

export interface ShoeState {
  cards: Card[]
  played: Card[]
  decks: number
  cutIndex: number
  needsShuffle: boolean
}

export interface CountState {
  running: number
  system: CountingSystem
}

export interface Deviation {
  playerTotal: number
  isSoft?: boolean
  isPair?: boolean
  dealerUp: number // 1 for Ace, 2..10
  basicAction: Action
  index: number // TC threshold
  direction: 'ge' | 'lt'
  deviationAction: Action
  explanation: string
}

export interface StrategyDecision {
  recommended: Action
  basic: Action
  fromDeviation?: Deviation
  explanation: string
}

export interface HandHistoryEntry {
  timestamp: number
  playerFinal: number
  dealerFinal: number
  bet: number
  payout: number
  result: HandResult
  correctDecisions: number
  totalDecisions: number
  wasBetCorrect: boolean
}

export interface UserStats {
  handsPlayed: number
  handsWon: number
  handsLost: number
  handsPushed: number
  totalNet: number
  biggestWin: number
  biggestLoss: number
  bestSession: number
  worstSession: number
  currentSession: number
  decisions: {
    total: number
    correct: number
    byCategory: Record<
      'hard' | 'soft' | 'pair' | 'surrender' | 'insurance' | 'deviation',
      { total: number; correct: number }
    >
  }
  counting: {
    drills: number
    correct: number
    totalError: number
  }
  trueCount: {
    drills: number
    correct: number
    totalError: number
  }
  history: HandHistoryEntry[]
}

export type UserLevel = 'Novato' | 'Aprendiz' | 'Intermedio' | 'Avanzado' | 'Experto'
