import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import { trueCount } from '../engine/counting'
import type { Rounding } from '../types'

function randomRC(): number {
  const cryptoObj = globalThis.crypto
  const arr = new Uint32Array(1)
  cryptoObj.getRandomValues(arr)
  return (arr[0] % 21) - 10 // -10..+10
}

function randomDecks(): number {
  const cryptoObj = globalThis.crypto
  const arr = new Uint32Array(1)
  cryptoObj.getRandomValues(arr)
  const half = (arr[0] % 12) + 1 // 1..12 half-decks
  return half / 2 // 0.5..6.0
}

export function TrueCountDrillPage() {
  const record = useStore((s) => s.recordTrueCountDrill)
  const rounding = useStore((s) => s.rules.rounding)

  const [challenge, setChallenge] = useState(() => ({ rc: randomRC(), decks: randomDecks() }))
  const [userAnswer, setUserAnswer] = useState('')
  const [result, setResult] = useState<null | { correct: boolean; error: number; real: number }>(null)
  const [rMode, setRMode] = useState<Rounding>(rounding)

  const real = useMemo(() => trueCount(challenge.rc, challenge.decks, rMode), [challenge, rMode])

  function submit() {
    const guess = parseInt(userAnswer || '0', 10)
    const err = guess - real
    const correct = guess === real
    record(correct, err)
    setResult({ correct, error: err, real })
  }

  function next() {
    setResult(null)
    setUserAnswer('')
    setChallenge({ rc: randomRC(), decks: randomDecks() })
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl text-chip-gold">Drill de True Count</h1>
      <p className="text-white/70 text-sm">
        Dado un running count y los mazos restantes, escribe el true count con el redondeo indicado.
      </p>

      <div className="card-panel p-6 space-y-4">
        <div className="flex justify-between text-xs text-white/60">
          <span>Redondeo</span>
          <div className="flex gap-1">
            {(['floor', 'round', 'truncate'] as Rounding[]).map((r) => (
              <button key={r} onClick={() => setRMode(r)}
                className={`btn-ghost !py-0.5 !px-2 !text-[10px] ${rMode === r ? '!bg-chip-gold !text-neutral-900' : ''}`}>
                {r}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center">
            <div className="label">Running Count</div>
            <div className="text-4xl font-display tabular-nums">
              {challenge.rc > 0 ? `+${challenge.rc}` : challenge.rc}
            </div>
          </div>
          <div className="text-center">
            <div className="label">Mazos restantes</div>
            <div className="text-4xl font-display tabular-nums">{challenge.decks.toFixed(1)}</div>
            <ShoeVisual decks={challenge.decks} />
          </div>
        </div>
        {!result ? (
          <>
            <input
              autoFocus
              type="number"
              placeholder="Escribe el TC"
              className="w-full text-3xl text-center bg-black/40 rounded-lg border border-white/10 py-3 tabular-nums"
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
            <button className="btn-primary w-full" onClick={submit}>Verificar</button>
          </>
        ) : (
          <>
            <div className={`rounded-lg p-3 text-center ${result.correct ? 'bg-emerald-500/20 border border-emerald-400/40' : 'bg-chip-red/20 border border-chip-red/40'}`}>
              <div className="text-sm">
                {result.correct ? '¡Correcto!' : 'Casi.'} El true count real es{' '}
                <strong>{result.real > 0 ? `+${result.real}` : result.real}</strong>.
              </div>
              <div className="text-xs text-white/70 mt-1">
                Cálculo: {challenge.rc} ÷ {challenge.decks.toFixed(1)} = {(challenge.rc / challenge.decks).toFixed(2)} → {rMode} → {result.real}
              </div>
            </div>
            <button className="btn-primary w-full" onClick={next}>Siguiente</button>
          </>
        )}
      </div>
    </div>
  )
}

function ShoeVisual({ decks }: { decks: number }) {
  const full = Math.floor(decks)
  const half = decks - full >= 0.5
  return (
    <div className="mt-2 flex justify-center gap-1">
      {Array.from({ length: full }).map((_, i) => (
        <div key={i} className="w-4 h-8 rounded-sm bg-chip-blue border border-white/40" />
      ))}
      {half && <div className="w-4 h-8 rounded-sm bg-chip-blue/50 border border-white/30" />}
    </div>
  )
}
