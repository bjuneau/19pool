// Builds the HTML body for the invite email. Inline styles only — many email
// clients ignore <style> blocks and don't load external CSS.
export function buildInviteEmailHtml(args: {
  leagueName: string;
  commissionerName: string;
  inviteUrl: string;
}): string {
  const { leagueName, commissionerName, inviteUrl } = args;
  const safeLeague = escapeHtml(leagueName);
  const safeCommissioner = escapeHtml(commissionerName);
  const safeUrl = escapeHtml(inviteUrl);

  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif; max-width: 560px; margin: 0 auto; color: #1a202c;">
  <div style="background: #0a0f1e; padding: 32px 24px; text-align: center; border-radius: 12px 12px 0 0;">
    <p style="color: #f59e0b; font-size: 24px; font-weight: 800; letter-spacing: 0.2em; margin: 0;">19 POOL</p>
  </div>
  <div style="background: #ffffff; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 0 0 12px 12px;">
    <h1 style="font-size: 22px; font-weight: 700; margin: 0 0 16px 0;">You're invited to <strong>${safeLeague}</strong></h1>
    <p style="font-size: 15px; line-height: 1.6; color: #4a5568;">
      ${safeCommissioner} invited you to join their NFL pool on 19 Pool. Score exactly 19 points and you take home the weekly pot.
    </p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${safeUrl}" style="display: inline-block; background: #f59e0b; color: #0a0f1e; font-weight: 700; padding: 14px 32px; border-radius: 9999px; text-decoration: none;">Accept Invite</a>
    </div>
    <p style="font-size: 13px; color: #718096; line-height: 1.6;">
      Or paste this link into your browser:<br>
      <a href="${safeUrl}" style="color: #f59e0b; word-break: break-all;">${safeUrl}</a>
    </p>
  </div>
  <p style="text-align: center; font-size: 12px; color: #718096; margin-top: 24px;">
    Sent from 19pool.com · You can reply to this email to reach ${safeCommissioner}.
  </p>
</div>`.trim();
}

export function buildInviteEmailSubject(commissionerName: string, leagueName: string): string {
  return `${commissionerName} invited you to ${leagueName} on 19 Pool`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
