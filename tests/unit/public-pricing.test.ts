import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CARE_PACKAGES,
  HOUSEMASTER_SERVICE_HOURLY_EUR,
  INQUIRY_SELECTIONS,
  PUBLIC_PRICING,
  PUBLIC_SERVICES,
  TECHNICAL_SERVICE_HOURLY_EUR,
} from "../../app/src/config/publicServices";

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

describe("public service pricing", () => {
  it("keeps service and package prices in the central typed configuration", () => {
    expect(HOUSEMASTER_SERVICE_HOURLY_EUR).toBe(64.99);
    expect(TECHNICAL_SERVICE_HOURLY_EUR).toBe(79);
    expect(PUBLIC_PRICING.additionalCareHourEur).toBe(64.99);
    expect(PUBLIC_PRICING.serviceCallFlatEur).toBe(39);
    expect(PUBLIC_SERVICES.map((service) => [service.id, service.priceEur])).toEqual([
      ["hausmeisterservice", 64.99],
      ["stoerungsservice", 79],
    ]);
    expect(CARE_PACKAGES.map((pkg) => [pkg.id, pkg.priceEur, pkg.hours])).toEqual([
      ["basis", 399, 5],
      ["business", 699, 10],
      ["pro", 999, 15],
      ["priority", 1799, 25],
    ]);
  });

  it("provides every supported inquiry value and links package cards to the form", () => {
    expect(INQUIRY_SELECTIONS).toEqual([
      "hausmeisterservice",
      "stoerungsservice",
      "basis",
      "business",
      "pro",
      "priority",
    ]);

    const pricingSections = source("../../app/src/components/public/PricingSections.tsx");
    const inquiryPage = source("../../app/src/pages/public/ObjektbetreuungAnfragePage.tsx");
    expect(pricingSections).toContain("/objektbetreuung-anfrage?auswahl=");
    expect(inquiryPage).toContain('searchParams.get("auswahl")');
    expect(inquiryPage).toContain("INQUIRY_SELECTION_LABELS");
    expect(inquiryPage).toContain("localStorage");
  });

  it("removes legacy public package names, prices and full-hour rounding", () => {
    const publicSources = [
      "../../app/src/pages/public/HomePage.tsx",
      "../../app/src/pages/public/PreisePage.tsx",
      "../../app/src/pages/public/ObjektbetreuungPage.tsx",
      "../../app/src/pages/public/LeistungenPage.tsx",
      "../../app/src/config/publicServices.ts",
    ].map(source).join("\n");

    expect(publicSources).not.toMatch(/Objektbetreuung (Start|Plus|Premium|Individuell)/);
    expect(publicSources).not.toMatch(/\b(489|729|969)\s*€/);
    expect(publicSources).not.toContain("Jede angefangene Stunde wird als volle Stunde abgerechnet");
    expect(publicSources).toContain("15-Minuten-Einheiten");
  });
});
