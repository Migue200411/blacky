import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { LandingPage } from './pages/LandingPage'
import { LearnPage } from './pages/LearnPage'
import { ConfigPage } from './pages/ConfigPage'
import { SimulatorPage } from './pages/SimulatorPage'
import { CountDrillPage } from './pages/CountDrillPage'
import { TrueCountDrillPage } from './pages/TrueCountDrillPage'
import { StrategyTrainerPage } from './pages/StrategyTrainerPage'
import { DeviationsTrainerPage } from './pages/DeviationsTrainerPage'
import { StatsPage } from './pages/StatsPage'
import { ResponsiblePage } from './pages/ResponsiblePage'
import { ExamPage } from './pages/ExamPage'
import { AsistentePage } from './pages/AsistentePage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/aprender" element={<LearnPage />} />
        <Route path="/aprender/:lesson" element={<LearnPage />} />
        <Route path="/configuracion" element={<ConfigPage />} />
        <Route path="/simulador" element={<SimulatorPage />} />
        <Route path="/drill/conteo" element={<CountDrillPage />} />
        <Route path="/drill/true-count" element={<TrueCountDrillPage />} />
        <Route path="/entrenar/estrategia" element={<StrategyTrainerPage />} />
        <Route path="/entrenar/desviaciones" element={<DeviationsTrainerPage />} />
        <Route path="/examen" element={<ExamPage />} />
        <Route path="/asistente" element={<AsistentePage />} />
        <Route path="/estadisticas" element={<StatsPage />} />
        <Route path="/juego-responsable" element={<ResponsiblePage />} />
      </Route>
    </Routes>
  )
}
