'use client';
import { useState, type FormEvent } from 'react';

export default function Home() {
  const [url, setUrl] = useState('');
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState('');
  const [pdfError, setPdfError] = useState('');

  async function run(e: FormEvent) {
    e.preventDefault();
    setError('');
    setPdfError('');
    setHtml('');
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
      setHtml(await res.text());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function downloadPdf() {
    setPdfError('');
    setPdfLoading(true);
    try {
      const host = new URL(url).hostname.replace(/^www\./, '');
      const filename = `launchcheck-${host}.pdf`;
      const res = await fetch('/api/pdf', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ html, filename }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
    } catch (err) {
      setPdfError((err as Error).message);
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 960, margin: '2rem auto', fontFamily: 'system-ui', padding: '0 1rem' }}>
      <h1 style={{ marginBottom: 4 }}>launchcheck</h1>
      <p style={{ color: '#555', marginTop: 0 }}>
        Enter a URL to run a full pre-launch QA scan (security · SEO · performance · accessibility).
        Scans take 30–60 s — Lighthouse runs headless Chrome.
      </p>
      <form onSubmit={run} style={{ display: 'flex', gap: 8, margin: '1rem 0' }}>
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
          Running 59 checks including Lighthouse and axe. This takes 30–60 s…
        </p>
      )}
      {error && <p style={{ color: '#c0392b', fontWeight: 600 }}>Error: {error}</p>}
      {html && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <button
              onClick={downloadPdf}
              disabled={pdfLoading}
              style={{
                padding: '6px 16px',
                fontSize: 14,
                background: pdfLoading ? '#888' : '#27ae60',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: pdfLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {pdfLoading ? 'Generating PDF…' : 'Download PDF'}
            </button>
            {pdfError && (
              <span style={{ color: '#c0392b', fontSize: 13 }}>PDF error: {pdfError}</span>
            )}
          </div>
          <iframe
            title="launchcheck report"
            srcDoc={html}
            sandbox=""
            style={{ width: '100%', height: '80vh', border: '1px solid #ddd', borderRadius: 6 }}
          />
        </>
      )}
    </main>
  );
}
