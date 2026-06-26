import * as cron from 'node-cron';
import { listTargets, insertScan } from './db';
import { runScan } from './scanner';
import { sendReport } from './mailer';

const jobs = new Map<number, cron.ScheduledTask>();

async function runJobForTarget(targetId: number, url: string, email: string | null): Promise<void> {
  console.log(`[scheduler] scanning ${url}`);
  const result = await runScan(url);
  const scan = insertScan({
    target_id: targetId,
    status: result.status,
    failed: result.failed ?? null,
    warned: result.warned ?? null,
    passed: result.passed ?? null,
    skipped: result.skipped ?? null,
    pdf_path: result.pdfPath ?? null,
    error_message: result.errorMessage ?? null,
  });

  if (result.pdfPath && email) {
    const summary = scan.failed !== null
      ? `${scan.failed} failed, ${scan.warned} warned, ${scan.passed} passed, ${scan.skipped} skipped.`
      : result.errorMessage ?? 'Scan completed.';
    await sendReport(result.pdfPath, email, url, summary).catch((err: unknown) => {
      const e = err as { message?: string };
      console.error('[scheduler] sendReport failed:', e.message);
    });
  }
}

export function rebuildJobs(): void {
  for (const task of jobs.values()) {
    task.stop();
  }
  jobs.clear();

  const targets = listTargets();
  for (const target of targets) {
    if (!target.enabled) continue;
    if (!cron.validate(target.cron)) {
      console.warn(`[scheduler] invalid cron "${target.cron}" for target ${target.id}, skipping`);
      continue;
    }
    const task = cron.schedule(target.cron, () => {
      runJobForTarget(target.id, target.url, target.email).catch((err: unknown) => {
        const e = err as { message?: string };
        console.error(`[scheduler] job error for target ${target.id}:`, e.message);
      });
    });
    jobs.set(target.id, task);
    console.log(`[scheduler] scheduled target ${target.id} (${target.url}) @ ${target.cron}`);
  }
}

export function startScheduler(): void {
  console.log('[scheduler] starting');
  rebuildJobs();
}
