import FAQ from "@/components/blocks/faq";
import Feature1 from "@/components/blocks/feature1";
import Feature3 from "@/components/blocks/feature3";
import { getRemoveGeminiWatermarkPage } from "@/services/page";
import WatermarkRemover from "@/components/watermark-remover";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const page = await getRemoveGeminiWatermarkPage(locale);

  let canonicalUrl = `${process.env.NEXT_PUBLIC_WEB_URL}/remove-gemini-watermark`;

  if (locale !== "en") {
    canonicalUrl = `${process.env.NEXT_PUBLIC_WEB_URL}/${locale}/remove-gemini-watermark`;
  }

  return {
    title: page.watermarkRemover?.title,
    description: page.watermarkRemover?.description,
    openGraph: {
      title: page.watermarkRemover?.title,
      description: page.watermarkRemover?.description,
      url: canonicalUrl,
      type: 'website',
    },
    alternates: {
      canonical: canonicalUrl,
    },
  };
}

export default async function RemoveGeminiWatermarkPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const page = await getRemoveGeminiWatermarkPage(locale);

  return (
    <>
      {/* 水印移除工具区域 - 包含标题和描述 */}
      {page.watermarkRemover && (
        <section id="watermark-remover" className="py-16 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold mb-4">
                {page.watermarkRemover.title}
              </h1>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                {page.watermarkRemover.description}
              </p>
            </div>
            <WatermarkRemover
              defaultAlgorithm="telea"
              algorithms={['telea', 'ns']}
              defaultBrushSize={24}
              maxDimension={2048}
              processingBackend="wasm"
              className="max-w-6xl mx-auto"
            />
          </div>
        </section>
      )}

      {/* What is Gemini Watermark 说明部分 */}
      {page.whatIsGemini && <Feature1 section={page.whatIsGemini} />}

      {/* How to Remove 教程部分 */}
      {page.howToRemove && (
        <Feature3
          section={{
            ...page.howToRemove,
            // 如果没有顶级图片设置，则去除单项图片避免渲染大图区域
            items: !page.howToRemove.image
              ? page.howToRemove.items?.map((item) => ({ ...item, image: undefined }))
              : page.howToRemove.items,
          }}
        />
      )}

      {/* FAQ 常见问题部分 */}
      {page.faq && <FAQ section={page.faq} />}
    </>
  );
}