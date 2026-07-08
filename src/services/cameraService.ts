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
      await this.attachStream(videoElement, stream);
      return stream;
    } catch (primaryError) {
      console.warn('Environment camera constraints failed, retrying with fallback generic constraints:', primaryError);
      
      const fallbackConstraints: MediaStreamConstraints = {
        video: true,
        audio: false
      };

      try {
        const stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
        await this.attachStream(videoElement, stream);
        return stream;
      } catch (fallbackError) {
        const errorMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        console.error('All camera initialization constraints failed:', errorMessage);
        throw new Error(errorMessage || 'Failed to acquire camera permissions.');
      }
    }
  }

  private async attachStream(videoElement: HTMLVideoElement, stream: MediaStream): Promise<void> {
    videoElement.srcObject = stream;
    videoElement.setAttribute('playsinline', 'true');
    videoElement.setAttribute('autoplay', 'true');
    await videoElement.play();
    this.activeStream = stream;
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
    const videoWidth = videoElement.videoWidth;
    const videoHeight = videoElement.videoHeight;
    
    if (!videoWidth || !videoHeight) {
      return Promise.reject(new Error('Video stream dimensions are not loaded.'));
    }

    const geometry = this.computeCropGeometry(videoWidth, videoHeight);

    return createImageBitmap(videoElement)
      .then(imageBitmap => {
        const worker = this.ensureWorker();
        const payload = {
          imageBitmap,
          ...geometry
        };
        return this.runWorkerJob(worker, payload, [imageBitmap]);
      })
      .catch(err => {
        throw new Error(`createImageBitmap error: ${err.message}`);
      });
  }

  private computeCropGeometry(videoWidth: number, videoHeight: number) {
    const cropSize = Math.floor(Math.min(videoWidth, videoHeight) * 0.70);
    const cropX = Math.floor((videoWidth - cropSize) / 2);
    const cropY = Math.floor((videoHeight - cropSize) / 2);
    return {
      cropX,
      cropY,
      cropWidth: cropSize,
      cropHeight: cropSize,
      targetWidth: 300,
      targetHeight: 300
    };
  }

  private ensureWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(
        new URL('../workers/imageCompressor.worker.ts', import.meta.url),
        { type: 'module' }
      );
    }
    return this.worker;
  }

  private runWorkerJob(worker: Worker, payload: any, transfer: Transferable[]): Promise<Blob> {
    return new Promise((resolve, reject) => {
      let resolvedOrRejected = false;

      const cleanup = () => {
        resolvedOrRejected = true;
        clearTimeout(workerTimeout);
        worker.removeEventListener('message', onMessage);
        worker.removeEventListener('error', onError);
      };

      const onMessage = (event: MessageEvent) => {
        if (resolvedOrRejected) return;
        const { success, blob, error } = event.data;
        cleanup();
        if (success && blob) {
          resolve(blob);
        } else {
          reject(new Error(error || 'Worker compression failed.'));
        }
      };

      const onError = (event: ErrorEvent) => {
        if (resolvedOrRejected) return;
        cleanup();
        reject(new Error(`Worker error: ${event.message}`));
      };

      const workerTimeout = setTimeout(() => {
        if (resolvedOrRejected) return;
        cleanup();
        reject(new Error('Web Worker compression request timed out.'));
      }, 5000); // 5s safety timeout

      worker.addEventListener('message', onMessage);
      worker.addEventListener('error', onError);

      worker.postMessage(payload, transfer);
    });
  }
}

export const cameraService = new CameraService();
export default cameraService;
