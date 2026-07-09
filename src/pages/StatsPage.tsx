import { useStore, userLevel } from '../store/useStore'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Legend } from 'recharts'
import { useMemo } from 'react'
import type { UserStats } from '../types'

export function StatsPage() {
  const stats = useStore((s) => s.stats)
  const resetStats = useStore((s) => s.resetStats)
  const startSession = useStore((s) => s.startSession)

  const { level, progress } = userLevel(stats)

  const netSeries = useMemo(() => {
    let cum = 0
    return stats.history.map((h, i) => {
      cum += h.payout - h.bet
      return { i, net: Math.round(cum), bet: h.bet }
    })
  }, [stats.history])

  const decisionsData = useMemo(() => {
    return Object.entries(stats.decisions.byCategory).map(([k, v]) => ({
      category: k,
      accuracy: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0,
      total: v.total
    }))
  }, [stats.decisions])

  const decisionAcc = stats.decisions.total > 0 ? (stats.decisions.correct / stats.decisions.total) * 100 : 0
  const countingAcc = stats.counting.drills > 0 ? (stats.counting.correct / stats.counting.drills) * 100 : 0
  const tcAcc = stats.trueCount.drills > 0 ? (stats.trueCount.correct / stats.trueCount.drills) * 100 : 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <h1 className="font-display text-3xl text-chip-gold">Estadísticas</h1>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={startSession}>Nueva sesión</button>
          <button className="btn-danger" onClick={() => confirm('¿Reiniciar todas las estadísticas?') && resetStats()}>Reiniciar</button>
        </div>
      </div>

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Nivel" value={level} sub={`${Math.round(progress * 100)}% del máximo`} />
        <MetricCard label="Manos jugadas" value={String(stats.handsPlayed)} sub={`${stats.handsWon}W · ${stats.handsLost}L · ${stats.handsPushed}P`} />
        <MetricCard label="Precisión decisiones" value={`${decisionAcc.toFixed(1)}%`} sub={`${stats.decisions.correct}/${stats.decisions.total}`} />
        <MetricCard label="Ganancia simulada" value={`${stats.totalNet >= 0 ? '+' : ''}${stats.totalNet.toFixed(0)}`} sub={`Sesión actual: ${stats.currentSession >= 0 ? '+' : ''}${stats.currentSession.toFixed(0)}`} />
      </section>

      <section className="grid md:grid-cols-2 gap-3">
        <div className="card-panel p-4">
          <div className="font-display text-lg mb-2">Ganancia acumulada</div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={netSeries.length ? netSeries : [{ i: 0, net: 0 }]}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="i" stroke="rgba(255,255,255,0.4)" fontSize={10} />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} />
                <Tooltip contentStyle={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)' }} />
                <Line dataKey="net" stroke="#d4a83c" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-panel p-4">
          <div className="font-display text-lg mb-2">Precisión por categoría</div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={decisionsData}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="category" stroke="rgba(255,255,255,0.4)" fontSize={10} />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)' }} />
                <Legend />
                <Bar dataKey="accuracy" fill="#d4a83c" name="Precisión %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Mayor subida" value={`+${stats.biggestWin.toFixed(0)}`} />
        <MetricCard label="Mayor caída" value={`${stats.biggestLoss.toFixed(0)}`} />
        <MetricCard label="Mejor sesión" value={`${stats.bestSession >= 0 ? '+' : ''}${stats.bestSession.toFixed(0)}`} />
        <MetricCard label="Peor sesión" value={`${stats.worstSession.toFixed(0)}`} />
        <MetricCard label="Conteo · precisión" value={`${countingAcc.toFixed(1)}%`} sub={`${stats.counting.drills} drills`} />
        <MetricCard label="Conteo · error medio" value={stats.counting.drills > 0 ? (stats.counting.totalError / stats.counting.drills).toFixed(2) : '—'} />
        <MetricCard label="True Count · precisión" value={`${tcAcc.toFixed(1)}%`} sub={`${stats.trueCount.drills} drills`} />
        <MetricCard label="True Count · error medio" value={stats.trueCount.drills > 0 ? (stats.trueCount.totalError / stats.trueCount.drills).toFixed(2) : '—'} />
      </section>

      <ErrorAnalysis stats={stats} />

      <RecentHands stats={stats} />
    </div>
  )
}

