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
import PaymentsTab from './dashboard/PaymentsTab';
import StandingsTab from './dashboard/StandingsTab';
import TeamsTab from './dashboard/TeamsTab';
import WeeklyResultsTab from './dashboard/WeeklyResultsTab';
import { hasPaymentTracker } from '../lib/features';

type UserDoc = {
  firstName?: string;
  lastName?: string;
  email?: string;
  leagueCode?: string;
};

type DashTab = 'results' | 'standings' | 'members' | 'teams' | 'payments';

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [leagueCode, setLeagueCode] = useState<string>('');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [activeTab, setActiveTab] = useState<DashTab>('results');

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

  // Widen the container for Teams tab (drag-and-drop) and Weekly Results
  // in-season (game cards). Standings stays narrow — it's a leaderboard.
  const wideTab =
    activeTab === 'teams' ||
    (activeTab === 'results' && league?.status === 'in_season');

  return (
    <div className="hero-bg min-h-screen px-4 py-16">
      <div className={`mx-auto transition-all ${wideTab ? 'max-w-4xl' : 'max-w-3xl'}`}>
        <header className="flex items-center justify-between mb-10">
          <Link to="/" className="text-2xl font-extrabold tracking-widest">
            <span className="text-amber-400">19</span>
            <span className="text-white"> POOL</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              to="/account"
              className="text-sm text-slate-400 hover:text-amber-400 transition-colors"
            >
              Account
            </Link>
            <button
              onClick={handleSignOut}
              className="text-sm text-slate-400 hover:text-white transition-colors px-4 py-2 rounded-full border border-white/10 hover:border-white/30"
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* Tab bar. Results + Standings for everyone; the admin tabs
            (Members / Teams / Payments) only render for the commissioner.
            overflow-x-auto lets the 5-tab commissioner row scroll on
            narrow phones. */}
        {league && (
          <div className="overflow-x-auto mb-6 -mx-1 px-1">
            <div className="flex bg-navy-950/60 border border-white/10 rounded-xl p-1 gap-1 max-w-2xl w-max">
              <TabButton
                active={activeTab === 'results'}
                onClick={() => setActiveTab('results')}
              >
                Weekly Results
              </TabButton>
              <TabButton
                active={activeTab === 'standings'}
                onClick={() => setActiveTab('standings')}
              >
                Standings
              </TabButton>
              {isCommissioner && (
                <>
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
                  {hasPaymentTracker(league) && (
                    <TabButton
                      active={activeTab === 'payments'}
                      onClick={() => setActiveTab('payments')}
                    >
                      Payments
                    </TabButton>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        <Card>
          {!league ? (
            <WeeklyResultsTab
              firstName={firstName}
              league={league}
              leagueCode={leagueCode}
              loadingProfile={loadingProfile}
              userId={user?.uid ?? ''}
              isCommissioner={isCommissioner}
            />
          ) : activeTab === 'standings' ? (
            <StandingsTab
              league={league}
              leagueCode={leagueCode}
            />
          ) : activeTab === 'members' && isCommissioner ? (
            <MembersTab
              leagueCode={leagueCode}
              league={league}
              commissionerName={commissionerName}
            />
          ) : activeTab === 'teams' && isCommissioner ? (
            <TeamsTab leagueCode={leagueCode} league={league} />
          ) : activeTab === 'payments' && isCommissioner && hasPaymentTracker(league) ? (
            <PaymentsTab leagueCode={leagueCode} league={league} />
          ) : (
            <WeeklyResultsTab
              firstName={firstName}
              league={league}
              leagueCode={leagueCode}
              loadingProfile={loadingProfile}
              userId={user?.uid ?? ''}
              isCommissioner={isCommissioner}
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
