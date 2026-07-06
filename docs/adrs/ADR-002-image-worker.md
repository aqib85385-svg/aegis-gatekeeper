# ADR 002: Off-Thread Image Compression

## Context
The application captures snapshots from high-resolution video feeds, performs cropping, scales the image to 300x300 pixels, converts it to grayscale, and compresses it to a lightweight JPEG format. Executing these intensive Canvas operations on the browser's main thread blocks layout rendering, causing UI freezes and degrading the volunteer check-in experience.

## Decision
We delegate all image cropping, grayscaling, and JPEG compression operations to a dedicated Web Worker (`src/workers/imageCompressor.worker.ts`). The worker communicates asynchronously via messages, processing image data off the main thread.

## Alternatives Considered
1.  **Main-Thread Processing:** Run canvas drawing and calculations directly in the component stream handler.
    *   *Rejected:* Causes visible frame drops and thread blocking during scan snapshots.
2.  **Server-Side Compression:** Upload raw high-resolution images and compress them on the server.
    *   *Rejected:* Increases upload size (MBs instead of KBs), leading to slow uploads on cellular networks.

## Consequences
*   **Positive:** Main rendering thread remains completely responsive.
*   **Positive:** Drastically reduces API payload sizes (<100KB), speeding up network uploads.
*   **Neutral:** Requires Web Worker compatibility in target browsers (standard in modern browsers).
