// Azure Functions (SWA-integrated) HTTP endpoint for PII redaction.
// Receives { text, language, policy } and returns { redactedText, entities }.
// - policy: "redact" | "pseudo" | "hash"
// - language: "auto" | "en" | "fr" (when "auto", we omit language to let the service detect)
// Uses Azure AI Language (Text Analytics) PII endpoint via REST.

const fetch = require('node-fetch');
const crypto = require('crypto');

const endpoint = process.env.LANGUAGE_ENDPOINT;
const key = process.env.LANGUAGE_KEY;

// Helper: build documents payload, omitting language if "auto"
function buildDocuments(text, language) {
    const doc = { id: "1", text };
    if (language && language !== "auto") {
        doc.language = language;
    }
    return { documents: [doc] };
}

// Helper: apply chosen masking policy on original text
function applyPolicy(originalText, entities, policy) {
    // Build replacement list from entities
    const replacements = entities.map(e => {
        const start = e.offset;
        const end = e.offset + e.length;
        const snippet = originalText.slice(start, end);

        // Default replacement: redact
        let replacement = "***";
        if (policy === "pseudo") {
            // Use the PII category as a pseudonym label
            replacement = `[${e.category}]`;
        } else if (policy === "hash") {
            // Irreversible short hash (avoid leaking originals)
            replacement = crypto.createHash("sha256")
                .update(snippet)
                .digest("hex")
                .slice(0, 10);
        }

        return { start, end, replacement };
    });

    // Replace from the end to preserve offsets
    let redacted = originalText;
    replacements
        .sort((a, b) => b.start - a.start)
        .forEach(r => {
            redacted = redacted.slice(0, r.start) + r.replacement + redacted.slice(r.end);
        });

    return redacted;
}

module.exports = async function (context, req) {
    try {
        // Basic input validation
        const { text, language = "auto", policy = "redact" } = req.body || {};
        if (!text || typeof text !== "string" || text.trim().length === 0) {
            context.res = { status: 400, body: { error: "Missing or empty 'text'." } };
            return;
        }
        if (!endpoint || !key) {
            context.res = { status: 500, body: { error: "Server is missing AI_LANGUAGE_* config." } };
            return;
        }

        // PII endpoint (stable version)
        const url = `${endpoint}/text/analytics/v3.1/entities/recognition/pii`;
        const payload = buildDocuments(text, language);

        // Call Azure AI Language PII REST API
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
            // Forward useful error context for troubleshooting
            context.log("PII API error:", data);
            context.res = { status: 502, body: { error: "Upstream PII API error", details: data } };
            return;
        }

        const entities = (data && data.documents && data.documents[0] && data.documents[0].entities) || [];

        // Apply masking policy
        const redactedText = applyPolicy(text, entities, policy);

        context.res = {
            status: 200,
            headers: { "Content-Type": "application/json" },
            body: { redactedText, entities }
        };
    } catch (err) {
        // Catch-all safety net
        context.log("Server error:", err);
        context.res = { status: 500, body: { error: "Server error" } };
    }
};
