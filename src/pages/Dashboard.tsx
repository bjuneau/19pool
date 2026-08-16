import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
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
    <div className="bg-paper min-h-screen">
      <div className={`mx-auto transition-all px-5 sm:px-8 ${wideTab ? 'max-w-5xl' : 'max-w-3xl'}`}>
        {/* Editorial masthead. "19 Pool" logo left, right-side navigation
            as plain text links with hairline treatment on hover. */}
        <header className="flex items-center justify-between py-5 border-b border-ink-line">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="font-display font-black text-2xl leading-none text-accent">
              19
            </span>
            <span className="kicker text-ink">Pool</span>
          </Link>
          <div className="flex items-center gap-5 sm:gap-6">
            <Link
              to="/account"
              className="text-sm text-ink-dim hover:text-ink transition-colors"
            >
              Account
            </Link>
            <button
              onClick={handleSignOut}
              className="text-sm text-ink-dim hover:text-ink transition-colors"
            >
              Sign out
            </button>
          </div>
        </header>

        {/* Section navigation — text-only tabs with a solid accent
            underline for the active one. No pill chrome; hairline rule
            underneath separates from content. Wraps naturally on narrow
            screens so nothing scrolls off. */}
        {league && (
          <nav className="flex flex-wrap gap-x-6 sm:gap-x-8 gap-y-1 border-b border-ink-line pt-4 mb-6">
            <TabButton
              active={activeTab === 'results'}
              onClick={() => setActiveTab('results')}
            >
              Results
            </TabButton>
            <TabButton
              active={activeTab === 'standings'}
              onClick={() => setActiveTab('standings')}
            >
              Standings
            </TabButton>
            {isCommissioner && (
              <>
                <span className="hidden sm:inline-block self-center w-px h-3 bg-ink-line" />
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
          </nav>
        )}

        <div className="py-4 sm:py-8">
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
        </div>
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
      className={`relative pb-3 -mb-px text-sm font-semibold transition-colors border-b-2 ${
        active
          ? 'text-ink border-accent'
          : 'text-ink-dim border-transparent hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}
