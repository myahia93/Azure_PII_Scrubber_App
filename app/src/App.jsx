import React, { useState } from "react";
import "./App.css";

export default function App() {
  const [text, setText] = useState("");
  const [policy, setPolicy] = useState("redact");
  const [language, setLanguage] = useState("auto");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/sanitize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language, policy }),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || "Failed to anonymize text");
      }
      const data = await res.json();
      setResult(data); // { anonymized, spans, entities }
    } catch (err) {
      setError(err?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!result?.anonymized) return;
    const blob = new Blob([result.anonymized], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "anonymized.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderHighlighted = (textValue, spans) => {
    if (!textValue) return null;
    if (!spans || spans.length === 0) return textValue;

    const parts = [];
    let cursor = 0;
    spans.forEach((s, i) => {
      if (s.start > cursor) parts.push(textValue.slice(cursor, s.start));
      parts.push(<mark key={i}>{textValue.slice(s.start, s.end)}</mark>);
      cursor = s.end;
    });
    if (cursor < textValue.length) parts.push(textValue.slice(cursor));
    return parts;
  };

  return (
    <div className="page">
      <header className="header">
        <div className="container">
          <h1 className="brand">PII Scrubber</h1>
          <p className="tagline">Detect • Mask • Share safely</p>
        </div>
      </header>

      <main className="container main">
        {/* Card: form */}
        <section className="card">
          <h2 className="card-title">Anonymize your text</h2>
          <p className="muted">
            Paste any text containing personal info (emails, phones, names…).
            Choose a policy and a language, then click <b>Anonymize</b>.
          </p>

          <form onSubmit={handleSubmit} className="grid gap">
            <label className="field">
              <span className="label">Text to anonymize</span>
              <textarea
                className="input textarea"
                rows={8}
                placeholder="e.g. John Doe lives in Paris and his phone is 0601020304, email john.doe@example.com"
                value={text}
                onChange={(e) => setText(e.target.value)}
                required
              />
            </label>

            <div className="grid two gap">
              <label className="field">
                <span className="label">Policy</span>
                <select
                  className="input select"
                  value={policy}
                  onChange={(e) => setPolicy(e.target.value)}
                >
                  <option value="redact">Redact (*** mask)</option>
                  <option value="pseudo">Pseudonymize ([Category])</option>
                  <option value="hash">Hash (sha256, 10 chars)</option>
                </select>
              </label>

              <label className="field">
                <span className="label">Language</span>
                <select
                  className="input select"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  <option value="auto">Auto detect</option>
                  <option value="en">English</option>
                  <option value="fr">French</option>
                </select>
              </label>
            </div>

            <div className="actions">
              <button
                className="btn primary"
                type="submit"
                disabled={loading || !text.trim()}
              >
                {loading ? "Anonymizing…" : "Anonymize"}
              </button>
              {result?.anonymized && (
                <button
                  type="button"
                  className="btn ghost"
                  onClick={handleDownload}
                >
                  Download
                </button>
              )}
            </div>

            {error && <div className="alert error">Error: {error}</div>}
          </form>
        </section>

        {/* Card: results */}
        {result && (
          <section className="card">
            <h2 className="card-title">Results</h2>
            <div className="grid two gap">
              <div className="panel">
                <h3 className="panel-title">Original</h3>
                <div className="codeblock">{text}</div>
              </div>

              <div className="panel">
                <h3 className="panel-title">Anonymized</h3>
                <div className="codeblock green">
                  {renderHighlighted(result.anonymized, result.spans)}
                </div>
                <div className="chips">
                  {Array.isArray(result.entities) &&
                    result.entities.slice(0, 12).map((e, i) => (
                      <span className="chip" key={i}>
                        {e.category}
                      </span>
                    ))}
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="footer">
        <div className="container">
          <span className="footnote">
            Built with Azure Static Web Apps, Azure Functions & Azure AI
            Language. No data is stored on the server.
          </span>
        </div>
      </footer>
    </div>
  );
}
