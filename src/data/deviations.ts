import type { Deviation } from '../types'

// Illustrious 18 + Fab 4. dealerUp: 11 = As.
// Estas son las desviaciones más rentables en un shoe de 6 mazos con Hi-Lo.
// Cada regla se dispara cuando el true count cumple la dirección (ge = ≥, lt = <).
export const DEVIATIONS: Deviation[] = [
  // ── Illustrious 18 ──────────────────────────────────────────────
  {
    playerTotal: 16, dealerUp: 10, basicAction: 'H',
    index: 0, direction: 'ge', deviationAction: 'S',
    explanation: 'Con TC ≥ 0, plantarse en 16 vs 10: hay más figuras y pedir aumenta el riesgo de pasarse.'
  },
  {
    playerTotal: 15, dealerUp: 10, basicAction: 'H',
    index: 4, direction: 'ge', deviationAction: 'S',
    explanation: 'Con TC ≥ +4, plantarse en 15 vs 10: la densidad de dieces vuelve más probable pasarse.'
  },
  {
    playerTotal: 20, isPair: true, dealerUp: 5, basicAction: 'S',
    index: 5, direction: 'ge', deviationAction: 'P',
    explanation: 'Con TC ≥ +5, dividir 10-10 vs 5: sacrificas una mano fuerte por dos apuestas con alta probabilidad de ganar.'
  },
  {
    playerTotal: 20, isPair: true, dealerUp: 6, basicAction: 'S',
    index: 4, direction: 'ge', deviationAction: 'P',
    explanation: 'Con TC ≥ +4, dividir 10-10 vs 6.'
  },
  {
    playerTotal: 10, dealerUp: 10, basicAction: 'H',
    index: 4, direction: 'ge', deviationAction: 'D',
    explanation: 'Con TC ≥ +4, doblar 10 vs 10: aumentan las chances de sacar una carta alta.'
  },
  {
    playerTotal: 12, dealerUp: 3, basicAction: 'H',
    index: 2, direction: 'ge', deviationAction: 'S',
    explanation: 'Con TC ≥ +2, plantarse en 12 vs 3: el dealer se pasa con más frecuencia.'
  },
  {
    playerTotal: 12, dealerUp: 2, basicAction: 'H',
    index: 3, direction: 'ge', deviationAction: 'S',
    explanation: 'Con TC ≥ +3, plantarse en 12 vs 2.'
  },
  {
    playerTotal: 11, dealerUp: 11, basicAction: 'H',
    index: 1, direction: 'ge', deviationAction: 'D',
    explanation: 'Con TC ≥ +1, doblar 11 vs As.'
  },
  {
    playerTotal: 9, dealerUp: 2, basicAction: 'H',
    index: 1, direction: 'ge', deviationAction: 'D',
    explanation: 'Con TC ≥ +1, doblar 9 vs 2.'
  },
  {
    playerTotal: 10, dealerUp: 11, basicAction: 'H',
    index: 4, direction: 'ge', deviationAction: 'D',
    explanation: 'Con TC ≥ +4, doblar 10 vs As.'
  },
  {
    playerTotal: 9, dealerUp: 7, basicAction: 'H',
    index: 3, direction: 'ge', deviationAction: 'D',
    explanation: 'Con TC ≥ +3, doblar 9 vs 7.'
  },
  {
    playerTotal: 16, dealerUp: 9, basicAction: 'H',
    index: 5, direction: 'ge', deviationAction: 'S',
    explanation: 'Con TC ≥ +5, plantarse 16 vs 9.'
  },
  {
    playerTotal: 13, dealerUp: 2, basicAction: 'S',
    index: -1, direction: 'lt', deviationAction: 'H',
    explanation: 'Con TC < -1, pedir 13 vs 2: hay menos cartas altas de riesgo.'
  },
  {
    playerTotal: 12, dealerUp: 4, basicAction: 'S',
    index: 0, direction: 'lt', deviationAction: 'H',
    explanation: 'Con TC < 0, pedir 12 vs 4.'
  },
  {
    playerTotal: 12, dealerUp: 5, basicAction: 'S',
    index: -2, direction: 'lt', deviationAction: 'H',
    explanation: 'Con TC < -2, pedir 12 vs 5.'
  },
  {
    playerTotal: 12, dealerUp: 6, basicAction: 'S',
    index: -1, direction: 'lt', deviationAction: 'H',
    explanation: 'Con TC < -1, pedir 12 vs 6.'
  },
  {
    playerTotal: 13, dealerUp: 3, basicAction: 'S',
    index: -2, direction: 'lt', deviationAction: 'H',
    explanation: 'Con TC < -2, pedir 13 vs 3.'
  },

  // ── Fab 4 (surrender) ───────────────────────────────────────────
  {
    playerTotal: 14, dealerUp: 10, basicAction: 'H',
    index: 3, direction: 'ge', deviationAction: 'R',
    explanation: 'Fab 4: con TC ≥ +3, rendirse con 14 vs 10.'
  },
  {
    playerTotal: 15, dealerUp: 10, basicAction: 'H',
    index: 0, direction: 'ge', deviationAction: 'R',
    explanation: 'Fab 4: con TC ≥ 0, rendirse con 15 vs 10 (si la mesa lo permite).'
  },
  {
    playerTotal: 15, dealerUp: 9, basicAction: 'H',
    index: 2, direction: 'ge', deviationAction: 'R',
    explanation: 'Fab 4: con TC ≥ +2, rendirse con 15 vs 9.'
  },
  {
    playerTotal: 15, dealerUp: 11, basicAction: 'H',
    index: 1, direction: 'ge', deviationAction: 'R',
    explanation: 'Fab 4: con TC ≥ +1, rendirse con 15 vs As.'
  }
]

export const INSURANCE_INDEX = 3 // Tomar seguro si TC ≥ +3
