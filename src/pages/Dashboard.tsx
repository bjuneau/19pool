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

type DashTab = 'results' | 'standings' | 'admin';
type AdminSubTab = 'members' | 'teams' | 'payments';

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [leagueCode, setLeagueCode] = useState<string>('');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [activeTab, setActiveTab] = useState<DashTab>('results');
  const [adminSubTab, setAdminSubTab] = useState<AdminSubTab>('members');

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

  function goToAdminMembers() {
    setActiveTab('admin');
    setAdminSubTab('members');
  }

  return (
    <div className="bg-paper min-h-screen">
      <div className="mx-auto px-5 sm:px-8 max-w-5xl">
        {/* Dark-utility masthead matching Landing: "19POOL" wordmark left,
            text links right. Volt-lime "19", white "POOL", hairline rule
            underneath. Wordmark is one continuous string, no gap. */}
        <header className="flex items-center justify-between h-14 border-b border-ink-line">
          <Link to="/" className="flex items-baseline">
            <span className="font-display font-extrabold text-2xl leading-none tracking-tight text-accent">
              19
            </span>
            <span className="font-display font-extrabold text-2xl leading-none tracking-tight text-ink">
              POOL
            </span>
          </Link>
          <div className="flex items-center gap-4 sm:gap-5">
            <Link
              to="/account"
              className="text-sm font-medium text-ink-dim hover:text-ink transition-colors"
            >
              Account
            </Link>
            <button
              onClick={handleSignOut}
              className="text-sm font-medium text-ink-dim hover:text-ink transition-colors"
            >
              Sign out
            </button>
          </div>
        </header>

        {/* Section navigation — text-only tabs with a solid accent
            underline for the active one. Commissioner-only Members,
            Teams, and Payments are folded under an Admin parent so
            the main nav stays on one line. */}
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
              <TabButton
                active={activeTab === 'admin'}
                onClick={() => setActiveTab('admin')}
              >
                Admin
              </TabButton>
            )}
          </nav>
        )}

        {/* Admin sub-nav — only shown when the Admin parent is active.
            Smaller / lighter than the main nav so the hierarchy reads. */}
        {league && isCommissioner && activeTab === 'admin' && (
          <nav className="flex flex-wrap gap-x-5 sm:gap-x-6 gap-y-1 -mt-4 mb-6">
            <SubTabButton
              active={adminSubTab === 'members'}
              onClick={() => setAdminSubTab('members')}
            >
              Members
            </SubTabButton>
            <SubTabButton
              active={adminSubTab === 'teams'}
              onClick={() => setAdminSubTab('teams')}
            >
              Teams
            </SubTabButton>
            {hasPaymentTracker(league) && (
              <SubTabButton
                active={adminSubTab === 'payments'}
                onClick={() => setAdminSubTab('payments')}
              >
                Payments
              </SubTabButton>
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
              onGoToMembers={goToAdminMembers}
            />
          ) : activeTab === 'standings' ? (
            <StandingsTab
              league={league}
              leagueCode={leagueCode}
            />
          ) : activeTab === 'admin' && isCommissioner ? (
            adminSubTab === 'teams' ? (
              <TeamsTab leagueCode={leagueCode} league={league} />
            ) : adminSubTab === 'payments' && hasPaymentTracker(league) ? (
              <PaymentsTab leagueCode={leagueCode} league={league} />
            ) : (
              <MembersTab
                leagueCode={leagueCode}
                league={league}
                commissionerName={commissionerName}
              />
            )
          ) : (
            <WeeklyResultsTab
              firstName={firstName}
              league={league}
              leagueCode={leagueCode}
              loadingProfile={loadingProfile}
              userId={user?.uid ?? ''}
              isCommissioner={isCommissioner}
              onGoToMembers={goToAdminMembers}
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

function SubTabButton({
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
      className={`relative pb-2 -mb-px text-xs font-semibold uppercase tracking-[0.14em] transition-colors border-b-2 ${
        active
          ? 'text-ink border-accent'
          : 'text-ink-muted border-transparent hover:text-ink-dim'
      }`}
    >
      {children}
    </button>
  );
}
