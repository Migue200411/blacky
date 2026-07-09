import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/useStore'
import {
  doubleDown,
  forceNewShoe,
  hit,
  initGame,
  nextRound,
  reshuffleIfNeeded,
  split,
  stand,
  startRound,
  surrender,
  takeInsurance,
  type GameState
} from '../engine/game'
import { decksRemaining } from '../engine/deck'
import { trueCount } from '../engine/counting'
import { decideStrategy } from '../engine/strategy'
import { handTotal, isPair } from '../engine/hand'
import { recommendedBet } from '../engine/betting'
import { DealerHandView, PlayerHandView } from '../components/HandDisplay'
import { CountPanel } from '../components/CountPanel'
import { CountCheck } from '../components/CountCheck'
import { ActionBar } from '../components/ActionBar'
import { BetControls } from '../components/BetControls'
import { ResponsibleBanner } from '../components/ResponsibleBanner'
import type { Action, HandHistoryEntry } from '../types'

interface Props {
  examMode?: boolean
  onDecisionRecorded?: (correct: boolean) => void
  onHandRecorded?: (net: number) => void
}

export function SimulatorPage({ examMode, onDecisionRecorded, onHandRecorded }: Props = {}) {
  const rules = useStore((s) => s.rules)
  const storeShowCounts = useStore((s) => s.showCountsInSim)
  const setShowCounts = useStore((s) => s.setShowCountsInSim)
  const storeHelpMode = useStore((s) => s.helpMode)
  const setHelpMode = useStore((s) => s.setHelpMode)
  const recordDecision = useStore((s) => s.recordDecision)
  const recordHand = useStore((s) => s.recordHand)
  const recordCountingDrill = useStore((s) => s.recordCountingDrill)

  // In exam mode, all coaching aids are forced off.
  const showCounts = examMode ? false : storeShowCounts
  const helpMode = examMode ? false : storeHelpMode

  const [state, setState] = useState<GameState>(() => initGame(rules))
  const [feedback, setFeedback] = useState<string | null>(null)
  const [lastDecisionCorrect, setLastDecisionCorrect] = useState<boolean | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showBetPanel, setShowBetPanel] = useState(false)
  const roundDecisions = useRef({ total: 0, correct: 0 })
  // Track the rules signature we initialised the game with. If the user goes to
  // Config and edits mesa rules that materially affect the shoe, the sim
  // rebuilds on next render (only when phase='betting' so we don't blow up an
  // in-progress hand).
  const initSig = useRef(sigForRules(rules))
  const currentSig = sigForRules(rules)
  if (initSig.current !== currentSig && state.phase === 'betting') {
    initSig.current = currentSig
    setState(initGame(rules))
  }

  const decks = useMemo(() => decksRemaining(state.shoe), [state.shoe])
  const tc = useMemo(
    () => trueCount(state.runningCount, decks, rules.rounding),
    [state.runningCount, decks, rules.rounding]
  )
  const suggested = useMemo(
    () => recommendedBet(rules, tc, state.bankroll),
    [rules, tc, state.bankroll]
  )

  const currentHand = state.hands[state.activeHandIdx]
  const hasStarted = state.hands.length > 0 || state.phase !== 'betting'

  function handleAction(a: Action) {
    if (state.phase !== 'playerTurn') return
    const hand = state.hands[state.activeHandIdx]
    const dealerUp = state.dealer.cards[0]
    const decision = decideStrategy({
      hand,
      dealerUp,
      rules,
      trueCount: tc,
      splitsSoFar: state.splitsSoFar
    })
    const correct = a === decision.recommended
    setLastDecisionCorrect(correct)
    const category: 'hard' | 'soft' | 'pair' = (() => {
      if (isPair(hand.cards)) return 'pair'
      return handTotal(hand.cards).isSoft ? 'soft' : 'hard'
    })()
    if (a === 'R') recordDecision('surrender', correct)
    else if (decision.fromDeviation) recordDecision('deviation', correct)
    else recordDecision(category, correct)
    roundDecisions.current.total += 1
    if (correct) roundDecisions.current.correct += 1
    onDecisionRecorded?.(correct)

    if (examMode) {
      setFeedback(null)
    } else {
      setFeedback(
        (correct ? '✓ Correcto: ' : '✗ Deberías haber jugado ' + labelAction(decision.recommended) + '. ') +
        decision.explanation
      )
    }

    let next: GameState = state
    switch (a) {
      case 'H': next = hit(state); break
      case 'S': next = stand(state); break
      case 'D': next = doubleDown(state); break
      case 'P': next = split(state); break
      case 'R': next = surrender(state); break
      case 'I': break
    }
    setState(next)
    if (next.phase === 'roundOver') settleStats(next)
  }

  function handleBet(amount: number) {
    setFeedback(null)
    setLastDecisionCorrect(null)
    setShowBetPanel(false)
    const next = startRound(state, amount)
    setState(next)
    if (next.phase === 'roundOver') settleStats(next)
  }

  function handleQuickStart() {
    handleBet(Math.min(state.bankroll, Math.max(rules.minBet, suggested.bet)))
  }

  function handleInsurance(accept: boolean) {
    const next = takeInsurance(state, accept)
    setState(next)
    if (next.phase === 'roundOver') settleStats(next)
  }

  function handleNext() {
    setFeedback(null)
    setLastDecisionCorrect(null)
    const shuffled = reshuffleIfNeeded(state)
    setState(nextRound(shuffled))
  }

  function settleStats(finalState: GameState) {
    const dealerFinal = sum(finalState.dealer.cards.map((c) => cardVal(c.rank)))
    const ts = Date.now()
    let roundNet = 0
    for (const h of finalState.hands) {
      const playerFinal = sum(h.cards.map((c) => cardVal(c.rank)))
      const net = (h.payout ?? 0) - h.bet
      roundNet += net
      const entry: HandHistoryEntry = {
        timestamp: ts,
        playerFinal,
        dealerFinal,
        bet: h.bet,
        payout: h.payout ?? 0,
        result: h.result ?? 'lose',
        correctDecisions: roundDecisions.current.correct,
        totalDecisions: roundDecisions.current.total,
        wasBetCorrect: true
      }
      recordHand(entry)
    }
    onHandRecorded?.(roundNet)
    roundDecisions.current = { total: 0, correct: 0 }
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {!examMode && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="font-display text-3xl text-chip-gold">Simulador Automático</h1>
              <p className="text-white/70 text-sm">La app reparte y calcula. Tú decides la jugada.</p>
            </div>
            <Link to="/" className="btn-ghost">← Volver</Link>
          </div>
          <div className="rounded-lg border border-chip-gold/40 bg-chip-gold/5 text-xs text-white/85 px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              <strong>Modo:</strong>{' '}
              {rules.variant === 'american' ? 'Estadounidense' : 'Europeo'}
            </span>
            <span className="text-white/70">
              {rules.variant === 'american'
                ? 'Dealer con carta oculta.'
                : `Dealer sin carta oculta inicial.${rules.enhc ? ' ENHC activo.' : ' OBBO (sólo apuesta original).'}`}
            </span>
            <Link to="/configuracion" className="ml-auto underline text-chip-gold">Cambiar</Link>
          </div>
        </>
      )}

      {/* Compact status strip */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Metric label="Bankroll" value={`$${state.bankroll.toFixed(0)}`} highlight />
        <Metric label="Mano" value={state.hands.length ? `${state.activeHandIdx + 1}/${state.hands.length}` : '—'} />
        <Metric label="RC" value={showCounts ? fmtSigned(state.runningCount) : '••'} />
        <Metric label="TC" value={showCounts ? fmtSigned(tc) : '••'} />
      </section>

      {/* Main table */}
      <section className="card-panel p-4 space-y-4 bg-gradient-to-b from-felt to-felt-dark">
        <DealerHandView dealer={state.dealer} />

        <div className="space-y-2">
          {state.hands.length === 0 ? (
            <div className="text-center py-6 space-y-3">
              {state.bankroll >= rules.minBet ? (
                <>
                  <div className="text-white/70 text-sm">
                    ¿Listo para jugar? Empieza con la apuesta sugerida o elige la tuya.
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-md mx-auto">
                    <button className="btn-primary py-3" onClick={handleQuickStart}>
                      Empezar simulación rápida
                      <span className="ml-2 text-xs opacity-80">${suggested.bet}</span>
                    </button>
                    <button className="btn-secondary py-3" onClick={() => setShowBetPanel((v) => !v)}>
                      {showBetPanel ? 'Ocultar apuesta' : 'Elegir apuesta'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <div className="text-white/70 text-sm">Bankroll agotado.</div>
                  <button
                    className="btn-secondary"
                    onClick={() => { setFeedback(null); setState(initGame(rules)) }}
                  >
                    Reiniciar simulación
                  </button>
                </div>
              )}
            </div>
          ) : (
            state.hands.map((h, i) => (
              <PlayerHandView
                key={i}
                hand={h}
                active={state.phase === 'playerTurn' && state.activeHandIdx === i}
                label={state.hands.length > 1 ? `Mano ${i + 1}` : undefined}
              />
            ))
          )}
        </div>

        {state.phase === 'insurance' && (
          <div className="rounded-xl border border-chip-gold/50 bg-black/40 p-3 space-y-2">
            <div className="font-semibold">El dealer muestra un As. ¿Tomar seguro?</div>
            <div className="text-xs text-white/70">
              Cuesta la mitad de tu apuesta y paga 2:1. Recomendado sólo si TC ≥ +3.
              {showCounts && ` TC actual: ${tc}.`}
            </div>
            <div className="flex gap-2">
              <button className="btn-primary flex-1" onClick={() => handleInsurance(true)}>Tomar seguro</button>
              <button className="btn-secondary flex-1" onClick={() => handleInsurance(false)}>No, gracias</button>
            </div>
          </div>
        )}

        {state.phase === 'playerTurn' && currentHand && (
          <>
            <ActionBar
              hand={currentHand}
              rules={rules}
              splitsSoFar={state.splitsSoFar}
              onAction={handleAction}
            />
            {helpMode && <RecommendationHint state={state} tc={tc} />}
          </>
        )}

        {state.phase === 'roundOver' && (
          <div className="space-y-2">
            <div className={`rounded-xl border p-3 ${state.lastRoundNet > 0 ? 'border-emerald-400/40 bg-emerald-400/10' : state.lastRoundNet < 0 ? 'border-chip-red/40 bg-chip-red/10' : 'border-white/10 bg-white/5'}`}>
              <div className="text-sm">
                Resultado:{' '}
                <strong className="tabular-nums">
                  {state.lastRoundNet > 0 ? '+' : ''}{state.lastRoundNet.toFixed(0)}
                </strong>
              </div>
              {feedback && <div className="text-xs text-white/80 mt-1">{feedback}</div>}
            </div>
            <button className="btn-primary w-full" onClick={handleNext}>Nueva mano</button>
          </div>
        )}

        {feedback && state.phase !== 'roundOver' && !examMode && (
          <div className={`rounded-xl border p-3 text-sm ${lastDecisionCorrect ? 'border-emerald-400/40 bg-emerald-400/10' : 'border-chip-red/40 bg-chip-red/10'}`}>
            {feedback}
          </div>
        )}
      </section>

      {/* Bet panel — visible only when needed */}
      {state.phase === 'betting' && showBetPanel && state.bankroll >= rules.minBet && (
        <BetControls
          rules={rules}
          bankroll={state.bankroll}
          suggestedBet={suggested.bet}
          onBet={handleBet}
          warning={suggested.warning}
        />
      )}

      {/* Shoe warning */}
      {state.shoe.needsShuffle && (
        <div className="card-panel p-3 text-xs text-chip-gold">
          El zapato llegó al corte. Se barajará antes de la próxima mano.
        </div>
      )}

      {/* Bottom controls */}
      <section className="flex flex-wrap gap-2">
        <button
          className="btn-ghost text-xs"
          disabled={state.phase !== 'betting' && state.phase !== 'roundOver'}
          onClick={() => {
            if (!confirm('Nuevo zapato: reinicia el conteo. ¿Continuar?')) return
            setFeedback(null); setLastDecisionCorrect(null)
            setState((prev) => forceNewShoe(prev))
          }}
        >
          Nuevo zapato
        </button>
        <button
          className="btn-ghost text-xs"
          onClick={() => {
            if (!confirm('Reiniciar simulación: se pierde bankroll y se baraja un nuevo zapato. ¿Continuar?')) return
            setFeedback(null); setLastDecisionCorrect(null)
            setState(initGame(rules))
          }}
        >
          Reiniciar todo
        </button>
        <button className="btn-ghost text-xs ml-auto" onClick={() => setShowAdvanced((v) => !v)}>
          {showAdvanced ? 'Ocultar opciones' : 'Ver opciones'}
        </button>
      </section>

      {/* Advanced options (collapsed by default) */}
      {showAdvanced && !examMode && (
        <>
          <section className="card-panel p-4 space-y-3">
            <div className="font-display text-lg text-chip-gold">Opciones</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={showCounts} onChange={(e) => setShowCounts(e.target.checked)} className="accent-chip-gold" />
                Mostrar conteo en pantalla
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={helpMode} onChange={(e) => setHelpMode(e.target.checked)} className="accent-chip-gold" />
                Modo ayuda (sugerencia durante mano)
              </label>
              <Link to="/configuracion" className="btn-ghost !py-1 !px-3 text-xs w-fit">Configuración avanzada de reglas</Link>
            </div>
          </section>

          <div className="grid md:grid-cols-2 gap-3">
            <CountPanel running={state.runningCount} shoe={state.shoe} hidden={!showCounts} rounding={rules.rounding} />
            {!showCounts && hasStarted && (
              <CountCheck
                realRC={state.runningCount}
                onSubmit={(_g, correct, err) => recordCountingDrill(correct, err)}
              />
            )}
          </div>
        </>
      )}

      {!examMode && <ResponsibleBanner compact />}
    </div>
  )
}

