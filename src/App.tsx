import { useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Landing from './pages/Landing';
import AdLanding from './pages/AdLanding';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import ForgotPassword from './pages/ForgotPassword';
import CreateLeague from './pages/CreateLeague';
import Dashboard from './pages/Dashboard';
import Join from './pages/Join';
import Account from './pages/Account';
import Terms from './pages/legal/Terms';
import Privacy from './pages/legal/Privacy';
import Contact from './pages/legal/Contact';
import { ProtectedRoute } from './components/ProtectedRoute';
import SiteFooter from './components/SiteFooter';
import { getTestCurrentWeek, getTestSeason, isTestMode } from './lib/espn';
import { captureAttribution } from './lib/attribution';
import { initMetaPixel, trackPageView } from './lib/metaPixel';
import { AD_LANDING_PATH } from './components/marketing';

export default function App() {
  useAdTracking();
  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner />
      <div className="flex-1 flex flex-col">
        <Routes>
        <Route path="/" element={<Landing />} />
        <Route path={AD_LANDING_PATH} element={<AdLanding />} />
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
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </div>
      <SiteFooter />
    </div>
  );
}

/**
 * Captures first-party ad attribution (UTMs / click IDs) once per session, and
 * — only when a Meta Pixel ID is configured — reports SPA route changes as
 * PageViews. With no pixel ID this does the attribution capture and nothing
 * else, sending no data to any third party.
 */
function useAdTracking(): void {
  const location = useLocation();
  const isFirstRoute = useRef(true);

  useEffect(() => {
    captureAttribution();
    initMetaPixel(); // fires the initial PageView itself when enabled
  }, []);

  useEffect(() => {
    // initMetaPixel already counted the first route; only report moves.
    if (isFirstRoute.current) {
      isFirstRoute.current = false;
      return;
    }
    trackPageView();
  }, [location.pathname]);
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
