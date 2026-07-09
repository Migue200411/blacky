import { useEffect, useMemo, useRef, useState } from 'react'
import { buildShoe, drawCard } from '../engine/deck'
import { runningCountFromCards } from '../engine/counting'
import { PlayingCard } from '../components/PlayingCard'
import { useStore } from '../store/useStore'
import type { Card } from '../types'

type Phase = 'setup' | 'playing' | 'answer' | 'result'

export function CountDrillPage() {
  const record = useStore((s) => s.recordCountingDrill)
  const [decks, setDecks] = useState(6)
  const [count, setCount] = useState(52)
  const [speedMs, setSpeedMs] = useState(700)
  const [batch, setBatch] = useState<1 | 2 | 3>(1)

  const [phase, setPhase] = useState<Phase>('setup')
  const [shownCards, setShownCards] = useState<Card[]>([])
  const [current, setCurrent] = useState<Card[]>([])
  const [userAnswer, setUserAnswer] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const startTime = useRef(0)
  const timer = useRef<number | undefined>(undefined)

  const finalCount = useMemo(() => runningCountFromCards(shownCards, 'HiLo'), [shownCards])

  useEffect(() => () => { if (timer.current) clearInterval(timer.current) }, [])

  function start() {
    let shoe = buildShoe(decks, 0.75)
    const drawn: Card[] = []
    for (let i = 0; i < Math.min(count, shoe.cards.length); i++) {
      const r = drawCard(shoe); shoe = r.shoe; drawn.push(r.card)
    }
    setShownCards([])
    setCurrent([])
    setUserAnswer('')
    setPhase('playing')
    startTime.current = performance.now()
    let idx = 0
    if (timer.current) clearInterval(timer.current)
    timer.current = window.setInterval(() => {
      const chunk = drawn.slice(idx, idx + batch)
      idx += batch
      setCurrent(chunk)
      setShownCards((prev) => [...prev, ...chunk])
      if (idx >= drawn.length) {
        clearInterval(timer.current)
        timer.current = undefined
        setElapsed(Math.round(performance.now() - startTime.current))
        setPhase('answer')
      }
    }, speedMs) as unknown as number
  }

  function submit() {
    const guess = parseInt(userAnswer || '0', 10)
    const correct = guess === finalCount
    record(correct, guess - finalCount)
    setPhase('result')
  }

  function reset() {
    setPhase('setup')
    setShownCards([])
    setCurrent([])
    setUserAnswer('')
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl text-chip-gold">Drill de conteo</h1>
        <p className="text-white/70 text-sm">Mantén el running count Hi-Lo mientras las cartas van saliendo. Al final introdúcelo y compáralo con el real.</p>
      </div>

      {phase === 'setup' && (
        <div className="card-panel p-4 space-y-3">
          <Row label="Número de cartas">
            <input type="number" className="bg-black/40 rounded px-3 py-1.5 border border-white/10 w-28" value={count}
              onChange={(e) => setCount(Math.max(4, parseInt(e.target.value || '4', 10)))} />
          </Row>
          <Row label="Velocidad (ms/paso)">
            <input type="range" min={200} max={2000} step={100} value={speedMs} onChange={(e) => setSpeedMs(parseInt(e.target.value, 10))} className="w-full accent-chip-gold" />
            <div className="text-xs text-white/60 tabular-nums">{speedMs} ms</div>
          </Row>
          <Row label="Cartas por paso">
            <div className="flex gap-2">
              {[1, 2, 3].map((n) => (
                <button key={n} onClick={() => setBatch(n as 1 | 2 | 3)} className={`btn-ghost !py-1 !px-3 ${batch === n ? '!bg-chip-gold !text-neutral-900' : ''}`}>{n}</button>
              ))}
            </div>
          </Row>
          <Row label="Mazos">
            <div className="flex flex-wrap gap-2">
              {[1, 2, 4, 6, 8].map((n) => (
                <button key={n} onClick={() => setDecks(n)} className={`btn-ghost !py-1 !px-3 ${decks === n ? '!bg-chip-gold !text-neutral-900' : ''}`}>{n}</button>
              ))}
            </div>
          </Row>
          <button className="btn-primary w-full" onClick={start}>Iniciar drill</button>
        </div>
      )}

      {phase === 'playing' && (
        <div className="card-panel p-6 space-y-4 min-h-[360px]">
          <div className="text-center text-xs text-white/60">Recuerda el running count. No lo escribas todavía.</div>
          <div className="flex flex-wrap gap-2 justify-center min-h-[120px] items-center">
            {current.map((c) => <PlayingCard key={c.id} card={c} />)}
          </div>
          <div className="text-center text-xs text-white/60">Vistas: {shownCards.length} / {count}</div>
        </div>
      )}

      {phase === 'answer' && (
        <div className="card-panel p-6 space-y-3">
          <div className="text-center">¿Cuál es el running count final?</div>
          <input
            autoFocus
            type="number"
            className="w-full text-3xl text-center bg-black/40 rounded-lg border border-white/10 py-3 tabular-nums"
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          <button className="btn-primary w-full" onClick={submit}>Verificar</button>
        </div>
      )}

      {phase === 'result' && (
        <div className="card-panel p-6 space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="label">Tu respuesta</div>
              <div className="text-3xl font-display">{userAnswer}</div>
            </div>
            <div>
              <div className="label">Real</div>
              <div className={`text-3xl font-display ${parseInt(userAnswer || '0', 10) === finalCount ? 'text-emerald-400' : 'text-chip-red'}`}>
                {finalCount > 0 ? `+${finalCount}` : finalCount}
              </div>
            </div>
            <div>
              <div className="label">Error</div>
              <div className="text-2xl">{parseInt(userAnswer || '0', 10) - finalCount}</div>
            </div>
            <div>
              <div className="label">Tiempo</div>
              <div className="text-2xl tabular-nums">{(elapsed / 1000).toFixed(1)}s</div>
            </div>
          </div>
          <div className="text-xs text-white/60">
            Precisión: {shownCards.length > 0 ? ((1 - Math.abs(parseInt(userAnswer || '0', 10) - finalCount) / Math.max(1, shownCards.length)) * 100).toFixed(1) : 0}%
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={reset}>Configurar de nuevo</button>
            <button className="btn-primary flex-1" onClick={start}>Repetir con mismos ajustes</button>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid sm:grid-cols-[200px_1fr] gap-2 items-center">
      <div className="text-sm">{label}</div>
      <div>{children}</div>
    </div>
  )
}
