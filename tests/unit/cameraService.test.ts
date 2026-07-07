import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CameraService } from '../../src/services/cameraService';

describe('CameraService', () => {
  let cameraService: CameraService;
  let mockStream: any;
  let mockTrack: any;
  let mockVideo: any;

  beforeEach(() => {
    cameraService = new CameraService();
    mockTrack = { stop: vi.fn() };
    mockStream = {
      getTracks: vi.fn().mockReturnValue([mockTrack])
    };
    mockVideo = {
      play: vi.fn().mockResolvedValue(undefined),
      setAttribute: vi.fn(),
      srcObject: null,
      videoWidth: 640,
      videoHeight: 480
    };

    // Global mock setup
    if (typeof window === 'undefined') {
      (globalThis as any).window = {
        location: {
          protocol: 'https:',
          hostname: 'localhost'
        }
      } as any;
    } else {
      Object.defineProperty(window, 'location', {
        value: { protocol: 'https:', hostname: 'localhost' },
        writable: true
      });
    }

    Object.defineProperty(globalThis, 'navigator', {
      value: {
        mediaDevices: {
          getUserMedia: vi.fn().mockResolvedValue(mockStream)
        }
      },
      writable: true,
      configurable: true
    });

    (globalThis as any).createImageBitmap = vi.fn().mockResolvedValue({
      close: vi.fn(),
      width: 640,
      height: 480
    });
  });

  it('should successfully start camera in secure contexts', async () => {
    const stream = await cameraService.startCamera(mockVideo as any);
    expect(stream).toBeDefined();
    expect(mockVideo.srcObject).toBe(mockStream);
    expect(mockVideo.play).toHaveBeenCalled();
  });

  it('should throw error in non-secure HTTP contexts', async () => {
    (globalThis as any).window.location.protocol = 'http:';
    (globalThis as any).window.location.hostname = 'example.com';

    await expect(cameraService.startCamera(mockVideo as any)).rejects.toThrow(
      'Camera access is blocked over non-secure HTTP'
    );
  });

  it('should throw error if mediaDevices getUserMedia is not supported', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {},
      writable: true,
      configurable: true
    });
    await expect(cameraService.startCamera(mockVideo as any)).rejects.toThrow(
      'Media Devices API is not supported or blocked in this browser context.'
    );
  });

  it('should try fallback constraints if rear facing facingMode environment getUserMedia throws', async () => {
    const primaryError = new Error('FacingMode failed');
    navigator.mediaDevices.getUserMedia = vi.fn()
      .mockRejectedValueOnce(primaryError)
      .mockResolvedValueOnce(mockStream);

    const stream = await cameraService.startCamera(mockVideo as any);
    expect(stream).toBe(mockStream);
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(2);
  });

  it('should throw original initialization error if both constraints fail', async () => {
    navigator.mediaDevices.getUserMedia = vi.fn()
      .mockRejectedValue(new Error('Hardware error'));

    await expect(cameraService.startCamera(mockVideo as any)).rejects.toThrow(
      'Hardware error'
    );
  });

  it('should stop camera tracks and release stream', async () => {
    await cameraService.startCamera(mockVideo as any);
    cameraService.stopCamera();
    expect(mockTrack.stop).toHaveBeenCalled();
  });

  it('should throw error in captureAndProcess if dimensions are 0', async () => {
    mockVideo.videoWidth = 0;
    mockVideo.videoHeight = 0;

    await expect(cameraService.captureAndProcess(mockVideo as any)).rejects.toThrow(
      'Video stream dimensions are not loaded.'
    );
  });

  it('should capture image and resolve compressed blob via Worker', async () => {
    const mockBlob = new Blob(['compressed-image'], { type: 'image/jpeg' });
    
    // Mock Worker constructor
    const mockWorker = {
      postMessage: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };
    
    (globalThis as any).Worker = vi.fn().mockImplementation(function() {
      return mockWorker;
    });

    // Call captureAndProcess
    const capturePromise = cameraService.captureAndProcess(mockVideo as any);

    // Verify worker setup and trigger mock worker response
    await vi.waitFor(() => expect(mockWorker.addEventListener).toHaveBeenCalled());
    
    const onMessageCallback = mockWorker.addEventListener.mock.calls.find(
      (call: any) => call[0] === 'message'
    )[1];

    onMessageCallback({
      data: {
        success: true,
        blob: mockBlob
      }
    });

    const resultBlob = await capturePromise;
    expect(resultBlob).toBe(mockBlob);
    expect(mockWorker.postMessage).toHaveBeenCalled();
  });

  it('should reject captureAndProcess if Worker returns success false', async () => {
    const mockWorker = {
      postMessage: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };
    (globalThis as any).Worker = vi.fn().mockImplementation(function() {
      return mockWorker;
    });

    const capturePromise = cameraService.captureAndProcess(mockVideo as any);

    await vi.waitFor(() => expect(mockWorker.addEventListener).toHaveBeenCalled());
    const onMessageCallback = mockWorker.addEventListener.mock.calls.find(
      (call: any) => call[0] === 'message'
    )[1];

    onMessageCallback({
      data: {
        success: false,
        error: 'Compression failure'
      }
    });

    await expect(capturePromise).rejects.toThrow('Compression failure');
  });

  it('should reject captureAndProcess if Worker triggers error event', async () => {
    const mockWorker = {
      postMessage: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };
    (globalThis as any).Worker = vi.fn().mockImplementation(function() {
      return mockWorker;
    });

    const capturePromise = cameraService.captureAndProcess(mockVideo as any);

    await vi.waitFor(() => expect(mockWorker.addEventListener).toHaveBeenCalled());
    const onErrorCallback = mockWorker.addEventListener.mock.calls.find(
      (call: any) => call[0] === 'error'
    )[1];

    onErrorCallback({
      message: 'Syntax error in worker script'
    });

    await expect(capturePromise).rejects.toThrow('Worker error: Syntax error in worker script');
  });
});
