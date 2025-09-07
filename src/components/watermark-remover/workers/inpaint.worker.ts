// Web Worker for inpainting processing
// 使用官方 OpenCV.js，通过 importScripts 加载

type MsgType = 'INPAINT' | 'WARMUP'

interface InpaintMessage {
  type: MsgType
  payload?: {
    imageData: ImageData
    maskData: ImageData
    algorithm: 'telea' | 'ns'
    inpaintRadius: number
  }
}

interface InpaintResponse {
  type: 'INPAINT_SUCCESS' | 'INPAINT_ERROR'
  payload?: ImageData
  error?: string
}

// 声明全局 cv 对象
declare const cv: any

let isOpenCVLoaded = false

// 加载 OpenCV.js - 使用官方版本与 importScripts
async function loadOpenCV(): Promise<void> {
  if (isOpenCVLoaded) return
  
  try {
    console.log('🔄 Loading OpenCV.js (official) in worker...')
    
    // 首先尝试从本地加载，如果失败则使用 CDN
    try {
      self.importScripts('/libs/opencv.js')
      console.log('✅ Loaded OpenCV from local file')
    } catch (localError) {
      console.warn('⚠️ Local OpenCV not found, falling back to CDN...')
      self.importScripts('https://docs.opencv.org/4.8.0/opencv.js')
      console.log('✅ Loaded OpenCV from CDN')
    }

    // 等待 OpenCV 初始化完成
    if (typeof cv !== 'undefined') {
      await new Promise<void>((resolve) => {
        cv['onRuntimeInitialized'] = () => {
          isOpenCVLoaded = true
          console.log('✅ OpenCV initialized successfully in worker')
          resolve()
        }
      })
    } else {
      throw new Error('OpenCV not available after loading script')
    }
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err))
  }
}

// 直接构造 ImageData，避免 OffscreenCanvas 兼容/性能问题
function performInpaint(
  imageData: ImageData,
  maskData: ImageData,
  algorithm: 'telea' | 'ns',
  inpaintRadius: number
): ImageData {
  try {
    if (!cv) throw new Error('OpenCV not ready')
    const srcRGBA = cv.matFromImageData(imageData)
    const maskRGBA = cv.matFromImageData(maskData)
    const srcRGB = new cv.Mat()
    const dstRGB = new cv.Mat()
    const grayMask = new cv.Mat()
    const binMask = new cv.Mat()

    // 源图转 3 通道；掩膜转灰度并二值
    cv.cvtColor(srcRGBA, srcRGB, cv.COLOR_RGBA2RGB)
    cv.cvtColor(maskRGBA, grayMask, cv.COLOR_RGBA2GRAY)
    cv.threshold(grayMask, binMask, 1, 255, cv.THRESH_BINARY)

    // 适度膨胀掩膜，覆盖边缘
    const ksize = Math.max(1, Math.min(7, ((inpaintRadius | 0) % 2 === 1 ? inpaintRadius : inpaintRadius - 1)))
    const kernel = cv.Mat.ones(ksize, ksize, cv.CV_8U)
    const iterations = Math.max(0, Math.min(3, Math.floor(inpaintRadius / 6)))
    if (iterations > 0) cv.dilate(binMask, binMask, kernel, new cv.Point(-1, -1), iterations)

    const flags = algorithm === 'telea' ? cv.INPAINT_TELEA : cv.INPAINT_NS
    cv.inpaint(srcRGB, binMask, dstRGB, inpaintRadius, flags)

    // 转 RGBA 并构造 ImageData
    const dstRGBA = new cv.Mat()
    cv.cvtColor(dstRGB, dstRGBA, cv.COLOR_RGB2RGBA)
    const result = new ImageData(new Uint8ClampedArray(dstRGBA.data), dstRGBA.cols, dstRGBA.rows)

    // 释放内存
    srcRGBA.delete(); maskRGBA.delete(); srcRGB.delete(); dstRGB.delete();
    grayMask.delete(); binMask.delete(); kernel.delete(); dstRGBA.delete()

    return result
  } catch (error) {
    throw new Error(`Inpainting processing failed: ${error}`)
  }
}

self.onmessage = async (e: MessageEvent<InpaintMessage>) => {
  const { type, payload } = e.data
  try {
    if (type === 'WARMUP') {
      await loadOpenCV()
      self.postMessage({ type: 'INPAINT_SUCCESS' } as InpaintResponse)
      return
    }
    if (type === 'INPAINT') {
      await loadOpenCV()
      if (!payload) throw new Error('Missing payload for INPAINT')
      const { imageData, maskData, algorithm, inpaintRadius } = payload
      const result = performInpaint(imageData, maskData, algorithm, inpaintRadius)
      self.postMessage({ type: 'INPAINT_SUCCESS', payload: result } as InpaintResponse)
    }
  } catch (error) {
    self.postMessage({
      type: 'INPAINT_ERROR',
      error: error instanceof Error ? error.message : 'Unknown error'
    } as InpaintResponse)
  }
}
