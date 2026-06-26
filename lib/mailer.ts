import * as fs from 'node:fs';
import { Resend } from 'resend';

export async function sendReport(
  pdfPath: string,
  toEmail: string,
  url: string,
  summary: string,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.FROM_EMAIL;

  if (!apiKey || !from) {
    console.warn('[mailer] RESEND_API_KEY and FROM_EMAIL must both be set to deliver email');
    return;
  }

  const hostname = new URL(url).hostname;
  const date = new Date().toISOString().split('T')[0];
  const subject = `launchcheck report — ${hostname} — ${date}`;
  const filename = `launchcheck-${hostname}.pdf`;

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: toEmail,
    subject,
    text: summary,
    attachments: [{ filename, content: fs.readFileSync(pdfPath) }],
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}
