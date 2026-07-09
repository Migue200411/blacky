export function ResponsiblePage() {
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h1 className="font-display text-3xl text-chip-gold">Juego responsable</h1>
      <div className="card-panel p-6 space-y-3 text-white/85 text-sm leading-relaxed">
        <p>
          Blackjack Trainer Pro es una herramienta educativa. Todo el bankroll, apuestas y resultados
          son simulados. Esta app no promueve el juego con dinero real, no procesa pagos y no debe
          usarse para asistir juego en casinos físicos o en línea.
        </p>
        <p>
          El blackjack tiene ventaja de la casa incluso jugando con estrategia perfecta. Aprender
          conteo de cartas y desviaciones puede reducir esa ventaja en teoría, pero los resultados
          reales son altamente variables, dependen del casino, las reglas y el bankroll disponible.
        </p>
        <p>Recomendaciones:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Nunca apuestes dinero que no puedas perder.</li>
          <li>Establece límites de tiempo y presupuesto antes de jugar.</li>
          <li>Si sientes que el juego afecta tu vida, busca ayuda profesional.</li>
          <li>Practica aquí sin dinero real cuantas veces quieras.</li>
        </ul>
      </div>
    </div>
  )
}
