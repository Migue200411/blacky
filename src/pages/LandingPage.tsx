import { Link } from 'react-router-dom'
import { ResponsibleBanner } from '../components/ResponsibleBanner'
import { PlayingCard } from '../components/PlayingCard'

const HERO_CARDS = [
  { rank: 'A', suit: '♠', id: 'h1' } as const,
  { rank: 'K', suit: '♥', id: 'h2' } as const
]

const CTA = [
  { to: '/aprender', title: 'Empezar a aprender', desc: 'Curso desde cero: reglas, estrategia y conteo.' },
  { to: '/drill/conteo', title: 'Practicar conteo', desc: 'Drills de Hi-Lo running count con velocidad ajustable.' },
  { to: '/simulador', title: 'Jugar simulación', desc: 'Mesa simulada con bankroll y coaching en vivo.' },
  { to: '/entrenar/estrategia', title: 'Entrenar estrategia', desc: 'Practica estrategia básica y desviaciones I18/Fab4.' },
  { to: '/asistente', title: 'Asistente de práctica', desc: 'Registra manualmente una mano y recibe la jugada recomendada.' },
  { to: '/examen', title: 'Exámenes', desc: 'Evaluaciones con Q&A de estrategia, conteo y true count.' }
]

export function LandingPage() {
  return (
    <div className="space-y-8">
      <section className="grid md:grid-cols-2 gap-8 items-center">
        <div className="space-y-4">
          <div className="text-xs uppercase tracking-[0.3em] text-chip-gold">Entrenador educativo</div>
          <h1 className="font-display text-4xl sm:text-5xl leading-tight">
            Aprende blackjack con <span className="text-chip-gold">disciplina y matemática</span>, no con intuición.
          </h1>
          <p className="text-white/80 text-base sm:text-lg leading-relaxed">
            Blackjack Trainer Pro te enseña estrategia básica, conteo Hi-Lo, true count y desviaciones,
            en un simulador que corrige cada decisión con explicación. Todo es <strong>simulado y educativo</strong>:
            no hay dinero real ni promesas de ganancias.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/aprender" className="btn-primary">Empezar a aprender</Link>
            <Link to="/simulador" className="btn-secondary">Ir al simulador</Link>
          </div>
        </div>
        <div className="relative flex justify-center">
          <div className="absolute inset-0 rounded-full blur-3xl bg-chip-gold/10" />
          <div className="relative flex gap-3 rotate-[-4deg]">
            {HERO_CARDS.map((c) => <PlayingCard key={c.id} card={c} />)}
          </div>
        </div>
      </section>

      <section className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {CTA.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="card-panel p-4 hover:border-chip-gold transition group"
          >
            <div className="font-display text-lg text-chip-gold group-hover:underline">{c.title}</div>
            <p className="text-sm text-white/70 mt-1">{c.desc}</p>
          </Link>
        ))}
      </section>

      <section className="card-panel p-6 space-y-3">
        <div className="font-display text-xl">Qué encontrarás dentro</div>
        <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm text-white/80 list-disc list-inside">
          <li>Curso progresivo de 6 lecciones (reglas, estrategia básica, Hi-Lo, TC, apuestas, desviaciones).</li>
          <li>Simulador de mesa con hit, stand, double, split, surrender e insurance.</li>
          <li>Conteo automático con panel visible u oculto según prefieras practicar.</li>
          <li>Drills de running count y true count con retroalimentación en tiempo real.</li>
          <li>Entrenador de estrategia por categorías (hard, soft, pairs) con explicaciones.</li>
          <li>Entrenador de desviaciones tipo Illustrious 18 y Fab 4.</li>
          <li>Configuración completa de reglas de mesa y rampa de apuestas personalizable.</li>
          <li>Estadísticas locales: precisión, ganancias simuladas, mejor y peor sesión.</li>
        </ul>
      </section>

      <ResponsibleBanner />
    </div>
  )
}
