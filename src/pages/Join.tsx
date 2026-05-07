import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { PasswordStrengthBar } from '../components/PasswordStrengthBar';
import { authErrorMessage, useAuth } from '../lib/auth';
import { db } from '../lib/firebase';
import {
  claimOrCreateMember,
  resolveInvite,
} from '../lib/members';
import type { ResolvedInvite } from '../lib/members';
import {
  getPasswordStrength,
  validatePasswordPair,
} from '../lib/passwordStrength';
import { LEAGUE_CAPACITY } from '../lib/types';

const TOS_VERSION = '2026-05-05';

type ResolveState =
  | { kind: 'loading' }
  | { kind: 'invalid' }
  | { kind: 'ready'; invite: ResolvedInvite };

export default function Join() {
  const { codeOrToken } = useParams<{ codeOrToken: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [resolveState, setResolveState] = useState<ResolveState>({ kind: 'loading' });
  const [manualCode, setManualCode] = useState('');
  const [actionError, setActionError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!codeOrToken) {
      setResolveState({ kind: 'invalid' });
      return;
    }
    setResolveState({ kind: 'loading' });
    resolveInvite(codeOrToken)
      .then((invite) => {
        if (cancelled) return;
        setResolveState(invite ? { kind: 'ready', invite } : { kind: 'invalid' });
      })
      .catch(() => {
        if (!cancelled) setResolveState({ kind: 'invalid' });
      });
    return () => {
      cancelled = true;
    };
  }, [codeOrToken]);

  // Sub-screen: no codeOrToken → prompt for one.
  if (!codeOrToken) {
    return (
      <CenteredCard>
        <h1 className="text-2xl font-extrabold text-white mb-2">Join a League</h1>
        <p className="text-slate-400 text-sm mb-6">
          Enter the invite code your commissioner gave you.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = manualCode.trim();
            if (trimmed) navigate(`/join/${trimmed}`);
          }}
          className="space-y-4"
        >
          <Input
            label="Invite Code"
            placeholder="WOLF-2291"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            className="font-mono tracking-widest uppercase"
          />
          <button
            type="submit"
            className="w-full bg-amber-500 hover:bg-amber-400 text-navy-950 font-bold py-3 rounded-xl transition-all tracking-wide"
          >
            Continue →
          </button>
        </form>
      </CenteredCard>
    );
  }

  if (resolveState.kind === 'loading' || authLoading) {
    return (
      <CenteredCard>
        <p className="text-slate-400 text-sm text-center">Loading invite…</p>
      </CenteredCard>
    );
  }

  if (resolveState.kind === 'invalid') {
    return (
      <CenteredCard>
        <h1 className="text-2xl font-extrabold text-white mb-2">Invalid invite</h1>
        <p className="text-slate-400 text-sm mb-6">
          This invite link is invalid or expired. Double-check the link your
          commissioner sent you.
        </p>
        <Link
          to="/join"
          className="inline-block bg-amber-500 hover:bg-amber-400 text-navy-950 font-bold px-6 py-2.5 rounded-full transition-all tracking-wide"
        >
          Enter Invite Code Manually
        </Link>
      </CenteredCard>
    );
  }

  const { invite } = resolveState;
  const userEmail = (user?.email ?? '').toLowerCase();
  const alreadyJoined =
    !!user &&
    !!invite.invitedMember &&
    invite.invitedMember.uid === user.uid &&
    !!invite.invitedMember.joinedAt;

  // Already a member of this league via the resolved invite token.
  if (alreadyJoined) {
    return (
      <CenteredCard>
        <h1 className="text-2xl font-extrabold text-white mb-2">
          You're already in <span className="text-amber-400">{invite.league.name}</span>.
        </h1>
        <p className="text-slate-400 text-sm mb-6">
          Head to your dashboard to keep things rolling.
        </p>
        <Link
          to="/dashboard"
          className="inline-block bg-amber-500 hover:bg-amber-400 text-navy-950 font-bold px-6 py-2.5 rounded-full transition-all tracking-wide"
        >
          Go to Dashboard
        </Link>
      </CenteredCard>
    );
  }

  async function handleConfirmJoin() {
    if (!user) return;
    setActionError('');
    setSubmitting(true);
    try {
      const result = await claimOrCreateMember({
        leagueCode: invite.leagueCode,
        league: invite.league,
        invitedMember: invite.invitedMember,
        user,
      });
      if (!result.ok) {
        setActionError(result.error);
        setSubmitting(false);
        return;
      }
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setActionError(
        (err as { message?: string })?.message ?? 'Could not join the league.'
      );
      setSubmitting(false);
    }
  }

  // Signed in: simple confirm step.
  if (user) {
    // Block obvious wrong-email mismatches early when we have a token.
    const tokenLockedToOther =
      !!invite.invitedMember &&
      !!invite.invitedMember.email &&
      invite.invitedMember.email !== userEmail &&
      !!invite.invitedMember.uid &&
      invite.invitedMember.uid !== user.uid;

    return (
      <CenteredCard>
        <h1 className="text-2xl font-extrabold text-white mb-2">
          Join <span className="text-amber-400">{invite.league.name}</span>?
        </h1>
        <p className="text-slate-400 text-sm mb-6">
          You're signed in as{' '}
          <span className="text-white font-semibold">{userEmail}</span>.
          {invite.invitedMember
            ? ' This invite is waiting for you to claim it.'
            : ` ${invite.league.memberCount} of ${LEAGUE_CAPACITY} spots taken.`}
        </p>

        {tokenLockedToOther && (
          <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl">
            This invite was sent to a different account.
          </div>
        )}
        {actionError && (
          <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl">
            {actionError}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            to="/dashboard"
            className="flex-1 text-center text-slate-400 hover:text-white text-sm py-3 transition-colors"
          >
            Not now
          </Link>
          <button
            type="button"
            onClick={handleConfirmJoin}
            disabled={submitting || tokenLockedToOther}
            className="flex-1 bg-amber-500 hover:bg-amber-400 text-navy-950 font-bold py-3 rounded-full transition-all tracking-wide disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? 'Joining…' : 'Join League'}
          </button>
        </div>
      </CenteredCard>
    );
  }

  // Not signed in: render the auth flow.
  return (
    <JoinAuthFlow
      invite={invite}
      defaultEmail={invite.invitedMember?.email ?? ''}
    />
  );
}

function JoinAuthFlow({
  invite,
  defaultEmail,
}: {
  invite: ResolvedInvite;
  defaultEmail: string;
}) {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const strength = getPasswordStrength(password);
  const emailLockedToInvite = !!invite.invitedMember?.email;

  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!firstName.trim() || !email.trim()) {
      setError('First name and email are required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email.');
      return;
    }
    const pwError = validatePasswordPair(password, confirmPassword, strength);
    if (pwError) {
      setError(pwError);
      return;
    }

    setSubmitting(true);
    try {
      const cred = await signUp(email.trim(), password);
      await setDoc(doc(db, 'users', cred.user.uid), {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        leagueCode: '',
        acceptedTOS: true,
        acceptedTOSVersion: TOS_VERSION,
        acceptedTOSAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
      const result = await claimOrCreateMember({
        leagueCode: invite.leagueCode,
        league: invite.league,
        invitedMember: invite.invitedMember,
        user: cred.user,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      if (!result.ok) {
        setError(result.error);
        setSubmitting(false);
        return;
      }
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(authErrorMessage(err));
      setSubmitting(false);
    }
  }

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setSubmitting(true);
    try {
      const cred = await signIn(email.trim(), password);
      const result = await claimOrCreateMember({
        leagueCode: invite.leagueCode,
        league: invite.league,
        invitedMember: invite.invitedMember,
        user: cred.user,
      });
      if (!result.ok) {
        setError(result.error);
        setSubmitting(false);
        return;
      }
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(authErrorMessage(err));
      setSubmitting(false);
    }
  }

  const passwordToggle = (
    <button
      type="button"
      onClick={() => setShowPassword((s) => !s)}
      className="text-slate-400 hover:text-amber-400 transition-colors text-xs font-medium"
      aria-label={showPassword ? 'Hide password' : 'Show password'}
    >
      {showPassword ? 'Hide' : 'Show'}
    </button>
  );

  return (
    <CenteredCard wide>
      <div className="text-center mb-6">
        <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">
          You're invited to join
        </p>
        <h1 className="text-2xl font-extrabold text-white">{invite.league.name}</h1>
      </div>

      <div className="flex bg-navy-950/80 rounded-xl p-1 mb-6 gap-1">
        <button
          type="button"
          onClick={() => setMode('signup')}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
            mode === 'signup' ? 'bg-navy-700 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          Create Account
        </button>
        <button
          type="button"
          onClick={() => setMode('signin')}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
            mode === 'signin' ? 'bg-navy-700 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          Sign In
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {mode === 'signup' ? (
        <form onSubmit={handleSignUp} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First Name"
              type="text"
              placeholder="Brooks"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            <Input
              label="Last Name"
              type="text"
              placeholder="Smith"
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            readOnly={emailLockedToInvite}
            className={emailLockedToInvite ? 'opacity-70 cursor-not-allowed' : ''}
          />
          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Min. 8 characters"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            endAdornment={passwordToggle}
          />
          <PasswordStrengthBar password={password} strength={strength} />
          <Input
            label="Confirm Password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Re-type your password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            endAdornment={passwordToggle}
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-amber-500 hover:bg-amber-400 text-navy-950 font-bold py-3 rounded-xl mt-2 transition-all tracking-wide disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? 'Creating account…' : 'Create Account & Join'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleSignIn} className="space-y-4">
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            endAdornment={passwordToggle}
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-amber-500 hover:bg-amber-400 text-navy-950 font-bold py-3 rounded-xl mt-2 transition-all tracking-wide disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? 'Signing in…' : 'Sign In & Join'}
          </button>
        </form>
      )}
    </CenteredCard>
  );
}

function CenteredCard({
  children,
  wide,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="hero-bg min-h-screen flex items-center justify-center px-4 py-16">
      <Card className={`w-full ${wide ? 'max-w-md' : 'max-w-md'}`}>{children}</Card>
    </div>
  );
}
