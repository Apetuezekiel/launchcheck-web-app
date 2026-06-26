import { listTargets, insertTarget, lastScanForTarget } from '@/lib/db';
import { rebuildJobs } from '@/lib/scheduler';
import { isPublicHttpUrl } from '@/lib/ssrf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const targets = listTargets();
  const result = targets.map((t) => ({
    ...t,
    lastScan: lastScanForTarget(t.id) ?? null,
  }));
  return Response.json(result);
}

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as {
    url?: unknown;
    cron?: unknown;
    email?: unknown;
  };

  const url = body.url;
  const cronExpr = typeof body.cron === 'string' ? body.cron : '0 9 * * 1';
  const email = typeof body.email === 'string' && body.email ? body.email : null;

  if (typeof url !== 'string' || !isPublicHttpUrl(url)) {
    return Response.json({ error: 'Provide a valid public http(s) URL.' }, { status: 400 });
  }

  try {
    const target = insertTarget(url, cronExpr, email);
    rebuildJobs();
    return Response.json(target, { status: 201 });
  } catch (err) {
    const e = err as { message?: string; code?: string };
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return Response.json({ error: 'URL already monitored.' }, { status: 409 });
    }
    return Response.json({ error: e.message ?? 'insert failed' }, { status: 500 });
  }
}
