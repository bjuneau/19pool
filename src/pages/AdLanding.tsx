import { Link } from 'react-router-dom';
import { useState } from 'react';
import marketingPointsShot from '../../img/19pool-marketing-points1.jpg';
import marketingPhoneShot from '../../img/19pool-marketing-phone-hero1-points.png';
import {
  VOLT,
  DISPLAY_WIDE,
  AD_LANDING_PATH,
  Section,
  SectionHead,
  VoltMark,
} from '../components/marketing';

// Paid-acquisition landing page (/nfl-pool-app).
//
// ⚠ COMPLIANCE: this page is the destination for Facebook/Instagram ads.
// Meta's Gambling and Games policy restricts advertising paid-entry contests
// with cash prizes, and reviewers read the destination page, not just the ad.
// So this page sells the SOFTWARE — team assignment, live scores, standings —
// and must stay free of entry fees, pots, payouts, prize amounts, and any
// dollar figure. The main marketing page at "/" is unchanged and still leads
// with the pot; keep the two separate.
//
// The site footer hides its Venmo donate link on this route (see SiteFooter).

export default function AdLanding() {
  return (
    <div className="flex-1 bg-void text-white font-sans antialiased">
      <Nav />
      <Hero />
      <Spreadsheet />
      <HowItWorks />
      <Scoreboard />
      <Standings />
      <Features />
      <FAQ />
      <FinalCTA />
    </div>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────
// Logo returns to this page rather than "/" so ad traffic stays inside the
// clean funnel instead of landing on the pot-led marketing page.

function Nav() {
  return (
    <nav className="sticky top-0 z-50 bg-void/90 backdrop-blur-md border-b border-void-line">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-5 sm:px-8 h-14">
        <Link to={AD_LANDING_PATH} className="flex items-baseline">
          <span
            className="font-display font-extrabold text-2xl leading-none tracking-tight"
            style={{ color: VOLT }}
          >
            19
          </span>
          <span className="font-display font-extrabold text-2xl leading-none tracking-tight text-white">
            POOL
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
            Start free →
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
        className="uppercase text-[13vw] sm:text-[7.5rem] lg:text-[9rem] leading-[0.9]"
        style={DISPLAY_WIDE}
      >
        <span className="block">Run your</span>
        <span className="block">NFL 19 Pool.</span>
        <span className="block">
          Kill the <VoltMark>spreadsheet.</VoltMark>
        </span>
      </h1>

      <p className="mt-8 max-w-2xl mx-auto text-lg text-white/70 leading-relaxed">
        Every player gets NFL teams. Any week one of your teams finishes on
        exactly 19 points, you take the week. 19 Pool tracks all of it for
        you — live scores, automatic 19 detection, season standings.
      </p>

      <p
        className="mt-6 text-[10px] uppercase tracking-widest font-bold"
        style={{ color: VOLT }}
      >
        Free for the 2026 season
      </p>

      <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link
          to="/signup"
          className="inline-flex items-center justify-center text-sm font-bold text-black px-6 py-3 rounded-full transition-transform hover:scale-105"
          style={{ backgroundColor: VOLT }}
        >
          Start your league free →
        </Link>
        <Link
          to="/join"
          className="inline-flex items-center justify-center text-sm font-bold text-white border border-white/25 hover:border-white/60 hover:bg-white/5 px-6 py-3 rounded-full transition-all"
        >
          Join with a code
        </Link>
      </div>

      <p className="mt-6 text-xs text-white/40">
        No install. No credit card. Works in any browser.
      </p>
    </section>
  );
}

// ─── The problem ──────────────────────────────────────────────────────

function Spreadsheet() {
  const pains = [
    {
      t: 'Somebody has to check every score',
      b: 'Sunday night, one person cross-references sixteen box scores against a tab of names. Every single week for eighteen weeks.',
    },
    {
      t: 'The sheet dies around Week 3',
      b: 'It always does. Someone gets busy, one week goes un-updated, and the whole thing quietly stops being the source of truth.',
    },
    {
      t: 'Nobody knows where they stand',
      b: 'Half the group has no idea whether they are still alive. The group chat becomes the standings, and the group chat is wrong.',
    },
  ];
  return (
    <Section tint>
      <SectionHead
        title={
          <>
            Every league dies
            <br />
            in a <VoltMark>spreadsheet.</VoltMark>
          </>
        }
        sub="The game is great. The admin is what kills it."
      />
      <div className="grid md:grid-cols-3 gap-4 mt-12">
        {pains.map((p) => (
          <div
            key={p.t}
            className="bg-void-2 border border-void-line rounded-2xl p-6 sm:p-8"
          >
            <h3 className="uppercase text-lg mb-3" style={DISPLAY_WIDE}>
              {p.t}
            </h3>
            <p className="text-white/70 text-sm leading-relaxed">{p.b}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ─── How it works ─────────────────────────────────────────────────────

function HowItWorks() {
  const steps = [
    {
      n: '01',
      t: 'Create your league',
      b: 'Invite 8 to 32 players with a single link. Setup takes about two minutes.',
    },
    {
      n: '02',
      t: 'Assign the teams',
      b: 'One NFL team per player, or several each in a smaller league. Random assignment or manual drag-and-drop.',
    },
    {
      n: '03',
      t: 'Let it run itself',
      b: 'Live ESPN scores every Sunday. Any team landing on 19 is flagged automatically. Standings update themselves.',
    },
  ];
  return (
    <Section>
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
        {steps.map((s) => (
          <div
            key={s.n}
            className="bg-void-2 border border-void-line rounded-2xl p-6 sm:p-8"
          >
            <div className="flex items-baseline justify-between mb-5">
              <span className="font-mono text-sm font-bold" style={{ color: VOLT }}>
                {s.n}
              </span>
              <span className="text-[10px] uppercase tracking-widest font-bold text-white/40">
                Step
              </span>
            </div>
            <h3 className="uppercase text-xl mb-3" style={DISPLAY_WIDE}>
              {s.t}
            </h3>
            <p className="text-white/70 text-sm leading-relaxed">{s.b}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ─── Scoreboard ───────────────────────────────────────────────────────
// Uses the points-only variant of the results screenshot. The original
// (19pool-marketing-scores1.jpg) foregrounds "THIS WEEK'S POT" and dollar
// payouts and must never appear on this page — see the compliance note at
// the top of the file.

function Scoreboard() {
  return (
    <Section tint>
      <SectionHead
        title={
          <>
            Sunday scoreboard,
            <br />
            <VoltMark>built for the moment.</VoltMark>
          </>
        }
        sub="Scores land as they finish. The app spots the 19 before anyone in the group chat does."
      />
      <div className="mt-12 relative max-w-4xl mx-auto">
        {/* The source shot is 1200px of dense dashboard. Letting it shrink to
            a ~330px phone viewport renders the scores about 4px tall, so on
            small screens it keeps a readable min-width and scrolls inside its
            own container instead. The page itself never scrolls sideways. */}
        <div className="relative bg-void-2 border border-void-line rounded-2xl overflow-x-auto shadow-2xl">
          <img
            src={marketingPointsShot}
            alt="19 Pool weekly results: live NFL scores with the 19-point week highlighted"
            className="block h-auto min-w-[640px] w-full"
          />
        </div>
        <p className="text-center text-white/40 text-xs mt-4">
          Live ESPN scores. Automatic detection when a team lands on 19.
          <span className="sm:hidden"> Swipe to see the full week.</span>
        </p>
      </div>
    </Section>
  );
}

// ─── Standings ────────────────────────────────────────────────────────
// Points-only variant of the phone shot. The original
// (19pool-marketing-phone-hero1.png) shows pot totals in dollars and must
// not appear on this page.

function Standings() {
  const points = [
    'Who has hit a 19, and how many times.',
    'Where every player sits, all season long.',
    'Updated the moment a game goes final.',
  ];
  return (
    <Section>
      <div className="grid md:grid-cols-2 gap-10 md:gap-14 items-center">
        <div className="order-2 md:order-1">
          <h2
            className="uppercase text-4xl sm:text-5xl leading-[0.95]"
            style={DISPLAY_WIDE}
          >
            The whole season,
            <br />
            <VoltMark>one leaderboard.</VoltMark>
          </h2>
          <p className="mt-5 text-white/60 leading-relaxed text-base sm:text-lg">
            No more "wait, who's actually winning?" in the group chat. Every
            player can pull up the standings on their phone any time.
          </p>
          <ul className="mt-7 space-y-3">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-3">
                <span
                  className="mt-[7px] h-1.5 w-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: VOLT }}
                />
                <span className="text-white/70 text-sm sm:text-base leading-relaxed">
                  {p}
                </span>
              </li>
            ))}
          </ul>
          <Link
            to="/signup"
            className="mt-8 inline-flex items-center justify-center text-sm font-bold text-black px-6 py-3 rounded-full transition-transform hover:scale-105"
            style={{ backgroundColor: VOLT }}
          >
            Start your league free →
          </Link>
        </div>
        <div className="order-1 md:order-2 flex justify-center">
          <img
            src={marketingPhoneShot}
            alt="19 Pool season standings on a phone: full-season leaderboard showing each player's count of 19s"
            className="block w-full max-w-[280px] sm:max-w-[320px] h-auto"
          />
        </div>
      </div>
    </Section>
  );
}

// ─── Features ─────────────────────────────────────────────────────────

const FEATURES = [
  { t: 'Live ESPN scores', b: 'Pulled automatically all Sunday. No manual entry, ever.' },
  { t: 'Automatic 19s', b: 'The app watches every game and flags the moment a team lands on 19.' },
  { t: 'Season standings', b: 'A running leaderboard the whole league can see at any time.' },
  { t: 'One-link invites', b: 'Send a link. They tap it, pick a name, and they are in.' },
  { t: 'Works on any phone', b: 'Browser-based. Nothing to download, nothing to update.' },
];

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
        {FEATURES.map((f) => (
          <div
            key={f.t}
            className="bg-void-2 border border-void-line rounded-2xl p-5 sm:p-6"
          >
            <h3 className="uppercase text-sm mb-2.5" style={DISPLAY_WIDE}>
              {f.t}
            </h3>
            <p className="text-white/60 text-xs leading-relaxed">{f.b}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: 'How many people do I need?',
    a: 'Anywhere from 8 to 32. Thirty-two is the sweet spot — one NFL team per player — but smaller leagues work fine, and the app assigns multiple teams per player automatically.',
  },
  {
    q: 'What if two players hit 19 in the same week?',
    a: 'Both are credited with the week. The app records every 19 it finds and shows them side by side in the results.',
  },
  {
    q: 'What if nobody hits 19?',
    a: 'The week is recorded with no 19 and the season carries on. Most weeks nobody hits it — that is what makes the ones that land feel good.',
  },
  {
    q: 'Do I have to install anything?',
    a: 'No. It runs in the browser on your phone or laptop. Players do not need an app store.',
  },
  {
    q: 'What does it cost?',
    a: 'Nothing for the 2026 season. We are in beta and want leagues actually using it.',
  },
  {
    q: 'Is this affiliated with the NFL?',
    a: 'No. 19 Pool is an independent tool and is not affiliated with or endorsed by the NFL or ESPN. Scores come from a public ESPN feed.',
  },
];

function FAQ() {
  return (
    <Section tint>
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
        {FAQS.map((f) => (
          <FAQItem key={f.q} {...f} />
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
        aria-expanded={open}
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

// ─── Final CTA ────────────────────────────────────────────────────────

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
            Start your league free →
          </Link>
          <Link
            to="/join"
            className="text-sm font-bold text-white border border-white/25 hover:border-white/60 hover:bg-white/5 px-8 py-4 rounded-full transition-all"
          >
            Join with a code
          </Link>
        </div>
      </div>
    </section>
  );
}
