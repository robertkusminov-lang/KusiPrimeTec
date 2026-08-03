import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

describe("public qualification sections", () => {
  const home = source("../../app/src/pages/public/HomePage.tsx");
  const services = source("../../app/src/pages/public/LeistungenPage.tsx");

  it("places the detailed trust section before the final home CTA", () => {
    const trustIndex = home.indexOf("Warum KusiPrimeTec");
    const qualificationsIndex = home.indexOf("Fachlich qualifiziert. Praktisch erfahren.");
    const finalCtaIndex = home.indexOf("Struktur beginnt mit einer klaren Anfrage.");

    expect(trustIndex).toBeGreaterThan(-1);
    expect(qualificationsIndex).toBeGreaterThan(trustIndex);
    expect(finalCtaIndex).toBeGreaterThan(qualificationsIndex);
    expect(home).toContain('aria-labelledby="qualifications-heading"');
    expect(home).toContain('to="/buchen"');
    expect(home).toContain("Qualifikationsnachweise stellen wir Geschäftskunden auf Anfrage zur Verfügung.");
  });

  it("adds the compact qualification context to the services page", () => {
    expect(services).toContain("Fachliche Grundlage unserer Leistungen");
    expect(services).toContain('aria-labelledby="service-qualifications-heading"');
    expect(services).toContain("Arbeiten außerhalb des zulässigen Leistungsrahmens");
  });

  it("avoids prohibited claims and public certificate assets", () => {
    const changedPages = `${home}\n${services}`;
    const prohibitedClaims = [
      "ETZ-zertifizierter Fachbetrieb",
      "zertifizierter Elektrobetrieb",
      "staatlich geprüfter Elektrobetrieb",
      "Elektrofachbetrieb",
      "11 Zertifizierungen",
      "amtlich zertifiziert",
      "HWK-zertifizierter Betrieb",
      "berechtigt zur Ausführung sämtlicher Elektroarbeiten",
    ];

    prohibitedClaims.forEach((claim) => expect(changedPages).not.toContain(claim));
    expect(changedPages).not.toMatch(/(?:zeugnis|qualifikation)[^\n]*(?:\.pdf|download)/i);
  });
});
