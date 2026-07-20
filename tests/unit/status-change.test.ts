import { describe, expect, it } from "vitest";
import { ensureStatusTransition } from "../src/workflow";

describe("Status Änderung", () => {
  it("erlaubt Fortschritt im Workflow", () => {
    expect(ensureStatusTransition("Neu", "Termin_geplant")).toBe(true);
  });

  it("verbietet Rücksprung ohne Storno", () => {
    expect(ensureStatusTransition("Rechnung_gesendet", "In_Arbeit")).toBe(false);
  });
});


