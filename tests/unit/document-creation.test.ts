import { describe, expect, it } from "vitest";
import { nextDocumentNumber } from "../src/workflow";

describe("Dokument Erstellung", () => {
  it("erzeugt Dokumentnummern für Angebot/Rapport/Rechnung", () => {
    expect(nextDocumentNumber("ANG", 2026, 5)).toBe("ANG-2026-0005");
    expect(nextDocumentNumber("RAP", 2026, 5)).toBe("RAP-2026-0005");
    expect(nextDocumentNumber("RE", 2026, 5)).toBe("RE-2026-0005");
  });
});


