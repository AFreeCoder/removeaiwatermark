import FAQ from "@/components/blocks/faq";
import Feature1 from "@/components/blocks/feature1";
import Feature3 from "@/components/blocks/feature3";
import Hero from "@/components/blocks/hero";
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
    title: page.metadata?.title,
    description: page.metadata?.description,
    openGraph: {
      title: page.metadata?.title,
      description: page.metadata?.description,
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
      {/* Hero 区域 */}
      {page.hero && <Hero hero={page.hero} />}

      {/* 水印移除工具区域 */}
      {page.watermarkRemover && (
        <section id="watermark-remover" className="py-16 bg-muted/30">
          <div className="container mx-auto px-4">
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