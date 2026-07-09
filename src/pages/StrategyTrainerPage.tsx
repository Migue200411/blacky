import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import { PlayingCard } from '../components/PlayingCard'
import { decideStrategy } from '../engine/strategy'
import { newHand } from '../engine/hand'
import type { Action, Card, Rank, Suit } from '../types'

type Category = 'hard' | 'soft' | 'pair' | 'mixed'

const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10']
const SUITS: Suit[] = ['♠', '♥', '♦', '♣']

function rnd(max: number): number {
  const a = new Uint32Array(1); globalThis.crypto.getRandomValues(a); return a[0] % max
}

function makeCard(rank: Rank): Card {
  return { rank, suit: SUITS[rnd(4)], id: `t${rnd(1_000_000)}` }
}

function generateHand(cat: Category): { cards: Card[]; category: 'hard' | 'soft' | 'pair' } {
  const chosen: Category = cat === 'mixed'
    ? (['hard', 'soft', 'pair'] as const)[rnd(3)]
    : cat

  if (chosen === 'pair') {
    const r = RANKS[rnd(RANKS.length)]
    return { cards: [makeCard(r), makeCard(r)], category: 'pair' }
  }
  if (chosen === 'soft') {
    // Ace + non-ace non-10 for interesting soft totals (13..20).
    const other = RANKS[1 + rnd(9)] // '2'..'10'
    return { cards: [makeCard('A'), makeCard(other)], category: 'soft' }
  }
  // Hard: two non-aces summing 5..20
  while (true) {
    const a = RANKS[1 + rnd(9)]
    const b = RANKS[1 + rnd(9)]
    if (a === b) continue
    const va = a === '10' ? 10 : parseInt(a, 10)
    const vb = b === '10' ? 10 : parseInt(b, 10)
    const total = va + vb
    if (total < 5 || total > 20) continue
    return { cards: [makeCard(a), makeCard(b)], category: 'hard' }
  }
}

function dealerUpcard(): Card {
  const r = RANKS[rnd(RANKS.length)]
  return makeCard(r)
}

export function StrategyTrainerPage() {
  const rules = useStore((s) => s.rules)
  const record = useStore((s) => s.recordDecision)
  const [category, setCategory] = useState<Category>('mixed')
  const [challenge, setChallenge] = useState(() => ({
    hand: generateHand('mixed'),
    dealer: dealerUpcard()
  }))
  const [result, setResult] = useState<null | { chosen: Action; correct: boolean; explanation: string; correctAction: Action }>(null)

  const decision = useMemo(() => {
    return decideStrategy({
      hand: newHand(challenge.hand.cards, rules.unit),
      dealerUp: challenge.dealer,
      rules,
      trueCount: 0,
      splitsSoFar: 0
    })
  }, [challenge, rules])

  function submit(a: Action) {
    if (result) return
    const correct = a === decision.basic // strategy trainer only cares about basic
    setResult({ chosen: a, correct, explanation: decision.explanation, correctAction: decision.basic })
    record(challenge.hand.category, correct)
  }

  function next(cat: Category = category) {
    setResult(null)
    setChallenge({ hand: generateHand(cat), dealer: dealerUpcard() })
  }

  function pick(cat: Category) {
    setCategory(cat)
    next(cat)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-3xl text-chip-gold">Entrenador de estrategia básica</h1>
        <div className="flex gap-1 flex-wrap">
          {(['mixed', 'hard', 'soft', 'pair'] as Category[]).map((c) => (
            <button
              key={c}
              onClick={() => pick(c)}
              className={`btn-ghost !py-1 !px-3 text-xs ${category === c ? '!bg-chip-gold !text-neutral-900' : ''}`}
            >
              {c === 'mixed' ? 'Todo' : c === 'hard' ? 'Hard' : c === 'soft' ? 'Soft' : 'Pairs'}
            </button>
          ))}
        </div>
      </div>

      <div className="card-panel p-6 space-y-4 bg-gradient-to-b from-felt/60 to-felt-dark">
        <div className="text-center">
          <div className="label mb-1">Dealer muestra</div>
          <div className="flex justify-center"><PlayingCard card={challenge.dealer} /></div>
        </div>
        <div className="text-center">
          <div className="label mb-1">Tu mano</div>
          <div className="flex justify-center gap-2">
            {challenge.hand.cards.map((c) => <PlayingCard key={c.id} card={c} />)}
          </div>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {(['H', 'S', 'D', 'P', 'R'] as Action[]).map((a) => (
            <button
              key={a}
              onClick={() => submit(a)}
              disabled={!!result}
              className={a === 'D' || a === 'P' ? 'btn-primary' : a === 'R' ? 'btn-danger' : 'btn-secondary'}
            >
              {labelAction(a)}
            </button>
          ))}
        </div>
        {result && (
          <div className={`rounded-lg p-3 ${result.correct ? 'border border-emerald-400/40 bg-emerald-400/10' : 'border border-chip-red/40 bg-chip-red/10'}`}>
            <div className="text-sm">
              {result.correct ? '✓ Correcto.' : `✗ Debías ${labelAction(result.correctAction)}.`}
            </div>
            <div className="text-xs text-white/70 mt-1">{result.explanation}</div>
            <button className="btn-primary mt-3 w-full" onClick={() => next()}>Siguiente</button>
          </div>
        )}
      </div>
    </div>
  )
}

function labelAction(a: Action): string {
  return { H: 'Pedir', S: 'Plantarse', D: 'Doblar', P: 'Dividir', R: 'Rendirse', I: 'Seguro' }[a]
}
