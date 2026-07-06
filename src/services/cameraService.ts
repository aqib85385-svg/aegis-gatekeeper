/**
 * Service to manage camera access, video streaming, and snapshot frame capturing.
 */

export class CameraService {
  private activeStream: MediaStream | null = null;
  private worker: Worker | null = null;

  public async startCamera(videoElement: HTMLVideoElement): Promise<MediaStream> {
    this.stopCamera(); // Make sure any existing stream is cleaned up

    // 1. Verify HTTPS / Secure Context requirements
    if (typeof window !== 'undefined' && window.location) {
      const isSecure = window.location.protocol === 'https:' || 
                       window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1';
      if (!isSecure) {
        throw new Error('Camera access is blocked over non-secure HTTP. Please deploy over HTTPS or use localhost.');
      }
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Media Devices API is not supported or blocked in this browser context.');
    }

    // Request back camera on mobile if available, otherwise default to front/default
    const primaryConstraints: MediaStreamConstraints = {
      video: {
        facingMode: 'environment', // Rear-facing camera for scanning tickets/bags
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false // No audio needed for visual scan
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(primaryConstraints);
      videoElement.srcObject = stream;
      
      // Force play for iOS devices
      videoElement.setAttribute('playsinline', 'true');
      videoElement.setAttribute('autoplay', 'true');
      await videoElement.play();
      
      this.activeStream = stream;
      return stream;
    } catch (primaryError) {
      console.warn('Environment camera constraints failed, retrying with fallback generic constraints:', primaryError);
      
      const fallbackConstraints: MediaStreamConstraints = {
        video: true,
        audio: false
      };

      try {
        const stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
        videoElement.srcObject = stream;
        
        videoElement.setAttribute('playsinline', 'true');
        videoElement.setAttribute('autoplay', 'true');
        await videoElement.play();
        
        this.activeStream = stream;
        return stream;
      } catch (fallbackError) {
        const errorMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        console.error('All camera initialization constraints failed:', errorMessage);
        throw new Error(errorMessage || 'Failed to acquire camera permissions.');
      }
    }
  }

  /**
   * Stops the camera stream and releases media devices.
   */
  public stopCamera(): void {
    if (this.activeStream) {
      this.activeStream.getTracks().forEach(track => track.stop());
      this.activeStream = null;
    }
  }

  /**
   * Captures a single frame from the video element and processes it in a Web Worker.
   * Processes: Crop to center square -> Resize -> Grayscale -> Compress.
   */
  public captureAndProcess(videoElement: HTMLVideoElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
      try {
        const videoWidth = videoElement.videoWidth;
        const videoHeight = videoElement.videoHeight;
        
        if (!videoWidth || !videoHeight) {
          throw new Error('Video stream dimensions are not loaded.');
        }

        // 1. Calculate cropping area (crop to a center square, 70% of shortest dimension)
        const cropSize = Math.floor(Math.min(videoWidth, videoHeight) * 0.70);
        const cropX = Math.floor((videoWidth - cropSize) / 2);
        const cropY = Math.floor((videoHeight - cropSize) / 2);
        
        // Target dimensions for upload resizing
        const targetWidth = 300;
        const targetHeight = 300;

        // 2. Capture dynamic bitmap from video stream
        createImageBitmap(videoElement).then(imageBitmap => {
          // 3. Lazy-initialize Web Worker
          if (!this.worker) {
            this.worker = new Worker(
              new URL('../workers/imageCompressor.worker.ts', import.meta.url),
              { type: 'module' }
            );
          }

          // 4. Set up message handler for worker output
          const onMessage = (event: MessageEvent) => {
            // Clean up the handler to prevent memory leaks/multiple triggers
            this.worker?.removeEventListener('message', onMessage);
            this.worker?.removeEventListener('error', onError);

            const { success, blob, error } = event.data;
            if (success && blob) {
              resolve(blob);
            } else {
              reject(new Error(error || 'Worker compression failed.'));
            }
          };

          const onError = (event: ErrorEvent) => {
            this.worker?.removeEventListener('message', onMessage);
            this.worker?.removeEventListener('error', onError);
            reject(new Error(`Worker error: ${event.message}`));
          };

          this.worker.addEventListener('message', onMessage);
          this.worker.addEventListener('error', onError);

          // 5. Post to worker (bitmap is transferred, freeing memory on the main thread)
          this.worker.postMessage(
            {
              imageBitmap,
              cropX,
              cropY,
              cropWidth: cropSize,
              cropHeight: cropSize,
              targetWidth,
              targetHeight
            },
            [imageBitmap] // Transferables list
          );
        }).catch(err => reject(new Error(`createImageBitmap error: ${err.message}`)));
      } catch (error) {
        reject(error);
      }
    });
  }
}

export const cameraService = new CameraService();
export default cameraService;
