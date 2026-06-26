import { getTarget, insertScan } from '@/lib/db';
import { runScan, scanning } from '@/lib/scanner';
import { sendReport } from '@/lib/mailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { targetId?: unknown };
  const targetId = body.targetId;

  if (typeof targetId !== 'number') {
    return Response.json({ error: 'Provide targetId.' }, { status: 400 });
  }

  const target = getTarget(targetId);
  if (!target) {
    return Response.json({ error: 'Target not found.' }, { status: 404 });
  }

  if (scanning.has(target.url)) {
    return Response.json({ error: 'Scan already in progress for this target.' }, { status: 409 });
  }

  scanning.add(target.url);
  try {
    const result = await runScan(target.url);
    const scan = insertScan({
      target_id: target.id,
      status: result.status,
      failed: result.failed ?? null,
      warned: result.warned ?? null,
      passed: result.passed ?? null,
      skipped: result.skipped ?? null,
      pdf_path: result.pdfPath ?? null,
      error_message: result.errorMessage ?? null,
    });

    if (result.pdfPath && target.email) {
      const summary = scan.failed !== null
        ? `${scan.failed} failed, ${scan.warned} warned, ${scan.passed} passed, ${scan.skipped} skipped.`
        : result.errorMessage ?? 'Scan completed.';
      await sendReport(result.pdfPath, target.email, target.url, summary).catch((err: unknown) => {
        const e = err as { message?: string };
        console.error('[scan route] sendReport failed:', e.message);
      });
    }

    return Response.json({ result });
  } finally {
    scanning.delete(target.url);
  }
}
