import Database from 'better-sqlite3';
import path from 'node:path';

export interface Target {
  id: number;
  url: string;
  cron: string;
  email: string | null;
  enabled: number;
  created_at: number;
}

export interface Scan {
  id: number;
  target_id: number;
  scanned_at: number;
  status: 'ok' | 'error';
  failed: number | null;
  warned: number | null;
  passed: number | null;
  skipped: number | null;
  pdf_path: string | null;
  error_message: string | null;
}

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  const dbPath = path.join(process.cwd(), 'monitor.db');
  _db = new Database(dbPath);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  migrate(_db);
  return _db;
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS targets (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      url         TEXT    NOT NULL UNIQUE,
      cron        TEXT    NOT NULL DEFAULT '0 9 * * 1',
      email       TEXT,
      enabled     INTEGER NOT NULL DEFAULT 1,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS scans (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      target_id     INTEGER NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
      scanned_at    INTEGER NOT NULL DEFAULT (unixepoch()),
      status        TEXT    NOT NULL CHECK(status IN ('ok','error')),
      failed        INTEGER,
      warned        INTEGER,
      passed        INTEGER,
      skipped       INTEGER,
      pdf_path      TEXT,
      error_message TEXT
    );
  `);
}

export function listTargets(): Target[] {
  return getDb().prepare('SELECT * FROM targets ORDER BY created_at DESC').all() as Target[];
}

export function getTarget(id: number): Target | undefined {
  return getDb().prepare('SELECT * FROM targets WHERE id = ?').get(id) as Target | undefined;
}

export function insertTarget(url: string, cron: string, email: string | null): Target {
  const db = getDb();
  const result = db
    .prepare('INSERT INTO targets (url, cron, email) VALUES (?, ?, ?)')
    .run(url, cron, email);
  return getTarget(result.lastInsertRowid as number)!;
}

export function deleteTarget(id: number): void {
  getDb().prepare('DELETE FROM targets WHERE id = ?').run(id);
}

export function updateTarget(
  id: number,
  patch: Partial<Pick<Target, 'cron' | 'email' | 'enabled'>>,
): void {
  const db = getDb();
  const keys = Object.keys(patch) as Array<keyof typeof patch>;
  if (keys.length === 0) return;
  const sets = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => patch[k]);
  db.prepare(`UPDATE targets SET ${sets} WHERE id = ?`).run(...values, id);
}

export function insertScan(scan: Omit<Scan, 'id' | 'scanned_at'>): Scan {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO scans (target_id, status, failed, warned, passed, skipped, pdf_path, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      scan.target_id,
      scan.status,
      scan.failed ?? null,
      scan.warned ?? null,
      scan.passed ?? null,
      scan.skipped ?? null,
      scan.pdf_path ?? null,
      scan.error_message ?? null,
    );
  return db
    .prepare('SELECT * FROM scans WHERE id = ?')
    .get(result.lastInsertRowid as number) as Scan;
}

export function lastScanForTarget(targetId: number): Scan | undefined {
  return getDb()
    .prepare('SELECT * FROM scans WHERE target_id = ? ORDER BY scanned_at DESC LIMIT 1')
    .get(targetId) as Scan | undefined;
}
