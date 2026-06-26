import { execFile } from 'node:child_process';
import * as path from 'node:path';
import { promisify } from 'node:util';
import puppeteer from 'puppeteer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180; // scan ~60s + PDF conversion ~30s

const execFileAsync = promisify(execFile);

/**
 * SSRF guard: only public http(s) URLs.
 * String-level only. For a public deployment also resolve the hostname and
 * re-check the resulting IP (DNS-rebinding defence).
 */
function isPublicHttpUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  const h = u.hostname;
  if (/^(localhost|0\.0\.0\.0|::1)$/i.test(h)) return false;
  if (/^127\./.test(h)) return false;
  if (/^10\./.test(h)) return false;
  if (/^192\.168\./.test(h)) return false;
  if (/^169\.254\./.test(h)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
  return true;
}

/**
 * Render self-contained HTML to a PDF buffer via puppeteer.
 * The launchcheck HTML report is script-free and has no external resources,
 * so 'load' is sufficient — no need for networkidle0.
 */
async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '16px', right: '16px', bottom: '16px', left: '16px' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { url?: unknown };
  const url = body.url;

  if (typeof url !== 'string' || !isPublicHttpUrl(url)) {
    return Response.json({ error: 'Provide a valid public http(s) URL.' }, { status: 400 });
  }

  // Step 1: run launchcheck, get the self-contained HTML report.
  const bin = path.join(process.cwd(), 'node_modules', 'launchcheck', 'bin', 'launchcheck.mjs');
  const args = [bin, 'scan', '--url', url, '--format', 'html'];
  const opts = { timeout: 120_000, maxBuffer: 64 * 1024 * 1024 };

  let html: string;
  try {
    const { stdout } = await execFileAsync(process.execPath, args, opts);
    html = stdout;
  } catch (err) {
    // Exit 1 = findings present — report is still in stdout.
    const e = err as { stdout?: string; stderr?: string; message?: string };
    if (typeof e.stdout === 'string' && e.stdout.includes('<!doctype html>')) {
      html = e.stdout;
    } else {
      const detail = e.stderr ?? e.message ?? 'scan failed';
      console.error('[scan] launchcheck error:', detail);
      return Response.json({ error: detail }, { status: 500 });
    }
  }

  // Step 2: convert HTML → PDF.
  // The launchcheck child process has already exited, so launching a second
  // puppeteer instance here does not conflict with it.
  try {
    const pdf = await htmlToPdf(html);
    const host = new URL(url).hostname.replace(/^www\./, '');
    const filename = `launchcheck-${host}.pdf`;
    return new Response(pdf, {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    const e = err as { message?: string };
    console.error('[scan] PDF conversion error:', e.message);
    return Response.json(
      { error: 'PDF generation failed: ' + (e.message ?? 'unknown') },
      { status: 500 },
    );
  }
}
