import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createTicketSubmissionGuard } from "../../app/src/features/booking/submissionGuard";
import {
  normalizeIdempotencyKey,
  ticketPayloadHash,
  validateTicketAttachments,
} from "../../api/supabase/functions/_shared/ticket-creation-integrity";

describe("ticket creation integrity", () => {
  it("locks synchronous duplicate submissions and reuses the key after failure", () => {
    let sequence = 0;
    const guard = createTicketSubmissionGuard(() => `key-${++sequence}`);
    expect(guard.begin()).toBe("key-1");
    expect(guard.begin()).toBeNull();
    guard.finish(false);
    expect(guard.begin()).toBe("key-1");
    guard.finish(true);
    expect(guard.begin()).toBe("key-2");
  });

  it("accepts UUID keys and binds a key to a stable payload hash", async () => {
    const key = "550e8400-e29b-41d4-a716-446655440000";
    expect(normalizeIdempotencyKey(key)).toBe(key);
    expect(normalizeIdempotencyKey("not-a-uuid")).toBeNull();
    expect(await ticketPayloadHash({ b: 2, a: 1, idempotency_key: key })).toBe(
      await ticketPayloadHash({ a: 1, b: 2, idempotency_key: crypto.randomUUID() }),
    );
    expect(await ticketPayloadHash({ a: 2 })).not.toBe(await ticketPayloadHash({ a: 1 }));
  });

  it("validates attachment bytes before any ticket write", () => {
    const valid = { name: "foto.jpg", type: "image/jpeg", size: 3, base64: "AQID" };
    expect(validateTicketAttachments([valid])).toBeNull();
    expect(validateTicketAttachments([{ ...valid, base64: "not-base64" }])).toContain("Dateiinhalte");
    expect(validateTicketAttachments([{ ...valid, size: 4 }])).toContain("Dateigröße");
    expect(validateTicketAttachments([{ ...valid, type: "text/html", name: "angriff.html" }])).toContain("Dateityp");
  });

  it("uses a database-enforced unique request and explicit rollback path", () => {
    const migration = readFileSync(
      fileURLToPath(new URL("../../api/supabase/migrations/20260722210000_ticket_creation_idempotency.sql", import.meta.url)),
      "utf8",
    );
    const edgeFunction = readFileSync(
      fileURLToPath(new URL("../../api/supabase/functions/create-ticket/index.ts", import.meta.url)),
      "utf8",
    );
    expect(migration).toContain("idempotency_key uuid primary key");
    expect(migration).toContain("processing_token uuid not null");
    expect(edgeFunction.indexOf("validateTicketAttachments")).toBeLessThan(edgeFunction.indexOf('rpc("next_ticket_number")'));
    expect(edgeFunction).toContain("rollbackTicketCreation");
    expect(edgeFunction).toContain("finishTicketCreation");
  });
});
