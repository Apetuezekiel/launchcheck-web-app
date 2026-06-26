import { execFile } from 'node:child_process';
import * as path from 'node:path';
import { promisify } from 'node:util';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

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

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { url?: unknown };
  const url = body.url;

  if (typeof url !== 'string' || !isPublicHttpUrl(url)) {
    return Response.json({ error: 'Provide a valid public http(s) URL.' }, { status: 400 });
  }

  const bin = path.join(process.cwd(), 'node_modules', 'launchcheck', 'bin', 'launchcheck.mjs');
  const args = [bin, 'scan', '--url', url, '--format', 'html'];
  const opts = { timeout: 120_000, maxBuffer: 64 * 1024 * 1024 };

  try {
    const { stdout } = await execFileAsync(process.execPath, args, opts);
    return new Response(stdout, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  } catch (err) {
    // Exit 1 = findings present — report is still in stdout.
    const e = err as { stdout?: string; stderr?: string; message?: string };
    if (typeof e.stdout === 'string' && e.stdout.includes('<!doctype html>')) {
      return new Response(e.stdout, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    }
    const detail = e.stderr ?? e.message ?? 'scan failed';
    console.error('[scan] launchcheck error:', detail);
    return Response.json({ error: detail }, { status: 500 });
  }
}
