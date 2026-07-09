import { useState } from 'react'
import type { TableRules } from '../types'

interface Props {
  rules: TableRules
  bankroll: number
  suggestedBet: number
  onBet: (amount: number) => void
  warning?: string
}

const CHIP_VALUES = [1, 5, 25, 100]

export function BetControls({ rules, bankroll, suggestedBet, onBet, warning }: Props) {
  const [amount, setAmount] = useState(Math.max(rules.minBet, suggestedBet))

  function addChip(v: number) {
    setAmount((prev) => Math.min(bankroll, Math.min(rules.maxBet, prev + v)))
  }

  function reset() {
    setAmount(rules.minBet)
  }

  return (
    <div className="card-panel p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="label">Tu apuesta</div>
          <div className="text-3xl font-display text-chip-gold tabular-nums">${amount}</div>
        </div>
        <div className="text-right">
          <div className="label">Sugerida</div>
          <div className="text-lg tabular-nums">${suggestedBet}</div>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        {CHIP_VALUES.map((v) => (
          <button
            key={v}
            onClick={() => addChip(v)}
            className="btn-ghost !py-1 !px-3 text-sm"
          >
            +{v}
          </button>
        ))}
        <button onClick={reset} className="btn-ghost !py-1 !px-3 text-sm">
          Reset
        </button>
        <button
          onClick={() => setAmount(suggestedBet)}
          className="btn-ghost !py-1 !px-3 text-sm"
        >
          Usar sugerida
        </button>
      </div>
      <input
        type="range"
        min={rules.minBet}
        max={Math.min(rules.maxBet, bankroll)}
        step={rules.unit}
        value={Math.min(amount, Math.min(rules.maxBet, bankroll))}
        onChange={(e) => setAmount(parseInt(e.target.value, 10))}
        className="w-full accent-chip-gold"
      />
      {warning && (
        <div className="text-[11px] text-chip-red border border-chip-red/40 bg-chip-red/10 rounded px-2 py-1">
          {warning}
        </div>
      )}
      <div className="flex justify-between text-[11px] text-white/60">
        <span>Min: ${rules.minBet}</span>
        <span>Máx: ${rules.maxBet}</span>
      </div>
      <button
        className="btn-primary w-full"
        disabled={amount < rules.minBet || amount > bankroll}
        onClick={() => onBet(amount)}
      >
        Repartir manos
      </button>
    </div>
  )
}
