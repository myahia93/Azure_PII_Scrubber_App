import React, { useState } from "react";

function App() {
  const [text, setText] = useState("");
  const [policy, setPolicy] = useState("redact");
  const [language, setLanguage] = useState("auto");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  // Handles form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/sanitize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, policy, language }),
      });
      if (!res.ok) throw new Error("Failed to anonymize text.");
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  // Download anonymized text as .txt file
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

  // Highlights replaced PII in anonymized text
  const highlightPII = (anonymized, spans) => {
    if (!spans || spans.length === 0) return anonymized;
    let parts = [];
    let lastIdx = 0;
    spans.forEach((span, i) => {
      parts.push(anonymized.slice(lastIdx, span.start));
      parts.push(
        <mark key={i} style={{ background: "#ffe066" }}>
          {anonymized.slice(span.start, span.end)}
        </mark>
      );
      lastIdx = span.end;
    });
    parts.push(anonymized.slice(lastIdx));
    return parts;
  };

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h2>PII Scrubber</h2>
      <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
        <div>
          <label>
            <b>Text to Anonymize:</b>
            <br />
            <textarea
              rows={6}
              style={{ width: "100%", marginTop: 8 }}
              value={text}
              onChange={e => setText(e.target.value)}
              required
            />
          </label>
        </div>
        <div style={{ margin: "12px 0" }}>
          <label>
            Policy:&nbsp;
            <select value={policy} onChange={e => setPolicy(e.target.value)}>
              <option value="redact">Redact</option>
              <option value="pseudo">Pseudo</option>
              <option value="hash">Hash</option>
            </select>
          </label>
          &nbsp;&nbsp;
          <label>
            Language:&nbsp;
            <select value={language} onChange={e => setLanguage(e.target.value)}>
              <option value="auto">Auto</option>
              <option value="en">English</option>
              <option value="fr">French</option>
            </select>
          </label>
        </div>
        <button type="submit" disabled={loading}>
          {loading ? "Anonymizing..." : "Anonymize"}
        </button>
      </form>

      {error && (
        <div style={{ color: "red", marginBottom: 16 }}>
          <b>Error:</b> {error}
        </div>
      )}

      {result && (
        <div style={{ display: "flex", gap: 24 }}>
          <div style={{ flex: 1 }}>
            <h4>Original Text</h4>
            <div style={{
              border: "1px solid #ccc",
              padding: 12,
              minHeight: 120,
              background: "#fafafa",
              whiteSpace: "pre-wrap"
            }}>
              {text}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <h4>
              Anonymized Text{" "}
              <button onClick={handleDownload} style={{ float: "right" }}>
                Download
              </button>
            </h4>
            <div style={{
              border: "1px solid #ccc",
              padding: 12,
              minHeight: 120,
              background: "#f6fff6",
              whiteSpace: "pre-wrap"
            }}>
              {highlightPII(result.anonymized, result.spans)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;


