export type Strength = {
  score: number;
  label: string;
  color: string;
};

export function getPasswordStrength(pw: string): Strength {
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

export function strengthBarColor(score: number): string {
  if (score <= 1) return 'bg-red-400';
  if (score <= 3) return 'bg-amber-400';
  return 'bg-green-400';
}

// Shared validation used by both signup paths (SignUp.tsx and Join.tsx).
// Returns null when valid, or an error message to display.
export function validatePasswordPair(
  password: string,
  confirmPassword: string,
  strength: Strength
): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (password !== confirmPassword) {
    return 'Passwords do not match. Please re-type to confirm.';
  }
  if (strength.score < 2) {
    return 'Password is too weak. Try a longer password or add numbers/symbols.';
  }
  return null;
}
