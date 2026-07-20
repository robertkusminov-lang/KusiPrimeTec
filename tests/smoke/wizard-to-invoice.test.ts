import { describe, expect, it } from "vitest";
import { ensureStatusTransition, nextDocumentNumber, nextTicketNumber } from "../src/workflow";

describe("Smoke: Wizard bis Rechnung", () => {
  it("läuft End-to-End Zustandsfolge ohne Bruch", () => {
    const ticket = nextTicketNumber(2026, 1);
    expect(ticket).toBe("KPT-2026-0001");

    expect(ensureStatusTransition("Neu", "Geprueft")).toBe(true);
    expect(ensureStatusTransition("Geprueft", "Termin_geplant")).toBe(true);
    expect(ensureStatusTransition("Termin_geplant", "In_Arbeit")).toBe(true);
    expect(nextDocumentNumber("RAP", 2026, 1)).toBe("RAP-2026-0001");
    expect(nextDocumentNumber("RE", 2026, 1)).toBe("RE-2026-0001");
  });
});


