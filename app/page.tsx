'use client';
import { useState, type FormEvent } from 'react';

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function run(e: FormEvent) {
    e.preventDefault();
    setError('');
    setDone(false);
    setLoading(true);
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      // Trigger PDF download from the response blob.
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const host = new URL(url).hostname.replace(/^www\./, '');
      a.download = `launchcheck-${host}.pdf`;
      a.click();
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: '3rem auto', fontFamily: 'system-ui', padding: '0 1rem' }}>
      <h1 style={{ marginBottom: 4 }}>launchcheck</h1>
      <p style={{ color: '#555', marginTop: 0 }}>
        Enter a URL to run a full pre-launch QA scan (security · SEO · performance · accessibility).
        A PDF report will download automatically when the scan completes.
      </p>
      <form onSubmit={run} style={{ display: 'flex', gap: 8, margin: '1.5rem 0' }}>
        <input
          type="url"
          required
          placeholder="https://example.com/"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          style={{ flex: 1, padding: 8, fontSize: 15, border: '1px solid #ccc', borderRadius: 4 }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '8px 18px',
            fontSize: 15,
            background: loading ? '#888' : '#0070f3',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: loading ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {loading ? 'Scanning…' : 'Scan'}
        </button>
      </form>
      {loading && (
        <p style={{ color: '#555', fontStyle: 'italic' }}>
          Running 59 checks (Lighthouse + axe + security + SEO…) then rendering PDF.
          This takes 45–90 s.
        </p>
      )}
      {done && (
        <p style={{ color: '#27ae60', fontWeight: 600 }}>
          Report downloaded — check your Downloads folder.
        </p>
      )}
      {error && <p style={{ color: '#c0392b', fontWeight: 600 }}>Error: {error}</p>}
    </main>
  );
}
