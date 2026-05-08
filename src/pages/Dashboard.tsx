import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { Card } from '../components/Card';
import { useAuth } from '../lib/auth';
import { db } from '../lib/firebase';
import { buildDisplayName } from '../lib/members';
import { normalizeLeague } from '../lib/types';
import type { League } from '../lib/types';
import MembersTab from './dashboard/MembersTab';
import OverviewTab from './dashboard/OverviewTab';
import TeamsTab from './dashboard/TeamsTab';

type UserDoc = {
  firstName?: string;
  lastName?: string;
  email?: string;
  leagueCode?: string;
};

type DashTab = 'overview' | 'members' | 'teams';

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [leagueCode, setLeagueCode] = useState<string>('');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [activeTab, setActiveTab] = useState<DashTab>('overview');

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
      setLeague(
        snap.exists() ? normalizeLeague(snap.data() as Record<string, unknown>) : null
      );
    });
    return unsub;
  }, [leagueCode]);

  async function handleSignOut() {
    await signOut();
    navigate('/', { replace: true });
  }

  const firstName =
    userDoc?.firstName || user?.email?.split('@')[0] || 'there';
  const isCommissioner =
    !!user && !!league && league.commissionerId === user.uid;
  const commissionerName = buildDisplayName(
    userDoc?.firstName ?? '',
    userDoc?.lastName ?? '',
    user?.email?.split('@')[0]
  );

  // Widen the container for Teams tab (drag-and-drop) and Overview in-season (game cards).
  const wideTab =
    activeTab === 'teams' ||
    (activeTab === 'overview' && league?.status === 'in_season');

  return (
    <div className="hero-bg min-h-screen px-4 py-16">
      <div className={`mx-auto transition-all ${wideTab ? 'max-w-4xl' : 'max-w-3xl'}`}>
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

        {/* Tab bar — only for commissioners (members only see overview) */}
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
            <TabButton
              active={activeTab === 'teams'}
              onClick={() => setActiveTab('teams')}
            >
              Teams
            </TabButton>
          </div>
        )}

        <Card>
          {activeTab === 'overview' || !isCommissioner || !league ? (
            <OverviewTab
              firstName={firstName}
              league={league}
              leagueCode={leagueCode}
              loadingProfile={loadingProfile}
              userId={user?.uid ?? ''}
              isCommissioner={isCommissioner}
            />
          ) : activeTab === 'members' ? (
            <MembersTab
              leagueCode={leagueCode}
              league={league}
              commissionerName={commissionerName}
            />
          ) : (
            <TeamsTab leagueCode={leagueCode} league={league} />
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
