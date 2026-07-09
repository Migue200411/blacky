import { decksRemaining } from '../engine/deck'
import { trueCount as tcCalc } from '../engine/counting'
import type { Rounding, ShoeState } from '../types'

interface Props {
  running: number
  shoe: ShoeState
  hidden?: boolean
  rounding?: Rounding
}

export function CountPanel({ running, shoe, hidden, rounding = 'floor' }: Props) {
  const decks = decksRemaining(shoe)
  const tc = tcCalc(running, decks, rounding)
  const played = shoe.played.length
  const total = shoe.decks * 52
  const penetrationPct = Math.round((played / total) * 100)

  return (
    <div className="card-panel p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="font-display text-lg text-chip-gold">Conteo</div>
        {hidden && <span className="text-[10px] uppercase text-white/50">oculto</span>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="label">Running Count</div>
          <div className="text-3xl font-bold tabular-nums">
            {hidden ? '••' : running > 0 ? `+${running}` : running}
          </div>
        </div>
        <div>
          <div className="label">True Count</div>
          <div className="text-3xl font-bold tabular-nums text-chip-gold">
            {hidden ? '••' : tc > 0 ? `+${tc}` : tc}
          </div>
        </div>
        <div className="col-span-2 border-t border-white/10 pt-2">
          <div className="label">Zapato</div>
          <div className="flex items-end justify-between gap-2">
            <div className="text-sm">
              <span className="tabular-nums">{decks.toFixed(2)}</span> mazos restantes
            </div>
            <div className="text-[11px] text-white/60">Penetración {penetrationPct}%</div>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-chip-gold"
              style={{ width: `${Math.min(100, penetrationPct)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
