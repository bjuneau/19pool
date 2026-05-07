import type { Strength } from '../lib/passwordStrength';
import { strengthBarColor } from '../lib/passwordStrength';

type Props = {
  password: string;
  strength: Strength;
};

export function PasswordStrengthBar({ password, strength }: Props) {
  if (!password) return null;
  const color = strengthBarColor(strength.score);
  return (
    <div className="-mt-2 mb-1">
      <div className="flex gap-1 mb-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < strength.score ? color : 'bg-white/10'
            }`}
          />
        ))}
      </div>
      <p className={`text-xs ${strength.color}`}>{strength.label}</p>
    </div>
  );
}
