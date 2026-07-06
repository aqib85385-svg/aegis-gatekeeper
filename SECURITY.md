# Security Policy

## Supported Versions

Only the current active release in this repository receives security updates.

## Reporting a Vulnerability

If you identify a security issue, please do not open a public GitHub issue. 

Email reports directly to the maintainers. We evaluate reports and respond within 48 hours to coordinate a security patch.

### Security Boundaries
*   **Upstream Key Privacy:** The `GEMINI_API_KEY` is restricted to server environments (Vercel functions & Cloud Run containers) and is never returned to frontend layers.
*   **API Security Headers:** All route endpoints enforce standard CORS origins and apply strict Frame-Options, HSTS, and CSP clickjacking protection headers.
*   **Stack Trace Scrubbing:** Raw backend error stacks are logged to host consoles but are filtered out of API response objects to prevent directory disclosure.
