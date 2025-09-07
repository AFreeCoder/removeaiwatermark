'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Upload, Eraser, Undo, Redo, Download, Copy, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useInpaintWorker, type InpaintAlgorithm } from './hooks/useInpaintWorker'

type Algorithm = InpaintAlgorithm

interface WatermarkRemoverProps {
  defaultAlgorithm?: Algorithm
  algorithms?: Algorithm[]
  defaultBrushSize?: number
  maxDimension?: number
  initialImage?: string | File | ArrayBuffer
  onProcessStart?: (meta: any) => void
  onProcessEnd?: (result: { blob: Blob; url: string }) => void
  onError?: (err: Error | { code: string; message: string }) => void
  processingBackend?: 'wasm' | 'server'
  serverEndpoint?: string
  className?: string
}

export default function WatermarkRemover({
  defaultAlgorithm = 'telea',
  algorithms = ['telea', 'ns'],
  defaultBrushSize = 24,
  maxDimension = 4096,
  // initialImage (removed, was unused)
  onProcessStart,
  onProcessEnd,
  onError,
  processingBackend = 'wasm',
  serverEndpoint,
  className,
}: WatermarkRemoverProps) {
  // 状态管理
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  // 原始图片对象
  const [algorithm, setAlgorithm] = useState<Algorithm>(defaultAlgorithm)
  const [brushSize, setBrushSize] = useState(defaultBrushSize)
  const [inpaintRadius, setInpaintRadius] = useState<number>(3)
  const [isErasing, setIsErasing] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  // 掩膜历史（用于撤销/重做），限制最大步数
  const [history, setHistory] = useState<ImageData[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [resultImage, setResultImage] = useState<string | null>(null)
  const hasWarmedRef = useRef(false)

  // Hook for inpaint worker
  const { inpaint: workerInpaint, warmup: workerWarmup } = useInpaintWorker()

  // 节流渲染：避免频繁的 readback 操作
  const updateOverlayFromMask = useCallback(() => {
    const maskCanvas = maskCanvasRef.current
    const overlayCanvas = overlayCanvasRef.current
    if (!maskCanvas || !overlayCanvas) return

    const overlayCtx = overlayCanvas.getContext('2d')
    if (!overlayCtx) return

    // 清空可视化画布
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)
    
    // 复制掩膜到可视化画布
    overlayCtx.globalCompositeOperation = 'source-over'
    overlayCtx.drawImage(maskCanvas, 0, 0)
    
    // 将白色掩膜区域染色为蓝色画笔效果
    overlayCtx.globalCompositeOperation = 'source-in'
    overlayCtx.fillStyle = 'rgba(0,0,255,0.3)'
    overlayCtx.fillRect(0, 0, overlayCanvas.width, overlayCanvas.height)
  }, [])

  // 节流版本的渲染更新，避免频繁调用
  const deferredUpdateOverlay = useCallback(() => {
    requestAnimationFrame(() => {
      updateOverlayFromMask()
    })
  }, [updateOverlayFromMask])

  // 简单的 inpainting 算法（MVP 备用方案）
  const simpleInpaint = useCallback(async (imageData: ImageData, maskData: ImageData): Promise<ImageData> => {
    return new Promise((resolve) => {
      // 模拟异步处理
      setTimeout(() => {
        const result = new ImageData(
          new Uint8ClampedArray(imageData.data),
          imageData.width,
          imageData.height
        )
        
        const { width, height } = imageData
        
        // 简单的邻近像素平均算法
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4
            
            // 检查是否在掩膜区域内（灰度值 > 128表示需要修复）
            if (maskData.data[idx] > 128) { // 检查红色通道，灰度图RGB值相同
              // 获取周围8个像素的平均值
              let r = 0, g = 0, b = 0, count = 0
              
              for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                  if (dx === 0 && dy === 0) continue
                  
                  const nx = x + dx
                  const ny = y + dy
                  
                  if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    const nidx = (ny * width + nx) * 4
                    
                    // 只使用非掩膜区域的像素（灰度值 <= 128表示保持不变的区域）
                    if (maskData.data[nidx] <= 128) {
                      r += imageData.data[nidx]
                      g += imageData.data[nidx + 1]
                      b += imageData.data[nidx + 2]
                      count++
                    }
                  }
                }
              }
              
              if (count > 0) {
                result.data[idx] = Math.round(r / count)
                result.data[idx + 1] = Math.round(g / count)
                result.data[idx + 2] = Math.round(b / count)
              }
            }
          }
        }
        
        resolve(result)
      }, 500) // 模拟处理时间
    })
  }, [])

  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const maskCanvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const resultCanvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const MAX_HISTORY = 20

  // 绘制状态
  const [isDrawing, setIsDrawing] = useState(false)
  const [lastPoint, setLastPoint] = useState<{ x: number; y: number } | null>(null)

  // 处理文件上传
  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        console.log('Image loaded:', img.width, img.height)
        // 检查图片尺寸，如果过大则缩放
        let { width, height } = img
        const maxDim = Math.max(width, height)
        
        if (maxDim > maxDimension) {
          const scale = maxDimension / maxDim
          width *= scale
          height *= scale
        }

        setImage(img)
        
        // 重置历史记录
        setHistory([])
        setHistoryIndex(-1)
        // 清空结果
        setResultImage(null)
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }, [maxDimension])

  // 处理拖拽上传
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }, [handleFileSelect])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  // 处理剪贴板粘贴
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items || [])
      const imageItem = items.find(item => item.type.startsWith('image/'))
      
      if (imageItem) {
        const file = imageItem.getAsFile()
        if (file) {
          handleFileSelect(file)
        }
      }
    }

    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [handleFileSelect])

  // 处理图片加载到画布
  useEffect(() => {
    if (!image) return

    const canvas = canvasRef.current
    const maskCanvas = maskCanvasRef.current
    const overlayCanvas = overlayCanvasRef.current
    
    if (canvas && maskCanvas && overlayCanvas) {
      const { width: imgWidth, height: imgHeight } = image
      
      // 检查图片尺寸，如果过大则缩放
      let width = imgWidth
      let height = imgHeight
      const maxDim = Math.max(width, height)
      
      if (maxDim > maxDimension) {
        const scale = maxDimension / maxDim
        width *= scale
        height *= scale
      }
      
      // 设置画布的实际尺寸
      canvas.width = width
      canvas.height = height
      maskCanvas.width = width
      maskCanvas.height = height
      overlayCanvas.width = width
      overlayCanvas.height = height
      
      // 设置画布的显示尺寸，保持宽高比（上限 800）
      const containerWidth = Math.min(width, 800)
      const containerHeight = (height * containerWidth) / width
      
      canvas.style.width = `${containerWidth}px`
      canvas.style.height = `${containerHeight}px`
      maskCanvas.style.width = `${containerWidth}px`
      maskCanvas.style.height = `${containerHeight}px`
      overlayCanvas.style.width = `${containerWidth}px`
      overlayCanvas.style.height = `${containerHeight}px`
      
      const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null
      const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true } as CanvasRenderingContext2DSettings) as CanvasRenderingContext2D | null
      const overlayCtx = overlayCanvas.getContext('2d') as CanvasRenderingContext2D | null
      
      if (ctx && maskCtx && overlayCtx) {
        // 绘制图片到主画布
        ctx.clearRect(0, 0, width, height)
        ctx.drawImage(image, 0, 0, width, height)
        
        // 清空掩膜与可视化画布
        maskCtx.clearRect(0, 0, width, height)
        overlayCtx.clearRect(0, 0, width, height)
      } else {
        // 画布上下文不可用
      }
    } else {
      // 画布引用未就绪
    }
  }, [image, maxDimension])

  // 获取鼠标在画布上的坐标
  const getCanvasPoint = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = overlayCanvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    let clientX: number
    let clientY: number

    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0]
      clientX = touch.clientX
      clientY = touch.clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    }
  }, [])

  // 绘制：同时绘制到"掩膜画布"（算法用）与"可视化画布"（UI 效果）
  const drawOnMask = useCallback((x: number, y: number, erase = false) => {
    const maskCanvas = maskCanvasRef.current
    const overlayCanvas = overlayCanvasRef.current
    if (!maskCanvas || !overlayCanvas) return

    const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true } as CanvasRenderingContext2DSettings) as CanvasRenderingContext2D | null
    const overlayCtx = overlayCanvas.getContext('2d') as CanvasRenderingContext2D | null
    if (!maskCtx || !overlayCtx) return

    const radius = Math.max(brushSize / 2, 0.5)

    // 掩膜：直接使用单通道灰度格式，白色=255（需要inpaint），黑色=0（保持不变）
    maskCtx.globalCompositeOperation = erase ? 'destination-out' : 'source-over'
    // 使用纯白色绘制需要修复的区域，纯黑色用于橡皮擦
    const grayValue = erase ? 0 : 255
    maskCtx.fillStyle = `rgb(${grayValue},${grayValue},${grayValue})`
    
    // 绘制圆形软笔刷
    maskCtx.beginPath()
    maskCtx.arc(x, y, radius, 0, Math.PI * 2)
    maskCtx.fill()

    // 如果有连续笔触，连接两点之间
    if (lastPoint) {
      maskCtx.lineWidth = brushSize
      maskCtx.lineCap = 'round'
      maskCtx.lineJoin = 'round'
      maskCtx.strokeStyle = `rgb(${grayValue},${grayValue},${grayValue})`
      maskCtx.beginPath()
      maskCtx.moveTo(lastPoint.x, lastPoint.y)
      maskCtx.lineTo(x, y)
      maskCtx.stroke()
    }

    // 节流更新可视化显示，减少性能开销
    deferredUpdateOverlay()
  }, [brushSize, lastPoint, deferredUpdateOverlay])

  // 鼠标事件处理
  const snapshotMask = useCallback(() => {
    const maskCanvas = maskCanvasRef.current
    if (!maskCanvas) return
    const ctx = maskCanvas.getContext('2d', { willReadFrequently: true } as CanvasRenderingContext2DSettings) as CanvasRenderingContext2D | null
    if (!ctx) return
    const imageData = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height)
    setHistory((prev) => {
      const base = prev.slice(0, historyIndex + 1)
      base.push(imageData)
      // 限制历史长度
      const overflow = Math.max(base.length - MAX_HISTORY, 0)
      return overflow ? base.slice(overflow) : base
    })
    setHistoryIndex((idx) => Math.min(idx + 1, MAX_HISTORY - 1))
  }, [historyIndex])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isProcessing || !image) return
    const point = getCanvasPoint(e)
    if (!point) return

    setIsDrawing(true)
    setLastPoint(point)
    // 保存绘制前快照
    snapshotMask()

    drawOnMask(point.x, point.y, isErasing)
  }, [getCanvasPoint, drawOnMask, isErasing, snapshotMask, isProcessing, image])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawing || isProcessing) return

    const point = getCanvasPoint(e)
    if (!point) return

    drawOnMask(point.x, point.y, isErasing)
    setLastPoint(point)
  }, [isDrawing, getCanvasPoint, drawOnMask, isErasing, isProcessing])

  const handleMouseUp = useCallback(() => {
    if (isDrawing) {
      // 保存绘制后快照，便于重做
      snapshotMask()
    }
    setIsDrawing(false)
    setLastPoint(null)
  }, [isDrawing, snapshotMask])

  // 预热 OpenCV（Worker 中加载 opencv.js），减少首次处理等待
  useEffect(() => {
    if (processingBackend === 'wasm' && !hasWarmedRef.current) {
      hasWarmedRef.current = true
      workerWarmup().catch(() => {
        // 静默失败，首次处理时仍会加载
      })
    }
  }, [processingBackend, workerWarmup])

  

  // 撤销操作
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const maskCanvas = maskCanvasRef.current
      const overlayCanvas = overlayCanvasRef.current
      if (maskCanvas && overlayCanvas) {
        const ctx = maskCanvas.getContext('2d', { willReadFrequently: true } as CanvasRenderingContext2DSettings) as CanvasRenderingContext2D | null
        const octx = overlayCanvas.getContext('2d') as CanvasRenderingContext2D | null
        if (ctx && octx) {
          const previousState = history[historyIndex - 1]
          ctx.putImageData(previousState, 0, 0)
          setHistoryIndex(historyIndex - 1)
          // 同步可视化：使用统一的渲染函数
          updateOverlayFromMask()
        }
      }
    }
  }, [history, historyIndex, updateOverlayFromMask])

  // 重做操作
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const maskCanvas = maskCanvasRef.current
      const overlayCanvas = overlayCanvasRef.current
      if (maskCanvas && overlayCanvas) {
        const ctx = maskCanvas.getContext('2d', { willReadFrequently: true } as CanvasRenderingContext2DSettings) as CanvasRenderingContext2D | null
        const octx = overlayCanvas.getContext('2d') as CanvasRenderingContext2D | null
        if (ctx && octx) {
          const nextState = history[historyIndex + 1]
          ctx.putImageData(nextState, 0, 0)
          setHistoryIndex(historyIndex + 1)
          // 同步可视化：使用统一的渲染函数
          updateOverlayFromMask()
        }
      }
    }
  }, [history, historyIndex, updateOverlayFromMask])

  // 键盘快捷键：[ / ] 调整画笔；Cmd/Ctrl+Z 撤销；Shift+Cmd/Ctrl+Z 重做；E 切换橡皮擦
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!image) return
      // 调整画笔
      if (e.key === '[') {
        setBrushSize((s) => Math.max(0, s - 2))
      } else if (e.key === ']') {
        setBrushSize((s) => Math.min(100, s + 2))
      }
      // 撤销/重做
      const isMac = navigator.platform.toUpperCase().includes('MAC')
      const meta = isMac ? e.metaKey : e.ctrlKey
      if (meta && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      } else if (meta && (e.key.toLowerCase() === 'z' && e.shiftKey)) {
        e.preventDefault()
        handleRedo()
      }
      // 橡皮擦切换
      if (e.key.toLowerCase() === 'e') {
        setIsErasing((v) => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [image, handleUndo, handleRedo])

  // 清空掩膜
  const handleClearMask = useCallback(() => {
    const maskCanvas = maskCanvasRef.current
    const overlayCanvas = overlayCanvasRef.current
    if (maskCanvas && overlayCanvas) {
      const ctx = maskCanvas.getContext('2d', { willReadFrequently: true } as CanvasRenderingContext2DSettings) as CanvasRenderingContext2D | null
      const octx = overlayCanvas.getContext('2d') as CanvasRenderingContext2D | null
      if (ctx && octx) {
        ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height)
        // 清空后更新可视化显示
        updateOverlayFromMask()
        // 保存到历史记录
        const imageData = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height)
        setHistory((prev) => {
          const base = prev.slice(0, historyIndex + 1)
          base.push(imageData)
          const overflow = Math.max(base.length - MAX_HISTORY, 0)
          return overflow ? base.slice(overflow) : base
        })
        setHistoryIndex((idx) => Math.min(idx + 1, MAX_HISTORY - 1))
      }
    }
  }, [historyIndex, updateOverlayFromMask])

  // 处理图片消除
  const handleProcess = useCallback(async () => {
    if (!image) {
      toast.error('Please upload an image first')
      return
    }

    const canvas = canvasRef.current
    const maskCanvas = maskCanvasRef.current
    if (!canvas || !maskCanvas) return

    const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true } as CanvasRenderingContext2DSettings) as CanvasRenderingContext2D | null
    if (!maskCtx) return

    // 检查是否有掩膜（灰度格式，白色=255表示需要修复的区域）
    const maskImageData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height)
    let hasMask = false
    
    // 检查是否有任何白色像素（RGB值 > 128表示需要修复）
    for (let i = 0; i < maskImageData.data.length; i += 4) {
      if (maskImageData.data[i] > 128) { // 检查红色通道，灰度图RGB值相同
        hasMask = true
        break
      }
    }
    
    if (!hasMask) {
      toast.error('Please select an area to remove')
      return
    }

    setIsProcessing(true)
    // 先显示结果区域，占位，以便用户可见“结果画布”
    if (!resultImage) setResultImage('processing')
    onProcessStart?.({ algorithm, brushSize, inpaintRadius })

    try {
      // 获取原图数据
      const canvasCtx = canvas.getContext('2d')
      if (!canvasCtx) throw new Error('Cannot get canvas context')
      
      const imageData = canvasCtx.getImageData(0, 0, canvas.width, canvas.height)
      
      // 如果后端处理模式是 server，发送到服务器
      if (processingBackend === 'server' && serverEndpoint) {
        // 服务端处理逻辑
        const formData = new FormData()
        
        // 将 ImageData 转换为 Blob
        const imageBlob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((blob) => {
            if (blob) resolve(blob)
          }, 'image/png')
        })
        
        const maskBlob = await new Promise<Blob>((resolve) => {
          maskCanvas.toBlob((blob) => {
            if (blob) resolve(blob)
          }, 'image/png')
        })
        
        formData.append('image', imageBlob)
        formData.append('mask', maskBlob)
        formData.append('algorithm', algorithm)
        formData.append('inpaintRadius', '3')
        
        const response = await fetch(serverEndpoint, {
          method: 'POST',
          body: formData
        })
        
        if (!response.ok) throw new Error('Server processing failed')
        
        const processedBlob = await response.blob()
        const processedUrl = URL.createObjectURL(processedBlob)
        
        // 加载处理后的图片到画布
        const processedImg = new Image()
        processedImg.onload = () => {
          canvasCtx.drawImage(processedImg, 0, 0)
          setResultImage(processedUrl)
          onProcessEnd?.({ blob: processedBlob, url: processedUrl })
          toast.success('处理完成')
        }
        processedImg.src = processedUrl
        
      } else {
        // 首选使用 Web Worker + OpenCV.js 进行 Inpainting
        let result: ImageData
        try {
          const radius = Math.max(1, Math.round(inpaintRadius))
          console.log('🔄 Starting OpenCV inpaint...', { algorithm, radius })
          // 掩膜已经是灰度格式，直接使用
          result = await workerInpaint(imageData, maskImageData, algorithm, radius)
          console.log('✅ OpenCV inpaint completed successfully')
        } catch (e) {
          console.warn('⚠️ OpenCV inpaint failed, falling back to simple algorithm:', e)
          // 失败时退回到简易算法
          result = await simpleInpaint(imageData, maskImageData)
          console.log('✅ Simple inpaint completed')
        }
        
        // 将结果绘制到结果画布
        const resultCanvas = resultCanvasRef.current
        if (resultCanvas) {
          resultCanvas.width = canvas.width
          resultCanvas.height = canvas.height
          
          // 设置显示尺寸与原画布相同
          resultCanvas.style.width = canvas.style.width
          resultCanvas.style.height = canvas.style.height
          
          const resultCtx = resultCanvas.getContext('2d')
          if (resultCtx) {
            resultCtx.putImageData(result, 0, 0)
            // 立即显示结果区域
            setResultImage('ready')
            // 导出 URL/Blob（带 fallback）
            const toBlob = (canvas: HTMLCanvasElement): Promise<Blob> => {
              return new Promise((resolve) => {
                if (canvas.toBlob) {
                  canvas.toBlob((b) => b && resolve(b), 'image/png')
                } else {
                  const dataURL = canvas.toDataURL('image/png')
                  const arr = dataURL.split(',')
                  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png'
                  const bstr = atob(arr[1])
                  let n = bstr.length
                  const u8arr = new Uint8Array(n)
                  while (n--) u8arr[n] = bstr.charCodeAt(n)
                  resolve(new Blob([u8arr], { type: mime }))
                }
              })
            }
            toBlob(resultCanvas).then((blob) => {
              const url = URL.createObjectURL(blob)
              setResultImage(url)
              onProcessEnd?.({ blob, url })
              toast.success('Processing completed')
            })
          }
        }
      }
      
      // 清除掩膜并更新可视化
      maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height)
      updateOverlayFromMask()
      
    } catch (error) {
      const err = error as Error
      onError?.(err)
      toast.error('处理失败: ' + err.message)
    } finally {
      setIsProcessing(false)
    }
  }, [image, algorithm, brushSize, inpaintRadius, processingBackend, serverEndpoint, workerInpaint, onProcessStart, onProcessEnd, onError, simpleInpaint, updateOverlayFromMask])

  // 导出功能
  const handleDownload = useCallback(() => {
    const canvas = resultCanvasRef.current
    if (!canvas) return

    const link = document.createElement('a')
    link.download = 'watermark-removed.png'
    link.href = canvas.toDataURL()
    link.click()
  }, [])

  const handleCopyToClipboard = useCallback(async () => {
    const canvas = resultCanvasRef.current
    if (!canvas) return

    try {
      canvas.toBlob(async (blob) => {
        if (blob) {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ])
          toast.success('Copied to clipboard')
        }
      })
    } catch (error) {
      toast.error('Copy failed, please try download')
    }
  }, [])

  return (
    <div className={cn('w-full max-w-4xl mx-auto p-4 space-y-4', className)}>
      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-muted rounded-lg">
        {/* 文件上传 */}
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
        >
          <Upload className="w-4 h-4 mr-2" />
          Upload Image
        </Button>
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFileSelect(file)
          }}
        />

        {/* 算法选择 */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Algorithm:</label>
          <Select value={algorithm} onValueChange={(value: Algorithm) => setAlgorithm(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {algorithms.includes('telea') && (
                <SelectItem value="telea">Telea</SelectItem>
              )}
              {algorithms.includes('ns') && (
                <SelectItem value="ns">Navier-Stokes</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* 画笔大小 */}
        <div className="flex items-center gap-2 min-w-32">
          <label className="text-sm font-medium">Brush:</label>
          <Slider
            value={[brushSize]}
            onValueChange={(value) => setBrushSize(value[0])}
            min={1}
            max={100}
            step={1}
            className="flex-1"
          />
          <span className="text-sm w-8">{brushSize}</span>
        </div>

        {/* 工具按钮 */}
        <div className="flex items-center gap-1">
          <Button
            variant={isErasing ? "default" : "outline"}
            size="sm"
            onClick={() => setIsErasing(!isErasing)}
            disabled={!image || isProcessing}
          >
            <Eraser className="w-4 h-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleUndo}
            disabled={!image || historyIndex <= 0 || isProcessing}
          >
            <Undo className="w-4 h-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRedo}
            disabled={!image || historyIndex >= history.length - 1 || isProcessing}
          >
            <Redo className="w-4 h-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleClearMask}
            disabled={!image || isProcessing}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>

        {/* 处理按钮 */}
        <Button
          onClick={handleProcess}
          disabled={!image || isProcessing}
          className="ml-auto"
        >
          {isProcessing ? 'Processing...' : 'Remove Watermark'}
        </Button>
      </div>

      {/* 算法参数 */}
      <div className="flex items-center gap-4 p-4 bg-muted/60 rounded-lg">
        <div className="flex items-center gap-2 min-w-56">
          <label className="text-sm font-medium">Inpaint Radius:</label>
          <Slider
            value={[inpaintRadius]}
            onValueChange={(v) => setInpaintRadius(v[0])}
            min={1}
            max={30}
            step={1}
            className="flex-1"
            disabled={isProcessing}
          />
          <span className="text-sm w-10 text-right">{inpaintRadius}</span>
        </div>
      </div>

      {/* 画布区域 */}
      <div 
        className="relative border-2 border-dashed border-muted-foreground/25 rounded-lg overflow-hidden bg-muted/50 min-h-96 flex items-center justify-center"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        {image ? (
          <div className="relative w-full flex justify-center">
            <div className="relative">
              <canvas
                ref={canvasRef}
                className="block border"
              // 鼠标事件
              />
              {/* 可视化/交互画布（水彩效果） */}
              <canvas
                ref={overlayCanvasRef}
                className="absolute top-0 left-0 cursor-crosshair pointer-events-auto touch-none select-none"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                // 触摸事件（移动端）
                onTouchStart={(e) => {
                  const touch = e.touches[0]
                  if (!touch) return
                  // 将 touch 事件适配为鼠标绘制
                  // 复用 mouse handlers 通过 getCanvasPoint 的 touch 分支
                  // 只需触发一次 down
                  // 直接调用 handleMouseDown 类型断言为 any
                  ;(handleMouseDown as any)(e)
                }}
                onTouchMove={(e) => {
                  ;(handleMouseMove as any)(e)
                }}
                onTouchEnd={(e) => {
                  handleMouseUp()
                }}
              />
              {/* 掩膜画布（算法用，不可见） */}
              <canvas
                ref={maskCanvasRef}
                className="absolute top-0 left-0 pointer-events-none opacity-0"
              />
            </div>
          </div>
        ) : (
          <div className="text-center text-muted-foreground">
            <Upload className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Drag and drop an image here or click upload</p>
            <p className="text-sm mt-2">Supports PNG, JPEG, WebP formats</p>
            <p className="text-sm">You can also paste from clipboard with Ctrl+V</p>
          </div>
        )}
      </div>

      {/* 结果显示区域 */}
      {resultImage && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Result</h3>
          <div className="relative border-2 border-dashed border-muted-foreground/25 rounded-lg overflow-hidden bg-muted/50 min-h-96 flex items-center justify-center">
            <div className="relative w-full flex justify-center">
              <div className="relative">
                <canvas
                  ref={resultCanvasRef}
                  className="block border"
                />
              </div>
            </div>
          </div>
          
          {/* 导出工具栏 */}
          <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
            <span className="text-sm font-medium">Export:</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={isProcessing}
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyToClipboard}
              disabled={isProcessing}
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
