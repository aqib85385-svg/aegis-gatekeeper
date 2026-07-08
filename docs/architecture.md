# Architecture Specification

Aegis GateKeeper uses a hybrid client/server design:

```
┌──────────────────────────── Browser (React, client) ────────────────────────────────┐
│  Components: App · CameraCapture · DecisionCard · QuickActions · SimulationPanel  │
│  • Off-thread image compression running in a dedicated Web Worker                   │
│  • Speech synthesis client service for auditable gate announcements                  │
└───────────────────────────────────────┬──────────────────────────────────────────────┘
                                        │ fetch POST /api/decision-proxy
                                        ▼
┌───────────────────────── Secure Server API Gateway ─────────────────────────────────┐
│  • Vercel serverless function (`api/decision-proxy.ts`)                              │
│  • Express HTTP Cloud Run listener (`server.js`)                                     │
│  • Validates Base64 structures and routes requests to Gemini 2.5 Flash API          │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

## Layers
1.  **Frontend View (React 19):** Controls step-by-step volunteer inputs, camera viewport overlays, and accessibility announcements.
2.  **Worker Processing Thread:** Runs image grayscaling, crop bounds calculations, and JPEG compression off the main rendering thread.
3.  **Backend Route Gateway:** Secures the Gemini API Key, validates base64 formats, and sanitizes outgoing exceptions.
