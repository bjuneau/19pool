import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Method not allowed' });
    }

  const { to, subject, html } = req.body || {};

  if (!to || !subject || !html) {
        return res.status(400).json({ error: 'Missing required fields: to, subject, html' });
  }

  const recipients = Array.isArray(to) ? to : [to];
    if (!recipients.length) {
          return res.status(400).json({ error: 'No recipients provided' });
    }

  try {
        const { data, error } = await resend.emails.send({
                from: '19 Pool <invite@19pool.com>',
                to: recipients,
                subject,
                html,
        });

      if (error) {
              console.error('Resend error:', error);
              return res.status(400).json({ error: error.message || 'Failed to send email' });
      }

      return res.status(200).json({ success: true, id: data?.id });
  } catch (err) {
        console.error('send-email handler error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
