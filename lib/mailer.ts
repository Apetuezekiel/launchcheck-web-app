import * as fs from 'node:fs';
import * as path from 'node:path';

export async function sendReport(
  pdfPath: string,
  toEmail: string,
  url: string,
  summary: string,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[mailer] TODO: set RESEND_API_KEY to enable email delivery');
    return;
  }

  const { Resend } = await import('resend');
  const resend = new Resend(apiKey);

  const hostname = new URL(url).hostname;
  const date = new Date().toISOString().slice(0, 10);
  const subject = `launchcheck report — ${hostname} — ${date}`;
  const from = process.env.FROM_EMAIL ?? 'reports@resend.dev';

  const attachment = fs.readFileSync(pdfPath);
  const filename = path.basename(pdfPath);

  await resend.emails.send({
    from,
    to: toEmail,
    subject,
    text: summary,
    attachments: [{ filename, content: attachment }],
  });
}
