// Classic Web Worker for inpainting processing (runtime JS for Vercel)
// Loads OpenCV.js via importScripts in the worker context.

/* eslint-disable no-restricted-globals */

let isOpenCVLoaded = false;

async function loadOpenCV() {
  if (isOpenCVLoaded) return;
  try {
    // Try CDN first
    try {
      self.importScripts('https://r2.removeaiwatermark.org/opencv.js');
      // If COEP/CORP blocks the CDN, we fall back below
      // (no-op log here to avoid noisy consoles in production)
    } catch (cdnErr) {
      // Fallback to same-origin static asset
      const origin = self.location && self.location.origin ? self.location.origin : '';
      const localUrl = origin ? `${origin}/libs/opencv.js` : '/libs/opencv.js';
      self.importScripts(localUrl);
    }

    if (typeof cv !== 'undefined') {
      await new Promise((resolve) => {
        cv.onRuntimeInitialized = () => {
          isOpenCVLoaded = true;
          resolve();
        };
      });
    } else {
      throw new Error('OpenCV not available after loading script');
    }
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

function performInpaint(imageData, maskData, algorithm, inpaintRadius) {
  if (typeof cv === 'undefined') throw new Error('OpenCV not ready');

  const srcRGBA = cv.matFromImageData(imageData);
  const maskRGBA = cv.matFromImageData(maskData);
  const srcRGB = new cv.Mat();
  const dstRGB = new cv.Mat();
  const grayMask = new cv.Mat();
  const binMask = new cv.Mat();

  cv.cvtColor(srcRGBA, srcRGB, cv.COLOR_RGBA2RGB);
  cv.cvtColor(maskRGBA, grayMask, cv.COLOR_RGBA2GRAY);
  cv.threshold(grayMask, binMask, 1, 255, cv.THRESH_BINARY);

  const oddRadius = (inpaintRadius | 0) % 2 === 1 ? inpaintRadius : inpaintRadius - 1;
  const ksize = Math.max(1, Math.min(7, oddRadius));
  const kernel = cv.Mat.ones(ksize, ksize, cv.CV_8U);
  const iterations = Math.max(0, Math.min(3, Math.floor(inpaintRadius / 6)));
  if (iterations > 0) cv.dilate(binMask, binMask, kernel, new cv.Point(-1, -1), iterations);

  const flags = algorithm === 'telea' ? cv.INPAINT_TELEA : cv.INPAINT_NS;
  cv.inpaint(srcRGB, binMask, dstRGB, inpaintRadius, flags);

  const dstRGBA = new cv.Mat();
  cv.cvtColor(dstRGB, dstRGBA, cv.COLOR_RGB2RGBA);
  const result = new ImageData(new Uint8ClampedArray(dstRGBA.data), dstRGBA.cols, dstRGBA.rows);

  srcRGBA.delete();
  maskRGBA.delete();
  srcRGB.delete();
  dstRGB.delete();
  grayMask.delete();
  binMask.delete();
  kernel.delete();
  dstRGBA.delete();

  return result;
}

self.onmessage = async (e) => {
  const { type, payload } = e.data || {};
  try {
    if (type === 'WARMUP') {
      await loadOpenCV();
      self.postMessage({ type: 'INPAINT_SUCCESS' });
      return;
    }
    if (type === 'INPAINT') {
      await loadOpenCV();
      if (!payload) throw new Error('Missing payload for INPAINT');
      const { imageData, maskData, algorithm, inpaintRadius } = payload;
      const result = performInpaint(imageData, maskData, algorithm, inpaintRadius);
      self.postMessage({ type: 'INPAINT_SUCCESS', payload: result });
      return;
    }
    throw new Error('Unknown message type');
  } catch (error) {
    self.postMessage({ type: 'INPAINT_ERROR', error: error && error.message ? error.message : String(error) });
  }
};