function RecommendationHint({ state, tc }: { state: GameState; tc: number }) {
  const rules = useStore((s) => s.rules)
  const hand = state.hands[state.activeHandIdx]
  if (!hand) return null
  const decision = decideStrategy({
    hand,
    dealerUp: state.dealer.cards[0],
    rules,
    trueCount: tc,
    splitsSoFar: state.splitsSoFar
  })
  return (
    <div className="rounded-xl border border-chip-gold/40 bg-chip-gold/5 p-3 text-xs">
      <span className="font-semibold text-chip-gold">Sugerencia:</span>{' '}
      {labelAction(decision.recommended)}
      {decision.fromDeviation && ' (desviación por conteo)'}
      <div className="text-white/70 mt-1">{decision.explanation}</div>
    </div>
  )
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-2 ${highlight ? 'border-chip-gold/50 bg-chip-gold/10' : 'border-white/10 bg-black/30'}`}>
      <div className="label">{label}</div>
      <div className="text-xl font-display tabular-nums">{value}</div>
    </div>
  )
}

function fmtSigned(n: number): string {
  return n > 0 ? `+${n}` : String(n)
}

function labelAction(a: Action): string {
  return { H: 'Pedir', S: 'Plantarse', D: 'Doblar', P: 'Dividir', R: 'Rendirse', I: 'Seguro' }[a]
}

function sigForRules(r: { decks: number; penetration: number; bankroll: number }): string {
  return `${r.decks}-${r.penetration}-${r.bankroll}`
}

function cardVal(rank: string): number {
  if (rank === 'A') return 11
  if (rank === 'J' || rank === 'Q' || rank === 'K' || rank === '10') return 10
  return parseInt(rank, 10)
}

function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0)
}
