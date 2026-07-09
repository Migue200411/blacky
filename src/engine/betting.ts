import type { Aggression, BetRampEntry, TableRules } from '../types'

export function recommendedBet(rules: TableRules, trueCount: number, bankroll: number): {
  bet: number
  units: number
  warning?: string
} {
  const ramp = [...rules.betRamp].sort((a, b) => a.tc - b.tc)
  let units = 1
  for (const entry of ramp) {
    if (trueCount >= entry.tc) units = entry.units
  }

  const aggressionMultiplier: Record<Aggression, number> = {
    conservative: 0.75,
    moderate: 1,
    aggressive: 1.5
  }
  units = Math.max(1, Math.round(units * aggressionMultiplier[rules.aggression]))

  let bet = units * rules.unit
  bet = Math.max(rules.minBet, Math.min(rules.maxBet, bet))
  bet = Math.min(bet, bankroll)

  let warning: string | undefined
  if (bankroll > 0 && bet / bankroll > 0.05) {
    warning = 'Advertencia: esta apuesta supera el 5% de tu bankroll simulado, considera reducirla.'
  }
  return { bet, units, warning }
}

export function expectedUnits(ramp: BetRampEntry[], tc: number): number {
  const sorted = [...ramp].sort((a, b) => a.tc - b.tc)
  let units = 1
  for (const entry of sorted) if (tc >= entry.tc) units = entry.units
  return units
}