function ErrorAnalysis({ stats }: { stats: UserStats }) {
  const cats = Object.entries(stats.decisions.byCategory)
  const weakest = cats
    .filter(([, v]) => v.total >= 5)
    .map(([k, v]) => ({ k, acc: v.correct / v.total, total: v.total }))
    .sort((a, b) => a.acc - b.acc)
    .slice(0, 3)

  const rolling = useMemo(() => {
    const window = 25
    const arr = stats.history.slice(-100)
    return arr.map((h, i) => {
      const start = Math.max(0, i - window + 1)
      const slice = arr.slice(start, i + 1)
      const tot = slice.reduce((s, x) => s + x.totalDecisions, 0)
      const cor = slice.reduce((s, x) => s + x.correctDecisions, 0)
      return { i, acc: tot > 0 ? Math.round((cor / tot) * 100) : 0 }
    })
  }, [stats.history])

  return (
    <section className="card-panel p-4 space-y-3">
      <div className="font-display text-lg">Análisis avanzado de errores</div>
      {stats.decisions.total < 20 ? (
        <div className="text-sm text-white/60">
          Juega o entrena unas 20 decisiones más para ver un análisis fiable.
        </div>
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="label mb-2">Categorías donde más fallas</div>
              {weakest.length === 0 ? (
                <div className="text-sm text-white/60">Aún no hay suficientes datos por categoría.</div>
              ) : (
                <ul className="space-y-1 text-sm">
                  {weakest.map((w) => (
                    <li key={w.k} className="flex justify-between border-b border-white/5 py-1">
                      <span className="capitalize">{translateCat(w.k)}</span>
                      <span className="tabular-nums">
                        <strong className={w.acc < 0.6 ? 'text-chip-red' : 'text-chip-gold'}>
                          {(w.acc * 100).toFixed(0)}%
                        </strong>
                        <span className="text-white/50 text-xs ml-2">({w.total})</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {weakest.length > 0 && (
                <p className="text-[11px] text-white/60 mt-2">
                  Vuelve al{' '}
                  <a href="/entrenar/estrategia" className="underline text-chip-gold">entrenador de estrategia</a>{' '}
                  y filtra por esta categoría hasta subir tu precisión.
                </p>
              )}
            </div>
            <div>
              <div className="label mb-2">Precisión reciente (ventana de 25 manos)</div>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={rolling.length ? rolling : [{ i: 0, acc: 0 }]}>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="i" stroke="rgba(255,255,255,0.4)" fontSize={10} />
                    <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} domain={[0, 100]} />
                    <Tooltip contentStyle={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)' }} />
                    <Line dataKey="acc" stroke="#d4a83c" strokeWidth={2} dot={false} name="Precisión %" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

function RecentHands({ stats }: { stats: UserStats }) {
  const last = stats.history.slice(-15).reverse()
  return (
    <section className="card-panel p-4 space-y-3">
      <div className="font-display text-lg">Últimas manos</div>
      {last.length === 0 ? (
        <div className="text-sm text-white/60">Aún no hay historial. Juega el simulador o el modo examen.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-white/60">
              <tr>
                <th className="text-left py-1">#</th>
                <th className="text-left py-1">Resultado</th>
                <th className="text-right py-1">Apuesta</th>
                <th className="text-right py-1">Pago</th>
                <th className="text-right py-1">Neto</th>
                <th className="text-right py-1">Decisiones</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {last.map((h, i) => {
                const net = h.payout - h.bet
                return (
                  <tr key={h.timestamp + '-' + i} className="border-t border-white/5">
                    <td className="py-1 text-white/50">{stats.history.length - i}</td>
                    <td className="py-1">{resultLabel(h.result)}</td>
                    <td className="py-1 text-right">{h.bet}</td>
                    <td className="py-1 text-right">{h.payout.toFixed(0)}</td>
                    <td className={`py-1 text-right ${net > 0 ? 'text-emerald-400' : net < 0 ? 'text-chip-red' : 'text-white/70'}`}>
                      {net >= 0 ? '+' : ''}{net.toFixed(0)}
                    </td>
                    <td className="py-1 text-right">
                      {h.totalDecisions > 0 ? `${h.correctDecisions}/${h.totalDecisions}` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function translateCat(k: string): string {
  return {
    hard: 'Hard totals', soft: 'Soft totals', pair: 'Pairs',
    surrender: 'Surrender', insurance: 'Insurance', deviation: 'Deviations'
  }[k] ?? k
}

function resultLabel(r: string): string {
  return { win: 'Ganada', lose: 'Perdida', push: 'Empate', blackjack: 'Blackjack',
    surrender: 'Rendida', bust: 'Bust', dealerBust: 'Ganada (dealer bust)' }[r] ?? r
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card-panel p-4">
      <div className="label">{label}</div>
      <div className="text-2xl font-display tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-white/60">{sub}</div>}
    </div>
  )
}
