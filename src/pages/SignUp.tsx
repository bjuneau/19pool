import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { authErrorMessage, useAuth } from '../lib/auth';
import { db } from '../lib/firebase';

const TOS_VERSION = '2026-05-05';

type Strength = { score: number; label: string; color: string };

function getPasswordStrength(pw: string): Strength {
  if (!pw) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  score = Math.min(score, 4);
  const labels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = [
    'text-red-400',
    'text-red-400',
    'text-amber-400',
    'text-amber-300',
    'text-green-400',
  ];
  return { score, label: labels[score], color: colors[score] };
}

function strengthBarColor(score: number): string {
  if (score <= 1) return 'bg-red-400';
  if (score <= 3) return 'bg-amber-400';
  return 'bg-green-400';
}

export default function SignUp() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const strength = getPasswordStrength(password);

  async function handleSubmit(e: FormEvent) {
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
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-type to confirm.');
      return;
    }
    if (strength.score < 2) {
      setError('Password is too weak. Try a longer password or add numbers/symbols.');
      return;
    }

    setSubmitting(true);
    try {
      const cred = await signUp(email.trim(), password);
      await setDoc(doc(db, 'users', cred.user.uid), {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        leagueCode: '',
        acceptedTOS: true,
        acceptedTOSVersion: TOS_VERSION,
        acceptedTOSAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
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
    <div className="hero-bg min-h-screen flex items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="text-3xl font-extrabold mb-1 inline-block">
            <span className="text-amber-400">19</span>
            <span className="text-white"> POOL</span>
          </Link>
          <p className="text-slate-400 text-sm mt-2">Create your account</p>
        </div>

        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
          {password && (
            <div className="-mt-2 mb-1">
              <div className="flex gap-1 mb-1">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      i < strength.score ? strengthBarColor(strength.score) : 'bg-white/10'
                    }`}
                  />
                ))}
              </div>
              <p className={`text-xs ${strength.color}`}>{strength.label}</p>
            </div>
          )}
          <Input
            label="Confirm Password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Re-type your password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            endAdornment={passwordToggle}
          />
          <p className="text-xs text-slate-500 leading-relaxed">
            By creating an account, you agree to the Terms &amp; Conditions and
            confirm you are 18 or older.
          </p>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-amber-500 hover:bg-amber-400 text-navy-950 font-bold py-3 rounded-xl mt-2 transition-all tracking-wide disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-400 mt-6">
          Already have an account?{' '}
          <Link to="/signin" className="text-amber-400 hover:text-amber-300 font-semibold">
            Sign in
          </Link>
        </p>
        <div className="text-center mt-4">
          <Link
            to="/"
            className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </Card>
    </div>
  );
}
