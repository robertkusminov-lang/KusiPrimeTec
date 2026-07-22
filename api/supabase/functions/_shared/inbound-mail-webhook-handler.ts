type EnabledWebhookProcessor = (request: Request) => Promise<Response>;

export function isInboundMailWebhookEnabled(value: string | undefined): boolean {
  return String(value || "").trim().toLowerCase() === "true";
}

function notFound(): Response {
  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export async function handleInboundMailWebhook(
  request: Request,
  enabledValue: string | undefined,
  processEnabledRequest: EnabledWebhookProcessor,
): Promise<Response> {
  if (!isInboundMailWebhookEnabled(enabledValue)) return notFound();
  return processEnabledRequest(request);
}
