import type { DealerState, HandState } from '../types'
import { handTotal } from '../engine/hand'
import { PlayingCard } from './PlayingCard'

interface PlayerProps {
  hand: HandState
  active?: boolean
  label?: string
}

export function PlayerHandView({ hand, active, label }: PlayerProps) {
  const t = handTotal(hand.cards)
  return (
    <div className={`p-3 rounded-2xl border transition ${active ? 'border-chip-gold shadow-lg shadow-yellow-500/10' : 'border-white/10'} bg-black/25`}>
      {label && <div className="text-[10px] uppercase tracking-widest text-white/50 mb-1">{label}</div>}
      <div className="flex gap-1 sm:gap-2 min-h-[6rem]">
        {hand.cards.map((c) => (
          <PlayingCard key={c.id} card={c} />
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs">
        <span className="px-2 py-0.5 rounded bg-white/10">
          Total: <strong className={t.isBust ? 'text-chip-red' : 'text-white'}>{t.value}</strong>{t.isSoft && !t.isBust ? ' (suave)' : ''}
        </span>
        <span className="px-2 py-0.5 rounded bg-white/10">Apuesta: {hand.bet}</span>
        {hand.doubled && <span className="px-2 py-0.5 rounded bg-chip-gold text-neutral-900">Doblada</span>}
        {hand.blackjack && <span className="px-2 py-0.5 rounded bg-chip-gold text-neutral-900">Blackjack</span>}
        {hand.surrendered && <span className="px-2 py-0.5 rounded bg-chip-red">Rendida</span>}
        {hand.busted && <span className="px-2 py-0.5 rounded bg-chip-red">Bust</span>}
        {hand.result && (
          <span className="px-2 py-0.5 rounded bg-black/60 border border-white/15">
            {resultLabel(hand.result)} {hand.payout !== undefined ? `· pago ${hand.payout.toFixed(0)}` : ''}
          </span>
        )}
      </div>
    </div>
  )
}

function resultLabel(r: string) {
  const m: Record<string, string> = {
    win: 'Ganada', lose: 'Perdida', push: 'Empate',
    blackjack: 'Blackjack', surrender: 'Rendida',
    bust: 'Bust', dealerBust: 'Ganada (dealer bust)'
  }
  return m[r] ?? r
}

interface DealerProps {
  dealer: DealerState
}

export function DealerHandView({ dealer }: DealerProps) {
  // Before a round is dealt, dealer.cards is empty — render a placeholder
  // rather than crashing in handTotal.
  if (dealer.cards.length === 0) {
    return (
      <div className="p-3 rounded-2xl border border-white/10 bg-black/40">
        <div className="text-[10px] uppercase tracking-widest text-white/50 mb-1">Dealer</div>
        <div className="flex gap-1 sm:gap-2 min-h-[6rem] items-center text-white/40 text-sm">
          Esperando reparto…
        </div>
      </div>
    )
  }
  const visibleCards = dealer.holeHidden ? [dealer.cards[0]].filter(Boolean) : dealer.cards
  const cardsForTotal = dealer.holeHidden ? visibleCards : dealer.cards
  const t = cardsForTotal.length > 0 ? handTotal(cardsForTotal) : { value: 0, isSoft: false, isBust: false, isBlackjack: false }
  return (
    <div className="p-3 rounded-2xl border border-white/10 bg-black/40">
      <div className="text-[10px] uppercase tracking-widest text-white/50 mb-1">Dealer</div>
      <div className="flex gap-1 sm:gap-2 min-h-[6rem]">
        {visibleCards.map((c) => (
          <PlayingCard key={c.id} card={c} />
        ))}
        {dealer.holeHidden && <PlayingCard hidden />}
      </div>
      <div className="mt-2 text-xs">
        <span className="px-2 py-0.5 rounded bg-white/10">
          {dealer.holeHidden ? 'Muestra' : 'Total'}: <strong className={t.isBust ? 'text-chip-red' : 'text-white'}>{t.value}</strong>
          {t.isSoft && !dealer.holeHidden && !t.isBust ? ' (suave)' : ''}
        </span>
        {dealer.blackjack && !dealer.holeHidden && <span className="ml-2 px-2 py-0.5 rounded bg-chip-gold text-neutral-900">Blackjack</span>}
      </div>
    </div>
  )
}
