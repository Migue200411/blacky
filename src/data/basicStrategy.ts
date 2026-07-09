import type { Action } from '../types'

// Dealer upcard index: 2..10, then 11 for Ace.
// Actions: H, S, D (double else hit), Ds (double else stand), P, R (surrender), Rh (surrender else hit), Rs (surrender else stand)
export type StrategyCell = 'H' | 'S' | 'D' | 'Ds' | 'P' | 'R' | 'Rh' | 'Rs'

export const DEALER_UPCARDS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const

// Hard totals (5..21). Key = player total. Values indexed by DEALER_UPCARDS.
export const HARD_TOTALS: Record<number, StrategyCell[]> = {
  5:  ['H','H','H','H','H','H','H','H','H','H'],
  6:  ['H','H','H','H','H','H','H','H','H','H'],
  7:  ['H','H','H','H','H','H','H','H','H','H'],
  8:  ['H','H','H','H','H','H','H','H','H','H'],
  9:  ['H','D','D','D','D','H','H','H','H','H'],
  10: ['D','D','D','D','D','D','D','D','H','H'],
  11: ['D','D','D','D','D','D','D','D','D','D'],
  12: ['H','H','S','S','S','H','H','H','H','H'],
  13: ['S','S','S','S','S','H','H','H','H','H'],
  14: ['S','S','S','S','S','H','H','H','H','H'],
  15: ['S','S','S','S','S','H','H','H','Rh','H'],
  16: ['S','S','S','S','S','H','H','Rh','Rh','Rh'],
  17: ['S','S','S','S','S','S','S','S','S','Rs'],
  18: ['S','S','S','S','S','S','S','S','S','S'],
  19: ['S','S','S','S','S','S','S','S','S','S'],
  20: ['S','S','S','S','S','S','S','S','S','S'],
  21: ['S','S','S','S','S','S','S','S','S','S']
}

// Soft totals — key = player total with an ace counted as 11.
export const SOFT_TOTALS: Record<number, StrategyCell[]> = {
  13: ['H','H','H','D','D','H','H','H','H','H'],
  14: ['H','H','H','D','D','H','H','H','H','H'],
  15: ['H','H','D','D','D','H','H','H','H','H'],
  16: ['H','H','D','D','D','H','H','H','H','H'],
  17: ['H','D','D','D','D','H','H','H','H','H'],
  18: ['S','Ds','Ds','Ds','Ds','S','S','H','H','H'],
  19: ['S','S','S','S','Ds','S','S','S','S','S'],
  20: ['S','S','S','S','S','S','S','S','S','S'],
  21: ['S','S','S','S','S','S','S','S','S','S']
}

// Pairs — key is the pair rank total (2,2 = 4; A,A = 22 sentinel)
export const PAIRS: Record<number, StrategyCell[]> = {
  4:  ['P','P','P','P','P','P','H','H','H','H'], // 2,2
  6:  ['P','P','P','P','P','P','H','H','H','H'], // 3,3
  8:  ['H','H','H','P','P','H','H','H','H','H'], // 4,4
  10: ['D','D','D','D','D','D','D','D','H','H'], // 5,5 treat as hard 10
  12: ['P','P','P','P','P','H','H','H','H','H'], // 6,6
  14: ['P','P','P','P','P','P','H','H','H','H'], // 7,7
  16: ['P','P','P','P','P','P','P','P','P','P'], // 8,8
  18: ['P','P','P','P','P','S','P','P','S','S'], // 9,9
  20: ['S','S','S','S','S','S','S','S','S','S'], // 10,10
  22: ['P','P','P','P','P','P','P','P','P','P']  // A,A
}

// Textual explanations per category for the UI.
export const EXPLANATIONS = {
  hard: (total: number, dealer: number, action: StrategyCell) =>
    `Con un total duro de ${total} contra ${dealer === 11 ? 'A' : dealer}, la estrategia básica indica ${describeAction(action)}.`,
  soft: (total: number, dealer: number, action: StrategyCell) =>
    `Tu mano suave suma ${total} contra ${dealer === 11 ? 'A' : dealer}. La estrategia básica dice ${describeAction(action)} porque el As te da flexibilidad.`,
  pair: (rank: string, dealer: number, action: StrategyCell) =>
    `Con una pareja de ${rank} contra ${dealer === 11 ? 'A' : dealer}, la estrategia básica indica ${describeAction(action)}.`
}

export function describeAction(a: StrategyCell): string {
  switch (a) {
    case 'H': return 'pedir (Hit)'
    case 'S': return 'plantarse (Stand)'
    case 'D': return 'doblar si es posible, si no pedir'
    case 'Ds': return 'doblar si es posible, si no plantarse'
    case 'P': return 'dividir (Split)'
    case 'R':
    case 'Rh': return 'rendirse si es posible, si no pedir'
    case 'Rs': return 'rendirse si es posible, si no plantarse'
  }
}

export function resolveStrategyCell(
  cell: StrategyCell,
  opts: { canDouble: boolean; canSurrender: boolean }
): Action {
  switch (cell) {
    case 'H': return 'H'
    case 'S': return 'S'
    case 'D': return opts.canDouble ? 'D' : 'H'
    case 'Ds': return opts.canDouble ? 'D' : 'S'
    case 'P': return 'P'
    case 'R':
    case 'Rh': return opts.canSurrender ? 'R' : 'H'
    case 'Rs': return opts.canSurrender ? 'R' : 'S'
  }
}
