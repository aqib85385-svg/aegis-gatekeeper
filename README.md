# Aegis GateKeeper: GenAI Stadium Gate Decision Assistant

Aegis GateKeeper is a secure, privacy-first, and highly accessible real-time operational decision engine designed for tournament volunteers at stadium entry turnstiles during the FIFA World Cup 2026.

**Live demo:** [https://aegis-gatekeeper-59191111914.us-central1.run.app/](https://aegis-gatekeeper-59191111914.us-central1.run.app/)

---

## 1. What problem does this solve?

Stadium gates during major global tournaments like the FIFA World Cup are high-pressure, high-throughput bottlenecks. Temporary event volunteers face several key challenges:
*   **Ticketing Edge Cases:** Resolving gate allocation errors, invalid entry screens, and ticket transfer issues.
*   **Safety Regulations:** Spotting prohibited items (oversized bags, metal containers, professional camera lenses) while executing childcare and medical policy exceptions.
*   **Language Barriers:** Communicating gate instructions and safety protocols to fans from dozens of countries under high noise conditions.

Aegis GateKeeper provides volunteers with a single-screen mobile assistant. By pointing their camera at a ticket, bag, or dynamic issue, the app generates immediate, actionable entry decisions right at the turnstile, keeping lines moving safely.

---

## 2. Why is GenAI required?

Standard rule-based check-in systems fail when encountering unstructured physical or situational edge cases. Generative AI is necessary to:
*   **Multi-Factor Policy Reasoning:** The model does not just extract text or detect objects. It reasons through complex, overlapping guidelines. For example, it can determine if a dynamic gate override applies based on queue telemetry, or if an oversized bag qualifies for a childcare exemption while enforcing a rule to empty a flask inside that same bag.
*   **Dynamic Context Mapping:** The system synthesizes raw visual data (camera snapshots), volunteer text, and real-time gate telemetry (queue times and time-to-kickoff) to make localized, contextual recommendations.
*   **Real-time Dialect Translation:** The AI translates instructions into the fan's native language while generating pre-drafted radio scripts and policy explanations in English for the volunteer.

---

## 3. How does the solution work?

```
[ Volunteer Input + Camera ]
             │
             ▼
    +──────────────────+
    │  Local Policy    │ ── (Safety Keyword Bypass) ──> [ Emergency Manual Redirect ]
    │  Bypass Engine   │
    +──────────────────+
             │ (Normal Flow)
             ▼
    +──────────────────+
    │  Web Worker      │ ── (Center Crop + Grayscale + JPEG Compression <100KB)
    │  Image Pipeline  │
    +──────────────────+
             │ (Privacy Payload)
             ▼
    +──────────────────+
    │  Secure Vercel   │ ── (Hides Credentials, calls Gemini 2.5 Flash API)
    │  API Proxy       │
    +──────────────────+
             │ (JSON Response)
             ▼
    +──────────────────+
    │  Zod Validator   │ ── (Strict schema contract parsing)
    │  & Action UI     │
    +──────────────────+
             │
             ▼
    [ Visual Directive Card & Web Speech Playback ]
```

1.  **Ingestion:** The volunteer captures a frame using the camera or selects a scenario preset, then enters observations.
2.  **Deterministic local check:** A local policy engine scans input for security terms (like "gun", "knife", "medical") to bypass the AI and trigger immediate alerts.
3.  **Privacy-first processing:** Images are cropped to the scan box, grayscaled, and compressed to under 100 KB in a browser Web Worker before upload.
4.  **Secure routing:** The client sends the payload to `/api/decision-proxy`, a serverless function that handles API key injection.
5.  **LLM Reasoning:** Gemini 2.5 Flash processes the rules and returns a structured JSON payload.
6.  **Schema Check & Render:** The app runs a Zod parser schema validation. It updates the UI with an action-first directive card (`ALLOW`, `REVIEW`, or `DENY`) and plays the translated Spanish instructions using the Web Speech API.

### Deterministic Decision Engine Architecture
To ensure high-safety margins and prevent generative AI hallucinations on critical rules, Aegis GateKeeper decouples rule reasoning from narrative phrasing:
*   **Decoupled Rule Reasoning:** The decision status (`ALLOW` | `REVIEW` | `DENY`) and the required volunteer action are computed by a pure, deterministic function (`evaluateBaggage` in [decisionEngine.ts](src/services/decisionEngine.ts)), not by the LLM.
*   **Constrained LLM Role:** The LLM's role is strictly constrained to generating the natural-language explanation and translation framing on top of the already-determined outcome.
*   **Code-Enforced Overrides:** When a deterministic rule matches (e.g., diaper bag flask detection, ticket screenshots, or gate queue surge redirects), its status and action code override the LLM's returned values.
*   **Direct Unit Testing:** This boundary is unit-tested directly: [decisionEngine.test.ts](tests/unit/decisionEngine.test.ts) covers every rule branch synchronously with no mock dependencies, and [aiService.test.ts](tests/unit/aiService.test.ts) asserts override and pass-through behavior with a mocked LLM response.

---

## 4. How do I run the project?

### Prerequisites
*   Node.js (v18 or higher)
*   A Gemini API Key (set in your environment variables as `GEMINI_API_KEY`)

### Installation & Local Run
1.  Clone the repository and navigate to the project directory:
    ```bash
    cd project4
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Run the development server locally:
    ```bash
    npm run dev
    ```
4.  Open the server URL shown in your terminal (typically `http://localhost:5173`).

---

## 5. How do I deploy it?

### Option A: Vercel (Frontend & Serverless Functions)
1. Install the Vercel CLI globally: `npm install -g vercel`
2. Authenticate and run deployment in the root folder: `vercel`
3. Configure `GEMINI_API_KEY` in your project settings on the Vercel Dashboard.

### Option B: Google Cloud Run (Containerized Web Server)
Aegis GateKeeper is fully containerized via `Dockerfile` and `server.js`:
1. Build and deploy container using the Google Cloud SDK:
   ```bash
   gcloud run deploy aegis-gatekeeper --source . --region us-central1 --allow-unauthenticated
   ```
2. Configure the `GEMINI_API_KEY` environment variable in the Cloud Run service settings or run:
   ```bash
   gcloud run services update aegis-gatekeeper --set-env-vars GEMINI_API_KEY="YOUR_KEY" --region us-central1
   ```

---

## 6. How do I test it?

The project includes unit, integration, and E2E testing.

### Run Unit and Integration Tests
To execute the Vitest test suite checking the local engine, Zod parsing logic, and serverless proxy handlers:
```bash
npm run test
```

### Run End-to-End Tests
To execute Playwright E2E scenario testing:
```bash
npx playwright test
```

### Measured Coverage & Performance Metrics
*   **Vitest Test Coverage (v8):**
    *   Statements: 86.8%
    *   Branches: 80.73%
    *   Functions: 84.44%
    *   Lines: 89.5%
*   **Lighthouse Performance Audit (Live Cloud Run URL):**
    *   Performance: 97/100
    *   Accessibility: 100/100
    *   Best Practices: 100/100

---

## 7. How is user data protected?

*   **Client-Side Redaction & Cropping:** The camera pipeline crops the target scan region and strips out surrounding background information (faces, other fans) before the image is transmitted.
*   **In-Memory Processing:** Images are held in temporary canvas buffers and cleared from browser memory immediately after upload.
*   **Stateless API Proxy:** The Vercel serverless function does not store payloads, write logs, or persist image files.
*   **Zero PII Collection:** The system evaluates ticket structures, items, and logistics parameters without ingesting or storing names, ticket numbers, or personal details.
