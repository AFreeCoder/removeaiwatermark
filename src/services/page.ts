import { LandingPage, PricingPage, ShowcasePage, RemoveGeminiWatermarkPage } from "@/types/pages/landing";

export async function getLandingPage(locale: string): Promise<LandingPage> {
  return (await getPage("landing", locale)) as LandingPage;
}

export async function getPricingPage(locale: string): Promise<PricingPage> {
  return (await getPage("pricing", locale)) as PricingPage;
}

export async function getShowcasePage(locale: string): Promise<ShowcasePage> {
  return (await getPage("showcase", locale)) as ShowcasePage;
}

export async function getRemoveGeminiWatermarkPage(locale: string): Promise<RemoveGeminiWatermarkPage> {
  return (await getPage("remove-gemini-watermark", locale)) as RemoveGeminiWatermarkPage;
}

export async function getPage(
  name: string,
  locale: string
): Promise<LandingPage | PricingPage | ShowcasePage | RemoveGeminiWatermarkPage> {
  try {
    if (locale === "zh-CN") {
      locale = "zh";
    }

    return await import(
      `@/i18n/pages/${name}/${locale.toLowerCase()}.json`
    ).then((module) => module.default);
  } catch (error) {
    console.warn(`Failed to load ${locale}.json, falling back to en.json`);

    return await import(`@/i18n/pages/${name}/en.json`).then(
      (module) => module.default
    );
  }
}
