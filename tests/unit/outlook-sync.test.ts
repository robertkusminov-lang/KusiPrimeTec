import { describe, expect, it } from "vitest";
import { assignInboundMessageToTicket } from "../src/workflow";

describe("Outlook Sync", () => {
  it("ordnet Antwortmail der Ticketnummer zu", () => {
    const ticket = assignInboundMessageToTicket("Re: Rückfrage zu KPT-2026-0412");
    expect(ticket).toBe("KPT-2026-0412");
  });

  it("liefert null ohne Ticketnummer", () => {
    expect(assignInboundMessageToTicket("Allgemeine Anfrage")).toBeNull();
  });
});


