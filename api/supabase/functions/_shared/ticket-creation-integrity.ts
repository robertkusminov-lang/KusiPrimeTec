export type TicketAttachmentInput = {
  name?: unknown;
  type?: unknown;
  base64?: unknown;
  size?: unknown;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_SIZE_BYTES = 20 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "application/pdf"]);
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "pdf"]);

export function normalizeIdempotencyKey(value: unknown): string | null {
  const key = String(value || "").trim().toLowerCase();
  return UUID_PATTERN.test(key) ? key : null;
}

function decodedBase64Length(value: string): number {
  if (!value) return 0;
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return (value.length / 4) * 3 - padding;
}

export function validateTicketAttachments(input: TicketAttachmentInput[]): string | null {
  if (input.length > MAX_ATTACHMENTS) return `Maximal ${MAX_ATTACHMENTS} Anhänge pro Ticket sind erlaubt.`;

  let totalSize = 0;
  for (const attachment of input) {
    const name = String(attachment.name || "").trim();
    const type = String(attachment.type || "").trim().toLowerCase();
    const size = Number(attachment.size);
    const base64 = String(attachment.base64 || "").trim();
    const extension = name.split(".").pop()?.toLowerCase() || "";

    if (!name || name.length > 180 || /[\u0000-\u001f\u007f]/.test(name)) return "Ungültiger Dateiname.";
    if (!ALLOWED_TYPES.has(type) || !ALLOWED_EXTENSIONS.has(extension)) return `${name}: Dateityp nicht erlaubt.`;
    if (!Number.isInteger(size) || size <= 0 || size > MAX_ATTACHMENT_SIZE_BYTES) {
      return `${name}: Datei ist größer als 10 MB oder ungültig.`;
    }
    if (!base64 || base64.length % 4 !== 0 || !BASE64_PATTERN.test(base64)) return `${name}: Dateiinhalte sind ungültig.`;
    if (decodedBase64Length(base64) !== size) return `${name}: Dateigröße stimmt nicht mit dem Inhalt überein.`;

    totalSize += size;
    if (totalSize > MAX_TOTAL_ATTACHMENT_SIZE_BYTES) return "Anhänge überschreiten zusammen 20 MB.";
  }
  return null;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== "idempotency_key")
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stableValue(item)]),
  );
}

export async function ticketPayloadHash(payload: Record<string, unknown>): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(stableValue(payload)));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
