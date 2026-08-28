import { LegalPage, H2, P, CONTACT_EMAIL } from './LegalPage';

export default function Contact() {
  return (
    <LegalPage title="Contact">
      <P>
        Questions, feedback, bug reports, or a stuck league? Email us
        and a real person will reply — usually within a day.
      </P>

      <div className="my-8">
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-navy-950 font-bold py-3 px-6 rounded-xl transition-all tracking-wide"
        >
          Email {CONTACT_EMAIL}
        </a>
      </div>

      <H2>Common things to include</H2>
      <P>
        Making a small change to your first message helps us fix your
        issue faster:
      </P>
      <ul className="text-slate-300 text-[15px] leading-relaxed mb-4 list-disc pl-5 space-y-1.5">
        <li>
          <strong>Your league code</strong> (looks like{' '}
          <span className="font-mono text-amber-400">BOLT-5MSE8</span>) —
          it's on the Results tab.
        </li>
        <li>
          <strong>What you were trying to do</strong> and what happened
          instead.
        </li>
        <li>
          <strong>Screenshot</strong> if the issue is visual — a picture
          saves a lot of back-and-forth.
        </li>
      </ul>

      <H2>Response time</H2>
      <P>
        This is a small operation. Weekdays typically same day; weekends
        during game windows, we're usually watching football too and
        will reply the next morning.
      </P>
    </LegalPage>
  );
}
