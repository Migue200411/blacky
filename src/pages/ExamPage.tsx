import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { PlayingCard } from '../components/PlayingCard'
import { decideStrategy } from '../engine/strategy'
import { handTotal, newHand } from '../engine/hand'
import { runningCountFromCards, trueCount as computeTC } from '../engine/counting'
import { buildShoe, drawCard } from '../engine/deck'
import { DEFAULT_RULES } from '../data/defaults'
import type { Action, Card, Rank, Rounding, Suit } from '../types'

type ExamMode = 'basic-strategy' | 'running-count' | 'true-count' | 'mixed'

interface Question {
  id: string
  type: 'basic-strategy' | 'running-count' | 'true-count'
  prompt: string
  playerHand?: Card[]
  dealerUpcard?: Card
  cardsSequence?: Card[]
  runningCount?: number
  decksRemaining?: number
  rounding?: Rounding
  options?: string[]
  correctAnswer: string | number
  explanation: string
}

interface Answer {
  question: Question
  userAnswer: string | number | null
  correct: boolean
}

const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10']
const SUITS: Suit[] = ['♠', '♥', '♦', '♣']
let seq = 0
function rnd(n: number): number {
  const a = new Uint32Array(1); globalThis.crypto.getRandomValues(a); return a[0] % n
}
function id(): string { return `q${++seq}` }
function card(rank: Rank): Card {
  return { rank, suit: SUITS[rnd(4)], id: `${id()}` }
}

function makeStrategyQuestion(): Question {
  const kind = rnd(3) // 0 hard, 1 soft, 2 pair
  let cards: Card[]
  if (kind === 2) {
    const r = RANKS[rnd(RANKS.length)]
    cards = [card(r), card(r)]
  } else if (kind === 1) {
    const other = RANKS[1 + rnd(9)]
    cards = [card('A'), card(other)]
  } else {
    while (true) {
      const a = RANKS[1 + rnd(9)]
      const b = RANKS[1 + rnd(9)]
      if (a === b) continue
      const va = a === '10' ? 10 : parseInt(a, 10)
      const vb = b === '10' ? 10 : parseInt(b, 10)
      const total = va + vb
      if (total < 5 || total > 20) continue
      cards = [card(a), card(b)]
      break
    }
  }
  const dealerRank = RANKS[rnd(RANKS.length)]
  const dealer = card(dealerRank)

  // Compute the correct action via the strategy engine (basic strategy, no deviations).
  const rules = defaultRulesForExam()
  const decision = decideStrategy({
    hand: newHand(cards!, rules.unit),
    dealerUp: dealer,
    rules,
    trueCount: 0,
    splitsSoFar: 0
  })

  return {
    id: id(),
    type: 'basic-strategy',
    prompt: '¿Cuál es la jugada correcta según estrategia básica?',
    playerHand: cards!,
    dealerUpcard: dealer,
    options: ['H', 'S', 'D', 'P', 'R'],
    correctAnswer: decision.basic,
    explanation: decision.explanation
  }
}

function makeRunningCountQuestion(): Question {
  const totalCards = 8 + rnd(20) // 8..27 cards
  let shoe = buildShoe(6, 0.75)
  const cards: Card[] = []
  for (let i = 0; i < totalCards; i++) {
    const r = drawCard(shoe); shoe = r.shoe; cards.push(r.card)
  }
  const correct = runningCountFromCards(cards, 'HiLo')
  return {
    id: id(),
    type: 'running-count',
    prompt: 'Después de ver esta secuencia, ¿cuál es el running count Hi-Lo final?',
    cardsSequence: cards,
    correctAnswer: correct,
    explanation: `Sumando cada carta Hi-Lo (2-6 = +1, 7-9 = 0, 10-A = -1) el running count es ${correct}.`
  }
}

function makeTrueCountQuestion(rounding: Rounding = 'floor'): Question {
  const rc = (rnd(21) - 10) // -10..+10
  const half = (rnd(12) + 1) / 2 // 0.5..6.0
  const correct = computeTC(rc, half, rounding)
  return {
    id: id(),
    type: 'true-count',
    prompt: `Con Running Count ${rc >= 0 ? '+' + rc : rc} y ${half.toFixed(1)} mazos restantes, ¿cuál es el true count (redondeo ${rounding})?`,
    runningCount: rc,
    decksRemaining: half,
    rounding,
    correctAnswer: correct,
    explanation: `TC = ${rc} ÷ ${half.toFixed(1)} = ${(rc / half).toFixed(2)} → ${rounding} → ${correct}.`
  }
}

function defaultRulesForExam() {
  // Exams use standard 6-deck S17 DAS Late so correct answers are consistent
  // regardless of the user's mesa config.
  return DEFAULT_RULES
}

