import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

describe("Google tag integration", () => {
  it("combines advertising and analytics IDs without loading gtag.js twice", () => {
    const htmlSource = source("../../app/index.html");
    const envSource = source("../../app/src/lib/env.ts");
    const tagSource = source("../../app/src/lib/googleTag.ts");

    expect(htmlSource).toContain("https://www.googletagmanager.com/gtag/js?id=G-86B0JHQ7LM");
    expect(htmlSource).toContain('gtag("config", "G-86B0JHQ7LM"');
    expect(envSource).toContain("VITE_GOOGLE_TAG_ID");
    expect(envSource).toContain("VITE_GOOGLE_ANALYTICS_ID");
    expect(envSource).toContain("new Set");
    expect(tagSource).toContain("script[data-kpt-gtag]");
    expect(tagSource).toContain('script[src^="https://www.googletagmanager.com/gtag/js"]');
    expect(tagSource).toContain("tagIds.forEach");
    expect(tagSource).toContain('window.gtag?.("config", tagId');
    expect(tagSource).toContain('window.gtag?.("event", "page_view"');
    expect(tagSource).toContain("export function trackGoogleEvent");
    expect(tagSource).toContain('getAnalyticsConsent() !== "granted"');
    expect(tagSource).toContain('.filter((tagId) => tagId.startsWith("G-"))');
  });

  it("defaults Consent Mode v2 to denied and enables tracking only after consent", () => {
    const htmlSource = source("../../app/index.html");
    const consentBanner = source("../../app/src/components/layout/ConsentBanner.tsx");
    const appSource = source("../../app/src/App.tsx");
    const tagSource = source("../../app/src/lib/googleTag.ts");

    expect(htmlSource).toContain('gtag("consent", "default"');
    expect(htmlSource).toContain('analytics_storage: "denied"');
    expect(htmlSource).toContain('ad_user_data: "denied"');
    expect(htmlSource).toContain('ad_personalization: "denied"');
    expect(consentBanner).toContain("ENV.googleTagIds.length");
    expect(consentBanner).toContain('setAnalyticsConsent("granted")');
    expect(appSource).toContain('getAnalyticsConsent() === "granted"');
    expect(appSource).toContain("initGoogleTag()");
    expect(appSource).toContain("updateGoogleTagConsent(granted)");
    expect(tagSource).toContain('window.gtag("consent", "update"');
  });

  it("tracks conversion signals without sending contact or ticket data", () => {
    const pricingSource = source("../../app/src/components/public/PricingSections.tsx");
    const inquirySource = source("../../app/src/pages/public/ObjektbetreuungAnfragePage.tsx");
    const bookingSource = source("../../app/src/features/booking/BookingWizard.tsx");

    expect(pricingSource).toContain('trackGoogleEvent("care_package_click"');
    expect(pricingSource).toContain('trackGoogleEvent("service_inquiry_click"');
    expect(inquirySource).toContain('trackGoogleEvent("lead_form_submit"');
    expect(bookingSource).toContain('trackGoogleEvent("lead_form_submit"');
    expect(inquirySource).not.toContain("trackGoogleEvent(\"lead_form_submit\", {\n        email:");
    expect(bookingSource).not.toContain("ticket_nummer: result.ticket_nummer,\n        send_to");
  });
});
