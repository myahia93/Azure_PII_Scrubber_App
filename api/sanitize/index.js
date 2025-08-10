// Azure Functions HTTP endpoint for PII redaction.
// Receives { text, language, policy } and returns { anonymized, spans, entities }.
// - policy: "redact" | "pseudo" | "hash"
// - language: "auto" | "en" | "fr"
// Uses Azure AI Language (Text Analytics) PII endpoint via REST.

const fetch = require('node-fetch');
const crypto = require('crypto');

const endpoint = process.env.LANGUAGE_ENDPOINT;
const key = process.env.LANGUAGE_KEY;

function buildDocuments(text, language) {
    const doc = { id: "1", text };
    if (language && language !== "auto") {
        doc.language = language;
    }
    return { documents: [doc] };
}

// Applies masking policy and returns anonymized text + spans
function applyPolicyWithSpans(originalText, entities, policy) {
    let anonymized = "";
    let cursor = 0;
    const spans = [];

    entities
        .sort((a, b) => a.offset - b.offset)
        .forEach(e => {
            const start = e.offset;
            const end = e.offset + e.length;

            // Append unchanged text before entity
            anonymized += originalText.slice(cursor, start);

            const snippet = originalText.slice(start, end);
            let replacement = "***";

            if (policy === "pseudo") {
                replacement = `[${e.category}]`;
            } else if (policy === "hash") {
                replacement = crypto.createHash("sha256")
                    .update(snippet)
                    .digest("hex")
                    .slice(0, 10);
            }

            // Track where the replacement lands in the anonymized text
            const spanStart = anonymized.length;
            anonymized += replacement;
            const spanEnd = anonymized.length;

            spans.push({ start: spanStart, end: spanEnd });
            cursor = end;
        });

    // Append remaining text
    anonymized += originalText.slice(cursor);
    return { anonymized, spans };
}

module.exports = async function (context, req) {
    try {
        const { text, language = "auto", policy = "redact" } = req.body || {};
        if (!text || typeof text !== "string" || text.trim().length === 0) {
            context.res = { status: 400, body: { error: "Missing or empty 'text'." } };
            return;
        }
        if (!endpoint || !key) {
            context.res = { status: 500, body: { error: "Missing AI Language config." } };
            return;
        }

        const url = `${endpoint}/text/analytics/v3.1/entities/recognition/pii`;
        const payload = buildDocuments(text, language);

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
            context.log("PII API error:", data);
            context.res = { status: 502, body: { error: "Upstream PII API error", details: data } };
            return;
        }

        const entities = (data?.documents?.[0]?.entities) || [];
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
