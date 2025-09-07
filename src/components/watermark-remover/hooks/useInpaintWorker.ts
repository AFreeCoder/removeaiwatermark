import { useRef, useCallback, useEffect } from 'react'

export type InpaintAlgorithm = 'telea' | 'ns'

type WorkerMsgType = 'INPAINT' | 'WARMUP'

interface InpaintWorkerMessage {
  type: WorkerMsgType
  payload?: {
    imageData: ImageData
    maskData: ImageData
    algorithm: InpaintAlgorithm
    inpaintRadius: number
  }
}

interface InpaintWorkerResponse {
  type: 'INPAINT_SUCCESS' | 'INPAINT_ERROR'
  payload?: ImageData
  error?: string
}

export function useInpaintWorker() {
  const workerRef = useRef<Worker | null>(null)
  const resolveRef = useRef<((value: any) => void) | null>(null)
  const rejectRef = useRef<((error: Error) => void) | null>(null)

  // 初始化 worker（使用 Classic Worker 支持 importScripts）
  useEffect(() => {
    if (!workerRef.current) {
      // 通过 bundler 解析 worker 入口
      const workerUrl = new URL('../workers/inpaint.worker.ts', import.meta.url)
      // 使用 Classic Worker，支持 importScripts 加载 OpenCV.js
      workerRef.current = new Worker(workerUrl, { type: 'classic' })

      workerRef.current.onmessage = (e: MessageEvent<InpaintWorkerResponse>) => {
        const { type, payload, error } = e.data

        if (type === 'INPAINT_SUCCESS' && resolveRef.current) {
          // 对于 WARMUP 没有 payload，对 INPAINT 有 payload
          resolveRef.current(payload as any)
          resolveRef.current = null
          rejectRef.current = null
        } else if (type === 'INPAINT_ERROR' && rejectRef.current) {
          rejectRef.current(new Error(error || 'Inpaint failed'))
          resolveRef.current = null
          rejectRef.current = null
        }
      }

      workerRef.current.onerror = (error) => {
        if (rejectRef.current) {
          rejectRef.current(new Error('Worker error: ' + error.message))
          resolveRef.current = null
          rejectRef.current = null
        }
      }
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate()
        workerRef.current = null
      }
    }
  }, [])

  const inpaint = useCallback(
    (
      imageData: ImageData,
      maskData: ImageData,
      algorithm: InpaintAlgorithm = 'telea',
      inpaintRadius: number = 3
    ): Promise<ImageData> => {
      return new Promise((resolve, reject) => {
        if (!workerRef.current) {
          reject(new Error('Worker not initialized'))
          return
        }

        resolveRef.current = resolve
        rejectRef.current = reject

        const message: InpaintWorkerMessage = {
          type: 'INPAINT',
          payload: {
            imageData,
            maskData,
            algorithm,
            inpaintRadius
          }
        }

        workerRef.current.postMessage(message)
      })
    },
    []
  )

  const warmup = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        reject(new Error('Worker not initialized'))
        return
      }
      resolveRef.current = resolve
      rejectRef.current = reject
      const message: InpaintWorkerMessage = { type: 'WARMUP' }
      workerRef.current.postMessage(message)
    })
  }, [])

  return { inpaint, warmup }
}
