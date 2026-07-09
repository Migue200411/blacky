import type { CountingSystem, Rank } from '../types'

export const HI_LO: Record<Rank, number> = {
  '2': 1, '3': 1, '4': 1, '5': 1, '6': 1,
  '7': 0, '8': 0, '9': 0,
  '10': -1, J: -1, Q: -1, K: -1, A: -1
}

export const COUNTING_SYSTEMS: Record<CountingSystem, Record<Rank, number>> = {
  HiLo: HI_LO,
  // Placeholders for future systems — same shape so engine can plug them in.
  KO: HI_LO,
  OmegaII: HI_LO,
  WongHalves: HI_LO
}

export function cardValueForCount(rank: Rank, system: CountingSystem): number {
  return COUNTING_SYSTEMS[system][rank]
}
