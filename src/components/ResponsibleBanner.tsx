interface Props {
  compact?: boolean
}

export function ResponsibleBanner({ compact }: Props) {
  if (compact) {
    return (
      <div className="text-[10px] sm:text-xs text-white/60 border-t border-white/10 pt-2 mt-2">
        Uso educativo únicamente · No garantiza ganancias · Practica con juego responsable.
      </div>
    )
  }
  return (
    <div className="card-panel p-4 text-sm text-white/80">
      <div className="font-semibold text-chip-gold mb-1">Aviso de juego responsable</div>
      <p className="leading-relaxed">
        Esta aplicación es <strong>educativa y de práctica simulada</strong>. No garantiza ganancias,
        no está diseñada para asistir juego en casinos reales y no reemplaza asesoría financiera. Si
        el juego con dinero real deja de ser diversión, busca ayuda profesional en tu localidad.
      </p>
    </div>
  )
}
