/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── App palette (dark utility, volt-lime accent) ────────────────
        // paper = background surfaces, ink = text, accent = volt lime,
        // hot = vermillion for winning-19 / live states.
        paper: {
          DEFAULT: '#0A0A0A',   // near-black — matches Landing void
          2: '#141414',         // elevated card
          3: '#1E1E1E',         // one more up
        },
        ink: {
          DEFAULT: '#FAFAFA',   // near-white
          dim: 'rgba(250, 250, 250, 0.65)',
          muted: 'rgba(250, 250, 250, 0.42)',
          line: 'rgba(255, 255, 255, 0.08)',
        },
        accent: {
          DEFAULT: '#C4F82A',   // volt lime — brand accent
          bright: '#D3FF3D',
          dim: 'rgba(196, 248, 42, 0.14)',
        },
        hot: {
          DEFAULT: '#E85D3A',   // vermillion — winners, live states
          dim: 'rgba(232, 93, 58, 0.14)',
        },

        // ── Backwards-compat aliases ────────────────────────────────────
        // Legacy pages still reference bg-navy-* / text-amber-* directly.
        // Both aliases now point at the new void + volt values so those
        // pages render coherently without needing per-file rewrites.
        navy: {
          950: '#0A0A0A',
          900: '#141414',
          800: '#1E1E1E',
          700: '#282828',
          600: '#333333',
        },
        amber: {
          200: '#EAFF80',
          300: '#DDFF4A',
          400: '#D3FF3D',
          500: '#C4F82A',
          600: '#A5D619',
        },

        // ── Landing-namespace aliases (still referenced by hardcoded
        // classes in Landing.tsx that predate the token unification) ────
        volt: {
          DEFAULT: '#C4F82A',
          soft: 'rgba(196, 248, 42, 0.14)',
        },
        void: {
          DEFAULT: '#0A0A0A',
          2: '#141414',
          3: '#1E1E1E',
          line: 'rgba(255, 255, 255, 0.08)',
        },
      },
      fontFamily: {
        // Matches go.amazing.com/challenge-b: Inter for body, Inter Tight
        // (condensed member of the same family) for chunky display type.
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Inter Tight"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      letterSpacing: {
        'kicker': '0.16em',
      },
    },
  },
  plugins: [],
};
