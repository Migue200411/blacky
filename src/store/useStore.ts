import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_RULES, EMPTY_STATS } from '../data/defaults'
import type { HandHistoryEntry, TableRules, UserStats } from '../types'

interface AppState {
  rules: TableRules
  stats: UserStats
  showCountsInSim: boolean
  helpMode: boolean
  soundOn: boolean
  hasSeenDisclaimer: boolean

  setRules: (r: Partial<TableRules>) => void
  resetRules: () => void
  setShowCountsInSim: (v: boolean) => void
  setHelpMode: (v: boolean) => void
  setSoundOn: (v: boolean) => void
  acceptDisclaimer: () => void

  recordDecision: (category: keyof UserStats['decisions']['byCategory'], correct: boolean) => void
  recordCountingDrill: (correct: boolean, error: number) => void
  recordTrueCountDrill: (correct: boolean, error: number) => void
  recordHand: (entry: HandHistoryEntry) => void
  resetStats: () => void
  startSession: () => void
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      rules: DEFAULT_RULES,
      stats: EMPTY_STATS,
      showCountsInSim: true,
      helpMode: true,
      soundOn: false,
      hasSeenDisclaimer: false,

      setRules: (r) =>
        set((s) => ({ rules: { ...s.rules, ...r } })),
      resetRules: () => set({ rules: DEFAULT_RULES }),
      setShowCountsInSim: (v) => set({ showCountsInSim: v }),
      setHelpMode: (v) => set({ helpMode: v }),
      setSoundOn: (v) => set({ soundOn: v }),
      acceptDisclaimer: () => set({ hasSeenDisclaimer: true }),

      recordDecision: (category, correct) =>
        set((s) => {
          const cat = s.stats.decisions.byCategory[category]
          return {
            stats: {
              ...s.stats,
              decisions: {
                ...s.stats.decisions,
                total: s.stats.decisions.total + 1,
                correct: s.stats.decisions.correct + (correct ? 1 : 0),
                byCategory: {
                  ...s.stats.decisions.byCategory,
                  [category]: {
                    total: cat.total + 1,
                    correct: cat.correct + (correct ? 1 : 0)
                  }
                }
              }
            }
          }
        }),

      recordCountingDrill: (correct, error) =>
        set((s) => ({
          stats: {
            ...s.stats,
            counting: {
              drills: s.stats.counting.drills + 1,
              correct: s.stats.counting.correct + (correct ? 1 : 0),
              totalError: s.stats.counting.totalError + Math.abs(error)
            }
          }
        })),

      recordTrueCountDrill: (correct, error) =>
        set((s) => ({
          stats: {
            ...s.stats,
            trueCount: {
              drills: s.stats.trueCount.drills + 1,
              correct: s.stats.trueCount.correct + (correct ? 1 : 0),
              totalError: s.stats.trueCount.totalError + Math.abs(error)
            }
          }
        })),

      recordHand: (entry) =>
        set((s) => {
          const won = entry.result === 'win' || entry.result === 'dealerBust' || entry.result === 'blackjack'
          const lost = entry.result === 'lose' || entry.result === 'bust' || entry.result === 'surrender'
          const push = entry.result === 'push'
          const net = entry.payout - entry.bet
          const currentSession = s.stats.currentSession + net
          return {
            stats: {
              ...s.stats,
              handsPlayed: s.stats.handsPlayed + 1,
              handsWon: s.stats.handsWon + (won ? 1 : 0),
              handsLost: s.stats.handsLost + (lost ? 1 : 0),
              handsPushed: s.stats.handsPushed + (push ? 1 : 0),
              totalNet: s.stats.totalNet + net,
              biggestWin: Math.max(s.stats.biggestWin, net),
              biggestLoss: Math.min(s.stats.biggestLoss, net),
              currentSession,
              bestSession: Math.max(s.stats.bestSession, currentSession),
              worstSession: Math.min(s.stats.worstSession, currentSession),
              history: [...s.stats.history.slice(-499), entry]
            }
          }
        }),

      startSession: () =>
        set((s) => ({ stats: { ...s.stats, currentSession: 0 } })),

      resetStats: () => set({ stats: EMPTY_STATS })
    }),
    {
      name: 'blackjack-trainer-pro',
      partialize: (s) => ({
        rules: s.rules,
        stats: s.stats,
        showCountsInSim: s.showCountsInSim,
        helpMode: s.helpMode,
        soundOn: s.soundOn,
        hasSeenDisclaimer: s.hasSeenDisclaimer
      })
    }
  )
)

export function userLevel(stats: UserStats): { level: string; progress: number } {
  const dec = stats.decisions.total
  const acc = dec > 0 ? stats.decisions.correct / dec : 0
  const hands = stats.handsPlayed
  const score = Math.min(1, hands / 500) * 0.5 + acc * 0.5
  if (score < 0.15) return { level: 'Novato', progress: score }
  if (score < 0.35) return { level: 'Aprendiz', progress: score }
  if (score < 0.6) return { level: 'Intermedio', progress: score }
  if (score < 0.85) return { level: 'Avanzado', progress: score }
  return { level: 'Experto', progress: score }
}
