import { Link } from 'react-router-dom';
import { useState } from 'react';
import type { ReactNode } from 'react';
import marketingScoresShot from '../../img/19pool-marketing-scores1.jpg';
import marketingPhoneHero from '../../img/19pool-marketing-phone-hero1.png';

// Marketing page — dark utility SaaS in the go.amazing.com/challenge-b
// style. Near-black bg, neon lime accent, chunky uppercase display type,
// two-tone highlighted headlines, numbered sections, pricing hammer,
// FAQ, final CTA.

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
      <ProblemSolution />
      <NeverStarts />
      <PainPoints />
      <HowItWorks />
      <SeeItLive />
      <Features />
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
        Everyone gets an NFL team. Any week your team ends on exactly 19,
        win or lose, you take the pot.
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
            'Spreadsheet nobody updates',
            'Arguments about final scores',
            'Someone forgets who owed what by Week 5',
            'Winner never trusts the math',
          ]}
        />
        <ListCard
          heading="What 19 Pool looks like"
          tone="volt"
          items={[
            'Live ESPN scores every 30 seconds',
            'Rollover math done automatically',
            'One-tap Venmo requests',
            'Standings updated live on Sunday',
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
      <div className="grid md:grid-cols-12 gap-8 md:gap-12 items-start">
        {/* Left: headline stacked with the two paragraphs underneath. */}
        <div className="md:col-span-7 space-y-6 sm:space-y-8">
          <h2
            className="uppercase text-4xl sm:text-6xl leading-[0.95]"
            style={DISPLAY_WIDE}
          >
            Most pools <br />
            never finish <br />
            the season. <br />
            <VoltMark>This changes that.</VoltMark>
          </h2>
          <div className="text-white/75 leading-relaxed space-y-4 text-base sm:text-lg max-w-xl">
            <p>
              Every year a friend starts a pool, someone forgets to collect the
              entry fees, the sheet stops getting updated by Week 3, and by
              Week 8 nobody remembers who's winning.
            </p>
            <p>
              19 Pool tracks all of it: scores, standings, who paid, who's
              winning. You just watch football and text the group chat when
              your team lands on 19.
            </p>
          </div>
        </div>

        {/* Right: phone hero image. On md+ it breaks upward past the
            section's top rule by 50px (section has sm:py-24 = 96px of
            padding-top, so mt-[-146px] puts the top edge 50px above the
            rule). On mobile the negative margin doesn't apply and the
            image stacks under the text with normal flow. */}
        <div className="md:col-span-5 flex justify-center md:justify-end md:-mt-[146px]">
          <img
            src={marketingPhoneHero}
            alt="19 Pool app on a phone — weekly results screen"
            className="w-full max-w-[300px] h-auto block"
          />
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
        …19 Pool fixes all of it. Try it free this season.
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
            Three steps.
            <br />
            <VoltMark>Two minutes.</VoltMark>
          </>
        }
        sub="Nothing to install. Nothing to configure."
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
// Image is imported so Vite bundles it with a hashed URL. Lives in
// /img/ at the repo root (not /public/) so it's not exposed as a raw
// static path — routed through the module graph like other assets.

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
        sub="A screenshot from the live app. No mockup polish."
      />
      <div className="mt-12 relative max-w-4xl mx-auto">
        <div className="relative bg-void-2 border border-void-line rounded-2xl overflow-hidden shadow-2xl">
          <img
            src={marketingScoresShot}
            alt="19 Pool weekly results: live NFL scores and pot standings"
            className="block w-full h-auto"
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
          { t: 'Full history', b: 'Every past week preserved' },
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
            seasons (probably five to ten bucks) and grandfather in anyone
            who ran a league during the beta.
          </p>
          <p>
            Nothing is charged to players individually. You collect entry fees
            from your group however you already do it (Venmo helper included).
            The app doesn't touch that money. That's between you and your
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
    a: 'Anywhere from 8 to 32. 32 is the sweet spot (one team per player), but smaller leagues work fine. The app assigns multiple teams per player automatically.',
  },
  {
    q: 'What if two players\' teams both hit 19 in the same week?',
    a: 'The pot splits evenly between them. The app calculates the split automatically and shows each winner\'s payout.',
  },
  {
    q: 'What if no team hits 19?',
    a: 'The week\'s pot rolls into next week\'s. It compounds until someone hits it. Some late-season weeks pay real money.',
  },
  {
    q: 'What if my group uses Zelle, PayPal, or Cash App instead of Venmo?',
    a: 'That works too. The Venmo integration is optional. The app tracks paid / unpaid regardless of how you actually collect.',
  },
  {
    q: 'Where do the scores come from?',
    a: 'ESPN\'s public API, refreshed every 30 seconds during live games. If ESPN\'s wrong, everyone\'s wrong the same way.',
  },
  {
    q: 'Where is my league\'s data stored?',
    a: 'Everything is on Google Firebase. Only your commissioner sees payment status. Nobody outside your league has access.',
  },
  {
    q: 'Can I run a league across multiple friend groups?',
    a: 'Yes. One person is the commissioner. Everyone else joins via invite link.',
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
