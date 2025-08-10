// Azure Functions HTTP endpoint for PII redaction (Analyze Text preview).
// Receives { text, language, policy } and returns { anonymized, spans, entities }.
// - policy: "redact" | "pseudo" | "hash"
// - language: "auto" | "en" | "fr"
// Calls Azure AI Language Analyze Text (PiiEntityRecognition).
//
// Env vars (set in SWA Configuration or local.settings.json for local dev):
// - LANGUAGE_ENDPOINT = https://<your-resource>.cognitiveservices.azure.com
// - LANGUAGE_KEY      = <key>

const fetch = require('node-fetch');
const crypto = require('crypto');

const endpoint = process.env.LANGUAGE_ENDPOINT;
const key = process.env.LANGUAGE_KEY;

function assertConfig(context) {
    if (!endpoint || !key) {
        context.res = { status: 500, body: { error: "Missing AI Language config (LANGUAGE_ENDPOINT / LANGUAGE_KEY)." } };
        return false;
    }
    return true;
}

// Build Analyze Text payload; omit language when set to "auto"
function buildAnalyzePayload(text, language) {
    const doc = { id: "1", text };
    if (language && language !== "auto") doc.language = language;

    return {
        kind: "PiiEntityRecognition",
        analysisInput: { documents: [doc] },
        // We keep masking client-side so we can support "hash" and "pseudo".
        // If you ever want the service to redact directly, you can pass:
        // parameters: { redactionReplaceWith: "***" }
        parameters: {}
    };
}

// Apply masking and return anonymized text + spans aligned to anonymized text
function applyPolicyWithSpans(originalText, entities, policy) {
    let anonymized = "";
    let cursor = 0;
    const spans = [];

    // Entities should include { offset, length, category, text, ... }
    const sorted = [...entities].sort((a, b) => a.offset - b.offset);

    for (const e of sorted) {
        const start = e.offset;
        const end = e.offset + e.length;

        // Append unchanged chunk
        anonymized += originalText.slice(cursor, start);

        const snippet = originalText.slice(start, end);
        let replacement = "***";
        if (policy === "pseudo") {
            replacement = `[${e.category}]`;
        } else if (policy === "hash") {
            replacement = crypto.createHash("sha256").update(snippet).digest("hex").slice(0, 10);
        }

        const spanStart = anonymized.length;
        anonymized += replacement;
        const spanEnd = anonymized.length;
        spans.push({ start: spanStart, end: spanEnd });

        cursor = end;
    }

    // Tail
    anonymized += originalText.slice(cursor);
    return { anonymized, spans };
}

module.exports = async function (context, req) {
    try {
        const { text, language = "auto", policy = "redact" } = req.body || {};

        // Basic validation
        if (!text || typeof text !== "string" || text.trim().length === 0) {
            context.res = { status: 400, body: { error: "Missing or empty 'text'." } };
            return;
        }
        if (!assertConfig(context)) return;

        // Analyze Text (preview)
        const url = `${endpoint.replace(/\/+$/, '')}/language/:analyze-text?api-version=2025-05-15-preview`;
        const payload = buildAnalyzePayload(text, language);

        const resp = await fetch(url, {
            method: "POST",
            headers: {
                "Ocp-Apim-Subscription-Key": key,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const data = await resp.json();

        if (!resp.ok) {
            context.log("Analyze Text API error:", data);
            context.res = { status: 502, body: { error: "Upstream API error", details: data } };
            return;
        }

        // New response shape (preview):
        // data.results.documents[0].entities -> [{ text, category, offset, length, confidenceScore }, ...]
        const entities =
            data?.results?.documents?.[0]?.entities
                ?.map(e => ({
                    text: e.text,
                    category: e.category,
                    offset: e.offset,
                    length: e.length,
                    confidenceScore: e.confidenceScore
                })) || [];

        const { anonymized, spans } = applyPolicyWithSpans(text, entities, policy);

        context.res = {
            status: 200,
            headers: { "Content-Type": "application/json" },
            body: { anonymized, spans, entities }
        };
    } catch (err) {
        context.log("Server error:", err);
        context.res = { status: 500, body: { error: "Server error" } };
    }
};
