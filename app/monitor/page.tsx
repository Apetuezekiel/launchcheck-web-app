'use client';
import { useState, useEffect, type FormEvent } from 'react';

interface LastScan {
  status: 'ok' | 'error';
  failed: number | null;
  warned: number | null;
  passed: number | null;
  skipped: number | null;
  scanned_at: number;
  error_message: string | null;
}

interface Target {
  id: number;
  url: string;
  cron: string;
  email: string | null;
  enabled: number;
  lastScan: LastScan | null;
}

const INPUT: React.CSSProperties = {
  padding: '6px 8px',
  fontSize: 14,
  border: '1px solid #ccc',
  borderRadius: 4,
};

const BTN = (bg: string, disabled: boolean): React.CSSProperties => ({
  padding: '6px 14px',
  fontSize: 14,
  background: disabled ? '#999' : bg,
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  cursor: disabled ? 'not-allowed' : 'pointer',
  whiteSpace: 'nowrap' as const,
});

export default function MonitorPage() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [loadErr, setLoadErr] = useState('');
  const [url, setUrl] = useState('');
  const [cronExpr, setCronExpr] = useState('0 9 * * 1');
  const [email, setEmail] = useState('');
  const [addErr, setAddErr] = useState('');
  const [adding, setAdding] = useState(false);
  const [scanning, setScanning] = useState<Record<number, boolean>>({});
  const [scanErr, setScanErr] = useState<Record<number, string>>({});

  async function load() {
    try {
      const res = await fetch('/api/monitor/targets');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setTargets(await res.json());
      setLoadErr('');
    } catch (err) {
      setLoadErr((err as Error).message);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function addTarget(e: FormEvent) {
    e.preventDefault();
    setAddErr('');
    setAdding(true);
    try {
      const res = await fetch('/api/monitor/targets', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url, cron: cronExpr, email: email || null }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setUrl('');
      setCronExpr('0 9 * * 1');
      setEmail('');
      await load();
    } catch (err) {
      setAddErr((err as Error).message);
    } finally {
      setAdding(false);
    }
  }

  async function removeTarget(id: number) {
    await fetch(`/api/monitor/targets/${id}`, { method: 'DELETE' });
    await load();
  }

  async function toggleEnabled(target: Target) {
    await fetch(`/api/monitor/targets/${target.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: target.enabled ? 0 : 1 }),
    });
    await load();
  }

  async function scanNow(id: number) {
    setScanErr((prev) => ({ ...prev, [id]: '' }));
    setScanning((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetch('/api/monitor/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ targetId: id }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      await load();
    } catch (err) {
      setScanErr((prev) => ({ ...prev, [id]: (err as Error).message }));
    } finally {
      setScanning((prev) => ({ ...prev, [id]: false }));
    }
  }

  function formatScan(s: LastScan | null): string {
    if (!s) return '—';
    const date = new Date(s.scanned_at * 1000).toLocaleString();
    if (s.status === 'error') return `error @ ${date}: ${s.error_message ?? 'unknown'}`;
    return `${s.failed ?? 0}f ${s.warned ?? 0}w ${s.passed ?? 0}p ${s.skipped ?? 0}s @ ${date}`;
  }

  return (
    <main style={{ maxWidth: 1100, margin: '2rem auto', fontFamily: 'system-ui', padding: '0 1rem' }}>
      <h1 style={{ marginBottom: 4 }}>launchcheck — monitor</h1>
      <p style={{ color: '#555', marginTop: 0 }}>
        Schedule recurring scans and receive PDF reports by email.
      </p>

      <form
        onSubmit={addTarget}
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '1.5rem 0 1rem' }}
      >
        <input
          type="url"
          required
          placeholder="https://example.com/"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          style={{ ...INPUT, flex: '2 1 200px' }}
        />
        <input
          type="text"
          required
          placeholder="cron (e.g. 0 9 * * 1)"
          value={cronExpr}
          onChange={(e) => setCronExpr(e.target.value)}
          style={{ ...INPUT, flex: '1 1 150px' }}
        />
        <input
          type="email"
          placeholder="email (optional)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ ...INPUT, flex: '1 1 180px' }}
        />
        <button type="submit" disabled={adding} style={BTN('#0070f3', adding)}>
          {adding ? 'Adding…' : 'Add target'}
        </button>
      </form>
      {addErr && <p style={{ color: '#c0392b', margin: '0 0 1rem' }}>Error: {addErr}</p>}

      {loadErr && <p style={{ color: '#c0392b' }}>Failed to load: {loadErr}</p>}

      {targets.length === 0 && !loadErr ? (
        <p style={{ color: '#777' }}>No targets yet. Add one above.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
              {['URL', 'Cron', 'Email', 'Enabled', 'Last scan', 'Actions'].map((h) => (
                <th key={h} style={{ padding: '8px 10px', border: '1px solid #ddd' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {targets.map((t) => (
              <tr key={t.id} style={{ verticalAlign: 'top' }}>
                <td style={{ padding: '8px 10px', border: '1px solid #ddd', wordBreak: 'break-all' }}>
                  {t.url}
                </td>
                <td style={{ padding: '8px 10px', border: '1px solid #ddd', whiteSpace: 'nowrap' }}>
                  {t.cron}
                </td>
                <td style={{ padding: '8px 10px', border: '1px solid #ddd' }}>
                  {t.email ?? '—'}
                </td>
                <td style={{ padding: '8px 10px', border: '1px solid #ddd', textAlign: 'center' }}>
                  <button
                    onClick={() => toggleEnabled(t)}
                    style={{
                      ...BTN(t.enabled ? '#27ae60' : '#999', false),
                      padding: '3px 10px',
                      fontSize: 12,
                    }}
                  >
                    {t.enabled ? 'On' : 'Off'}
                  </button>
                </td>
                <td
                  style={{
                    padding: '8px 10px',
                    border: '1px solid #ddd',
                    color: t.lastScan?.status === 'error' ? '#c0392b' : 'inherit',
                  }}
                >
                  {formatScan(t.lastScan)}
                </td>
                <td style={{ padding: '8px 10px', border: '1px solid #ddd', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => scanNow(t.id)}
                      disabled={!!scanning[t.id]}
                      style={BTN('#0070f3', !!scanning[t.id])}
                    >
                      {scanning[t.id] ? 'Scanning…' : 'Scan now'}
                    </button>
                    <button
                      onClick={() => removeTarget(t.id)}
                      style={BTN('#c0392b', false)}
                    >
                      Remove
                    </button>
                  </div>
                  {scanErr[t.id] && (
                    <p style={{ color: '#c0392b', margin: '4px 0 0', fontSize: 12 }}>
                      {scanErr[t.id]}
                    </p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
