/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Editorial palette — warm dark newsprint reverse-print.
        // paper = background, ink = text, accent = whiskey amber,
        // hot = vermillion for winning-19 moments.
        paper: {
          DEFAULT: '#0F0E0C',   // warm near-black
          2: '#1A1815',         // one step elevated
          3: '#26221E',         // two steps elevated
        },
        ink: {
          DEFAULT: '#F2EBDD',   // warm off-white body / heading
          dim: 'rgba(242, 235, 221, 0.62)',
          muted: 'rgba(242, 235, 221, 0.40)',
          line: 'rgba(242, 235, 221, 0.14)',
        },
        accent: {
          DEFAULT: '#F0B537',   // whiskey amber — brand
          bright: '#FFC856',
          dim: 'rgba(240, 181, 55, 0.14)',
        },
        hot: {
          DEFAULT: '#E85D3A',   // vermillion — winners, live states
          dim: 'rgba(232, 93, 58, 0.14)',
        },
        // Marketing-page dark palette (matches challenge-b reference).
        // Deliberately named separately from paper/ink so Landing can
        // use them without affecting the app tokens.
        volt: {
          DEFAULT: '#C4F82A',   // neon lime accent
          soft: 'rgba(196, 248, 42, 0.14)',
        },
        void: {
          DEFAULT: '#0A0A0A',   // near-black marketing bg
          2: '#141414',         // elevated card
          3: '#1E1E1E',         // one more up
          line: 'rgba(255, 255, 255, 0.08)',
        },
        // Kept for backwards compat while pages migrate. Aliased to the
        // new palette so lingering bg-navy-950 / text-amber-500 refs
        // render in the new tones instead of the old SaaS blue.
        navy: {
          950: '#0F0E0C',
          900: '#1A1815',
          800: '#26221E',
          700: '#332E28',
          600: '#413A32',
        },
        amber: {
          300: '#FFD584',
          400: '#FFC856',
          500: '#F0B537',
          600: '#D19A28',
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
        'kicker': '0.16em',   // small-caps section labels
      },
    },
  },
  plugins: [],
};
