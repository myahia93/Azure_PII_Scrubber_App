import React, { useState } from 'react';
import './App.css';

function App() {
  const [text, setText] = useState('');
  const [policy, setPolicy] = useState('redact');
  const [language, setLanguage] = useState('auto');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null); // expected: { anonymized: string, spans?: [{start:number,end:number}] }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/sanitize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language, policy }),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => '');
        throw new Error(msg || 'Failed to anonymize text');
      }
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err?.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!result?.anonymized) return;
    const blob = new Blob([result.anonymized], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'anonymized.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderHighlighted = (anonymized, spans) => {
    if (!anonymized) return null;
    if (!spans || spans.length === 0) return anonymized;

    const sorted = [...spans].sort((a, b) => a.start - b.start);
    const parts = [];
    let cursor = 0;

    sorted.forEach((s, i) => {
      if (s.start > cursor) {
        parts.push(anonymized.slice(cursor, s.start));
      }
      parts.push(
        <mark key={i}>
          {anonymized.slice(s.start, Math.min(s.end, anonymized.length))}
        </mark>
      );
      cursor = Math.min(s.end, anonymized.length);
    });

    if (cursor < anonymized.length) {
      parts.push(anonymized.slice(cursor));
    }

    return parts;
  };

  return (
    <div className="App">
      <h1>PII Scrubber</h1>

      <form onSubmit={handleSubmit} className="form">
        <label className="label" htmlFor="text">Text to Anonymize</label>
        <textarea
          id="text"
          className="textarea"
          rows={8}
          placeholder="Paste or type text that may contain PII..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
        />

        <div className="controls">
          <div className="control">
            <label className="label" htmlFor="policy">Policy</label>
            <select
              id="policy"
              className="select"
              value={policy}
              onChange={(e) => setPolicy(e.target.value)}
            >
              <option value="redact">redact</option>
              <option value="pseudo">pseudo</option>
              <option value="hash">hash</option>
            </select>
          </div>

          <div className="control">
            <label className="label" htmlFor="language">Language</label>
            <select
              id="language"
              className="select"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="auto">auto</option>
              <option value="en">en</option>
              <option value="fr">fr</option>
            </select>
          </div>

          <button className="button" type="submit" disabled={loading || !text.trim()}>
            {loading ? 'Anonymizing...' : 'Anonymize'}
          </button>
        </div>
      </form>

      {error && <div className="error">Error: {error}</div>}

      {result && (
        <div className="results">
          <div className="panel">
            <h3>Original</h3>
            <div className="content original">{text}</div>
          </div>

          <div className="panel">
            <h3 className="panel-title">
              Anonymized
              <button className="download" onClick={handleDownload}>Download</button>
            </h3>
            <div className="content anonymized">
              {renderHighlighted(result.anonymized, result.spans)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;


