import { useState } from 'react'
import { DEALER_UPCARDS, HARD_TOTALS, PAIRS, SOFT_TOTALS, describeAction, type StrategyCell } from '../data/basicStrategy'

type Tab = 'hard' | 'soft' | 'pairs'

const CELL_COLORS: Record<StrategyCell, string> = {
  H: 'bg-emerald-600/70',
  S: 'bg-chip-red/80',
  D: 'bg-chip-gold text-neutral-900',
  Ds: 'bg-chip-gold/70 text-neutral-900',
  P: 'bg-chip-blue/80',
  R: 'bg-purple-600/80',
  Rh: 'bg-purple-600/70',
  Rs: 'bg-purple-600/60'
}

function pairLabel(k: number): string {
  if (k === 4) return '2,2'
  if (k === 6) return '3,3'
  if (k === 8) return '4,4'
  if (k === 10) return '5,5'
  if (k === 12) return '6,6'
  if (k === 14) return '7,7'
  if (k === 16) return '8,8'
  if (k === 18) return '9,9'
  if (k === 20) return '10,10'
  if (k === 22) return 'A,A'
  return String(k)
}

export function StrategyTablesInteractive() {
  const [tab, setTab] = useState<Tab>('hard')
  const [hover, setHover] = useState<string | null>(null)

  const table = tab === 'hard' ? HARD_TOTALS : tab === 'soft' ? SOFT_TOTALS : PAIRS

  const rows = Object.keys(table).map((k) => parseInt(k, 10)).sort((a, b) => a - b)

  return (
    <div className="not-prose space-y-3">
      <div className="flex gap-2">
        {(['hard', 'soft', 'pairs'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`btn-ghost !py-1 !px-3 text-xs ${tab === t ? '!bg-chip-gold !text-neutral-900' : ''}`}
          >
            {t === 'hard' ? 'Hard totals' : t === 'soft' ? 'Soft totals' : 'Pairs'}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="text-[10px] sm:text-xs w-full">
          <thead>
            <tr>
              <th className="p-1 sm:p-2 text-white/60"></th>
              {DEALER_UPCARDS.map((u) => (
                <th key={u} className="p-1 sm:p-2 text-white/60 text-center">{u === 11 ? 'A' : u}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row}>
                <th className="p-1 sm:p-2 text-white/70 text-left">
                  {tab === 'pairs' ? pairLabel(row) : row}
                </th>
                {DEALER_UPCARDS.map((u, ci) => {
                  const cell = (table as Record<number, StrategyCell[]>)[row][ci]
                  const key = `${row}-${u}`
                  return (
                    <td
                      key={u}
                      onMouseEnter={() => setHover(key)}
                      onMouseLeave={() => setHover(null)}
                      onClick={() => setHover(hover === key ? null : key)}
                      className={`p-0 sm:p-0 text-center cursor-pointer text-white font-semibold ${CELL_COLORS[cell]}`}
                    >
                      <div className="px-1 py-0.5 sm:py-1">{cell}</div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hover && (() => {
        const [rowStr, upStr] = hover.split('-')
        const row = parseInt(rowStr, 10)
        const up = parseInt(upStr, 10)
        const ci = DEALER_UPCARDS.indexOf(up as any)
        const cell = (table as Record<number, StrategyCell[]>)[row][ci]
        const label =
          tab === 'hard' ? `Hard ${row}` :
          tab === 'soft' ? `Soft ${row}` :
          `Pareja ${pairLabel(row)}`
        return (
          <div className="rounded-lg bg-black/40 border border-white/10 p-3 text-sm">
            <strong>{label}</strong> vs {up === 11 ? 'A' : up}: {describeAction(cell)}.
          </div>
        )
      })()}
      <div className="flex flex-wrap gap-2 text-[11px] text-white/70">
        {(['H', 'S', 'D', 'Ds', 'P', 'Rh', 'Rs'] as StrategyCell[]).map((c) => (
          <span key={c} className={`px-2 py-0.5 rounded ${CELL_COLORS[c]}`}>{c} · {describeAction(c)}</span>
        ))}
      </div>
    </div>
  )
}
