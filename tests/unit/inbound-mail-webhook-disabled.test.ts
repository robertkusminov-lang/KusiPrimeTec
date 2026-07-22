import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  handleInboundMailWebhook,
  isInboundMailWebhookEnabled,
} from "../../api/supabase/functions/_shared/inbound-mail-webhook-handler";

const payloads = [
  {},
  { subject: "KPT-2026-0001", sender: "attacker@example.invalid" },
  { subject: "<script>alert(1)</script>", content: "x".repeat(1024) },
];

describe("disabled inbound mail webhook", () => {
  it.each([undefined, "", "false", "FALSE", "yes", "1"])(
    "defaults to disabled for %s",
    (value) => {
      expect(isInboundMailWebhookEnabled(value)).toBe(false);
    },
  );

  it.each(payloads)("returns a neutral 404 without invoking processing", async (payload) => {
    let processingCalls = 0;
    const request = new Request("https://example.invalid/inbound-mail-webhook", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const response = await handleInboundMailWebhook(request, "false", async () => {
      processingCalls += 1;
      return new Response(null, { status: 204 });
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
    expect(processingCalls).toBe(0);
    expect(request.bodyUsed).toBe(false);
  });

  it("does not process validation tokens, large payloads or retries", async () => {
    let processingCalls = 0;
    const process = async () => {
      processingCalls += 1;
      return new Response(null, { status: 204 });
    };
    const urls = [
      "https://example.invalid/inbound-mail-webhook?validationToken=untrusted",
      "https://example.invalid/inbound-mail-webhook",
      "https://example.invalid/inbound-mail-webhook",
    ];

    for (const [index, url] of urls.entries()) {
      const response = await handleInboundMailWebhook(
        new Request(url, { method: "POST", body: index === 1 ? "x".repeat(2_000_000) : "{}" }),
        undefined,
        process,
      );
      expect(response.status).toBe(404);
    }
    expect(processingCalls).toBe(0);
  });

  it("guards both repository function trees before request processing", () => {
    for (const relativePath of [
      "../../api/supabase/functions/inbound-mail-webhook/index.ts",
      "../../api/functions/inbound-mail-webhook/index.ts",
    ]) {
      const source = readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
      expect(source.indexOf("handleInboundMailWebhook")).toBeLessThan(source.indexOf("req.json()"));
      expect(source.indexOf("handleInboundMailWebhook")).toBeLessThan(source.indexOf("serviceClient()"));
    }
  });
});
