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
  const isMountedRef = useRef<boolean>(true);
  const [streamActive, setStreamActive] = useState<boolean>(false);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState<boolean>(false);
  const [announcement, setAnnouncement] = useState<string>('');

  // Clean up camera stream on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      cameraService.stopCamera();
    };
  }, []);

  // Revoke previous object URLs when the preview changes to avoid memory leaks
  useEffect(() => {
    return () => {
      if (capturedPreview) {
        URL.revokeObjectURL(capturedPreview);
      }
    };
  }, [capturedPreview]);

  const handleStartCamera = async () => {
    if (!videoRef.current) return;
    try {
      setProcessing(true);
      setAnnouncement('Starting camera stream...');
      const stream = await cameraService.startCamera(videoRef.current);
      if (!isMountedRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      setStreamActive(true);
      setCapturedPreview(null);
      setAnnouncement('Camera stream active. Align your ticket or item in the viewport.');
      onReset();
    } catch (err) {
      if (!isMountedRef.current) return;
      const errorMessage = err instanceof Error ? err.message : String(err);
      setAnnouncement(`Failed to start camera: ${errorMessage}`);
      onError(new Error(errorMessage || 'Permission denied or camera in use.'));
    } finally {
      if (isMountedRef.current) {
        setProcessing(false);
      }
    }
  };

  const handleStopCamera = () => {
    cameraService.stopCamera();
    setStreamActive(false);
    setCapturedPreview(null);
    setAnnouncement('Camera stream stopped.');
    onReset();
  };

  const handleCapture = async () => {
    if (!videoRef.current || !streamActive) return;

    try {
      setProcessing(true);
      setAnnouncement('Capturing and compressing image scan...');
      
      // 1. Trigger the off-thread crop/grayscale/compress pipeline
      const compressedBlob = await cameraService.captureAndProcess(videoRef.current);
      if (!isMountedRef.current) return;
      
      // 2. Stop camera stream immediately to conserve power and freeze view
      cameraService.stopCamera();
      setStreamActive(false);

      // 3. Create a local URL for the compressed image to display to the volunteer
      const localUrl = URL.createObjectURL(compressedBlob);
      setCapturedPreview(localUrl);
      setAnnouncement('Image snapshot successfully compressed and updated.');

      // 4. Pass the compressed blob and preview URL back to the controller
      onCaptureSuccess(compressedBlob, localUrl);
    } catch (err) {
      if (!isMountedRef.current) return;
      const errorMessage = err instanceof Error ? err.message : String(err);
      setAnnouncement(`Failed to capture image scan: ${errorMessage}`);
      onError(new Error(errorMessage || 'Failed to capture frame.'));
    } finally {
      if (isMountedRef.current) {
        setProcessing(false);
      }
    }
  };

  return (
    <div className="camera-capture-container" aria-label="Incident Scan Camera">
      <div style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', border: 0 }} aria-live="polite" role="status">
        {announcement}
      </div>
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
