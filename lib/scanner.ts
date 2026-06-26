import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';
import puppeteer from 'puppeteer';

const execFileAsync = promisify(execFile);

export interface ScanResult {
  status: 'ok' | 'error';
  failed?: number;
  warned?: number;
  passed?: number;
  skipped?: number;
  pdfPath?: string;
  errorMessage?: string;
}

// In-memory set of URLs currently being scanned (concurrency guard).
export const scanning = new Set<string>();

async function htmlToPdf(html: string): Promise<Uint8Array> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '16px', right: '16px', bottom: '16px', left: '16px' },
    });
  } finally {
    await browser.close();
  }
}

export async function runScan(url: string): Promise<ScanResult> {
  const bin = path.join(process.cwd(), 'node_modules', 'launchcheck', 'bin', 'launchcheck.mjs');
  const args = [bin, 'scan', '--url', url, '--format', 'html'];
  const opts = { timeout: 120_000, maxBuffer: 64 * 1024 * 1024 };

  let html: string;
  try {
    const { stdout } = await execFileAsync(process.execPath, args, opts);
    html = stdout;
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    if (typeof e.stdout === 'string' && e.stdout.includes('<!doctype html>')) {
      html = e.stdout;
    } else {
      return {
        status: 'error',
        errorMessage: e.stderr ?? e.message ?? 'scan failed',
      };
    }
  }

  const m = html.match(/(\d+) failed.*?(\d+) warned.*?(\d+) passed.*?(\d+) skipped/);
  const failed = m ? parseInt(m[1], 10) : undefined;
  const warned = m ? parseInt(m[2], 10) : undefined;
  const passed = m ? parseInt(m[3], 10) : undefined;
  const skipped = m ? parseInt(m[4], 10) : undefined;

  let pdfPath: string | undefined;
  try {
    const hostname = new URL(url).hostname;
    const timestamp = Date.now();
    const dir = path.join(process.cwd(), 'reports', hostname);
    fs.mkdirSync(dir, { recursive: true });
    pdfPath = path.join(dir, `${timestamp}.pdf`);
    const pdf = await htmlToPdf(html);
    fs.writeFileSync(pdfPath, pdf);
  } catch (err) {
    const e = err as { message?: string };
    console.error('[scanner] PDF generation failed:', e.message);
    pdfPath = undefined;
  }

  return { status: 'ok', failed, warned, passed, skipped, pdfPath };
}
