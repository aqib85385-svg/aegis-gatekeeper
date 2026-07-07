// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { CameraCapture } from '../../src/components/CameraCapture';
import { cameraService } from '../../src/services/cameraService';

// Mock cameraService
vi.mock('../../src/services/cameraService', () => {
  return {
    cameraService: {
      startCamera: vi.fn(),
      stopCamera: vi.fn(),
      captureAndProcess: vi.fn()
    },
    default: {
      startCamera: vi.fn(),
      stopCamera: vi.fn(),
      captureAndProcess: vi.fn()
    }
  };
});

describe('CameraCapture Component tests', () => {
  let mockSuccess: any;
  let mockReset: any;
  let mockError: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSuccess = vi.fn();
    mockReset = vi.fn();
    mockError = vi.fn();

    // Mock URL methods
    globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/mock-preview');
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it('should render camera placeholder when inactive', () => {
    render(
      <CameraCapture 
        onCaptureSuccess={mockSuccess} 
        onReset={mockReset} 
        onError={mockError} 
      />
    );

    expect(screen.getByText('Camera is currently disabled.')).toBeDefined();
    expect(screen.getByRole('button', { name: /Activate camera stream/i })).toBeDefined();
  });

  it('should successfully start stream when clicking start button', async () => {
    const mockStream = {
      getTracks: () => []
    };
    vi.mocked(cameraService.startCamera).mockResolvedValue(mockStream as any);

    render(
      <CameraCapture 
        onCaptureSuccess={mockSuccess} 
        onReset={mockReset} 
        onError={mockError} 
      />
    );

    const startButton = screen.getByRole('button', { name: /Activate camera stream/i });
    
    await act(async () => {
      fireEvent.click(startButton);
    });

    expect(cameraService.startCamera).toHaveBeenCalled();
    expect(mockReset).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Capture snapshot scan/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Disable camera feed/i })).toBeDefined();
  });

  it('should call onError callback if camera starts fails', async () => {
    vi.mocked(cameraService.startCamera).mockRejectedValue(new Error('Permission denied'));

    render(
      <CameraCapture 
        onCaptureSuccess={mockSuccess} 
        onReset={mockReset} 
        onError={mockError} 
      />
    );

    const startButton = screen.getByRole('button', { name: /Activate camera stream/i });
    
    await act(async () => {
      fireEvent.click(startButton);
    });

    expect(mockError).toHaveBeenCalledWith(expect.any(Error));
    expect(mockError.mock.calls[0][0].message).toContain('Permission denied');
  });

  it('should stop stream when clicking stop button', async () => {
    const mockStream = {
      getTracks: () => []
    };
    vi.mocked(cameraService.startCamera).mockResolvedValue(mockStream as any);

    render(
      <CameraCapture 
        onCaptureSuccess={mockSuccess} 
        onReset={mockReset} 
        onError={mockError} 
      />
    );

    // 1. Start the camera
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Activate camera stream/i }));
    });

    // 2. Stop the camera
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Disable camera feed/i }));
    });

    expect(cameraService.stopCamera).toHaveBeenCalled();
    expect(screen.getByText('Camera is currently disabled.')).toBeDefined();
  });

  it('should capture image and trigger onCaptureSuccess callback', async () => {
    const mockStream = {
      getTracks: () => []
    };
    const mockBlob = new Blob(['image-data'], { type: 'image/jpeg' });
    
    vi.mocked(cameraService.startCamera).mockResolvedValue(mockStream as any);
    vi.mocked(cameraService.captureAndProcess).mockResolvedValue(mockBlob);

    render(
      <CameraCapture 
        onCaptureSuccess={mockSuccess} 
        onReset={mockReset} 
        onError={mockError} 
      />
    );

    // 1. Start camera
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Activate camera stream/i }));
    });

    // 2. Click capture frame button
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Capture snapshot scan/i }));
    });

    expect(cameraService.captureAndProcess).toHaveBeenCalled();
    expect(cameraService.stopCamera).toHaveBeenCalled();
    expect(mockSuccess).toHaveBeenCalledWith(mockBlob, 'blob:http://localhost/mock-preview');
    
    // Grayscale image preview should be displayed
    const previewImage = screen.getByAltText('Grayscale cropped scan preview') as HTMLImageElement;
    expect(previewImage).toBeDefined();
    expect(previewImage.src).toBe('blob:http://localhost/mock-preview');

    // "Scan New Incident" button should be available
    expect(screen.getByRole('button', { name: /Scan a new item/i })).toBeDefined();
  });
});