function buildQuestions(mode: ExamMode, count: number, rounding: Rounding): Question[] {
  const arr: Question[] = []
  for (let i = 0; i < count; i++) {
    if (mode === 'basic-strategy') arr.push(makeStrategyQuestion())
    else if (mode === 'running-count') arr.push(makeRunningCountQuestion())
    else if (mode === 'true-count') arr.push(makeTrueCountQuestion(rounding))
    else {
      const r = i % 3
      if (r === 0) arr.push(makeStrategyQuestion())
      else if (r === 1) arr.push(makeRunningCountQuestion())
      else arr.push(makeTrueCountQuestion(rounding))
    }
  }
  return arr
}

const MODE_LABEL: Record<ExamMode, string> = {
  'basic-strategy': 'Estrategia básica',
  'running-count': 'Conteo Hi-Lo (RC)',
  'true-count': 'True Count',
  'mixed': 'Mixto'
}

export function ExamPage() {
  const rules = useStore((s) => s.rules)
  const recordDecision = useStore((s) => s.recordDecision)
  const recordCountingDrill = useStore((s) => s.recordCountingDrill)
  const recordTrueCountDrill = useStore((s) => s.recordTrueCountDrill)

  const [mode, setMode] = useState<ExamMode>('basic-strategy')
  const [count, setCount] = useState(10)
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Answer[]>([])
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<'setup' | 'question' | 'reviewing' | 'finished'>('setup')
  const [current, setCurrent] = useState<Answer | null>(null)
  const [textInput, setTextInput] = useState('')

  function start() {
    const qs = buildQuestions(mode, count, rules.rounding)
    setQuestions(qs)
    setAnswers([])
    setIndex(0)
    setCurrent(null)
    setTextInput('')
    setPhase('question')
  }

  function submit(userAnswer: string | number) {
    const q = questions[index]
    if (!q) return
    const correct = String(userAnswer) === String(q.correctAnswer)
    const ans: Answer = { question: q, userAnswer, correct }
    setAnswers((prev) => [...prev, ans])
    setCurrent(ans)
    setPhase('reviewing')
    // Track globally
    if (q.type === 'basic-strategy') {
      recordDecision(inferCategory(q), correct)
    } else if (q.type === 'running-count') {
      recordCountingDrill(correct, Number(userAnswer) - Number(q.correctAnswer))
    } else if (q.type === 'true-count') {
      recordTrueCountDrill(correct, Number(userAnswer) - Number(q.correctAnswer))
    }
  }

  function next() {
    setCurrent(null)
    setTextInput('')
    if (index + 1 >= questions.length) {
      setPhase('finished')
    } else {
      setIndex(index + 1)
      setPhase('question')
    }
  }

  function retry() {
    start()
  }

  function backToMenu() {
    setPhase('setup')
    setQuestions([])
    setAnswers([])
    setIndex(0)
    setCurrent(null)
  }

  if (phase === 'setup') {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div>
          <h1 className="font-display text-3xl text-chip-gold">Exámenes</h1>
          <p className="text-white/70 text-sm">Evalúa lo que has aprendido con preguntas de estrategia, conteo y true count.</p>
        </div>

        <section className="card-panel p-4 space-y-3">
          <div>
            <div className="label mb-2">Tipo de examen</div>
            <div className="grid grid-cols-2 gap-2">
              {(['basic-strategy', 'running-count', 'true-count', 'mixed'] as ExamMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`text-left p-3 rounded-lg border ${mode === m ? 'border-chip-gold bg-chip-gold/10' : 'border-white/10 hover:bg-white/5'}`}
                >
                  <div className="font-semibold">{MODE_LABEL[m]}</div>
                  <div className="text-[11px] text-white/60 mt-1">
                    {m === 'basic-strategy' && 'Elige la jugada correcta ante distintas manos y upcards.'}
                    {m === 'running-count' && 'Ve una secuencia de cartas y escribe el running count.'}
                    {m === 'true-count' && 'Convierte RC a true count con mazos restantes.'}
                    {m === 'mixed' && 'Combinación de los tres tipos anteriores.'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <span>Número de preguntas:</span>
            <input
              type="number"
              min={5}
              max={50}
              value={count}
              onChange={(e) => setCount(Math.max(5, Math.min(50, parseInt(e.target.value || '10', 10))))}
              className="bg-black/40 rounded px-2 py-1 border border-white/10 w-20"
            />
          </div>

          <button className="btn-primary w-full" onClick={start}>Iniciar examen</button>
          <div className="text-[11px] text-white/50">
            Los exámenes usan reglas estándar 6-mazos, S17, DAS, late surrender. Tu progreso se guarda en las estadísticas.
          </div>
        </section>

        <div className="flex justify-between">
          <Link to="/" className="btn-ghost">← Volver al inicio</Link>
        </div>
      </div>
    )
  }

  if (phase === 'finished') {
    const total = answers.length
    const correct = answers.filter((a) => a.correct).length
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0
    const grade = pct >= 95 ? 'A' : pct >= 85 ? 'B' : pct >= 70 ? 'C' : pct >= 55 ? 'D' : 'F'
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="font-display text-3xl text-chip-gold">Resultado final</h1>
        <div className="card-panel p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="label">Nota</div>
              <div className={`text-6xl font-display ${pct >= 85 ? 'text-emerald-400' : pct >= 70 ? 'text-chip-gold' : pct >= 55 ? 'text-yellow-300' : 'text-chip-red'}`}>
                {grade}
              </div>
            </div>
            <div className="text-right">
              <div className="label">Precisión</div>
              <div className="text-3xl font-display tabular-nums">{pct}%</div>
              <div className="text-[11px] text-white/60">{correct}/{total}</div>
            </div>
          </div>
          <div className="border-t border-white/10 pt-3 space-y-1 max-h-72 overflow-y-auto">
            {answers.map((a, i) => (
              <div key={a.question.id} className="flex items-start gap-2 text-xs">
                <span className={`mt-0.5 ${a.correct ? 'text-emerald-400' : 'text-chip-red'}`}>
                  {a.correct ? '✓' : '✗'}
                </span>
                <div className="flex-1">
                  <span className="text-white/70">{i + 1}.</span>{' '}
                  <span>{summaryOf(a.question)}</span>{' '}
                  <span className="text-white/50">Correcto: {a.question.correctAnswer}. Tu respuesta: {a.userAnswer ?? '—'}.</span>
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-secondary" onClick={backToMenu}>Volver al menú</button>
            <button className="btn-primary" onClick={retry}>Reintentar</button>
          </div>
        </div>
      </div>
    )
  }

  const q = questions[index]
  if (!q) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 text-center">
        <p className="text-white/70">No hay preguntas cargadas.</p>
        <button className="btn-primary" onClick={start}>Volver a intentar</button>
      </div>
    )
  }

  const progress = Math.round((index / questions.length) * 100)
  const scoreSoFar = answers.filter((a) => a.correct).length

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="card-panel p-3 sticky top-16 z-20">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div>
            {MODE_LABEL[mode]} · Pregunta <strong>{index + 1}</strong> de {questions.length}
          </div>
          <div>Puntaje: <strong className="tabular-nums">{scoreSoFar}/{answers.length}</strong></div>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full bg-chip-gold" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {phase === 'question' && (
        <QuestionView
          question={q}
          textInput={textInput}
          setTextInput={setTextInput}
          onAnswer={submit}
        />
      )}

      {phase === 'reviewing' && current && (
        <div className={`card-panel p-4 space-y-3 ${current.correct ? 'border border-emerald-400/40' : 'border border-chip-red/40'}`}>
          <div className="text-lg font-semibold">
            {current.correct ? '✓ Correcto' : '✗ Incorrecto'}
          </div>
          <div className="text-sm">
            Respuesta correcta: <strong>{current.question.correctAnswer}</strong>. Tu respuesta: <strong>{current.userAnswer ?? '—'}</strong>.
          </div>
          <div className="text-xs text-white/75 leading-relaxed">{current.question.explanation}</div>
          <button className="btn-primary w-full" onClick={next}>
            {index + 1 >= questions.length ? 'Ver resultado' : 'Siguiente pregunta'}
          </button>
        </div>
      )}

      <div className="flex justify-between">
        <button className="btn-ghost text-xs" onClick={backToMenu}>Volver al menú</button>
        {phase === 'question' && (
          <button className="btn-ghost text-xs" onClick={() => submit('')}>Saltar</button>
        )}
      </div>
    </div>
  )
}

