import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { authErrorMessage } from '../lib/auth';
import { auth } from '../lib/firebase';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  // Captured at submit time so the success message keeps showing the address
  // the user entered, even if they later edit the input.
  const [sentTo, setSentTo] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    const trimmed = email.trim();
    if (!trimmed) {
      setError('Please enter your email.');
      return;
    }

    setSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, trimmed);
      setSentTo(trimmed);
      setSent(true);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      // Don't leak whether the email is registered. A genuine user who typo'd
      // simply won't get an email.
      if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
        setSentTo(trimmed);
        setSent(true);
      } else {
        setError(authErrorMessage(err));
      }
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
          <p className="text-slate-400 text-sm mt-2">Reset your password</p>
        </div>

        {sent ? (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-4 text-3xl">
              📬
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Check your email</h3>
            <p className="text-slate-400 text-sm mb-6">
              We've sent a password reset link to{' '}
              <span className="text-white font-semibold">{sentTo}</span>. Follow
              the link to set a new password.
            </p>
            <Link
              to="/signin"
              className="inline-block bg-amber-500 hover:bg-amber-400 text-navy-950 font-bold px-6 py-2.5 rounded-full transition-all tracking-wide"
            >
              Back to Sign In
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="text-xs text-slate-500 leading-relaxed">
                Enter the email associated with your 19 Pool account and we'll
                send you a link to reset your password.
              </p>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-amber-500 hover:bg-amber-400 text-navy-950 font-bold py-3 rounded-xl mt-2 transition-all tracking-wide disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>

            <p className="text-center text-sm text-slate-400 mt-6">
              Remembered your password?{' '}
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
          </>
        )}
      </Card>
    </div>
  );
}
