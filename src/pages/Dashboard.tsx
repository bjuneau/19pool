import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { Card } from '../components/Card';
import { useAuth } from '../lib/auth';
import { db } from '../lib/firebase';
import { buildDisplayName } from '../lib/members';
import type { League } from '../lib/types';
import MembersTab from './dashboard/MembersTab';

type UserDoc = {
  firstName?: string;
  lastName?: string;
  email?: string;
  leagueCode?: string;
};

type DashTab = 'overview' | 'members';

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [leagueCode, setLeagueCode] = useState<string>('');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [activeTab, setActiveTab] = useState<DashTab>('overview');

  // Subscribe to the user doc; whenever leagueCode changes, swap the league
  // subscription so the dashboard stays in sync if the user joins a league
  // from another tab.
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      const ud = (snap.exists() ? snap.data() : {}) as UserDoc;
      setUserDoc(ud);
      setLeagueCode(ud.leagueCode ?? '');
      setLoadingProfile(false);
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!leagueCode) {
      setLeague(null);
      return;
    }
    const unsub = onSnapshot(doc(db, 'leagues', leagueCode), (snap) => {
      setLeague(snap.exists() ? (snap.data() as League) : null);
    });
    return unsub;
  }, [leagueCode]);

  async function handleSignOut() {
    await signOut();
    navigate('/', { replace: true });
  }

  const firstName = userDoc?.firstName || user?.email?.split('@')[0] || 'there';
  const isCommissioner =
    !!user && !!league && league.commissionerId === user.uid;
  const commissionerName = buildDisplayName(
    userDoc?.firstName ?? '',
    userDoc?.lastName ?? '',
    user?.email?.split('@')[0]
  );

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

        {league && isCommissioner && (
          <div className="flex bg-navy-950/60 border border-white/10 rounded-xl p-1 mb-6 gap-1 max-w-sm">
            <TabButton
              active={activeTab === 'overview'}
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </TabButton>
            <TabButton
              active={activeTab === 'members'}
              onClick={() => setActiveTab('members')}
            >
              Members
            </TabButton>
          </div>
        )}

        <Card>
          {activeTab === 'overview' || !isCommissioner || !league ? (
            <Overview
              firstName={firstName}
              league={league}
              loadingProfile={loadingProfile}
            />
          ) : (
            <MembersTab
              leagueCode={leagueCode}
              league={league}
              commissionerName={commissionerName}
            />
          )}
        </Card>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${
        active ? 'bg-navy-700 text-white' : 'text-slate-400 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

function Overview({
  firstName,
  league,
  loadingProfile,
}: {
  firstName: string;
  league: League | null;
  loadingProfile: boolean;
}) {
  return (
    <div>
      <h1 className="text-3xl font-extrabold text-white mb-2">
        Welcome, <span className="text-amber-400">{firstName}</span>
      </h1>
      <p className="text-slate-400 text-sm mb-8">
        Your dashboard is just getting started. Full league features coming soon.
      </p>

      {loadingProfile ? (
        <p className="text-slate-500 text-sm">Loading your profile…</p>
      ) : league ? (
        <div className="bg-navy-950/60 border border-amber-500/20 rounded-2xl p-6">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-2">
            Your League
          </p>
          <p className="text-2xl font-bold text-white mb-1">{league.name}</p>
          <p className="font-mono text-amber-400 tracking-[0.3em]">{league.code}</p>
          <p className="text-xs text-slate-500 mt-3">
            {league.memberCount ?? 0} member
            {(league.memberCount ?? 0) === 1 ? '' : 's'} · {league.status}
          </p>
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
    </div>
  );
}
