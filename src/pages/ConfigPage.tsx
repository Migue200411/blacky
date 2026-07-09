import { useStore } from '../store/useStore'
import type { DoubleRule, Rounding, SurrenderRule, TableRules } from '../types'
import { Link } from 'react-router-dom'
import { DEFAULT_BET_RAMP } from '../data/defaults'

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid sm:grid-cols-[220px_1fr] gap-2 sm:gap-4 items-start py-2 border-b border-white/5">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-[11px] text-white/50">{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  )
}

export function ConfigPage() {
  const rules = useStore((s) => s.rules)
  const setRules = useStore((s) => s.setRules)
  const resetRules = useStore((s) => s.resetRules)

  function set<K extends keyof TableRules>(k: K, v: TableRules[K]) {
    setRules({ [k]: v } as Partial<TableRules>)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-chip-gold">Configuración de mesa</h1>
          <p className="text-white/70 text-sm">Ajusta reglas antes de practicar o simular. Se guardan localmente.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={resetRules}>Restaurar</button>
          <Link to="/simulador" className="btn-primary">Ir al simulador</Link>
        </div>
      </div>

      <section className="card-panel p-4">
        <div className="font-display text-lg mb-2">Zapato y reglas</div>

        <Row label="Número de mazos">
          <div className="flex flex-wrap gap-2">
            {[1, 2, 4, 6, 8].map((n) => (
              <button
                key={n}
                onClick={() => set('decks', n as TableRules['decks'])}
                className={`btn-ghost !py-1 !px-3 ${rules.decks === n ? '!bg-chip-gold !text-neutral-900' : ''}`}
              >
                {n}
              </button>
            ))}
          </div>
        </Row>

        <Row label="Penetración" hint="Qué porcentaje del zapato se juega antes de barajar.">
          <div className="flex flex-wrap gap-2">
            {[0.5, 0.6, 0.65, 0.75, 0.8, 0.85].map((p) => (
              <button
                key={p}
                onClick={() => set('penetration', p as TableRules['penetration'])}
                className={`btn-ghost !py-1 !px-3 ${rules.penetration === p ? '!bg-chip-gold !text-neutral-900' : ''}`}
              >
                {Math.round(p * 100)}%
              </button>
            ))}
          </div>
        </Row>

        <Row label="Dealer" hint="H17 = pide con soft 17; S17 = se planta.">
          <div className="flex gap-2">
            <button onClick={() => set('dealerHitsSoft17', false)} className={`btn-ghost ${!rules.dealerHitsSoft17 ? '!bg-chip-gold !text-neutral-900' : ''}`}>S17</button>
            <button onClick={() => set('dealerHitsSoft17', true)} className={`btn-ghost ${rules.dealerHitsSoft17 ? '!bg-chip-gold !text-neutral-900' : ''}`}>H17</button>
          </div>
        </Row>

        <Row label="Pago blackjack" hint="3:2 es favorable, 6:5 muy desfavorable.">
          <div className="flex gap-2">
            {(['3:2', '6:5'] as const).map((p) => (
              <button key={p} onClick={() => set('blackjackPayout', p)} className={`btn-ghost ${rules.blackjackPayout === p ? '!bg-chip-gold !text-neutral-900' : ''}`}>{p}</button>
            ))}
          </div>
        </Row>

        <Row label="Double permitido">
          <div className="flex flex-wrap gap-2">
            {(['any', '9-11', '10-11', 'none'] as DoubleRule[]).map((d) => (
              <button key={d} onClick={() => set('doubleRule', d)} className={`btn-ghost !py-1 !px-3 ${rules.doubleRule === d ? '!bg-chip-gold !text-neutral-900' : ''}`}>
                {d === 'any' ? 'Cualquier 2' : d === 'none' ? 'No' : d}
              </button>
            ))}
          </div>
        </Row>

        <Row label="Double after split">
          <Toggle value={rules.doubleAfterSplit} onChange={(v) => set('doubleAfterSplit', v)} />
        </Row>

        <Row label="Surrender">
          <div className="flex gap-2">
            {(['none', 'late', 'early'] as SurrenderRule[]).map((s) => (
              <button key={s} onClick={() => set('surrender', s)} className={`btn-ghost !py-1 !px-3 ${rules.surrender === s ? '!bg-chip-gold !text-neutral-900' : ''}`}>
                {s === 'none' ? 'No' : s === 'late' ? 'Late' : 'Early'}
              </button>
            ))}
          </div>
        </Row>

        <Row label="Re-split"><Toggle value={rules.resplit} onChange={(v) => set('resplit', v)} /></Row>
        <Row label="Re-split aces"><Toggle value={rules.resplitAces} onChange={(v) => set('resplitAces', v)} /></Row>
        <Row label="Hit split aces"><Toggle value={rules.hitSplitAces} onChange={(v) => set('hitSplitAces', v)} /></Row>
        <Row label="Insurance"><Toggle value={rules.insurance} onChange={(v) => set('insurance', v)} /></Row>
      </section>

      <section className="card-panel p-4">
        <div className="font-display text-lg mb-2">Bankroll y apuestas simuladas</div>
        <Row label="Bankroll inicial">
          <input type="number" className="bg-black/40 rounded px-3 py-1.5 border border-white/10 w-40" value={rules.bankroll}
            onChange={(e) => set('bankroll', Math.max(0, parseInt(e.target.value || '0', 10)))} />
        </Row>
        <Row label="Mesa mínima / máxima">
          <div className="flex gap-2">
            <input type="number" className="bg-black/40 rounded px-3 py-1.5 border border-white/10 w-28" value={rules.minBet}
              onChange={(e) => set('minBet', Math.max(1, parseInt(e.target.value || '1', 10)))} />
            <input type="number" className="bg-black/40 rounded px-3 py-1.5 border border-white/10 w-28" value={rules.maxBet}
              onChange={(e) => set('maxBet', Math.max(rules.minBet, parseInt(e.target.value || '1', 10)))} />
          </div>
        </Row>
        <Row label="Unidad base de apuesta">
          <input type="number" className="bg-black/40 rounded px-3 py-1.5 border border-white/10 w-28" value={rules.unit}
            onChange={(e) => set('unit', Math.max(1, parseInt(e.target.value || '1', 10)))} />
        </Row>
        <Row label="Estilo de apuesta">
          <div className="flex gap-2">
            {(['conservative', 'moderate', 'aggressive'] as const).map((a) => (
              <button key={a} onClick={() => set('aggression', a)} className={`btn-ghost !py-1 !px-3 ${rules.aggression === a ? '!bg-chip-gold !text-neutral-900' : ''}`}>
                {a === 'conservative' ? 'Conservador' : a === 'moderate' ? 'Moderado' : 'Agresivo'}
              </button>
            ))}
          </div>
        </Row>
        <Row label="Rampa de apuestas" hint="Unidades a apostar según true count. Editable.">
          <BetRampEditor
            ramp={rules.betRamp}
            onChange={(r) => setRules({ betRamp: r })}
            onReset={() => setRules({ betRamp: DEFAULT_BET_RAMP })}
          />
        </Row>
      </section>

      <section className="card-panel p-4">
        <div className="font-display text-lg mb-2">Conteo</div>
        <Row label="Sistema" hint="Hi-Lo es el único activo en esta versión. Otros están reservados para futuro.">
          <div className="flex flex-wrap gap-2">
            {(['HiLo', 'KO', 'OmegaII', 'WongHalves'] as const).map((c) => (
              <button
                key={c}
                disabled={c !== 'HiLo'}
                onClick={() => set('countingSystem', c)}
                className={`btn-ghost !py-1 !px-3 ${rules.countingSystem === c ? '!bg-chip-gold !text-neutral-900' : ''}`}
              >
                {c === 'HiLo' ? 'Hi-Lo' : c}
              </button>
            ))}
          </div>
        </Row>
        <Row label="Redondeo True Count">
          <div className="flex gap-2">
            {(['floor', 'round', 'truncate'] as Rounding[]).map((r) => (
              <button key={r} onClick={() => set('rounding', r)} className={`btn-ghost !py-1 !px-3 ${rules.rounding === r ? '!bg-chip-gold !text-neutral-900' : ''}`}>
                {r === 'floor' ? 'Floor' : r === 'round' ? 'Round' : 'Truncate'}
              </button>
            ))}
          </div>
        </Row>
      </section>
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-14 h-7 rounded-full transition ${value ? 'bg-chip-gold' : 'bg-white/15'}`}
    >
      <span
        className={`absolute top-0.5 w-6 h-6 rounded-full bg-white transition ${value ? 'left-7' : 'left-0.5'}`}
      />
    </button>
  )
}

interface RampProps {
  ramp: TableRules['betRamp']
  onChange: (r: TableRules['betRamp']) => void
  onReset: () => void
}

function BetRampEditor({ ramp, onChange, onReset }: RampProps) {
  const sorted = [...ramp].sort((a, b) => a.tc - b.tc)
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[80px_1fr_auto] gap-2 items-center">
        {sorted.map((entry, i) => (
          <RampRow
            key={i}
            entry={entry}
            onChange={(e) => {
              const copy = sorted.slice()
              copy[i] = e
              onChange(copy)
            }}
            onDelete={() => onChange(sorted.filter((_, idx) => idx !== i))}
          />
        ))}
      </div>
      <div className="flex gap-2">
        <button
          className="btn-ghost !py-1 !px-3 text-xs"
          onClick={() => onChange([...sorted, { tc: (sorted.at(-1)?.tc ?? 0) + 1, units: (sorted.at(-1)?.units ?? 1) + 2 }])}
        >
          + Nivel
        </button>
        <button className="btn-ghost !py-1 !px-3 text-xs" onClick={onReset}>Rampa por defecto</button>
      </div>
    </div>
  )
}

function RampRow({ entry, onChange, onDelete }: {
  entry: { tc: number; units: number }
  onChange: (e: { tc: number; units: number }) => void
  onDelete: () => void
}) {
  return (
    <>
      <div className="text-xs">
        TC ≥{' '}
        <input
          type="number"
          value={entry.tc}
          onChange={(e) => onChange({ ...entry, tc: parseInt(e.target.value || '0', 10) })}
          className="bg-black/40 rounded px-2 py-1 border border-white/10 w-16"
        />
      </div>
      <div className="text-xs flex items-center gap-2">
        Apostar
        <input
          type="number"
          min={1}
          value={entry.units}
          onChange={(e) => onChange({ ...entry, units: Math.max(1, parseInt(e.target.value || '1', 10)) })}
          className="bg-black/40 rounded px-2 py-1 border border-white/10 w-16"
        />
        unidades
      </div>
      <button className="btn-ghost !py-1 !px-2 text-[10px]" onClick={onDelete}>×</button>
    </>
  )
}
