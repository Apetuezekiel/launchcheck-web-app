import puppeteer from 'puppeteer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as {
    html?: unknown;
    filename?: unknown;
  };

  const html = body.html;
  const filename =
    typeof body.filename === 'string' ? body.filename : 'launchcheck-report.pdf';

  if (typeof html !== 'string' || !html.includes('<!doctype html>')) {
    return Response.json({ error: 'Provide the HTML report in the body.' }, { status: 400 });
  }

  try {
    const pdf = await htmlToPdf(html);
    return new Response(new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }), {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    const e = err as { message?: string };
    console.error('[pdf] conversion error:', e.message);
    return Response.json(
      { error: 'PDF generation failed: ' + (e.message ?? 'unknown') },
      { status: 500 },
    );
  }
}
