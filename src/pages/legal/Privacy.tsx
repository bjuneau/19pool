import { LegalPage, H2, P, UL, CONTACT_EMAIL } from './LegalPage';

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy" effectiveDate="2026-08-30">
      <P>
        This policy explains what 19 Pool collects when you use
        19pool.com (the "Service"), what we do with it, who we share it
        with, and how you can get at it or delete it.
      </P>

      <H2>What we collect</H2>
      <P>Only the minimum needed to run a football pool for you:</P>
      <UL>
        <li>
          <strong>Email address</strong> — required to sign in and
          receive invite emails.
        </li>
        <li>
          <strong>First and last name</strong> shown to other players
          of your league. Players in a league see first name + last
          initial only.
        </li>
        <li>
          <strong>Venmo handle (optional)</strong> — used to build
          player-to-player pay links. Only visible inside your own
          league.
        </li>
        <li>
          <strong>League activity</strong> — what league you're in,
          which teams are assigned to you, weekly score results, and
          (if the commissioner enables payment tracking) whether the
          commissioner has marked your entry fee as received.
        </li>
        <li>
          <strong>How you found us</strong> — if you arrive from one of
          our ads or a link we published, we store the campaign tags on
          that link (and the site you came from) on your account, so we
          can tell which campaigns actually bring in players.
        </li>
        <li>
          <strong>Authentication metadata</strong> — timestamps of
          sign-in, password reset, and email delivery, kept by Firebase
          Auth.
        </li>
      </UL>
      <P>
        We do not collect a phone number, mailing address, date of
        birth, or payment card details, and we build no profile of your
        browsing anywhere outside 19pool.com. (Our advertising pixel,
        described below, does let Meta see your IP address and which
        19pool.com pages you viewed.) 19 Pool does not process or handle money — entry fees
        and payouts go directly between players via Venmo (see the
        Terms of Service).
      </P>

      <H2>How we use it</H2>
      <UL>
        <li>To run the Service: show your league its players, teams, and results.</li>
        <li>To send you the emails you'd expect: invites, password reset, occasional service-important notices.</li>
        <li>To debug problems (server logs).</li>
      </UL>
      <P>
        We advertise 19 Pool on Facebook and Instagram, and we use
        Meta's advertising pixel on this site to measure whether those
        ads work. The pixel reports which pages you viewed on
        19pool.com and whether you created an account. Meta may
        connect that to your Facebook or Instagram account.
      </P>
      <P>
        We do <strong>not</strong> send Meta your name, email address,
        or Venmo handle, and we do not upload customer lists to Meta.
        We don't sell your data for money. We run no other analytics or
        tracking SDK.
      </P>

      <H2>Who we share it with</H2>
      <P>
        We rely on a small set of third-party services to run the app.
        Your data reaches them only to the extent needed to do their
        job:
      </P>
      <UL>
        <li>
          <strong>Google Firebase</strong> — authentication and
          database (Firestore). Stores your account, league membership,
          and scoring data.
        </li>
        <li>
          <strong>Vercel</strong> — hosts the web app and API endpoints.
          Server logs may contain request metadata (URL, response code,
          timestamp).
        </li>
        <li>
          <strong>Resend</strong> — sends invite and password-reset
          emails. Sees the recipient email address and message body.
        </li>
        <li>
          <strong>Meta Platforms</strong> — advertising measurement.
          Sees which pages you visited on 19pool.com and whether you
          created an account, along with your IP address and browser
          details. Does not receive your name, email, or Venmo handle.
        </li>
        <li>
          <strong>ESPN</strong> — public NFL scores API. We fetch
          scoreboard data <em>from</em> ESPN; we do not send any user
          data to them.
        </li>
      </UL>
      <P>
        Beyond those service providers, we do not share your personal
        data with third parties unless required by law (subpoena or
        court order).
      </P>

      <H2>What other players see</H2>
      <P>
        Only players in the same league can see each other. Within a
        league:
      </P>
      <UL>
        <li>Everyone sees each other's first name + last initial.</li>
        <li>Everyone sees assigned NFL teams and standings.</li>
        <li>
          The commissioner additionally sees full names, email
          addresses, Venmo handles, and (if payment tracking is
          enabled) payment status.
        </li>
      </UL>
      <P>
        Players in one league cannot see players in a different league.
      </P>

      <H2>Cookies and local storage</H2>
      <P>
        We use browser local storage for a couple of small conveniences
        — remembering which sub-tab you last viewed, keeping you signed
        in via Firebase's session token.
      </P>
      <P>
        The Meta advertising pixel described above also stores an
        identifier in your browser so Meta can recognize a return
        visit. Blocking it (see the next section) stops that.
      </P>

      <H2>Advertising and your choices</H2>
      <P>
        Sharing your activity with Meta for ad measurement counts as
        "sharing for targeted advertising" under several US state
        privacy laws, including California's. You can stop it:
      </P>
      <UL>
        <li>
          Turn on <strong>Global Privacy Control</strong> in your
          browser, or use any tracker-blocking extension or browser
          (Firefox, Brave, and Safari block this pixel by default).
        </li>
        <li>
          Adjust ad settings inside Facebook or Instagram directly, under
          Settings → Ads → Ad preferences.
        </li>
        <li>
          Run <code className="text-amber-400">localStorage.setItem(
          '19pool.adTrackingOptOut', '1')</code> in your browser console,
          or email us and we'll walk you through it.
        </li>
      </UL>
      <P>
        None of this affects your ability to use 19 Pool — the game
        works identically either way.
      </P>

      <H2>Your rights and how to exercise them</H2>
      <UL>
        <li>
          <strong>Access and update</strong> — everything we hold about
          you (name, email, Venmo, league membership) is visible and
          editable on the Account page.
        </li>
        <li>
          <strong>Delete</strong> — Account → Danger Zone → Delete
          Account permanently removes your user record and pulls you
          out of any league. Commissioners must delete their league
          first.
        </li>
        <li>
          <strong>Export</strong> — email us and we'll send you what we
          have.
        </li>
      </UL>

      <H2>Data retention</H2>
      <P>
        We keep your data for as long as your account exists. When you
        delete your account, your user document and Firebase Auth
        record are deleted, and your player entry in any league is
        removed. Historical weekly-score results tied to a completed
        league remain until the commissioner deletes that league.
      </P>

      <H2>Security</H2>
      <P>
        Data in transit is TLS-encrypted. Firestore rules restrict
        writes so, for example, only a league's commissioner can
        modify that league. Passwords are handled by Firebase Auth —
        we never see or store them ourselves. That said, no system is
        perfectly secure; if you spot a security issue, please email us.
      </P>

      <H2>Children</H2>
      <P>
        The Service is not directed at anyone under 18 and we don't
        knowingly collect data from anyone under 18. If you're a parent
        and believe we've collected data about your child, email us
        and we'll delete it.
      </P>

      <H2>Changes to this policy</H2>
      <P>
        We may update this policy as the Service evolves. If we make a
        material change, we'll bump the effective date at the top and,
        for significant changes, email commissioners.
      </P>

      <H2>Contact</H2>
      <P>
        Privacy questions or requests? Email{' '}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="text-amber-400 hover:text-amber-300 underline-offset-2 hover:underline"
        >
          {CONTACT_EMAIL}
        </a>
        .
      </P>
    </LegalPage>
  );
}
