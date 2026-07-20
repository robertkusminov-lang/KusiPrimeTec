import { describe, expect, it } from "vitest";
import { nextTicketNumber } from "../src/workflow";

describe("Ticket Erstellung", () => {
  it("erzeugt Ticketnummer im Format KPT-YYYY-XXXX", () => {
    expect(nextTicketNumber(2026, 12)).toBe("KPT-2026-0012");
  });
});


