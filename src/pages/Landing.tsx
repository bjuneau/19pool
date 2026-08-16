import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

// Marketing page — modern light-mode SaaS. Modeled on the challenge-b
// aesthetic: white/off-white alternating sections, near-black text,
// electric-blue accent, numbered section markers, subtle shadows.
// Uses hardcoded light-theme classes so it doesn't interfere with the
// dark app theme downstream.

export default function Landing() {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans antialiased">
      {/* ── Nav ──────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-5 sm:px-8 h-16">
          <Link to="/" className="flex items-baseline gap-1.5">
            <span className="font-display font-extrabold text-2xl leading-none text-amber-500">
              19
            </span>
            <span className="font-display font-bold text-lg text-slate-900 tracking-tight">
              Pool
            </span>
          </Link>
          <div className="flex items-center gap-3 sm:gap-5">
            <Link
              to="/signin"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/signup"
              className="text-sm font-semibold bg-[#155EEF] hover:bg-[#1548CC] text-white px-4 py-2 rounded-lg transition-colors shadow-sm"
            >
              Create league
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 pt-14 sm:pt-24 pb-16 sm:pb-24">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 items-center">
          <div className="lg:col-span-7">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              NFL · 32 players · One winner each week
            </span>
            <h1 className="font-display font-extrabold text-5xl sm:text-6xl lg:text-7xl leading-[1.02] tracking-tight text-slate-900 mb-6">
              Score exactly{' '}
              <span className="text-amber-500">19</span>.<br />
              Take home the pot.
            </h1>
            <p className="text-lg sm:text-xl text-slate-600 leading-relaxed max-w-xl mb-8">
              Thirty‑two friends, thirty‑two NFL teams. Any team ends the week
              on exactly nineteen points and its owner pockets the whole
              weekly pot. Scores stream live from ESPN — no spreadsheets, no
              arguments.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                to="/signup"
                className="inline-flex items-center justify-center bg-[#155EEF] hover:bg-[#1548CC] text-white font-semibold px-6 py-3.5 rounded-lg shadow-sm transition-colors text-base"
              >
                Create a league →
              </Link>
              <Link
                to="/signup"
                className="inline-flex items-center justify-center bg-white hover:bg-slate-50 text-slate-900 font-semibold px-6 py-3.5 rounded-lg border border-slate-300 transition-colors text-base"
              >
                Join with a code
              </Link>
            </div>
            <p className="text-xs text-slate-500 mt-5">
              Free to try · No credit card · Ready in 2 minutes
            </p>
          </div>

          {/* Hero visual — a phone showing app-shell placeholder */}
          <div className="lg:col-span-5 flex justify-center lg:justify-end">
            <PhoneMockup
              label="Weekly Results"
              accent="#F0B537"
              content={
                <MockScreen
                  kicker="Week 4 · Final"
                  title="Falcons hit 19"
                  subtitle="Brooks Juneau wins $27.78"
                  stats={[
                    { l: 'Weekly Pot', v: '$27.78' },
                    { l: 'Season Pot', v: '$500' },
                    { l: '19s so far', v: '3' },
                  ]}
                />
              }
            />
          </div>
        </div>
      </section>

      {/* ── Trust bar ────────────────────────────────────────────────── */}
      <section className="border-y border-slate-200 bg-slate-50">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-10 grid grid-cols-2 sm:grid-cols-4 gap-6 items-center text-center">
          <TrustStat n="32" label="Teams / league" />
          <TrustStat n="18" label="Weeks / season" />
          <TrustStat n="30s" label="Score refresh" />
          <TrustStat n="1" label="Winning number" accent />
        </div>
      </section>

      {/* ── 01 / See it on your phone ────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 py-16 sm:py-24">
        <SectionHead
          number="01"
          kicker="The Product"
          title="See the whole pool on your phone."
          sub="Every score. Every winner. Every rollover. Live from ESPN, no manual entry. Placeholder screenshots below — swap in real ones when the season starts."
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mt-14">
          <div className="text-center">
            <PhoneMockup
              label="Results"
              accent="#F0B537"
              content={
                <MockScreen
                  kicker="Week 4"
                  title="Live scores"
                  subtitle="Auto-refreshing"
                  stats={[
                    { l: 'BUC', v: '19' },
                    { l: 'MIA', v: '31' },
                  ]}
                />
              }
            />
            <p className="mt-6 font-display font-bold text-lg text-slate-900">
              Weekly Results
            </p>
            <p className="text-sm text-slate-600 mt-1 max-w-xs mx-auto">
              Live game grid highlights the team who hit 19 and who owns it.
            </p>
          </div>

          <div className="text-center">
            <PhoneMockup
              label="Standings"
              accent="#155EEF"
              content={
                <MockScreen
                  kicker="Season"
                  title="Leaderboard"
                  subtitle="Ranked by 19s"
                  stats={[
                    { l: '1 · Brooks', v: '2' },
                    { l: '2 · Sarah', v: '1' },
                    { l: '3 · Mike', v: '0' },
                  ]}
                />
              }
            />
            <p className="mt-6 font-display font-bold text-lg text-slate-900">
              Standings
            </p>
            <p className="text-sm text-slate-600 mt-1 max-w-xs mx-auto">
              Season-long leaderboard with 19s hit, pot totals, and past weeks.
            </p>
          </div>

          <div className="text-center">
            <PhoneMockup
              label="Payments"
              accent="#155EEF"
              content={
                <MockScreen
                  kicker="Entry Fee"
                  title="$50 per player"
                  subtitle="Venmo request →"
                  stats={[
                    { l: 'Paid', v: '13 / 16' },
                    { l: 'Collected', v: '$650' },
                  ]}
                />
              }
            />
            <p className="mt-6 font-display font-bold text-lg text-slate-900">
              Payments
            </p>
            <p className="text-sm text-slate-600 mt-1 max-w-xs mx-auto">
              Commissioner tools: track who's paid, send Venmo requests, close
              the books.
            </p>
          </div>
        </div>
      </section>

      {/* ── 02 / How it works ───────────────────────────────────────── */}
      <section className="bg-slate-50 border-y border-slate-200">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16 sm:py-24">
          <SectionHead
            number="02"
            kicker="How it works"
            title="Simple rules. Big drama."
            sub="Four steps from group chat to Sunday routine."
          />

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-14">
            {[
              {
                n: '01',
                t: 'Form your league',
                b: 'One commissioner invites up to thirty‑two players. Set the weekly stakes on the way in.',
              },
              {
                n: '02',
                t: 'Get your team',
                b: 'Assign one NFL team to each player. That team is yours all season.',
              },
              {
                n: '03',
                t: 'Watch live scores',
                b: 'Scores stream from ESPN every 30 seconds. Zero manual entry.',
              },
              {
                n: '04',
                t: 'Hit 19, take the pot',
                b: 'Your team ends on exactly nineteen — the entire weekly prize is yours.',
              },
            ].map((s) => (
              <div
                key={s.n}
                className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-slate-300 transition-all"
              >
                <div className="font-mono text-xs font-semibold text-[#155EEF] mb-4">
                  {s.n} /
                </div>
                <h3 className="font-display font-bold text-lg text-slate-900 mb-2">
                  {s.t}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">{s.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 03 / Features ────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 py-16 sm:py-24">
        <SectionHead
          number="03"
          kicker="What's included"
          title="Everything you need to run the pool."
          sub="Built for commissioners who'd rather watch football than chase members for a Venmo."
        />

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-14">
          {[
            {
              t: 'Live ESPN scores',
              b: 'Every 30 seconds. No stat‑keeper. No manual entry.',
            },
            {
              t: 'Automatic rollovers',
              b: 'Weeks without a 19 automatically roll into the next week’s pot.',
            },
            {
              t: 'Venmo integration',
              b: 'Player pay-in and commissioner payout links, one tap on mobile.',
            },
            {
              t: 'Team drag & drop',
              b: 'Reassign teams during recruiting, mid‑season, whenever. Historical results are preserved.',
            },
            {
              t: 'Payment tracker',
              b: 'Commissioner sees paid / unpaid at a glance. Filter and remind in seconds.',
            },
            {
              t: 'Free to try',
              b: 'No credit card up front. Run a season, decide if it’s worth keeping.',
            },
          ].map((f) => (
            <div
              key={f.t}
              className="border-t border-slate-200 pt-5"
            >
              <h3 className="font-display font-bold text-slate-900 text-base mb-1.5">
                {f.t}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">{f.b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 04 / Testimonials ────────────────────────────────────────── */}
      <section className="bg-slate-50 border-y border-slate-200">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16 sm:py-24">
          <SectionHead
            number="04"
            kicker="What players say"
            title="A better way to run the Sunday pool."
            sub="Placeholder quotes below — swap with real testimonials once your test league wraps its first season."
          />

          <div className="grid md:grid-cols-3 gap-6 mt-14">
            {TESTIMONIALS.map((t) => (
              <Testimonial key={t.name} {...t} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 py-16 sm:py-24">
        <div className="relative overflow-hidden bg-slate-900 rounded-3xl px-8 sm:px-16 py-14 sm:py-20 text-center">
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.06] pointer-events-none"
            style={{
              backgroundImage:
                'radial-gradient(circle at 30% 30%, #F0B537 0px, transparent 1px), radial-gradient(circle at 70% 70%, #155EEF 0px, transparent 1px)',
              backgroundSize: '40px 40px, 40px 40px',
            }}
          />
          <span
            aria-hidden
            className="absolute -bottom-16 -right-8 font-display font-black text-[18rem] leading-none text-amber-500/10 select-none pointer-events-none"
          >
            19
          </span>
          <div className="relative">
            <h2 className="font-display font-extrabold text-4xl sm:text-6xl text-white tracking-tight mb-5">
              Ready to run your league?
            </h2>
            <p className="text-lg text-slate-300 mb-10 max-w-lg mx-auto">
              Two minutes to set up. Sixty‑five days of Sundays.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <Link
                to="/signup"
                className="inline-flex items-center justify-center bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-6 py-3.5 rounded-lg transition-colors text-base"
              >
                Create your league →
              </Link>
              <Link
                to="/signup"
                className="inline-flex items-center justify-center bg-transparent hover:bg-white/10 text-white font-semibold px-6 py-3.5 rounded-lg border border-white/20 transition-colors text-base"
              >
                Join with a code
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <div className="flex items-baseline gap-1.5">
            <span className="font-display font-extrabold text-lg text-amber-500 leading-none">
              19
            </span>
            <span className="font-display font-bold text-slate-700">Pool</span>
          </div>
          <p className="text-center">
            Not affiliated with the NFL or ESPN. © 2026 19 Pool.
          </p>
          <div className="flex gap-5">
            <Link to="/signup" className="hover:text-slate-900 transition-colors">
              Create
            </Link>
            <Link to="/signup" className="hover:text-slate-900 transition-colors">
              Join
            </Link>
            <Link to="/signin" className="hover:text-slate-900 transition-colors">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── Section head with numbered marker (challenge-b signature) ──────

function SectionHead({
  number,
  kicker,
  title,
  sub,
}: {
  number: string;
  kicker: string;
  title: string;
  sub: string;
}) {
  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-4">
        <span className="font-mono text-sm font-semibold text-[#155EEF]">
          {number} /
        </span>
        <span className="text-xs uppercase tracking-[0.16em] font-semibold text-slate-500">
          {kicker}
        </span>
      </div>
      <h2 className="font-display font-extrabold text-3xl sm:text-5xl text-slate-900 tracking-tight leading-[1.05] mb-4">
        {title}
      </h2>
      <p className="text-slate-600 leading-relaxed text-base sm:text-lg">
        {sub}
      </p>
    </div>
  );
}

// ─── Trust stat (small callout on the bar section) ──────────────────

function TrustStat({
  n,
  label,
  accent = false,
}: {
  n: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div
        className={`font-display font-extrabold text-4xl leading-none ${
          accent ? 'text-amber-500' : 'text-slate-900'
        }`}
      >
        {n}
      </div>
      <div className="text-xs uppercase tracking-widest font-semibold text-slate-500 mt-2">
        {label}
      </div>
    </div>
  );
}

// ─── Testimonial card (placeholder — swap with real content) ─────────

const TESTIMONIALS = [
  {
    quote:
      'Our group chat used to be a spreadsheet nightmare every Sunday. Now it’s just people yelling at their teams to score exactly 19.',
    name: 'Alex R.',
    role: 'Commissioner · Chicago',
    initials: 'AR',
    color: '#F0B537',
  },
  {
    quote:
      'I’ve won the pot twice with two different terrible teams. There’s something perfect about rooting for exactly 19.',
    name: 'Sarah C.',
    role: 'Player · San Francisco',
    initials: 'SC',
    color: '#155EEF',
  },
  {
    quote:
      'The rollover math + auto ESPN scores took my Sunday admin from 30 minutes to zero. My friends still hate me for winning three weeks in a row.',
    name: 'Mike T.',
    role: 'Commissioner · Boston',
    initials: 'MT',
    color: '#E85D3A',
  },
] as const;

function Testimonial({
  quote,
  name,
  role,
  initials,
  color,
}: {
  quote: string;
  name: string;
  role: string;
  initials: string;
  color: string;
}) {
  return (
    <figure className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm h-full flex flex-col">
      <blockquote className="text-slate-800 text-base leading-relaxed flex-1">
        <span className="font-display text-3xl text-slate-300 leading-none">
          &ldquo;
        </span>
        {quote}
      </blockquote>
      <figcaption className="mt-6 flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-display font-bold text-sm"
          style={{ backgroundColor: color }}
        >
          {initials}
        </div>
        <div>
          <div className="font-semibold text-slate-900 text-sm">{name}</div>
          <div className="text-xs text-slate-500">{role}</div>
        </div>
        <span className="ml-auto text-[9px] uppercase tracking-widest text-slate-300 font-semibold border border-slate-200 px-1.5 py-0.5 rounded">
          Placeholder
        </span>
      </figcaption>
    </figure>
  );
}

// ─── Phone mockup + inner mock screen (placeholder) ─────────────────
// A CSS-only iPhone bezel with a stylized "screenshot" inside. Marked
// PLACEHOLDER so the user knows to swap it out.

function PhoneMockup({
  label,
  accent,
  content,
}: {
  label: string;
  accent: string;
  content: ReactNode;
}) {
  return (
    <div className="relative mx-auto w-full max-w-[260px]">
      <span className="absolute -top-3 -right-3 z-10 text-[9px] uppercase tracking-widest font-bold text-slate-500 bg-white border border-slate-200 px-2 py-1 rounded shadow-sm">
        Placeholder
      </span>
      <div
        className="rounded-[2.5rem] p-2 shadow-xl ring-1 ring-slate-900/10"
        style={{ backgroundColor: '#1A1A1A' }}
      >
        <div className="relative rounded-[2rem] bg-white overflow-hidden aspect-[9/19.5]">
          {/* Notch */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-5 bg-black rounded-full z-10" />
          {/* Screen content */}
          <div className="h-full flex flex-col pt-10 pb-6 px-5">
            <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-1">
              {label}
            </div>
            <div className="h-px bg-slate-200 mb-4" />
            {content}
          </div>
          {/* Accent color underline at bottom */}
          <div
            className="absolute bottom-0 left-0 right-0 h-1"
            style={{ backgroundColor: accent }}
          />
        </div>
      </div>
    </div>
  );
}

function MockScreen({
  kicker,
  title,
  subtitle,
  stats,
}: {
  kicker: string;
  title: string;
  subtitle: string;
  stats: { l: string; v: string }[];
}) {
  return (
    <>
      <p className="text-[10px] uppercase tracking-widest font-semibold text-amber-600 mb-1">
        {kicker}
      </p>
      <p className="font-display font-extrabold text-slate-900 text-lg leading-tight mb-1">
        {title}
      </p>
      <p className="text-xs text-slate-500 mb-5">{subtitle}</p>
      <div className="mt-auto space-y-2">
        {stats.map((s) => (
          <div
            key={s.l}
            className="flex items-baseline justify-between border-t border-slate-100 pt-2"
          >
            <span className="text-[11px] text-slate-500 truncate">{s.l}</span>
            <span className="font-display font-bold text-slate-900 text-base">
              {s.v}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
