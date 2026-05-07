import { Link } from 'react-router-dom';
import { Button } from '../components/Button';

export default function Landing() {
  return (
    <div>
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-darker border-b border-white/5">
        <div className="h-16 flex items-center px-4 sm:px-6 lg:px-8 gap-4">
          <Link
            to="/"
            className="text-2xl font-extrabold tracking-widest flex-shrink-0 text-left"
          >
            <span className="text-amber-400">19</span>
            <span className="text-white"> POOL</span>
          </Link>
          <div className="flex items-center gap-3 ml-auto">
            <Link
              to="/signin"
              className="text-sm font-medium text-slate-400 hover:text-white transition-colors px-3 py-2"
            >
              Sign In
            </Link>
            <Link
              to="/signup"
              className="bg-amber-500 hover:bg-amber-400 text-navy-950 text-sm font-bold px-5 py-2 rounded-full transition-all hover:scale-105 tracking-wide"
            >
              Create League
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero-bg grid-bg min-h-screen flex flex-col items-center justify-center text-center px-4 pt-24 pb-16 relative overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-amber-500/5 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold tracking-widest uppercase px-4 py-2 rounded-full mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            NFL · 32 Players · One Winner Each Week
          </div>

          <h1 className="text-8xl sm:text-[11rem] font-extrabold tracking-tight leading-none mb-2 text-glow">
            <span className="text-amber-400">19</span>
          </h1>
          <h2 className="text-5xl sm:text-7xl font-extrabold tracking-[0.25em] text-white mb-6 uppercase">
            POOL
          </h2>

          <p className="text-xl sm:text-2xl text-slate-400 font-light max-w-2xl mx-auto mb-4">
            Score exactly{' '}
            <span className="text-amber-400 font-semibold">19 points</span> — win
            or lose — and you take home the entire weekly pot.
          </p>
          <p className="text-sm text-slate-500 mb-12">
            32 people. 32 NFL teams. Scores auto-update from ESPN every 30
            seconds.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/signup">
              <Button variant="primary">🏆 Create a League</Button>
            </Link>
            <Link to="/signup">
              <Button variant="secondary">Join with a Code</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-navy-900 py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-amber-400 text-sm font-semibold tracking-widest uppercase mb-3">
              The Game
            </p>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
              Simple rules. Big drama.
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                n: '01',
                title: 'Form Your League',
                body:
                  'One commissioner creates the league and invites exactly 32 people. You set the weekly stakes.',
              },
              {
                n: '02',
                title: 'Get Your Team',
                body:
                  'The commissioner assigns one NFL team to each player. That team is yours for the entire season.',
              },
              {
                n: '03',
                title: 'Watch Live Scores',
                body:
                  '19 Pool pulls live scores from ESPN every 30 seconds. Zero manual entry — ever.',
              },
              {
                n: '04',
                title: 'Hit 19, Win It All',
                body:
                  'Your team ends on exactly 19 points — win or lose — and you pocket the weekly pot.',
              },
            ].map((step) => (
              <div
                key={step.n}
                className="glass rounded-2xl p-8 hover:border-amber-500/20 transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mb-5 group-hover:bg-amber-500/20 transition-colors">
                  <span className="text-amber-400 font-mono font-bold text-lg">
                    {step.n}
                  </span>
                </div>
                <h3 className="font-bold text-white text-lg mb-2">
                  {step.title}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The 19 Banner */}
      <section className="bg-amber-500 py-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <span className="text-[300px] font-extrabold text-amber-600/20 leading-none">
            19
          </span>
        </div>
        <div className="relative max-w-3xl mx-auto text-center">
          <h2 className="text-4xl sm:text-6xl font-extrabold text-navy-950 tracking-tight mb-4">
            The Only Number That Matters
          </h2>
          <p className="text-amber-900/70 text-lg mb-8 max-w-xl mx-auto">
            Win or lose, offense or defense — all that matters is that final
            scoreboard reads 19. Any given Sunday, lightning can strike.
          </p>
          <Link
            to="/signup"
            className="inline-block bg-navy-950 text-amber-400 font-bold px-8 py-3 rounded-full text-sm tracking-widest uppercase hover:bg-navy-800 transition-colors"
          >
            Start Your League
          </Link>
        </div>
      </section>

      {/* Prizes */}
      <section className="bg-navy-950 py-24 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-amber-400 text-sm font-semibold tracking-widest uppercase mb-3">
            The Stakes
          </p>
          <h2 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight mb-16">
            Win every week. Or watch the pot grow.
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                emoji: '💵',
                title: 'Weekly Pot',
                body:
                  "Every member's entry fee rolls into the weekly prize. Hit 19 and it's all yours.",
              },
              {
                emoji: '🎰',
                title: 'Rollover',
                body:
                  'No winner? The pot rolls over and keeps building week after week.',
              },
              {
                emoji: '📡',
                title: 'Live Scores',
                body:
                  'Scores stream from ESPN automatically. No manual entry, no arguments.',
              },
              {
                emoji: '🔥',
                title: '32 Chances',
                body:
                  'All 32 NFL teams in play every single week. Drama guaranteed.',
              },
            ].map((p) => (
              <div
                key={p.title}
                className="glass rounded-2xl p-8 text-center hover:glow-gold-sm transition-all"
              >
                <div className="text-4xl mb-4">{p.emoji}</div>
                <h3 className="font-bold text-amber-400 text-xl mb-2">{p.title}</h3>
                <p className="text-slate-400 text-sm">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="hero-bg py-24 px-4 text-center border-t border-white/5">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight mb-4">
            Ready to run your league?
          </h2>
          <p className="text-slate-400 text-lg mb-10">
            Two minutes to set up. A full NFL season of Sunday drama.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/signup">
              <Button variant="primary">Create Your League</Button>
            </Link>
            <Link to="/signup">
              <Button variant="secondary">Join with a Code</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-navy-950 border-t border-white/5 py-12 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-2xl font-extrabold tracking-widest">
            <span className="text-amber-400">19</span>
            <span className="text-white"> POOL</span>
          </div>
          <p className="text-slate-500 text-sm">
            Not affiliated with the NFL or ESPN. © 2025 19 Pool.
          </p>
          <div className="flex gap-6 text-slate-500 text-sm">
            <Link to="/signup" className="hover:text-white transition-colors">
              Create League
            </Link>
            <Link to="/signup" className="hover:text-white transition-colors">
              Join League
            </Link>
            <Link to="/signin" className="hover:text-white transition-colors">
              Sign In
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
