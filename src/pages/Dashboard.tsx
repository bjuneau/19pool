import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { Card } from '../components/Card';
import { useAuth } from '../lib/auth';
import { db } from '../lib/firebase';

type UserDoc = {
  firstName?: string;
  lastName?: string;
  leagueCode?: string;
};

type LeagueDoc = {
  name?: string;
  code?: string;
};

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [leagueDoc, setLeagueDoc] = useState<LeagueDoc | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!user) return;
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      const ud = (userSnap.exists() ? userSnap.data() : {}) as UserDoc;
      if (cancelled) return;
      setUserDoc(ud);

      if (ud.leagueCode) {
        const leagueSnap = await getDoc(doc(db, 'leagues', ud.leagueCode));
        if (cancelled) return;
        setLeagueDoc((leagueSnap.exists() ? leagueSnap.data() : null) as LeagueDoc | null);
      }

      if (!cancelled) setLoadingProfile(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleSignOut() {
    await signOut();
    navigate('/', { replace: true });
  }

  const firstName = userDoc?.firstName || user?.email?.split('@')[0] || 'there';

  return (
    <div className="hero-bg min-h-screen px-4 py-16">
      <div className="max-w-3xl mx-auto">
        <header className="flex items-center justify-between mb-10">
          <Link to="/" className="text-2xl font-extrabold tracking-widest">
            <span className="text-amber-400">19</span>
            <span className="text-white"> POOL</span>
          </Link>
          <button
            onClick={handleSignOut}
            className="text-sm text-slate-400 hover:text-white transition-colors px-4 py-2 rounded-full border border-white/10 hover:border-white/30"
          >
            Sign Out
          </button>
        </header>

        <Card>
          <h1 className="text-3xl font-extrabold text-white mb-2">
            Welcome, <span className="text-amber-400">{firstName}</span>
          </h1>
          <p className="text-slate-400 text-sm mb-8">
            Your dashboard is just getting started. Full league features coming soon.
          </p>

          {loadingProfile ? (
            <p className="text-slate-500 text-sm">Loading your profile…</p>
          ) : leagueDoc ? (
            <div className="bg-navy-950/60 border border-amber-500/20 rounded-2xl p-6">
              <p className="text-xs text-slate-500 uppercase tracking-widest mb-2">
                Your League
              </p>
              <p className="text-2xl font-bold text-white mb-1">{leagueDoc.name}</p>
              <p className="font-mono text-amber-400 tracking-[0.3em]">{leagueDoc.code}</p>
            </div>
          ) : (
            <div className="bg-navy-950/60 border border-white/10 rounded-2xl p-6 text-center">
              <p className="text-slate-400 text-sm mb-4">
                You're not in a league yet.
              </p>
              <Link
                to="/create-league"
                className="inline-block bg-amber-500 hover:bg-amber-400 text-navy-950 font-bold px-6 py-2.5 rounded-full transition-all tracking-wide"
              >
                Create a League
              </Link>
            </div>
          )}

          <p className="text-xs text-slate-600 mt-8 text-center">
            Full dashboard coming soon.
          </p>
        </Card>
      </div>
    </div>
  );
}
