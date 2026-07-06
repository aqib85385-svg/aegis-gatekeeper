# Security Controls

Aegis GateKeeper enforces these security controls:

*   **API Key Isolation:** Upstream keys are bound to environment variables on hosting containers, preventing exposure in client-side script bundles.
*   **Base64 Sanitization:** Incoming image data is validated using regex filters (`/^[A-Za-z0-9+/=]+$/`) on API routes to block malformed inputs.
*   **No Exception Leakage:** Catch blocks route backend failures through `api/errorHelper.js` to log stacks internally while returning sanitized error messages to the client.
*   **HTTP Protection Headers:** API endpoints apply HSTS, strict origin CORS rules, and frame-ancestors restrictions to mitigate CSRF and clickjacking.
