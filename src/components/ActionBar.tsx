import type { Action, HandState, TableRules } from '../types'
import { actionAvailable } from '../engine/strategy'

interface Props {
  hand: HandState
  rules: TableRules
  splitsSoFar: number
  onAction: (a: Action) => void
  disabled?: boolean
}

const ACTIONS: { key: Action; label: string; className: string; shortcut: string }[] = [
  { key: 'H', label: 'Pedir', className: 'btn-secondary', shortcut: 'H' },
  { key: 'S', label: 'Plantarse', className: 'btn-secondary', shortcut: 'S' },
  { key: 'D', label: 'Doblar', className: 'btn-primary', shortcut: 'D' },
  { key: 'P', label: 'Dividir', className: 'btn-primary', shortcut: 'P' },
  { key: 'R', label: 'Rendirse', className: 'btn-danger', shortcut: 'R' }
]

export function ActionBar({ hand, rules, splitsSoFar, onAction, disabled }: Props) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
      {ACTIONS.map((a) => {
        const avail = !disabled && actionAvailable(a.key, hand, rules, splitsSoFar)
        return (
          <button
            key={a.key}
            className={a.className}
            disabled={!avail}
            onClick={() => onAction(a.key)}
          >
            <span>{a.label}</span>
            <span className="kbd hidden sm:inline">{a.shortcut}</span>
          </button>
        )
      })}
    </div>
  )
}
