import { getTarget, deleteTarget, updateTarget } from '@/lib/db';
import { rebuildJobs } from '@/lib/scheduler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const targetId = parseInt(id, 10);
  if (isNaN(targetId)) {
    return Response.json({ error: 'Invalid id.' }, { status: 400 });
  }
  if (!getTarget(targetId)) {
    return Response.json({ error: 'Not found.' }, { status: 404 });
  }
  deleteTarget(targetId);
  rebuildJobs();
  return new Response(null, { status: 204 });
}

export async function PATCH(req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const targetId = parseInt(id, 10);
  if (isNaN(targetId)) {
    return Response.json({ error: 'Invalid id.' }, { status: 400 });
  }
  if (!getTarget(targetId)) {
    return Response.json({ error: 'Not found.' }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    enabled?: unknown;
    cron?: unknown;
    email?: unknown;
  };

  const patch: Parameters<typeof updateTarget>[1] = {};
  if (typeof body.enabled === 'number') patch.enabled = body.enabled;
  if (typeof body.cron === 'string') patch.cron = body.cron;
  if ('email' in body) patch.email = typeof body.email === 'string' ? body.email : null;

  updateTarget(targetId, patch);
  rebuildJobs();
  return Response.json(getTarget(targetId));
}
