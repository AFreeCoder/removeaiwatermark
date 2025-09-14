import WatermarkRemover from '@/components/watermark-remover'
import { getRemoveGeminiWatermarkPage } from '@/services/page'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const page = await getRemoveGeminiWatermarkPage(locale);

  let canonicalUrl = `${process.env.NEXT_PUBLIC_WEB_URL}/watermark-remover`;
  if (locale !== "en") {
    canonicalUrl = `${process.env.NEXT_PUBLIC_WEB_URL}/${locale}/watermark-remover`;
  }

  return {
    title: page.watermarkRemover?.title || 'Remove AI Watermark Online - Free Tool | NoAIWatermark',
    description: page.watermarkRemover?.description || 'Free online tool to remove AI watermark and logos. Upload, brush, erase, and download clean AI images instantly.',
    openGraph: {
      title: page.watermarkRemover?.title || 'Remove AI Watermark Online - Free Tool | NoAIWatermark',
      description: page.watermarkRemover?.description || 'Free online tool to remove AI watermark and logos. Upload, brush, erase, and download clean AI images instantly.',
      url: canonicalUrl,
      type: 'website',
    },
    alternates: {
      canonical: canonicalUrl,
    },
  };
}

export default async function WatermarkRemoverPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const page = await getRemoveGeminiWatermarkPage(locale);
  return (
    <div className="container mx-auto px-4 py-8">
      {/* 页面标题和介绍 */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">
          {page.watermarkRemover?.title || 'Remove AI Watermark Online'}
        </h1>
        <p className="text-xl text-muted-foreground mb-2">
          {page.watermarkRemover?.description || 'Use advanced Inpainting algorithms to easily remove watermarks, logos, and unwanted objects from AI-generated images'}
        </p>
        <p className="text-sm text-muted-foreground">
          Local processing protects your privacy • Supports PNG, JPEG, WebP formats • Completely free to use
        </p>
      </div>

      {/* 使用指南 */}
      <div className="bg-muted/50 rounded-lg p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">使用指南</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-xs flex-shrink-0">
              1
            </div>
            <div>
              <h3 className="font-medium mb-1">上传图片</h3>
              <p className="text-muted-foreground">点击上传按钮或直接拖拽图片到画布区域</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-xs flex-shrink-0">
              2
            </div>
            <div>
              <h3 className="font-medium mb-1">标记区域</h3>
              <p className="text-muted-foreground">用画笔涂抹要移除的水印或对象区域</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-xs flex-shrink-0">
              3
            </div>
            <div>
              <h3 className="font-medium mb-1">选择算法</h3>
              <p className="text-muted-foreground">选择 Telea 或 Navier-Stokes 算法</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-xs flex-shrink-0">
              4
            </div>
            <div>
              <h3 className="font-medium mb-1">处理导出</h3>
              <p className="text-muted-foreground">点击消除按钮处理，然后下载或复制结果</p>
            </div>
          </div>
        </div>
      </div>

      {/* 水印移除组件 */}
      <WatermarkRemover
        defaultAlgorithm="telea"
        algorithms={['telea', 'ns']}
        defaultBrushSize={24}
        maxDimension={2048}
        processingBackend="wasm"
        onProcessStart={(meta) => {
          console.log('Processing started with:', meta)
        }}
        onProcessEnd={(result) => {
          console.log('Processing completed:', result)
        }}
        onError={(error) => {
          console.error('Processing error:', error)
        }}
        className="mb-8"
      />

      {/* 功能特点 */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-card border rounded-lg p-6">
          <h3 className="font-semibold mb-2">🔒 隐私保护</h3>
          <p className="text-sm text-muted-foreground">
            所有处理都在您的浏览器中本地完成，图片不会上传到服务器，完全保护您的隐私。
          </p>
        </div>
        <div className="bg-card border rounded-lg p-6">
          <h3 className="font-semibold mb-2">🎨 智能算法</h3>
          <p className="text-sm text-muted-foreground">
            采用 OpenCV 的 Telea 和 Navier-Stokes 算法，智能填补被移除的区域。
          </p>
        </div>
        <div className="bg-card border rounded-lg p-6">
          <h3 className="font-semibold mb-2">⚡ 高效处理</h3>
          <p className="text-sm text-muted-foreground">
            使用 Web Worker 进行后台处理，确保界面流畅不卡顿。
          </p>
        </div>
        <div className="bg-card border rounded-lg p-6">
          <h3 className="font-semibold mb-2">🖌️ 精确控制</h3>
          <p className="text-sm text-muted-foreground">
            可调节画笔大小，支持撤销重做，精确选择要移除的区域。
          </p>
        </div>
        <div className="bg-card border rounded-lg p-6">
          <h3 className="font-semibold mb-2">📱 响应式设计</h3>
          <p className="text-sm text-muted-foreground">
            完美适配桌面和移动设备，支持触摸操作和手势缩放。
          </p>
        </div>
        <div className="bg-card border rounded-lg p-6">
          <h3 className="font-semibold mb-2">🆓 完全免费</h3>
          <p className="text-sm text-muted-foreground">
            无需注册登录，无使用限制，完全免费使用所有功能。
          </p>
        </div>
      </div>

      {/* 技术说明 */}
      <div className="bg-muted/30 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">技术说明</h2>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            <strong>Telea 算法：</strong> 基于快速行进方法的图像修复算法，适合修复小面积的缺陷，处理速度较快。
          </p>
          <p>
            <strong>Navier-Stokes 算法：</strong> 基于流体动力学原理的修复算法，对于较大区域的修复效果更好，但处理时间稍长。
          </p>
          <p>
            <strong>浏览器兼容性：</strong> 需要现代浏览器支持 WebAssembly 和 Web Worker 技术。建议使用 Chrome、Firefox、Safari 或 Edge 的最新版本。
          </p>
        </div>
      </div>
    </div>
  )
}