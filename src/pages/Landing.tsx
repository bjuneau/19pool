import { Link } from 'react-router-dom';

// Editorial landing — a weekly-newspaper spread for a football pool.
// Fraunces display + Instrument Sans body, hairline rules between
// sections instead of floating cards. Asymmetric grids, big numerals as
// art, small-caps kickers.

export default function Landing() {
  return (
    <div className="min-h-screen bg-paper text-ink font-sans">
      {/* ── Masthead ─────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-paper/95 backdrop-blur-sm border-b border-ink-line">
        <div className="max-w-6xl mx-auto h-14 flex items-center justify-between px-5 sm:px-8">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="font-display font-black text-2xl leading-none text-accent">
              19
            </span>
            <span className="kicker text-ink">Pool</span>
          </Link>
          <div className="flex items-center gap-4 sm:gap-6">
            <Link
              to="/signin"
              className="text-sm text-ink-dim hover:text-ink transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/signup"
              className="text-sm font-semibold bg-accent hover:bg-accent-bright text-paper px-4 py-2 rounded-sm transition-colors"
            >
              Create league →
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Issue kicker (mimics "Vol. IV · Sunday Edition") ─────────── */}
      <div className="border-b border-ink-line">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-2 flex items-center justify-between text-[10px] font-mono tracking-widest uppercase text-ink-muted">
          <span>The 19 Pool · Weekly Ledger</span>
          <span className="hidden sm:inline">NFL / Regular Season / Sundays</span>
          <span>Est. 2025</span>
        </div>
      </div>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 pt-12 sm:pt-24 pb-16 sm:pb-24">
        <div className="grid sm:grid-cols-12 gap-6 sm:gap-10 items-end">
          <div className="sm:col-span-8">
            <p className="kicker text-accent mb-6">
              A Number Game · Est. Sunday
            </p>
            <h1 className="font-display font-black text-[13vw] sm:text-[9rem] leading-[0.85] tracking-[-0.04em] text-ink">
              Score
              <br />
              <span className="italic font-black">nineteen</span>.
              <br />
              Take the
              <br />
              <span className="text-accent">whole pot</span>.
            </h1>
          </div>
          <div className="sm:col-span-4 sm:pl-6 sm:border-l sm:border-ink-line">
            <p className="text-lg leading-snug text-ink-dim mb-6">
              Thirty‑two people, thirty‑two NFL teams. Any team ends the week on
              exactly nineteen — win or lose — and its owner pockets the pot.
            </p>
            <p className="text-sm text-ink-muted mb-8">
              Scores stream live from ESPN. No spreadsheets. No arguments.
            </p>
            <div className="flex flex-col gap-2">
              <Link
                to="/signup"
                className="bg-accent hover:bg-accent-bright text-paper text-sm font-semibold px-5 py-3 rounded-sm text-center transition-colors"
              >
                Create a league →
              </Link>
              <Link
                to="/signup"
                className="border border-ink-line hover:border-ink-dim text-ink text-sm font-semibold px-5 py-3 rounded-sm text-center transition-colors"
              >
                Join with a code
              </Link>
            </div>
          </div>
        </div>
      </section>

      <SectionRule label="I · The Game" />

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 py-12 sm:py-20">
        <div className="grid sm:grid-cols-12 gap-6 sm:gap-10 mb-10 sm:mb-16">
          <div className="sm:col-span-5">
            <h2 className="font-display font-black text-4xl sm:text-6xl leading-[0.95] tracking-tight">
              Simple rules.
              <br />
              <em className="text-accent not-italic">Big drama.</em>
            </h2>
          </div>
          <p className="sm:col-span-6 sm:col-start-7 text-lg text-ink-dim leading-relaxed self-end">
            The Sunday ritual, formalized. A pool for the friend‑group who
            already texts about football every week — with an actual reason for
            the group chat to explode when Cleveland scores nineteen.
          </p>
        </div>

        <ol className="divide-y divide-ink-line border-y border-ink-line">
          {[
            {
              n: '01',
              t: 'Form your league.',
              b: 'One commissioner creates the league and invites exactly thirty‑two people. Set the weekly stakes on the way in.',
            },
            {
              n: '02',
              t: 'Get your team.',
              b: 'The commissioner assigns one NFL team to each player. That team belongs to you for the whole season.',
            },
            {
              n: '03',
              t: 'Watch live scores.',
              b: 'Every score refreshes from ESPN every thirty seconds. Zero manual entry. Zero disputes.',
            },
            {
              n: '04',
              t: 'Hit nineteen. Take the pot.',
              b: 'Your team ends on exactly nineteen — offense, defense, however it happens — and the weekly prize is yours.',
            },
          ].map((s) => (
            <li key={s.n} className="grid sm:grid-cols-12 gap-4 py-6 sm:py-8">
              <span className="font-mono text-accent text-sm sm:col-span-1">
                {s.n}
              </span>
              <h3 className="font-display font-black text-xl sm:text-2xl sm:col-span-4 leading-tight">
                {s.t}
              </h3>
              <p className="text-ink-dim sm:col-span-7 leading-relaxed">
                {s.b}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <SectionRule label="II · The Number" />

      {/* ── 19 pull ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-paper-2 py-16 sm:py-32">
        <span
          aria-hidden
          className="absolute -top-16 sm:-top-24 -right-6 sm:right-8 font-display font-black text-[40vw] sm:text-[28rem] leading-none text-accent/25 select-none pointer-events-none"
        >
          19
        </span>
        <div className="relative max-w-6xl mx-auto px-5 sm:px-8">
          <div className="max-w-2xl">
            <p className="kicker text-ink-muted mb-6">A Pull‑Quote</p>
            <blockquote className="font-display font-black text-4xl sm:text-6xl leading-[0.95] tracking-[-0.03em] text-ink">
              The only number
              <br />
              that matters is
              <br />
              <span className="text-accent">nineteen.</span>
            </blockquote>
            <p className="mt-6 text-ink-dim max-w-md">
              Offense, defense, safety, blown extra point — however a team
              lands on nineteen at the final whistle, it wins the week for
              whoever owns it.
            </p>
            <Link
              to="/signup"
              className="inline-block mt-8 text-sm font-semibold border-b border-accent text-accent hover:text-ink hover:border-ink transition-colors"
            >
              Start your league →
            </Link>
          </div>
        </div>
      </section>

      <SectionRule label="III · The Stakes" />

      {/* ── Stakes grid ─────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 py-12 sm:py-20">
        <div className="grid sm:grid-cols-12 gap-6 sm:gap-10 mb-10 sm:mb-14">
          <div className="sm:col-span-6">
            <h2 className="font-display font-black text-4xl sm:text-5xl leading-[0.95] tracking-tight">
              Win the week.
              <br />
              <em className="text-accent not-italic">Or watch it grow.</em>
            </h2>
          </div>
          <p className="sm:col-span-5 sm:col-start-8 text-ink-dim leading-relaxed self-end">
            Weeks without a nineteen roll into the next. Some weeks pay a
            little. Some weeks pay months of built‑up rollover to one lucky
            team owner.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 border-t border-l border-ink-line">
          {[
            {
              t: 'Weekly Pot',
              b: 'Every entry fee compounds into the weekly prize. Hit nineteen, take it home.',
            },
            {
              t: 'Rollover',
              b: 'No nineteen this week? The prize rolls into next. Great weeks get very great.',
            },
            {
              t: 'Live Scores',
              b: 'Every 30 seconds from ESPN. No stat‑keeper, no ties, no arguments.',
            },
            {
              t: 'Thirty‑two Teams',
              b: 'The whole league is in play every Sunday. Every game matters to somebody.',
            },
          ].map((s) => (
            <div key={s.t} className="border-r border-b border-ink-line p-6 sm:p-8">
              <h3 className="font-display font-black text-2xl text-ink mb-3 leading-tight">
                {s.t}
              </h3>
              <p className="text-ink-dim text-sm leading-relaxed">{s.b}</p>
            </div>
          ))}
        </div>
      </section>

      <SectionRule label="Coda" />

      {/* ── Final CTA ────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 py-16 sm:py-24">
        <div className="grid sm:grid-cols-12 gap-6 sm:gap-10 items-end">
          <div className="sm:col-span-7">
            <h2 className="font-display font-black text-5xl sm:text-7xl leading-[0.9] tracking-[-0.03em]">
              Ready to run
              <br />
              <em className="text-accent not-italic">your league?</em>
            </h2>
          </div>
          <div className="sm:col-span-5 sm:pl-6 sm:border-l sm:border-ink-line">
            <p className="text-ink-dim mb-6">
              Two minutes to set up. Sixty‑five days of Sundays.
            </p>
            <div className="flex flex-col gap-2">
              <Link
                to="/signup"
                className="bg-accent hover:bg-accent-bright text-paper text-sm font-semibold px-5 py-3 rounded-sm text-center transition-colors"
              >
                Create your league →
              </Link>
              <Link
                to="/signup"
                className="border border-ink-line hover:border-ink-dim text-ink text-sm font-semibold px-5 py-3 rounded-sm text-center transition-colors"
              >
                Join with a code
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Colophon / footer ────────────────────────────────────────── */}
      <footer className="border-t border-ink-line">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] font-mono tracking-widest uppercase text-ink-muted">
          <div className="flex items-baseline gap-2">
            <span className="font-display font-black text-ink text-base leading-none">
              19
            </span>
            <span>Pool</span>
          </div>
          <span className="text-center">
            Not affiliated with the NFL or ESPN. © 2026 19 Pool.
          </span>
          <div className="flex gap-5">
            <Link to="/signup" className="hover:text-ink transition-colors">
              Create
            </Link>
            <Link to="/signup" className="hover:text-ink transition-colors">
              Join
            </Link>
            <Link to="/signin" className="hover:text-ink transition-colors">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── Section rule ─────────────────────────────────────────────────────
// A hairline divider with a small-caps roman-numeral label sitting in the
// middle — the sort of thing a Sunday paper does between "articles" on
// the same page.
function SectionRule({ label }: { label: string }) {
  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-8">
      <div className="flex items-center gap-4 py-3 border-t border-ink-line">
        <span className="kicker text-ink-muted">{label}</span>
        <span className="flex-1 h-px bg-ink-line" />
      </div>
    </div>
  );
}
