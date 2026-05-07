import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { authErrorMessage, useAuth } from '../lib/auth';
import { db } from '../lib/firebase';

const TOS_VERSION = '2026-05-05';

export default function SignUp() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
            type="password"
            placeholder="Min. 8 characters"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
