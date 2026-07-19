import { Navigate, Route, Routes } from 'react-router-dom';
import { GameRoute } from './features/game/GameRoute';
import { LiveMatch } from './features/live/LiveMatch';
import { ScoringLogin } from './features/scoringStation/ScoringLogin';
import { ScoringStationHome } from './features/scoringStation/ScoringStationHome';

export function App() {
  return (
    <div className="min-h-full bg-[var(--color-bg)] text-[var(--color-text)]">
      <Routes>
        <Route path="/" element={<ScoringStationHome />} />
        <Route path="/login" element={<ScoringLogin />} />
        <Route path="/game/:id" element={<GameRoute />} />

        {/* Kept for the simultaneous-scoring lock fallback. */}
        <Route path="/live/:id" element={<LiveMatch />} />

        {/* Tournament creation and historical modes are no longer exposed. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
