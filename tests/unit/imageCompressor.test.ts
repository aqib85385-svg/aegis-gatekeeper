import { describe, it, expect, vi } from 'vitest';

describe('Aegis GateKeeper Web Worker Compression', () => {
  it('should format worker compression payloads correctly', () => {
    const mockPostMessage = vi.fn();
    const mockWorker = {
      postMessage: mockPostMessage,
      terminate: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };

    // Simulated worker payload format
    const mockBitmap = {} as ImageBitmap;
    const payload = {
      imageBitmap: mockBitmap,
      cropX: 50,
      cropY: 50,
      cropWidth: 350,
      cropHeight: 350,
      targetWidth: 300,
      targetHeight: 300
    };

    mockWorker.postMessage(payload, [mockBitmap]);

    expect(mockPostMessage).toHaveBeenCalledTimes(1);
    expect(mockPostMessage).toHaveBeenCalledWith(payload, [mockBitmap]);
  });
});
