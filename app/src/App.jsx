import React, { useState } from 'react';
import './App.css';

function App() {
  const [text, setText] = useState('');
  const [policy, setPolicy] = useState('redact');
  const [language, setLanguage] = useState('auto');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/sanitize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, policy, language }),
      });

      if (!res.ok) throw new Error('Failed to anonymize text');
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err.message);
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

  return (
    <div className="App">
      <h1>PII Scrubber</h1>

      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <label htmlFor="text">Text to Anonymize</label>
          <textarea
            id="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter text containing PII..."
            required
            rows={6}
          />
        </div>

        <div className="controls">
          <div className="select-group">
            <label htmlFor="policy">Policy</label>
            <select
              id="policy"
              value={policy}
              onChange={(e) => setPolicy(e.target.value)}
            >
              <option value="redact">Redact</option>
              <option value="pseudo">Pseudonymize</option>
              <option value="hash">Hash</option>
            </select>
          </div>

          <div className="select-group">
            <label htmlFor="language">Language</label>
            <select
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="auto">Auto Detect</option>
              <option value="en">English</option>
              <option value="fr">French</option>
            </select>
          </div>

          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? 'Processing...' : 'Anonymize'}
          </button>
        </div>
      </form>

      {error && <div className="error">Error: {error}</div>}

      {result && (
        <div className="results">
          <div className="panel">
            <h3>Original Text</h3>
            <div className="text-content">{text}</div>
          </div>

          <div className="panel">
            <h3>
              Anonymized Text
              <button onClick={handleDownload} className="download-btn">
                Download
              </button>
            </h3>
            <div className="text-content anonymized">
              {result.spans?.length > 0 ? (
                result.spans.reduce((acc, span, i) => {
                  acc.push(result.anonymized.slice(span.start > 0 ? acc.length : 0, span.start));
                  acc.push(<mark key={i}>{result.anonymized.slice(span.start, span.end)}</mark>);
                  return acc;
                }, [])
              ) : (
                result.anonymized
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;


