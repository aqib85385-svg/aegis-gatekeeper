// Web Worker for privacy-first off-thread image processing: Crop -> Resize -> Grayscale -> Compress

interface WorkerMessageData {
  imageBitmap: ImageBitmap;
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  targetWidth: number;
  targetHeight: number;
}

self.onmessage = async (event: MessageEvent<WorkerMessageData>) => {
  const { imageBitmap, cropX, cropY, cropWidth, cropHeight, targetWidth, targetHeight } = event.data;

  try {
    // 1. Create OffscreenCanvas with target dimensions (resizes the image)
    const canvas = new OffscreenCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Could not get 2D context from OffscreenCanvas');
    }

    // Disable image smoothing to speed up drawing if desired, or keep enabled for quality
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';

    // 2. Draw and crop the image onto the canvas
    ctx.drawImage(
      imageBitmap,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      targetWidth,
      targetHeight
    );

    // 3. Convert image to grayscale (privacy and size reduction)
    const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Standard luminance weights for grayscale conversion
      const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      
      data[i] = gray;     // R
      data[i + 1] = gray; // G
      data[i + 2] = gray; // B
      // data[i+3] is Alpha (keep unchanged)
    }
    
    ctx.putImageData(imageData, 0, 0);

    // 4. Compress to low-quality JPEG (under 100 KB target)
    const blob = await canvas.convertToBlob({
      type: 'image/jpeg',
      quality: 0.70 // 70% quality yields high readability for OCR but very small size
    });

    // 5. Clean up the bitmap resource in memory
    imageBitmap.close();

    // 6. Post the compressed blob back to main thread
    self.postMessage({ success: true, blob });
  } catch (error) {
    if (imageBitmap) {
      imageBitmap.close();
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    self.postMessage({ success: false, error: errorMessage });
  }
};
