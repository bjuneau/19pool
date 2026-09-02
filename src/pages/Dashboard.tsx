import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../lib/auth';
import { isBeforeSeasonStart } from '../lib/espn';
import { db } from '../lib/firebase';
import { buildDisplayName } from '../lib/members';
import { normalizeLeague } from '../lib/types';
import type { League } from '../lib/types';
import SuperBar, {
  readSuperLeagueCode,
  writeSuperLeagueCode,
} from '../components/SuperBar';
import LeagueAdminTab from './dashboard/LeagueAdminTab';
import MembersTab from './dashboard/MembersTab';
import PaymentsTab from './dashboard/PaymentsTab';
import PlayersTab from './dashboard/PlayersTab';
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

type DashTab = 'results' | 'standings' | 'players' | 'admin';
type AdminSubTab = 'league' | 'members' | 'teams' | 'payments';

export default function Dashboard() {
  const { user, isSuper } = useAuth();

  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [league, setLeague] = useState<League | null>(null);
  // The user's own league (from users/{uid}.leagueCode). Super mode
  // ignores this in favor of superLeagueCode below.
  const [ownLeagueCode, setOwnLeagueCode] = useState<string>('');
  const [superLeagueCode, setSuperLeagueCodeState] = useState<string>(() =>
    readSuperLeagueCode()
  );
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [activeTab, setActiveTab] = useState<DashTab>('results');
  const [adminSubTab, setAdminSubTab] = useState<AdminSubTab>('members');

  // Effective league code: super picks any league; everyone else uses
  // whatever's on their own user doc.
  const leagueCode = isSuper ? superLeagueCode : ownLeagueCode;

  function handleSuperSelect(code: string) {
    setSuperLeagueCodeState(code);
    writeSuperLeagueCode(code);
    // Reset the active tab so a super-user landing on a new league
    // starts at Results, not (say) an Admin sub-tab left over from
    // the previous league.
    setActiveTab('results');
  }

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      const ud = (snap.exists() ? snap.data() : {}) as UserDoc;
      setUserDoc(ud);
      setOwnLeagueCode(ud.leagueCode ?? '');
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

  const firstName =
    userDoc?.firstName || user?.email?.split('@')[0] || 'there';
  const isCommissioner =
    isSuper ||
    (!!user && !!league && league.commissionerId === user.uid);
  const commissionerName = buildDisplayName(
    userDoc?.firstName ?? '',
    userDoc?.lastName ?? '',
    user?.email?.split('@')[0]
  );

  function goToAdminMembers() {
    setActiveTab('admin');
    setAdminSubTab('members');
  }

  // Prevention, not a postmortem. Once kickoff passes, an unlocked league
  // stops being fixable: nothing is scored, and catching up later means
  // scoring past weeks against rosters set after those games were played.
  // The red banner on Results reports that damage; this one is here to stop
  // it happening, so it only runs while there is still time to act.
  const needsLockReminder =
    !!league &&
    isCommissioner &&
    league.status !== 'in_season' &&
    league.status !== 'complete' &&
    isBeforeSeasonStart(league.season);

  function goToLockTeams() {
    setActiveTab('admin');
    setAdminSubTab('teams');
  }

  return (
    <div className="bg-paper flex-1">
      {needsLockReminder && (
        <button
          type="button"
          onClick={goToLockTeams}
          className="w-full bg-accent hover:bg-accent-bright text-paper text-xs sm:text-sm font-bold px-4 py-2 transition-colors text-center"
        >
          Lock your league before the season starts.
          <span className="font-semibold"> Lock it now &gt;</span>
        </button>
      )}
      {isSuper && (
        <SuperBar selectedCode={superLeagueCode} onSelect={handleSuperSelect} />
      )}
      <div className="mx-auto px-5 sm:px-8 max-w-5xl">
        {/* Dark-utility masthead matching Landing: "19POOL" wordmark left,
            person icon on the right that links to /account. Sign-out now
            lives inside the Account page — the top bar stays visually
            quiet on every dashboard view. */}
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
              to="/contact"
              className="text-sm font-medium text-ink-dim hover:text-ink transition-colors"
            >
              Feedback
            </Link>
            <Link
              to="/account"
              aria-label="Account"
              className="text-ink-dim hover:text-ink transition-colors"
            >
              <UserIcon />
            </Link>
          </div>
        </header>

        {/* Section navigation — text-only tabs with a solid accent
            underline for the active one. Commissioner-only League,
            Members, Teams, and Payments are folded under an Admin
            parent so the main nav stays on one line. */}
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
            <TabButton
              active={activeTab === 'players'}
              onClick={() => setActiveTab('players')}
            >
              Players
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
              Players
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
            <SubTabButton
              active={adminSubTab === 'league'}
              onClick={() => setAdminSubTab('league')}
            >
              League
            </SubTabButton>
          </nav>
        )}

        <div className="py-4 sm:py-8">
          {!league && isSuper ? (
            <div className="max-w-lg mx-auto text-center py-16">
              <p className="text-2xl mb-2">👑</p>
              <p className="text-white font-semibold mb-1">Super mode</p>
              <p className="text-slate-400 text-sm leading-relaxed">
                Pick a league from the bar at the top to load its full
                commissioner view.
              </p>
            </div>
          ) : !league ? (
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
          ) : activeTab === 'players' ? (
            <PlayersTab league={league} leagueCode={leagueCode} />
          ) : activeTab === 'admin' && isCommissioner ? (
            adminSubTab === 'members' ? (
              <MembersTab
                leagueCode={leagueCode}
                league={league}
                commissionerName={commissionerName}
              />
            ) : adminSubTab === 'teams' ? (
              <TeamsTab leagueCode={leagueCode} league={league} />
            ) : adminSubTab === 'payments' && hasPaymentTracker(league) ? (
              <PaymentsTab leagueCode={leagueCode} league={league} />
            ) : (
              <LeagueAdminTab league={league} leagueCode={leagueCode} />
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

// Flat outlined user icon — Heroicons "user" (outline, 24×24). No
// gradients, no fills, matches the utilitarian dashboard chrome.
function UserIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-6 h-6"
      aria-hidden="true"
    >
      <path d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
      <path d="M4.5 20.25a7.5 7.5 0 0 1 15 0" />
    </svg>
  );
}
