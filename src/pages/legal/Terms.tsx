import { LegalPage, H2, P, UL, CONTACT_EMAIL } from './LegalPage';

export default function Terms() {
  return (
    <LegalPage title="Terms of Service" effectiveDate="2026-08-28">
      <P>
        Welcome to 19 Pool. By creating an account or joining a league on
        19pool.com (the "Service"), you agree to these Terms. If you
        don't agree, don't use the Service.
      </P>

      <H2>1. What 19 Pool is</H2>
      <P>
        19 Pool is a scorekeeping tool for a group of friends running an
        NFL score pool. Each week we watch scores from ESPN's public API
        and flag any team that lands on exactly 19 points. That's the
        entire product: rosters, teams, weekly results, standings.
      </P>
      <P>
        <strong>19 Pool does not collect, hold, or distribute money.</strong>{' '}
        Entry fees and pot payouts are exchanged directly between
        players — typically through Venmo. Any Venmo links or Pay
        buttons in the app are convenience shortcuts that open Venmo
        with pre-filled fields. The transaction happens on Venmo, not
        on 19 Pool. Whether and how a pot is paid out is entirely
        between the commissioner and the players.
      </P>

      <H2>2. Eligibility</H2>
      <P>
        You must be at least 18 years old and legally able to enter into
        a contract to use the Service. If your local jurisdiction
        restricts pool-style contests or the exchange of money between
        friends around sports outcomes, it's your responsibility to
        know that and stay on the right side of it.
      </P>

      <H2>3. Your account</H2>
      <P>You're responsible for:</P>
      <UL>
        <li>Keeping your login credentials secret.</li>
        <li>
          Every action taken from your account, including any changes
          you make as a league commissioner.
        </li>
        <li>Any real-world money you agree to pay another player.</li>
      </UL>
      <P>
        We use Firebase Authentication for sign-in and password reset.
        Password requirements and strength meter aim to keep obvious
        weak passwords out — that doesn't replace using a unique
        password.
      </P>

      <H2>4. Player-to-player money</H2>
      <P>
        A league's entry fee, season pot, and weekly payouts are set by
        the commissioner and paid between players outside 19 Pool.
        You acknowledge that:
      </P>
      <UL>
        <li>
          19 Pool does not verify that any player has paid, nor that
          any winner has been paid. Payment tracking, if enabled, is a
          convenience for the commissioner to record what they've
          received — it is not an escrow.
        </li>
        <li>
          If there's a dispute between players about who owes what,
          it's between those players. 19 Pool is not a party to it and
          can't mediate.
        </li>
        <li>
          Scoring is derived from ESPN's public data. If ESPN reports a
          score wrong, our data will reflect that until ESPN corrects
          it. We refresh throughout the day; a wrong live score usually
          self-corrects before the week is over.
        </li>
      </UL>

      <H2>5. Acceptable use</H2>
      <P>Don't:</P>
      <UL>
        <li>Impersonate someone else or use a stolen email address.</li>
        <li>
          Use the Service to harass, threaten, or defraud other players.
        </li>
        <li>
          Try to break, probe, or overload the Service, its API, or the
          third-party services it relies on (Firebase, Resend, Vercel,
          ESPN).
        </li>
        <li>
          Scrape or resell the Service or its data.
        </li>
      </UL>
      <P>
        We reserve the right to suspend or delete any account that
        violates these rules or that we reasonably believe is being
        used to harm other players.
      </P>

      <H2>6. Your content</H2>
      <P>
        Anything you enter, like league names, player names, Venmo handles
        — you keep. You grant 19 Pool the license needed to display it
        inside your league (to other players of that league) and to
        operate the Service. You represent that you have the right to
        enter what you enter, especially anyone else's name or email
        that you invite.
      </P>

      <H2>7. Beta and free-during-2026-season pricing</H2>
      <P>
        19 Pool is currently free during the 2026 NFL season while it's
        in beta. Pricing may change for future seasons; we'll give
        commissioners advance notice by email if that happens, and any
        pricing change won't affect a league already underway.
      </P>

      <H2>8. Termination</H2>
      <P>
        You can delete your account at any time from Account → Danger
        Zone. Doing so removes your user data and pulls you out of any
        league you're in. Commissioners must delete their
        league first.
      </P>
      <P>
        We may suspend or terminate accounts that break these Terms.
        We'll try to give you notice by email unless we think the
        account is actively harming others, in which case we may act
        first.
      </P>

      <H2>9. Disclaimers</H2>
      <P>
        The Service is provided "as is" and "as available". We don't
        promise the Service will be uninterrupted, error-free, or that
        scores or standings will be accurate at any given moment — data
        depends on third-party feeds. To the fullest extent allowed by
        law, we disclaim all warranties, express or implied.
      </P>

      <H2>10. Limitation of liability</H2>
      <P>
        To the fullest extent allowed by law, 19 Pool and its operators
        are not liable to you for any indirect, incidental, special, or
        consequential damages, including lost pot money, lost data, or
        lost fun. Our total liability to you for any claim arising out
        of the Service is limited to the greater of (a) $50 or (b) the
        amount you paid us in the 12 months before the claim (which,
        during beta, is $0).
      </P>

      <H2>11. Changes to these Terms</H2>
      <P>
        We may update these Terms occasionally. If we make a material
        change, we'll bump the effective date at the top and, for
        significant changes, email commissioners. Continuing to use the
        Service after a change means you accept the new Terms.
      </P>

      <H2>12. Governing law</H2>
      <P>
        These Terms are governed by the laws of the United States, and
        any dispute will be brought in the courts serving the operator's
        residence. Where local consumer-protection law gives you
        stronger rights, those take precedence.
      </P>

      <H2>13. Contact</H2>
      <P>
        Questions about these Terms? Email{' '}
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
