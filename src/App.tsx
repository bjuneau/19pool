import { Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import ForgotPassword from './pages/ForgotPassword';
import CreateLeague from './pages/CreateLeague';
import Dashboard from './pages/Dashboard';
import Join from './pages/Join';
import Account from './pages/Account';
import { ProtectedRoute } from './components/ProtectedRoute';
import { getTestCurrentWeek, getTestSeason, isTestMode } from './lib/espn';

export default function App() {
  return (
    <>
      <TestModeBanner />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/join" element={<Join />} />
        <Route path="/join/:codeOrToken" element={<Join />} />
        <Route
          path="/create-league"
          element={
            <ProtectedRoute>
              <CreateLeague />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/account"
          element={
            <ProtectedRoute>
              <Account />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

/**
 * Full-width sticky banner shown whenever VITE_TEST_SEASON is set. Left off
 * entirely (no DOM at all) in production. `position: sticky` so it stays put
 * as pages scroll — a real "you cannot forget this is test mode" affordance.
 */
function TestModeBanner() {
  if (!isTestMode()) return null;
  const season = getTestSeason();
  const week = getTestCurrentWeek();
  const weekLabel = week !== null ? `, week ${week}` : '';
  return (
    <div className="sticky top-0 z-[70] bg-paper-2 border-b border-ink-line text-ink-dim text-xs text-center py-1.5 px-3">
      🧪 <span className="text-accent font-semibold">Test mode:</span> showing {season} season{weekLabel}
    </div>
  );
}
