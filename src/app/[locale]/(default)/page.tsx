import Branding from "@/components/blocks/branding";
import CTA from "@/components/blocks/cta";
import FAQ from "@/components/blocks/faq";
import Feature from "@/components/blocks/feature";
import Feature1 from "@/components/blocks/feature1";
import Feature2 from "@/components/blocks/feature2";
import Feature3 from "@/components/blocks/feature3";
import Hero from "@/components/blocks/hero";
import Pricing from "@/components/blocks/pricing";
import Showcase from "@/components/blocks/showcase";
import Stats from "@/components/blocks/stats";
import Testimonial from "@/components/blocks/testimonial";
import { getLandingPage } from "@/services/page";
import WatermarkRemover from "@/components/watermark-remover";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  let canonicalUrl = `${process.env.NEXT_PUBLIC_WEB_URL}`;

  if (locale !== "en") {
    canonicalUrl = `${process.env.NEXT_PUBLIC_WEB_URL}/${locale}`;
  }

  return {
    alternates: {
      canonical: canonicalUrl,
    },
  };
}

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const page = await getLandingPage(locale);

  return (
    <>
      {page.hero && <Hero hero={page.hero} />}
      {/* {page.branding && <Branding section={page.branding} />} */}
      
      {/* 水印移除工具 */}
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
      {page.introduce && <Feature1 section={page.introduce} />}
      {page.benefit && <Feature2 section={page.benefit} />}
      {page.usage && (
        <Feature3
          section={{
            ...page.usage,
            // If no top-level image is set for usage,
            // strip item images to avoid rendering the large image area.
            items: !page.usage.image
              ? page.usage.items?.map((item) => ({ ...item, image: undefined }))
              : page.usage.items,
          }}
        />
      )}
      {page.feature && <Feature section={page.feature} />}
      {page.showcase && <Showcase section={page.showcase} />}
      {page.stats && <Stats section={page.stats} />}
      {/* {page.pricing && <Pricing pricing={page.pricing} />} */}
      {page.testimonial && <Testimonial section={page.testimonial} />}
      {page.faq && <FAQ section={page.faq} />}
      {page.cta && <CTA section={page.cta} />}
    </>
  );
}
