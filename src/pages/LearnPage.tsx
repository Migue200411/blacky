import { useState } from 'react'
import { NavLink, useParams, useNavigate } from 'react-router-dom'
import { StrategyTablesInteractive } from '../components/StrategyTablesInteractive'
import { DEFAULT_BET_RAMP } from '../data/defaults'
import { DEVIATIONS, INSURANCE_INDEX } from '../data/deviations'
import { trueCount } from '../engine/counting'

const LESSONS = [
  { id: '1', title: 'Reglas básicas' },
  { id: '2', title: 'Estrategia básica' },
  { id: '3', title: 'Conteo Hi-Lo' },
  { id: '4', title: 'True Count' },
  { id: '5', title: 'Apuestas simuladas' },
  { id: '6', title: 'Desviaciones' }
]

export function LearnPage() {
  const { lesson } = useParams()
  const nav = useNavigate()
  const current = lesson ?? '1'
  return (
    <div className="grid md:grid-cols-[220px_1fr] gap-4">
      <aside className="card-panel p-3 md:sticky md:top-20 self-start">
        <div className="font-display text-lg mb-2">Curso</div>
        <nav className="flex md:flex-col gap-1 overflow-x-auto">
          {LESSONS.map((l) => (
            <NavLink
              key={l.id}
              to={`/aprender/${l.id}`}
              className={({ isActive }) =>
                `px-3 py-2 rounded text-sm ${
                  (isActive || (l.id === '1' && !lesson))
                    ? 'bg-chip-gold text-neutral-900 font-semibold'
                    : 'hover:bg-white/10'
                }`
              }
            >
              <span className="text-xs opacity-70">L{l.id}</span> · {l.title}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="space-y-4">
        {current === '1' && <Lesson1 />}
        {current === '2' && <Lesson2 />}
        {current === '3' && <Lesson3 />}
        {current === '4' && <Lesson4 />}
        {current === '5' && <Lesson5 />}
        {current === '6' && <Lesson6 />}
        <div className="flex justify-between pt-2">
          {parseInt(current) > 1 ? (
            <button className="btn-ghost" onClick={() => nav(`/aprender/${parseInt(current) - 1}`)}>← Anterior</button>
          ) : <span />}
          {parseInt(current) < LESSONS.length && (
            <button className="btn-primary" onClick={() => nav(`/aprender/${parseInt(current) + 1}`)}>Siguiente →</button>
          )}
        </div>
      </div>
    </div>
  )
}

function LessonShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="card-panel p-6 space-y-4">
      <h2 className="font-display text-2xl text-chip-gold">{title}</h2>
      <div className="prose prose-invert prose-sm max-w-none text-white/85 leading-relaxed [&_h3]:font-display [&_h3]:text-chip-gold [&_h3]:text-lg [&_ul]:list-disc [&_ul]:pl-5 [&_p]:leading-relaxed">
        {children}
      </div>
    </article>
  )
}

function Lesson1() {
  return (
    <LessonShell title="Lección 1 · Reglas básicas del blackjack">
      <p><strong>Objetivo:</strong> conseguir un total de mano mayor al del dealer sin pasarse de 21.</p>
      <h3>Valores de las cartas</h3>
      <ul>
        <li>2–10 valen su número.</li>
        <li>J, Q, K valen 10.</li>
        <li>El As vale 1 u 11 (mano suave si aún vale 11 sin pasarse).</li>
      </ul>
      <h3>Blackjack natural</h3>
      <p>Es un As + una carta de 10 en las primeras dos cartas. Paga 3:2 (o 6:5 en mesas malas).</p>
      <h3>Acciones del jugador</h3>
      <ul>
        <li><strong>Hit (pedir):</strong> tomar otra carta.</li>
        <li><strong>Stand (plantarse):</strong> quedarse con la mano actual.</li>
        <li><strong>Double (doblar):</strong> duplicar la apuesta y tomar una única carta más.</li>
        <li><strong>Split (dividir):</strong> con una pareja, separarla en dos manos apostando otra vez lo mismo.</li>
        <li><strong>Surrender (rendirse):</strong> abandonar y perder solo la mitad de la apuesta.</li>
        <li><strong>Insurance (seguro):</strong> apuesta lateral 2:1 si el dealer muestra As.</li>
      </ul>
      <h3>Cómo juega el dealer</h3>
      <p>El dealer sigue reglas fijas: pide hasta 17 o más. Con soft 17 depende de la mesa (S17 se planta, H17 pide).</p>
      <h3>Mano hard vs soft</h3>
      <ul>
        <li><strong>Hard:</strong> no hay As, o hay un As que sólo puede valer 1 sin pasarse.</li>
        <li><strong>Soft:</strong> hay un As que puede valer 11 sin pasarse (por ejemplo A-6 = 7/17 soft).</li>
      </ul>
      <h3>Pareja</h3>
      <p>Dos cartas del mismo valor. Se puede dividir. Algunas parejas (como 8-8 o A-A) casi siempre se dividen.</p>
    </LessonShell>
  )
}

function Lesson2() {
  return (
    <LessonShell title="Lección 2 · Estrategia básica">
      <p>
        La estrategia básica es la jugada matemáticamente óptima <em>sin</em> conocer las cartas restantes.
        Depende de cuatro variables clave:
      </p>
      <ul>
        <li>Número de mazos.</li>
        <li>Regla del dealer con soft 17 (H17 vs S17).</li>
        <li>Si se permite double after split.</li>
        <li>Si existe surrender.</li>
        <li>Pago del blackjack (3:2 favorable, 6:5 muy desfavorable).</li>
      </ul>
      <p>
        Toca cada celda de la tabla para leer la explicación. Estas tablas están calibradas para 4-8 mazos,
        S17, DAS permitido y late surrender — el escenario más común.
      </p>
      <StrategyTablesInteractive />
    </LessonShell>
  )
}

function Lesson3() {
  return (
    <LessonShell title="Lección 3 · Conteo Hi-Lo">
      <p>
        El conteo Hi-Lo asigna un valor a cada carta que ves salir. Al sumar esos valores tienes el
        <strong> running count</strong>, una estimación de si el zapato está cargado de cartas altas o bajas.
      </p>
      <div className="grid grid-cols-3 gap-2 not-prose">
        {[
          { label: '+1', cards: '2 3 4 5 6', color: 'bg-emerald-500/20 border-emerald-400/40' },
          { label: '0', cards: '7 8 9', color: 'bg-white/10 border-white/20' },
          { label: '-1', cards: '10 J Q K A', color: 'bg-chip-red/20 border-chip-red/40' }
        ].map((g) => (
          <div key={g.label} className={`rounded-lg border p-3 text-center ${g.color}`}>
            <div className="text-2xl font-display">{g.label}</div>
            <div className="text-xs mt-1">{g.cards}</div>
          </div>
        ))}
      </div>
      <p>
        <strong>Por qué las altas favorecen al jugador:</strong> con más 10s y Ases restantes es más
        probable obtener blackjack (que paga 3:2), que el dealer se pase al pedir cartas cuando su
        upcard es débil, y que un double 10 u 11 saque una carta grande.
      </p>
      <p>
        <strong>Por qué las bajas favorecen a la casa:</strong> el dealer completa manos débiles más
        fácil sin pasarse, y los pagos de blackjack son menos frecuentes.
      </p>
      <div className="not-prose">
        <a href="/drill/conteo" className="btn-primary">Practicar drill de conteo</a>
      </div>
    </LessonShell>
  )
}

function Lesson4() {
  const examples = [
    { rc: 8, decks: 4 },
    { rc: 6, decks: 2 },
    { rc: -4, decks: 2 },
    { rc: 3, decks: 6 }
  ]
  return (
    <LessonShell title="Lección 4 · True Count">
      <p>
        El running count no cuenta cuántos mazos quedan. En un zapato de 6 mazos, un RC de +6 no es lo
        mismo si quedan 5 mazos que si queda solo 1. Por eso se normaliza:
      </p>
      <div className="not-prose rounded-lg bg-black/40 border border-white/10 p-3 font-mono text-center text-lg">
        True Count = Running Count ÷ Mazos restantes
      </div>
      <h3>Ejemplos</h3>
      <table className="w-full text-sm not-prose">
        <thead className="text-white/60 text-xs">
          <tr>
            <th className="text-left py-1">RC</th>
            <th className="text-left py-1">Mazos</th>
            <th className="text-left py-1">TC (floor)</th>
            <th className="text-left py-1">TC (round)</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {examples.map((e, i) => (
            <tr key={i} className="border-t border-white/10">
              <td className="py-1">{e.rc > 0 ? `+${e.rc}` : e.rc}</td>
              <td className="py-1">{e.decks}</td>
              <td className="py-1">{trueCount(e.rc, e.decks, 'floor')}</td>
              <td className="py-1">{trueCount(e.rc, e.decks, 'round')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        En la <a href="/configuracion">configuración</a> puedes elegir el redondeo (floor, round, truncate).
        Cada estilo cambia levemente cuándo aplicas desviaciones. La versión conservadora es <strong>floor</strong>.
      </p>
      <div className="not-prose">
        <a href="/drill/true-count" className="btn-primary">Practicar drill de True Count</a>
      </div>
    </LessonShell>
  )
}

function Lesson5() {
  return (
    <LessonShell title="Lección 5 · Apuestas simuladas">
      <p>
        La idea del betting spread no es apostar más porque "sientes que vas a ganar". Se apuesta más
        cuando el <strong>true count</strong> muestra que el zapato está a tu favor, y menos cuando está en contra.
      </p>
      <div className="not-prose overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-white/60 text-xs">
            <tr>
              <th className="text-left py-1">True Count</th>
              <th className="text-left py-1">Unidades (por defecto)</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {DEFAULT_BET_RAMP.map((r) => (
              <tr key={r.tc} className="border-t border-white/10">
                <td className="py-1">≥ {r.tc > 0 ? `+${r.tc}` : r.tc}</td>
                <td className="py-1">{r.units}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Puedes editar tu propia rampa en la sección de <a href="/configuracion">configuración</a>.
        Además tienes tres estilos: conservador (menos varianza), moderado y agresivo.
      </p>
      <p className="text-chip-gold">
        Nada de esto garantiza ganar. La varianza en blackjack es enorme y una racha negativa puede durar
        cientos de manos incluso jugando perfecto.
      </p>
    </LessonShell>
  )
}

function Lesson6() {
  return (
    <LessonShell title="Lección 6 · Desviaciones por índice">
      <p>
        Cuando el true count es alto o bajo, ciertas jugadas cambian respecto a estrategia básica. Estas
        son las llamadas "desviaciones" (Illustrious 18 / Fab 4). Cada una tiene un índice de TC que actúa
        como umbral.
      </p>
      <p>
        <strong>Insurance:</strong> tomar seguro si TC ≥ +{INSURANCE_INDEX}. En cualquier otro caso, rechazar.
      </p>
      <div className="not-prose overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-white/60 text-xs">
            <tr>
              <th className="text-left py-1">Mano</th>
              <th className="text-left py-1">Dealer</th>
              <th className="text-left py-1">Índice</th>
              <th className="text-left py-1">Básica</th>
              <th className="text-left py-1">Con desviación</th>
              <th className="text-left py-1">Explicación</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {DEVIATIONS.map((d, i) => (
              <tr key={i} className="border-t border-white/10">
                <td className="py-1">{d.playerTotal}</td>
                <td className="py-1">{d.dealerUp === 11 ? 'A' : d.dealerUp}</td>
                <td className="py-1">{d.direction === 'ge' ? '≥ ' : '< '}{d.index}</td>
                <td className="py-1">{d.basicAction}</td>
                <td className="py-1 font-semibold text-chip-gold">{d.deviationAction}</td>
                <td className="py-1 text-white/70 text-xs">{d.explanation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="not-prose">
        <a href="/entrenar/desviaciones" className="btn-primary">Practicar desviaciones</a>
      </div>
    </LessonShell>
  )
}
