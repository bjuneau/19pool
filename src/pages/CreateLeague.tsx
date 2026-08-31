import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { LeagueModeCards } from '../components/LeagueMode';
import { useAuth } from '../lib/auth';
import { db } from '../lib/firebase';
import { trackEvent } from '../lib/metaPixel';
import {
  buildDisplayName,
  generateInviteToken,
} from '../lib/members';
import { computeWeeklyShareFromPot } from '../lib/scoring';
import { LEAGUE_CAPACITY } from '../lib/types';
import type { League, LeagueMode, Member } from '../lib/types';

// Same algorithm as legacy generateCode() in 19pool_15.html.
function generateLeagueCode(): string {
  const words = ['WOLF', 'HAWK', 'BULL', 'BLITZ', 'RUSH', 'IRON', 'BOLT', 'COLT', 'BEAR', 'LION'];
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1
  let suffix = '';
  for (let i = 0; i < 5; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${words[Math.floor(Math.random() * words.length)]}-${suffix}`;
}

export default function CreateLeague() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [leagueName, setLeagueName] = useState('');
  const [mode, setMode] = useState<LeagueMode>('classic');
  const [seasonEntry, setSeasonEntry] = useState('');
  const [venmo, setVenmo] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!user) {
      setError('You must be signed in to create a league.');
      return;
    }
    if (!leagueName.trim()) {
      setError('Please enter a league name.');
      return;
    }

    const entryAmount = seasonEntry ? Number(seasonEntry) : 0;
    if (Number.isNaN(entryAmount) || entryAmount < 0) {
      setError('Season entry amount must be a positive number.');
      return;
    }

    setSubmitting(true);
    try {
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      const userData = userSnap.exists() ? userSnap.data() : {};
      const firstName: string = userData.firstName ?? '';
      const lastName: string = userData.lastName ?? '';
      const userEmail = (user.email ?? '').toLowerCase();
      const displayName = buildDisplayName(firstName, lastName, userEmail.split('@')[0]);

      const code = generateLeagueCode();

      const leagueDoc: Omit<League, 'createdAt'> & {
        createdAt: ReturnType<typeof serverTimestamp>;
      } = {
        name: leagueName.trim(),
        code,
        commissionerId: user.uid,
        commissionerEmail: userEmail,
        commissionerName: displayName,
        seasonEntry: entryAmount,
        potOverride: null,
        venmo: venmo.trim(),
        pot: 0,
        season: new Date().getFullYear(),
        memberCount: 1,
        status: 'recruiting',
        mode,
        unownedTeams: [],
        teamsAssignedAt: null,
        lockedAt: null,
        skipReassignmentCheck: false,
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'leagues', code), leagueDoc);

      const commissionerMember: Member = {
        uid: user.uid,
        email: userEmail,
        firstName,
        lastName,
        name: displayName,
        phone: '',
        teams: [],
        wins: 0,
        closest: 0,
        role: 'commissioner',
        invitedAt: null,
        joinedAt: null,
        inviteToken: generateInviteToken(),
        lastInviteSentAt: null,
      };
      const memberRef = doc(collection(db, 'leagues', code, 'members'));
      await setDoc(memberRef, {
        ...commissionerMember,
        invitedAt: serverTimestamp(),
        joinedAt: serverTimestamp(),
      });

      await updateDoc(doc(db, 'users', user.uid), { leagueCode: code });

      // Primary conversion: a commissioner stood up a league. This is the
      // event ad delivery should optimize toward, not raw registrations.
      trackEvent('StartTrial');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const message =
        (err as { message?: string })?.message ??
        'Could not create league. Please try again.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="hero-bg flex-1 flex items-center justify-center px-4 py-16">
      <Card className="w-full max-w-lg">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-white">Create Your League</h1>
          <p className="text-slate-400 text-sm mt-1">
            Set up the basics. You can configure team assignments later.
          </p>
        </div>

        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="League Name"
            type="text"
            maxLength={40}
            placeholder="e.g. Sunday Funday Pool 2025"
            value={leagueName}
            onChange={(e) => setLeagueName(e.target.value)}
          />
          <div>
            <p className="block text-sm font-semibold text-slate-300 mb-2">
              How teams get assigned
            </p>
            <LeagueModeCards value={mode} onChange={setMode} />
          </div>
          <div>
            <Input
              label="Per-Player Entry Fee (Optional)"
              type="number"
              min="0"
              step="1"
              placeholder="e.g. 50"
              value={seasonEntry}
              onChange={(e) => setSeasonEntry(e.target.value)}
            />
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Each player Venmos you this amount at league start. You can adjust
              this later.
            </p>
            {(() => {
              const n = Number(seasonEntry);
              if (!seasonEntry || Number.isNaN(n) || n <= 0) return null;
              const potAtCap = n * LEAGUE_CAPACITY;
              const perWeek = computeWeeklyShareFromPot(potAtCap);
              return (
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  If you have {LEAGUE_CAPACITY} players, your season pot will be{' '}
                  <span className="text-amber-400 font-semibold">
                    ${potAtCap.toLocaleString('en-US')}
                  </span>{' '}
                  — that's{' '}
                  <span className="text-amber-400 font-semibold">
                    ${perWeek.toLocaleString('en-US')} per week
                  </span>{' '}
                  over the 18-week NFL regular season. You can also adjust the
                  pot directly after creating the league.
                </p>
              );
            })()}
          </div>
          <Input
            label="Venmo Handle (optional)"
            type="text"
            placeholder="@your-handle"
            value={venmo}
            onChange={(e) => setVenmo(e.target.value)}
          />

          <div className="flex items-center justify-between mt-6">
            <Link
              to="/dashboard"
              className="text-slate-400 hover:text-white text-sm transition-colors"
            >
              ← Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="bg-amber-500 hover:bg-amber-400 text-navy-950 font-bold px-8 py-3 rounded-full transition-all tracking-wide disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? 'Creating…' : 'Create League →'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
