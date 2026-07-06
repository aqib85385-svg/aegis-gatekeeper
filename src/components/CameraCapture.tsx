import React, { useRef, useState, useEffect } from 'react';
import { Camera, CameraOff, RefreshCw, Eye } from 'lucide-react';
import { cameraService } from '../services/cameraService';

interface CameraCaptureProps {
  onCaptureSuccess: (blob: Blob, previewUrl: string) => void;
  onReset: () => void;
  onError: (error: Error) => void;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  onCaptureSuccess,
  onReset,
  onError
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [streamActive, setStreamActive] = useState<boolean>(false);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState<boolean>(false);

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      cameraService.stopCamera();
    };
  }, []);

  const handleStartCamera = async () => {
    if (!videoRef.current) return;
    try {
      setProcessing(true);
      await cameraService.startCamera(videoRef.current);
      setStreamActive(true);
      setCapturedPreview(null);
      onReset();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      onError(new Error(errorMessage || 'Permission denied or camera in use.'));
    } finally {
      setProcessing(false);
    }
  };

  const handleStopCamera = () => {
    cameraService.stopCamera();
    setStreamActive(false);
    setCapturedPreview(null);
    onReset();
  };

  const handleCapture = async () => {
    if (!videoRef.current || !streamActive) return;

    try {
      setProcessing(true);
      
      // 1. Trigger the off-thread crop/grayscale/compress pipeline
      const compressedBlob = await cameraService.captureAndProcess(videoRef.current);
      
      // 2. Stop camera stream immediately to conserve power and freeze view
      cameraService.stopCamera();
      setStreamActive(false);

      // 3. Create a local URL for the compressed image to display to the volunteer
      const localUrl = URL.createObjectURL(compressedBlob);
      setCapturedPreview(localUrl);

      // 4. Pass the compressed blob and preview URL back to the controller
      onCaptureSuccess(compressedBlob, localUrl);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      onError(new Error(errorMessage || 'Failed to capture frame.'));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="camera-capture-container" aria-label="Incident Scan Camera">
      <div className="video-viewport">
        {/* Live Video Stream View */}
        <video
          ref={videoRef}
          className="video-feed"
          aria-label="Live camera preview"
          autoPlay
          playsInline
          muted
          style={{ display: streamActive && !capturedPreview ? 'block' : 'none' }}
        />

        {/* Dynamic Scan Target Grid Overlay (Visible when streaming) */}
        {streamActive && !capturedPreview && (
          <div className="scanner-target-overlay" aria-hidden="true">
            <div className="target-box">
              <div className="corner top-left"></div>
              <div className="corner top-right"></div>
              <div className="corner bottom-left"></div>
              <div className="corner bottom-right"></div>
              <span className="scanner-hint-text">ALIGN TICKET OR ITEM HERE</span>
            </div>
          </div>
        )}

        {/* Captured Compressed Privacy View (Grayscale) */}
        {capturedPreview && (
          <div className="captured-preview-container">
            <img
              src={capturedPreview}
              alt="Grayscale cropped scan preview"
              className="grayscale-preview-image"
            />
            <div className="privacy-badge">
              <Eye size={12} aria-hidden="true" />
              <span>Grayscale Privacy Crop (&lt;100KB)</span>
            </div>
          </div>
        )}

        {/* Empty placeholder view when camera is disabled */}
        {!streamActive && !capturedPreview && (
          <div className="camera-placeholder">
            <CameraOff size={48} className="placeholder-icon" aria-hidden="true" />
            <p className="placeholder-text">Camera is currently disabled.</p>
          </div>
        )}

        {/* Loading overlay when processing worker compression */}
        {processing && (
          <div className="processing-overlay" role="status">
            <div className="spinner" aria-hidden="true"></div>
            <p className="processing-text">Cropping & compressing...</p>
          </div>
        )}
      </div>

      <div className="camera-controls">
        {!streamActive && !capturedPreview && (
          <button
            type="button"
            className="btn-camera-action btn-start-camera"
            onClick={handleStartCamera}
            disabled={processing}
            aria-label="Activate camera stream"
          >
            <Camera size={18} aria-hidden="true" />
            <span>Start Scan Feed</span>
          </button>
        )}

        {streamActive && (
          <button
            type="button"
            className="btn-camera-action btn-capture"
            onClick={handleCapture}
            disabled={processing}
            aria-label="Capture snapshot scan"
          >
            <Camera size={18} aria-hidden="true" />
            <span>Capture Frame</span>
          </button>
        )}

        {(streamActive || capturedPreview) && (
          <button
            type="button"
            className="btn-camera-action btn-stop"
            onClick={capturedPreview ? handleStartCamera : handleStopCamera}
            disabled={processing}
            aria-label={capturedPreview ? "Scan a new item" : "Disable camera feed"}
          >
            {capturedPreview ? (
              <>
                <RefreshCw size={18} aria-hidden="true" />
                <span>Scan New Incident</span>
              </>
            ) : (
              <>
                <CameraOff size={18} aria-hidden="true" />
                <span>Stop Stream</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default CameraCapture;
