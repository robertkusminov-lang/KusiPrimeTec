import { describe, expect, it } from "vitest";
import { getMobileStickyCta, shouldHideMobileStickyCta } from "@/lib/publicCta";

describe("Mobile Sticky CTA", () => {
  it("liefert routebezogene CTA-Texte", () => {
    expect(getMobileStickyCta("/")).toEqual({
      href: "/objektbetreuung-anfrage?anliegen=objektbetreuung",
      label: "ObjektBetreuung anfragen",
    });
    expect(getMobileStickyCta("/objektbetreuung")).toEqual({
      href: "/objektbetreuung-anfrage?anliegen=objektbetreuung",
      label: "Betreuung anfragen",
    });
    expect(getMobileStickyCta("/objektcheck")).toEqual({
      href: "/objektbetreuung-anfrage?anliegen=objektcheck",
      label: "ObjektCheck anfragen",
    });
    expect(getMobileStickyCta("/leistungen")).toEqual({
      href: "/objektbetreuung",
      label: "ObjektBetreuung prüfen",
    });
    expect(getMobileStickyCta("/einzelauftrag")).toEqual({
      href: "/einzelauftrag",
      label: "Einzelauftrag melden",
    });
  });

  it("blendet den CTA auf geschützten und juristischen Routen aus", () => {
    expect(shouldHideMobileStickyCta("/buchen")).toBe(true);
    expect(shouldHideMobileStickyCta("/objektbetreuung-anfrage")).toBe(true);
    expect(shouldHideMobileStickyCta("/konto/anmelden")).toBe(true);
    expect(shouldHideMobileStickyCta("/konto/rapport/123")).toBe(true);
    expect(shouldHideMobileStickyCta("/admin")).toBe(true);
    expect(shouldHideMobileStickyCta("/impressum")).toBe(true);
    expect(getMobileStickyCta("/datenschutz")).toBeNull();
  });
});
