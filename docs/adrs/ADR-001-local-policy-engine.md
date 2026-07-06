# ADR 001: Local Policy Engine Bypass

## Context
High-volume entry turnstiles at sports stadiums (e.g. FIFA World Cup gates) require extremely low-latency processing during security threats (e.g. weapon match) or critical medical incidents. Sending every incident description to a remote Large Language Model (Gemini 1.5 Flash) introduces network latency, processing queue overhead, and dependency on internet uptime.

## Decision
We implement a local keyword policy matching engine in `src/services/policyEngine.ts`. This engine runs synchronously on the client side, matching incoming descriptions against predefined emergency and safety keyword configurations prior to making remote API calls.

## Alternatives Considered
1.  **All-AI Routing:** Execute remote API calls for every single request. 
    *   *Rejected:* High latency (~1-2 seconds) during emergency incidents is operationally unacceptable.
2.  **Server-Side Keyword Filters:** Place the keyword engine on the node backend.
    *   *Rejected:* Still requires a network round-trip to the backend proxy, which can fail if the device loses connection.

## Consequences
*   **Positive:** Near-zero latency response (instantaneous alert) during security/medical emergencies.
*   **Positive:** Local fallback functionality works even if the gate terminal loses internet connectivity.
*   **Neutral:** The list of safety keywords is hardcoded client-side, requiring client redeployments to update.
