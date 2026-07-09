import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { useEffect } from 'react'

const NAV = [
  { to: '/', label: 'Inicio' },
  { to: '/aprender', label: 'Curso' },
  { to: '/configuracion', label: 'Mesa' },
  { to: '/simulador', label: 'Simulador' },
  { to: '/drill/conteo', label: 'Conteo' },
  { to: '/drill/true-count', label: 'True Count' },
  { to: '/entrenar/estrategia', label: 'Estrategia' },
  { to: '/entrenar/desviaciones', label: 'Desviaciones' },
  { to: '/asistente', label: 'Asistente' },
  { to: '/examen', label: 'Examen' },
  { to: '/estadisticas', label: 'Stats' }
]

export function Layout() {
  const loc = useLocation()
  const hasSeen = useStore((s) => s.hasSeenDisclaimer)
  const accept = useStore((s) => s.acceptDisclaimer)

  useEffect(() => {
    if (loc.pathname !== '/') window.scrollTo(0, 0)
  }, [loc.pathname])

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-30 backdrop-blur bg-black/40 border-b border-white/10">
        <div className="max-w-6xl mx-auto flex items-center gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-chip-gold text-neutral-900 flex items-center justify-center font-display font-bold">
              BJ
            </div>
            <div className="hidden sm:block leading-tight">
              <div className="font-display text-lg text-chip-gold">Blackjack Trainer Pro</div>
              <div className="text-[10px] uppercase tracking-widest text-white/50">Entrenador educativo · Simulación</div>
            </div>
          </Link>
          <nav className="ml-auto flex overflow-x-auto no-scrollbar gap-1">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === '/'}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition ${
                    isActive
                      ? 'bg-chip-gold text-neutral-900 font-semibold'
                      : 'text-white/80 hover:bg-white/10'
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-white/10 mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-3 text-[11px] text-white/50 flex flex-wrap gap-2 justify-between">
          <span>Blackjack Trainer Pro · Sólo entrenamiento y simulación.</span>
          <span>No apuestas con dinero real desde esta app.</span>
        </div>
      </footer>

      {!hasSeen && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur flex items-center justify-center p-4">
          <div className="card-panel max-w-md p-6 space-y-4 animate-fadeIn">
            <div className="text-chip-gold font-display text-2xl">Antes de empezar</div>
            <p className="text-white/85 text-sm leading-relaxed">
              Blackjack Trainer Pro es una herramienta <strong>educativa y de simulación</strong>.
              No promete ganancias, no es asesoría financiera y no está pensada para asistir juego en casinos
              reales. Si decides jugar con dinero, hazlo con responsabilidad y dentro de tus límites.
            </p>
            <ul className="text-xs text-white/70 list-disc list-inside space-y-1">
              <li>Todo el bankroll es simulado.</li>
              <li>No hay integración con casinos ni pagos reales.</li>
              <li>Estas prácticas mejoran tu decisión, pero el resultado sigue siendo aleatorio.</li>
            </ul>
            <button className="btn-primary w-full" onClick={accept}>
              Entiendo y quiero practicar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
