import { describe, expect, it } from "vitest";
import { QUERY_TO_SUPPORT, SUPPORT_OPTIONS, resolveDesiredSupport } from "@/lib/publicInquiry";

describe("ObjektBetreuungs-Anfrage URL-Vorbelegung", () => {
  it("lässt nur die freigegebenen Support-Optionen zu", () => {
    expect(SUPPORT_OPTIONS).toEqual([
      "ObjektBetreuung",
      "ObjektCheck Gewerbe",
      "individuelles Betreuungskonzept",
      "unverbindliche Erstabstimmung",
    ]);
  });

  it("ordnet Query-Parameter sauber den Support-Werten zu", () => {
    expect(resolveDesiredSupport("objektbetreuung")).toBe("ObjektBetreuung");
    expect(resolveDesiredSupport("objektcheck")).toBe("ObjektCheck Gewerbe");
    expect(resolveDesiredSupport("individuell")).toBe("individuelles Betreuungskonzept");
    expect(resolveDesiredSupport("erstabstimmung")).toBe("unverbindliche Erstabstimmung");
    expect(resolveDesiredSupport("unbekannt")).toBe("");
    expect(resolveDesiredSupport(null)).toBe("");
  });

  it("deckt die freigegebenen URL-Werte vollständig ab", () => {
    expect(Object.keys(QUERY_TO_SUPPORT).sort()).toEqual([
      "erstabstimmung",
      "individuell",
      "objektbetreuung",
      "objektcheck",
    ]);
  });
});
