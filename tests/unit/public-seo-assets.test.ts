import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeStructuredData, toAbsoluteUrl } from "@/hooks/useSeo";

const publicDir = path.resolve(__dirname, "../../app/public");
const robotsTxt = readFileSync(path.join(publicDir, "robots.txt"), "utf8");
const sitemapXml = readFileSync(path.join(publicDir, "sitemap.xml"), "utf8");
const expectedIndexableRoutes = [
  "/",
  "/objektbetreuung",
  "/objektcheck",
  "/leistungen",
  "/referenzen",
  "/ueber-kusiprimetec",
  "/preise",
  "/ablauf",
  "/buchen",
  "/einzelauftrag",
  "/objektbetreuung-anfrage",
  "/impressum",
  "/datenschutz",
  "/agb",
  "/widerruf",
  "/haftung-koordination",
] as const;

describe("Öffentliche SEO-Dateien", () => {
  it("erzeugt absolute Canonical-URLs", () => {
    expect(toAbsoluteUrl("/objektcheck")).toBe("https://kusiprimetec.de/objektcheck");
    expect(toAbsoluteUrl("leistungen")).toBe("https://kusiprimetec.de/leistungen");
  });

  it("normalisiert strukturierte Daten in einen Schema.org-Graphen", () => {
    expect(
      normalizeStructuredData([
        { "@type": "Service", name: "ObjektCheck Gewerbe" },
        { "@type": "Service", name: "ObjektBetreuung" },
      ]),
    ).toEqual({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "Service", name: "ObjektCheck Gewerbe" },
        { "@type": "Service", name: "ObjektBetreuung" },
      ],
    });
  });

  it("veröffentlicht robots.txt mit Sitemap-Hinweis", () => {
    expect(robotsTxt).toContain("User-agent: *");
    expect(robotsTxt).toContain("Allow: /");
    expect(robotsTxt).toContain("Sitemap: https://kusiprimetec.de/sitemap.xml");
  });

  it("enthält alle indexierbaren öffentlichen Routen in der Sitemap", () => {
    expectedIndexableRoutes.forEach((route) => {
      expect(sitemapXml).toContain(`<loc>${toAbsoluteUrl(route)}</loc>`);
    });
    expect(sitemapXml).not.toContain("/konto/anmelden");
    expect(sitemapXml).not.toContain("/konto/rapport/");
    expect(sitemapXml).not.toContain("/admin");
  });
});
