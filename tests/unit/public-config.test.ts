import { describe, expect, it } from "vitest";
import { NAV_PUBLIC, PUBLIC_PATHS } from "@/data/content";
import { OBJECT_CARE_PACKAGES, PUBLIC_OFFER_CONFIG } from "@/data/publicWebsite";

describe("Öffentliche Angebotskonfiguration", () => {
  it("ordnet die Hauptnavigation entlang der Vertriebsseiten", () => {
    expect(NAV_PUBLIC.map((item) => item.href)).toEqual([
      "/",
      "/objektbetreuung",
      "/objektcheck",
      "/leistungen",
      "/referenzen",
      "/ueber-kusiprimetec",
      "/objektbetreuung-anfrage",
      "/konto/anmelden",
    ]);
  });

  it("priorisiert die Anfragewege korrekt", () => {
    expect(PUBLIC_PATHS.map((item) => item.title)).toEqual([
      "ObjektBetreuung anfragen",
      "ObjektCheck buchen",
      "Einzelauftrag melden",
      "Kundenlogin",
    ]);
    expect(PUBLIC_PATHS[0]?.featured).toBe(true);
  });

  it("hält vier ObjektBetreuungs-Modelle mit Plus-Empfehlung zentral vor", () => {
    expect(OBJECT_CARE_PACKAGES).toHaveLength(4);
    expect(OBJECT_CARE_PACKAGES.find((pkg) => pkg.id === "plus")?.featured).toBe(true);
    expect(OBJECT_CARE_PACKAGES.map((pkg) => pkg.priceLabel)).toEqual([
      "399 € / Monat",
      "599 € / Monat",
      "899 € / Monat",
      "Individuell kalkuliert",
    ]);
  });

  it("hält ObjektCheck, Einzelauftrag und Projektkoordination in einer Quelle", () => {
    expect(PUBLIC_OFFER_CONFIG.objectCheck.priceEur).toBe(249);
    expect(PUBLIC_OFFER_CONFIG.singleOrder.hourlyRateEur).toBe(80);
    expect(PUBLIC_OFFER_CONFIG.singleOrder.serviceCallFlatEur).toBe(39);
    expect(PUBLIC_OFFER_CONFIG.projectCoordination.basePercent).toBe(15);
    expect(PUBLIC_OFFER_CONFIG.projectCoordination.maxComplexityPercent).toBe(20);
  });
});
