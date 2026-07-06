# ADR 003: Server-Side API Proxy Gateway

## Context
Interacting with the Google AI Studio Gemini API requires appending the `GEMINI_API_KEY` credential parameter. Accessing the Gemini endpoint directly from the browser scripts would expose this API key in the public network traffic, violating basic security standards and risking quota theft.

## Decision
We routing all Gemini API queries through a server-side proxy (`api/decision-proxy.ts` and `server.js`). The frontend application posts payloads to the local proxy endpoint, which appends the key, handles timeouts, and proxies the request to Google AI Studio.

## Alternatives Considered
1.  **Direct Browser Access:** Bundle the API key in client-side code and query Gemini directly.
    *   *Rejected:* Exposes secrets to anyone inspecting network traffic or bundles.
2.  **Short-Lived Token Exchange:** Implement an identity-based client credentials token server.
    *   *Rejected:* Unnecessary architectural overhead for a simple proxy boundary.

## Consequences
*   **Positive:** Complete security isolation of the `GEMINI_API_KEY` credential.
*   **Positive:** Allows backend validation checks (base64 checks) and response sanitation before client delivery.
*   **Neutral:** Adds a backend proxy node latency layer (minimal, negligible impact).
