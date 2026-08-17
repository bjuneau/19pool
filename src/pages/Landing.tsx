import { Link } from 'react-router-dom';
import { useState } from 'react';
import type { ReactNode } from 'react';

// Marketing page — dark utility SaaS in the go.amazing.com/challenge-b
// style. Near-black bg, neon lime accent, chunky uppercase display type,
// two-tone highlighted headlines, small phone-filmstrip screenshots,
// numbered sections, pricing hammer, FAQ, final CTA.

const VOLT = '#C4F82A';

// Inter Tight at heaviest weight for chunky headline display, matches
// the go.amazing.com/challenge-b reference. Inter Tight is a condensed
// member of the Inter family — no wdth axis, just the tighter default
// glyphs. Pair with heavy weight + tight tracking for the industrial
// utility feel.
const DISPLAY_WIDE: React.CSSProperties = {
  fontFamily: '"Inter Tight", Inter, ui-sans-serif, system-ui, sans-serif',
  fontWeight: 900,
  letterSpacing: '-0.035em',
};

export default function Landing() {
  return (
    <div className="min-h-screen bg-void text-white font-sans antialiased">
      <Nav />
      <Hero />
      <ScreenshotFilmstrip />
      <ProblemSolution />
      <NeverStarts />
      <PainPoints />
      <HowItWorks />
      <SeeItLive />
      <Features />
      <Testimonials />
      <Pricing />
      <Catch />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────

function Nav() {
  return (
    <nav className="sticky top-0 z-50 bg-void/90 backdrop-blur-md border-b border-void-line">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-5 sm:px-8 h-14">
        <Link to="/" className="flex items-baseline gap-1.5">
          <span
            className="font-display font-extrabold text-2xl leading-none"
            style={{ color: VOLT }}
          >
            19
          </span>
          <span className="font-display font-bold text-lg tracking-tight">
            Pool
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <Link
            to="/signin"
            className="text-sm font-medium text-white/70 hover:text-white transition-colors"
          >
            Sign in
          </Link>
          <Link
            to="/signup"
            className="text-sm font-bold text-black px-4 py-2 rounded-full transition-transform hover:scale-105"
            style={{ backgroundColor: VOLT }}
          >
            Create league →
          </Link>
        </div>
      </div>
    </nav>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="max-w-6xl mx-auto px-5 sm:px-8 pt-14 sm:pt-24 pb-16 sm:pb-20 text-center">
      <h1
        className="uppercase text-[13vw] sm:text-[8rem] lg:text-[10rem] leading-[0.9]"
        style={DISPLAY_WIDE}
      >
        <span className="block">
          Score <VoltMark>19</VoltMark>.
        </span>
        <span className="block">
          Take the whole
        </span>
        <span className="block">
          <VoltMark>Pot.</VoltMark>
        </span>
      </h1>

      <p className="mt-8 max-w-2xl mx-auto text-lg text-white/70 leading-relaxed">
        Eight to thirty‑two friends. All thirty‑two NFL teams. Any team lands
        on exactly nineteen — win or lose — and its owner takes the whole
        weekly pot.
      </p>

      <p
        className="mt-6 text-[10px] uppercase tracking-widest font-bold"
        style={{ color: VOLT }}
      >
        Free during the 2026 season
      </p>

      <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link
          to="/signup"
          className="inline-flex items-center justify-center text-sm font-bold text-black px-6 py-3 rounded-full transition-transform hover:scale-105"
          style={{ backgroundColor: VOLT }}
        >
          Create your league →
        </Link>
        <Link
          to="/signup"
          className="inline-flex items-center justify-center text-sm font-bold text-white border border-white/25 hover:border-white/60 hover:bg-white/5 px-6 py-3 rounded-full transition-all"
        >
          Join with a code
        </Link>
      </div>

      <p className="mt-6 text-sm text-white/50">
        Got an invite from your commissioner?{' '}
        <Link
          to="/signup"
          className="underline underline-offset-4 hover:text-white transition-colors"
          style={{ color: VOLT }}
        >
          Join with your code →
        </Link>
      </p>
    </section>
  );
}

// ─── Screenshot filmstrip ─────────────────────────────────────────────

function ScreenshotFilmstrip() {
  const shots = [
    { l: 'Results', s: '#C4F82A' },
    { l: 'Standings', s: '#F0B537' },
    { l: 'Teams', s: '#C4F82A' },
    { l: 'Payments', s: '#F0B537' },
    { l: 'Account', s: '#C4F82A' },
  ];
  return (
    <section className="border-y border-void-line bg-void-2/40 py-10 sm:py-14">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <p className="text-center text-xs uppercase tracking-widest font-bold text-white/40 mb-8">
          The whole pool on your phone — placeholder screenshots below
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 sm:gap-4">
          {shots.map((s, i) => (
            <MiniPhone key={i} label={s.l} accent={s.s} />
          ))}
        </div>
      </div>
    </section>
  );
}

function MiniPhone({ label, accent }: { label: string; accent: string }) {
  return (
    <div className="relative">
      <div className="bg-black rounded-[1.25rem] p-1.5 shadow-lg ring-1 ring-white/10">
        <div className="relative bg-void-3 rounded-[1rem] aspect-[9/19] overflow-hidden">
          <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-10 h-3 bg-black rounded-full z-10" />
          <div className="h-full flex flex-col items-center justify-center px-2 text-center">
            <span
              className="text-[8px] uppercase tracking-widest font-bold mb-1"
              style={{ color: accent }}
            >
              {label}
            </span>
            <span
              className="font-display font-extrabold text-2xl leading-none"
              style={{ ...DISPLAY_WIDE, color: 'white' }}
            >
              19
            </span>
          </div>
          <div
            className="absolute bottom-0 left-0 right-0 h-0.5"
            style={{ backgroundColor: accent }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Problem/solution split ───────────────────────────────────────────

function ProblemSolution() {
  return (
    <Section>
      <SectionHead
        title={
          <>
            From <VoltMark>spreadsheet</VoltMark>
            <br />
            to <VoltMark>Sunday‑ready</VoltMark>.
          </>
        }
      />
      <div className="grid md:grid-cols-2 gap-6 mt-14">
        <ListCard
          heading="What most pools look like"
          tone="dim"
          items={[
            'Google Sheet nobody updates on time',
            'Group text arguing over final scores',
            'Someone forgets who owed what by Week 5',
            'Winner never quite trusts the math',
          ]}
        />
        <ListCard
          heading="What 19 Pool looks like"
          tone="volt"
          items={[
            'Live ESPN scores auto‑refresh every 30 seconds',
            'Rollover math handled — including split pots',
            'Payment tracker with one‑tap Venmo requests',
            'Season standings, past weeks, everything one tap away',
          ]}
        />
      </div>

      {/* Money example — real numbers so visitors can visualize the pot. */}
      <div className="mt-10 max-w-2xl mx-auto bg-void-2 border border-void-line rounded-xl px-5 py-4 text-center">
        <p className="text-xs uppercase tracking-widest font-bold text-white/40 mb-2">
          For example
        </p>
        <p className="text-white/85 text-sm sm:text-base leading-relaxed">
          16 friends × $50 entry ÷ 18 weeks ={' '}
          <span className="font-bold" style={{ color: VOLT }}>
            ~$44 per weekly winner
          </span>
          . No 19 that week? The pot rolls into next week.
        </p>
      </div>
    </Section>
  );
}

function ListCard({
  heading,
  items,
  tone,
}: {
  heading: string;
  items: string[];
  tone: 'dim' | 'volt';
}) {
  return (
    <div
      className={`bg-void-2 border rounded-2xl p-6 sm:p-8 ${
        tone === 'volt' ? 'border-volt/50' : 'border-void-line'
      }`}
    >
      <p
        className="text-xs uppercase tracking-widest font-bold mb-5"
        style={{ color: tone === 'volt' ? VOLT : 'rgba(255,255,255,0.5)' }}
      >
        {heading}
      </p>
      <ul className="space-y-3">
        {items.map((t) => (
          <li key={t} className="flex items-start gap-3 text-white/85 text-sm sm:text-base">
            <span
              className="flex-shrink-0 mt-0.5"
              style={{ color: tone === 'volt' ? VOLT : 'rgba(255,255,255,0.35)' }}
            >
              {tone === 'volt' ? '✓' : '✕'}
            </span>
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Most groups never finish ────────────────────────────────────────

function NeverStarts() {
  return (
    <Section tint>
      <div className="grid md:grid-cols-12 gap-8 items-start">
        <h2
          className="uppercase md:col-span-6 text-4xl sm:text-6xl leading-[0.95]"
          style={DISPLAY_WIDE}
        >
          Most pools <br />
          never finish <br />
          the season. <br />
          <VoltMark>This changes that.</VoltMark>
        </h2>
        <div className="md:col-span-6 md:pt-4 text-white/75 leading-relaxed space-y-4 text-base sm:text-lg">
          <p>
            Every year a friend starts a pool, someone forgets to collect the
            entry fees, the sheet stops getting updated by Week 3, and by
            Week 8 nobody remembers who's winning.
          </p>
          <p>
            19 Pool is the app that does all of it for you: collect, score,
            track, pay out. You just watch football and text the group chat
            when your team lands on nineteen.
          </p>
        </div>
      </div>
    </Section>
  );
}

// ─── Pain points ─────────────────────────────────────────────────────

function PainPoints() {
  return (
    <Section>
      <h2
        className="uppercase text-3xl sm:text-5xl text-center leading-[0.95]"
        style={DISPLAY_WIDE}
      >
        <VoltMark>If any of these</VoltMark> sound familiar…
      </h2>
      <div className="grid md:grid-cols-3 gap-4 mt-12">
        {[
          'The commissioner also has to be the accountant',
          'Someone always disputes the final score',
          'Half the group forgets to pay until December',
          'Splits, ties, and rollovers give everyone a headache',
          'By the end of the season the leaderboard is a mystery',
          'You want to run one for your group but the setup is a chore',
        ].map((p) => (
          <div
            key={p}
            className="bg-void-2 border border-void-line rounded-xl p-5 text-white/80 text-sm sm:text-base"
          >
            {p}
          </div>
        ))}
      </div>
      <p className="text-center mt-10 text-white/60 max-w-xl mx-auto">
        …you're going to want this app running your league next year.
      </p>
      <div className="mt-6 flex justify-center">
        <Link
          to="/signup"
          className="text-sm font-bold text-black px-6 py-3 rounded-full hover:scale-105 transition-transform"
          style={{ backgroundColor: VOLT }}
        >
          Show me →
        </Link>
      </div>
    </Section>
  );
}

// ─── How it works (numbered) ──────────────────────────────────────────

function HowItWorks() {
  return (
    <Section tint>
      <SectionHead
        title={
          <>
            Everyone lands
            <br />
            with <VoltMark>something built.</VoltMark>
          </>
        }
        sub="Three moves from group chat to Sunday routine."
      />
      <div className="grid md:grid-cols-3 gap-4 mt-12">
        {[
          {
            n: '01',
            t: 'Form your league',
            b: 'Invite 8 to 32 players. Set the entry fee. Whole thing takes two minutes.',
          },
          {
            n: '02',
            t: 'Assign the teams',
            b: 'One NFL team per player. Random assignment or manual drag‑and‑drop.',
          },
          {
            n: '03',
            t: 'Hit 19, take the pot',
            b: 'Live ESPN scores. Winners flagged automatically. Rollover handled if nobody hits it.',
          },
        ].map((s) => (
          <div
            key={s.n}
            className="bg-void-2 border border-void-line rounded-2xl p-6 sm:p-8"
          >
            <div className="flex items-baseline justify-between mb-5">
              <span
                className="font-mono text-sm font-bold"
                style={{ color: VOLT }}
              >
                {s.n}
              </span>
              <span className="text-[10px] uppercase tracking-widest font-bold text-white/40">
                Step
              </span>
            </div>
            <h3
              className="uppercase text-xl mb-3"
              style={DISPLAY_WIDE}
            >
              {s.t}
            </h3>
            <p className="text-white/70 text-sm leading-relaxed">{s.b}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ─── See it live (real product screenshot) ───────────────────────────
// Uses a fallback placeholder underneath the img so if the asset is
// missing (before Brooks drops the file in /public), the layout still
// looks intentional instead of showing a broken-image icon.

function SeeItLive() {
  return (
    <Section>
      <SectionHead
        title={
          <>
            Sunday scoreboard,
            <br />
            <VoltMark>built for the moment.</VoltMark>
          </>
        }
        sub="A screenshot from the live app — no mockup polish."
      />
      <div className="mt-12 relative max-w-4xl mx-auto">
        <div className="relative aspect-[16/10] bg-void-2 border border-void-line rounded-2xl overflow-hidden shadow-2xl">
          {/* Placeholder shown when the img asset is missing. Sits behind
              the img; the img covers it once loaded (object-cover). */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 pointer-events-none">
            <p
              className="text-[10px] uppercase tracking-widest font-bold mb-2"
              style={{ color: VOLT }}
            >
              Placeholder
            </p>
            <p className="text-white/40 text-sm">
              /public/screenshot-weekly-results.png
            </p>
          </div>
          <img
            src="/screenshot-weekly-results.png"
            alt="19 Pool weekly results — live NFL scores and pot standings"
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
        <p className="text-center text-white/40 text-xs mt-4">
          Live ESPN scores. Winner detection when a team hits 19.
        </p>
      </div>
    </Section>
  );
}

// ─── Features grid (5 across, matches reference) ─────────────────────

function Features() {
  return (
    <Section>
      <SectionHead
        title={
          <>
            <VoltMark>Real tools.</VoltMark>
            <br />
            Not just a scoreboard.
          </>
        }
      />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4 mt-12">
        {[
          { t: 'Live scores', b: 'ESPN pull every 30s' },
          { t: 'Auto rollover', b: 'Weeks without a 19 compound' },
          { t: 'Payment tracker', b: 'Paid / unpaid at a glance' },
          { t: 'Venmo links', b: 'One tap to pay or charge' },
          { t: 'Historical', b: 'Every past week preserved' },
        ].map((f) => (
          <div
            key={f.t}
            className="bg-void-2 border border-void-line rounded-xl p-4 sm:p-5"
          >
            <p
              className="uppercase text-sm sm:text-base font-bold mb-1"
              style={DISPLAY_WIDE}
            >
              {f.t}
            </p>
            <p className="text-white/55 text-xs sm:text-sm">{f.b}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ─── Testimonials ────────────────────────────────────────────────────

function Testimonials() {
  return (
    <Section tint>
      <SectionHead
        title={
          <>
            <VoltMark>Real leagues.</VoltMark>
            <br />
            Real players.
          </>
        }
        sub="Placeholder quotes below — swap when your first season wraps."
      />
      <div className="grid md:grid-cols-3 gap-4 mt-12">
        {TESTIMONIALS.map((t) => (
          <Testimonial key={t.name} {...t} />
        ))}
      </div>
    </Section>
  );
}

const TESTIMONIALS = [
  {
    quote:
      'Our group chat used to be a spreadsheet nightmare every Sunday. Now it\'s just people yelling at their teams to score exactly nineteen.',
    name: 'Alex R.',
    role: 'Commissioner · Chicago',
    initials: 'AR',
  },
  {
    quote:
      'I\'ve won the pot twice with two different terrible teams. There\'s something perfect about rooting for exactly 19.',
    name: 'Sarah C.',
    role: 'Player · San Francisco',
    initials: 'SC',
  },
  {
    quote:
      'The rollover math + auto ESPN scores took my Sunday admin from 30 minutes to zero. My friends still hate me for winning three weeks in a row.',
    name: 'Mike T.',
    role: 'Commissioner · Boston',
    initials: 'MT',
  },
] as const;

function Testimonial({
  quote,
  name,
  role,
  initials,
}: {
  quote: string;
  name: string;
  role: string;
  initials: string;
}) {
  return (
    <figure className="relative bg-void-2 border border-void-line rounded-2xl p-6 h-full flex flex-col">
      <span className="absolute top-3 right-3 text-[9px] uppercase tracking-widest font-bold text-white/30 border border-void-line px-1.5 py-0.5 rounded">
        Placeholder
      </span>
      <blockquote className="text-white/85 text-sm leading-relaxed flex-1">
        <span
          className="font-display text-4xl leading-none block mb-2"
          style={{ color: VOLT }}
        >
          &ldquo;
        </span>
        {quote}
      </blockquote>
      <figcaption className="mt-5 flex items-center gap-3 pt-4 border-t border-void-line">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-black font-display font-extrabold text-sm"
          style={{ backgroundColor: VOLT }}
        >
          {initials}
        </div>
        <div>
          <div className="font-bold text-white text-sm">{name}</div>
          <div className="text-xs text-white/50">{role}</div>
        </div>
      </figcaption>
    </figure>
  );
}

// ─── Pricing hammer ──────────────────────────────────────────────────

function Pricing() {
  return (
    <Section>
      <SectionHead
        title={
          <>
            <VoltMark>Free</VoltMark> to run
            <br />
            your first season.
          </>
        }
      />
      <div className="max-w-md mx-auto mt-12">
        <div className="bg-void-2 border-2 border-volt rounded-2xl p-8 text-center">
          <p className="text-xs uppercase tracking-widest font-bold text-white/50 mb-2">
            Beta pricing
          </p>
          <p
            className="uppercase text-6xl mb-1"
            style={{ ...DISPLAY_WIDE, color: VOLT }}
          >
            $0
          </p>
          <p className="text-white/60 text-sm mb-6">
            per league, for the whole season
          </p>
          <ul className="text-left text-sm text-white/80 space-y-2 mb-6 border-t border-void-line pt-6">
            {[
              '8 to 32 players per league',
              'Live ESPN scoring, all 18 weeks',
              'Payment tracker + Venmo integration',
              'Full historical results + standings',
              'Roster changes anytime during the season',
            ].map((f) => (
              <li key={f} className="flex items-start gap-2">
                <span style={{ color: VOLT }}>✓</span>
                {f}
              </li>
            ))}
          </ul>
          <Link
            to="/signup"
            className="block text-center text-sm font-bold text-black py-3 rounded-full hover:scale-[1.02] transition-transform"
            style={{ backgroundColor: VOLT }}
          >
            Create your league →
          </Link>
          <p className="text-xs text-white/40 mt-3">
            No credit card. Cancel by never signing up next year.
          </p>
        </div>
      </div>
    </Section>
  );
}

// ─── "So what's the catch?" transparency section ─────────────────────

function Catch() {
  return (
    <Section tint>
      <div className="max-w-3xl mx-auto text-center">
        <h2
          className="uppercase text-4xl sm:text-6xl leading-[0.95] mb-8"
          style={DISPLAY_WIDE}
        >
          So, <VoltMark>what's the catch?</VoltMark>
        </h2>
        <div className="text-white/75 text-base sm:text-lg leading-relaxed space-y-4">
          <p>
            No catch. First season is free while we're in beta. If enough
            leagues run through, we'll add a small per‑league fee for future
            seasons — probably five to ten bucks — and grandfather in anyone
            who ran a league during the beta.
          </p>
          <p>
            Nothing is charged to players individually. You collect entry fees
            from your group however you already do it (Venmo helper included).
            The app doesn't touch that money — that's between you and your
            friends.
          </p>
        </div>
      </div>
    </Section>
  );
}

// ─── FAQ ─────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: 'How many players do I need?',
    a: 'Anywhere from 8 to 32. 32 is the sweet spot (one team per player), but smaller leagues work fine — the app just assigns multiple teams per player automatically.',
  },
  {
    q: 'What if two players\' teams both hit 19 in the same week?',
    a: 'The pot splits evenly between them. The app calculates the split automatically and shows each winner\'s payout.',
  },
  {
    q: 'What if no team hits 19?',
    a: 'The week\'s pot rolls into next week\'s. It compounds until someone hits it. Some late‑season weeks pay real money.',
  },
  {
    q: 'Do I need Venmo?',
    a: 'No, but the app has one‑tap Venmo links built in for anyone who does. You can also just tell people to pay you however you normally do — the app tracks paid/unpaid regardless.',
  },
  {
    q: 'Where do the scores come from?',
    a: 'ESPN\'s public API, refreshed every 30 seconds during live games. If ESPN\'s wrong, everyone\'s wrong the same way.',
  },
  {
    q: 'Can I run a league across multiple friend groups?',
    a: 'Yep. One person is the commissioner, everyone else joins via invite link. Nobody needs to be from the same city or Slack.',
  },
];

function FAQ() {
  return (
    <Section>
      <SectionHead
        title={
          <>
            Frequently asked
            <br />
            <VoltMark>questions.</VoltMark>
          </>
        }
      />
      <div className="max-w-3xl mx-auto mt-12 border-y border-void-line">
        {FAQS.map((f, i) => (
          <FAQItem key={i} {...f} />
        ))}
      </div>
    </Section>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-void-line last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 py-5 text-left hover:bg-void-2/40 transition-colors px-2"
      >
        <span className="font-bold text-white text-base sm:text-lg">{q}</span>
        <span
          className="flex-shrink-0 text-2xl leading-none transition-transform"
          style={{
            color: VOLT,
            transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
          }}
        >
          +
        </span>
      </button>
      {open && (
        <p className="pb-6 px-2 text-white/70 text-sm sm:text-base leading-relaxed">
          {a}
        </p>
      )}
    </div>
  );
}

// ─── Final CTA hammer ────────────────────────────────────────────────

function FinalCTA() {
  return (
    <section className="relative overflow-hidden py-20 sm:py-32 text-center">
      <span
        aria-hidden
        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
      >
        <span
          className="uppercase text-[45vw] sm:text-[30rem] leading-none opacity-[0.04]"
          style={{ ...DISPLAY_WIDE, color: VOLT }}
        >
          19
        </span>
      </span>
      <div className="relative max-w-4xl mx-auto px-5 sm:px-8">
        <h2
          className="uppercase text-[13vw] sm:text-[7rem] leading-[0.9]"
          style={DISPLAY_WIDE}
        >
          You're one
          <br />
          <VoltMark>Nineteen</VoltMark>
          <br />
          Away.
        </h2>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/signup"
            className="text-sm font-bold text-black px-8 py-4 rounded-full hover:scale-105 transition-transform"
            style={{ backgroundColor: VOLT }}
          >
            Create your league →
          </Link>
          <Link
            to="/signup"
            className="text-sm font-bold text-white border border-white/25 hover:border-white/60 hover:bg-white/5 px-8 py-4 rounded-full transition-all"
          >
            Join with a code
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-void-line bg-void">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/40">
        <Link to="/" className="flex items-baseline gap-1.5">
          <span
            className="font-display font-extrabold text-lg leading-none"
            style={{ color: VOLT }}
          >
            19
          </span>
          <span className="font-display font-bold text-white/70">Pool</span>
        </Link>
        <p className="uppercase tracking-widest">
          Not affiliated with NFL or ESPN · © 2026 19 Pool
        </p>
        <div className="flex gap-5 uppercase tracking-widest font-bold">
          <Link to="/signup" className="hover:text-white transition-colors">
            Create
          </Link>
          <Link to="/signup" className="hover:text-white transition-colors">
            Join
          </Link>
          <Link to="/signin" className="hover:text-white transition-colors">
            Sign in
          </Link>
        </div>
      </div>
    </footer>
  );
}

// ─── Building blocks ─────────────────────────────────────────────────

function Section({ children, tint = false }: { children: ReactNode; tint?: boolean }) {
  return (
    <section className={tint ? 'border-y border-void-line bg-void-2/40' : ''}>
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16 sm:py-24">
        {children}
      </div>
    </section>
  );
}

function SectionHead({
  title,
  sub,
}: {
  title: ReactNode;
  sub?: string;
}) {
  return (
    <div className="text-center max-w-3xl mx-auto">
      <h2
        className="uppercase text-4xl sm:text-6xl leading-[0.95]"
        style={DISPLAY_WIDE}
      >
        {title}
      </h2>
      {sub && (
        <p className="mt-5 text-white/60 leading-relaxed text-base sm:text-lg">
          {sub}
        </p>
      )}
    </div>
  );
}

// The signature move — highlighter-style volt background behind key words.
function VoltMark({ children }: { children: ReactNode }) {
  return (
    <span
      className="inline-block px-[0.15em] text-black"
      style={{ backgroundColor: VOLT, boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' }}
    >
      {children}
    </span>
  );
}