interface QuestionViewProps {
  question: Question
  textInput: string
  setTextInput: (s: string) => void
  onAnswer: (v: string | number) => void
}

function QuestionView({ question, textInput, setTextInput, onAnswer }: QuestionViewProps) {
  const [seqIndex, setSeqIndex] = useState(0)
  const [seqDone, setSeqDone] = useState(false)

  // Auto-play card sequences for running-count questions.
  useEffect(() => {
    if (question.type !== 'running-count') return
    setSeqIndex(0)
    setSeqDone(false)
    const total = question.cardsSequence?.length ?? 0
    let i = 0
    const timer = window.setInterval(() => {
      i++
      setSeqIndex(i)
      if (i >= total) {
        clearInterval(timer)
        setSeqDone(true)
      }
    }, 600)
    return () => clearInterval(timer)
  }, [question.id, question.type])

  if (question.type === 'basic-strategy') {
    return (
      <div className="card-panel p-4 space-y-4">
        <div className="text-sm">{question.prompt}</div>
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="label mb-1">Dealer muestra</div>
            <div className="flex justify-center">
              {question.dealerUpcard && <PlayingCard card={question.dealerUpcard} />}
            </div>
          </div>
          <div>
            <div className="label mb-1">Tu mano</div>
            <div className="flex justify-center gap-1">
              {question.playerHand?.map((c) => (
                <PlayingCard key={c.id} card={c} small />
              ))}
            </div>
            {question.playerHand && (
              <div className="text-xs text-white/60 mt-1">
                Total: {handTotal(question.playerHand).value}{handTotal(question.playerHand).isSoft ? ' (soft)' : ''}
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {(question.options ?? []).map((opt) => (
            <button
              key={opt}
              className={opt === 'D' || opt === 'P' ? 'btn-primary' : opt === 'R' ? 'btn-danger' : 'btn-secondary'}
              onClick={() => onAnswer(opt)}
            >
              {labelAction(opt as Action)}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (question.type === 'running-count') {
    const total = question.cardsSequence?.length ?? 0
    const currentCard = question.cardsSequence?.[seqIndex - 1]
    return (
      <div className="card-panel p-4 space-y-4">
        <div className="text-sm">{question.prompt}</div>
        <div className="text-center min-h-[140px] flex flex-col items-center justify-center">
          {!seqDone && currentCard && <PlayingCard card={currentCard} />}
          {!seqDone && !currentCard && <div className="text-white/50 text-xs">Prepárate…</div>}
          {seqDone && <div className="text-chip-gold text-sm">Secuencia terminada. Escribe el running count.</div>}
          <div className="text-[11px] text-white/50 mt-2">Cartas mostradas: {Math.min(seqIndex, total)}/{total}</div>
        </div>
        {seqDone && (
          <>
            <input
              autoFocus
              type="number"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && textInput !== '' && onAnswer(parseInt(textInput, 10))}
              className="w-full text-2xl text-center bg-black/40 rounded-lg border border-white/10 py-3 tabular-nums"
              placeholder="Running count"
            />
            <button
              className="btn-primary w-full"
              disabled={textInput === ''}
              onClick={() => onAnswer(parseInt(textInput, 10))}
            >
              Verificar
            </button>
          </>
        )}
      </div>
    )
  }

  // true-count
  return (
    <div className="card-panel p-4 space-y-4">
      <div className="text-sm">{question.prompt}</div>
      <div className="grid grid-cols-2 gap-3 text-center">
        <Stat label="Running count" value={question.runningCount! > 0 ? `+${question.runningCount}` : String(question.runningCount)} />
        <Stat label="Mazos restantes" value={question.decksRemaining!.toFixed(1)} />
      </div>
      <input
        autoFocus
        type="number"
        value={textInput}
        onChange={(e) => setTextInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && textInput !== '' && onAnswer(parseInt(textInput, 10))}
        className="w-full text-2xl text-center bg-black/40 rounded-lg border border-white/10 py-3 tabular-nums"
        placeholder="True count"
      />
      <button
        className="btn-primary w-full"
        disabled={textInput === ''}
        onClick={() => onAnswer(parseInt(textInput, 10))}
      >
        Verificar
      </button>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg p-3 border border-white/10 bg-black/40">
      <div className="label">{label}</div>
      <div className="text-3xl font-display tabular-nums">{value}</div>
    </div>
  )
}

function inferCategory(q: Question): 'hard' | 'soft' | 'pair' {
  if (!q.playerHand) return 'hard'
  if (q.playerHand.length === 2 && q.playerHand[0].rank === q.playerHand[1].rank) return 'pair'
  return handTotal(q.playerHand).isSoft ? 'soft' : 'hard'
}

function labelAction(a: Action): string {
  return { H: 'Pedir', S: 'Plantarse', D: 'Doblar', P: 'Dividir', R: 'Rendirse', I: 'Seguro' }[a]
}

function summaryOf(q: Question): string {
  if (q.type === 'basic-strategy') {
    const h = q.playerHand ?? []
    const cards = h.map(c => c.rank).join('-')
    const up = q.dealerUpcard?.rank ?? '?'
    return `${cards} vs ${up}`
  }
  if (q.type === 'running-count') {
    return `RC de ${q.cardsSequence?.length ?? 0} cartas`
  }
  return `TC de RC ${q.runningCount} ÷ ${q.decksRemaining?.toFixed(1)} mazos`
}
