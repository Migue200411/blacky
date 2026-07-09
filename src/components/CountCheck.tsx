import { useState } from 'react'

interface Props {
  realRC: number
  onSubmit?: (userRC: number, correct: boolean, error: number) => void
}

export function CountCheck({ realRC, onSubmit }: Props) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [feedback, setFeedback] = useState<null | { correct: boolean; diff: number }>(null)

  function submit() {
    const guess = parseInt(value || '0', 10)
    const diff = guess - realRC
    const correct = diff === 0
    setFeedback({ correct, diff })
    onSubmit?.(guess, correct, diff)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="btn-ghost !py-1 !px-3 w-full text-xs"
      >
        Verificar mi conteo (RC oculto)
      </button>
    )
  }

  return (
    <div className="rounded-lg border border-white/10 bg-black/40 p-3 space-y-2">
      <div className="text-xs text-white/70">¿Cuál crees que es el running count actual?</div>
      {feedback ? (
        <div className={`text-sm ${feedback.correct ? 'text-emerald-400' : 'text-chip-red'}`}>
          {feedback.correct
            ? `¡Exacto! RC = ${realRC}.`
            : `El RC real es ${realRC}. Tu diferencia: ${feedback.diff > 0 ? '+' : ''}${feedback.diff}.`}
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            autoFocus
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            className="flex-1 bg-black/40 rounded px-3 py-1.5 border border-white/10 tabular-nums"
            placeholder="RC"
          />
          <button className="btn-primary !py-1.5 !px-3" onClick={submit}>Verificar</button>
        </div>
      )}
      <button className="text-[10px] text-white/50 underline" onClick={() => { setOpen(false); setFeedback(null); setValue('') }}>
        cerrar
      </button>
    </div>
  )
}
