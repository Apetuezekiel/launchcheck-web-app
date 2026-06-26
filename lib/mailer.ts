import { Resend } from 'resend';
import * as fs from 'node:fs';

export async function sendReport(
  pdfPath: string,
  toEmail: string,
  url: string,
  summary: string,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.FROM_EMAIL;

  if (!apiKey) {
    console.warn('[mailer] RESEND_API_KEY not set — skipping email.');
    return;
  }
  if (!fromEmail) {
    console.warn('[mailer] FROM_EMAIL not set — skipping email.');
    return;
  }

  const resend = new Resend(apiKey);
  const hostname = new URL(url).hostname;
  const date = new Date().toISOString().split('T')[0];
  const subject = `launchcheck report — ${hostname} — ${date}`;
  const filename = `launchcheck-${hostname}.pdf`;
  const pdfBuffer = fs.readFileSync(pdfPath);

  const { error } = await resend.emails.send({
    from: fromEmail,
    to: toEmail,
    subject,
    text: summary,
    attachments: [{ filename, content: pdfBuffer }],
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}
