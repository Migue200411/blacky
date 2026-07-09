import { useMemo, useState } from 'react'
import { DEVIATIONS } from '../data/deviations'
import { useStore } from '../store/useStore'
import type { Action, Deviation } from '../types'

function rnd(max: number): number {
  const a = new Uint32Array(1); globalThis.crypto.getRandomValues(a); return a[0] % max
}

function pickDeviation(): { dev: Deviation; tc: number; applies: boolean } {
  const dev = DEVIATIONS[rnd(DEVIATIONS.length)]
  // Half the time pick a TC where the deviation applies, half not.
  const applies = rnd(2) === 0
  let tc: number
  if (applies) {
    tc = dev.direction === 'ge' ? dev.index + rnd(3) : dev.index - 1 - rnd(3)
  } else {
    tc = dev.direction === 'ge' ? dev.index - 1 - rnd(3) : dev.index + rnd(3)
  }
  return { dev, tc, applies }
}

export function DeviationsTrainerPage() {
  const record = useStore((s) => s.recordDecision)
  const [challenge, setChallenge] = useState(pickDeviation)
  const [result, setResult] = useState<null | { correct: boolean; chosen: Action }>(null)

  const expected: Action = useMemo(() => (challenge.applies ? challenge.dev.deviationAction : challenge.dev.basicAction), [challenge])

  function submit(a: Action) {
    const correct = a === expected
    setResult({ correct, chosen: a })
    record('deviation', correct)
  }

  function next() {
    setResult(null)
    setChallenge(pickDeviation())
  }

  const dealerLbl = challenge.dev.dealerUp === 11 ? 'A' : String(challenge.dev.dealerUp)

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl text-chip-gold">Entrenador de desviaciones</h1>
      <p className="text-white/70 text-sm">
        Dado el true count y la situación, decide si sigues la estrategia básica o aplicas la desviación por índice.
      </p>

      <div className="card-panel p-6 space-y-4">
        <div className="grid sm:grid-cols-3 gap-3 text-center">
          <Stat label="Mano" value={String(challenge.dev.playerTotal)} />
          <Stat label="Dealer" value={dealerLbl} />
          <Stat label="True Count" value={challenge.tc > 0 ? `+${challenge.tc}` : String(challenge.tc)} highlight />
        </div>
        <div className="text-center text-xs text-white/60">
          Índice recordatorio: {challenge.dev.direction === 'ge' ? '≥ ' : '< '}{challenge.dev.index} · básica {challenge.dev.basicAction} → desviación {challenge.dev.deviationAction}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(['H', 'S', 'D', 'R'] as Action[]).map((a) => (
            <button
              key={a}
              disabled={!!result}
              onClick={() => submit(a)}
              className={a === 'D' ? 'btn-primary' : a === 'R' ? 'btn-danger' : 'btn-secondary'}
            >
              {labelAction(a)}
            </button>
          ))}
        </div>

        {result && (
          <div className={`rounded-lg p-3 ${result.correct ? 'border border-emerald-400/40 bg-emerald-400/10' : 'border border-chip-red/40 bg-chip-red/10'}`}>
            <div className="text-sm">
              {result.correct ? '✓ Correcto.' : `✗ Debías ${labelAction(expected)}.`}
            </div>
            <div className="text-xs text-white/70 mt-1">
              {challenge.applies
                ? `El TC (${challenge.tc}) cumple el índice ${challenge.dev.direction === 'ge' ? '≥' : '<'} ${challenge.dev.index}, por lo que aplica la desviación. ${challenge.dev.explanation}`
                : `El TC (${challenge.tc}) NO cumple el índice ${challenge.dev.direction === 'ge' ? '≥' : '<'} ${challenge.dev.index}, así que se juega estrategia básica: ${challenge.dev.basicAction}.`}
            </div>
            <button className="btn-primary mt-3 w-full" onClick={next}>Siguiente</button>
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-3 border ${highlight ? 'border-chip-gold/50 bg-chip-gold/10' : 'border-white/10 bg-black/40'}`}>
      <div className="label">{label}</div>
      <div className="text-3xl font-display">{value}</div>
    </div>
  )
}

function labelAction(a: Action): string {
  return { H: 'Pedir', S: 'Plantarse', D: 'Doblar', P: 'Dividir', R: 'Rendirse', I: 'Seguro' }[a]
}
