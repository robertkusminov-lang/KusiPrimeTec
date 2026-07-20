export type CustomerType = "privat" | "firma";

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripControlAndTags(value: string): string {
  const withoutTags = value.replace(/<[^>]*>/g, " ");
  let out = "";
  for (const char of withoutTags) {
    const code = char.charCodeAt(0);
    if ((code >= 0 && code <= 31) || code === 127) {
      out += " ";
    } else {
      out += char;
    }
  }
  return out;
}

function looksLikeSpam(value: string): boolean {
  const raw = value.toLowerCase();
  return raw.includes("testtest") || raw.includes("asdf") || raw.includes("qwerty");
}

function isPlaceholderValue(value: string): boolean {
  const raw = value.trim().toLowerCase();
  return raw === "undefined" || raw === "null";
}

export function sanitizeCustomerText(value: unknown): string {
  const raw = collapseWhitespace(stripControlAndTags(String(value || "")));
  const normalized = raw.replace(/\b(?:undefined|null)\b/gi, " ").replace(/\s+/g, " ").trim();
  const safe = normalized || raw;
  const cleaned = collapseWhitespace(safe);
  if (!cleaned) return "";
  if (isPlaceholderValue(cleaned)) return "";
  if (looksLikeSpam(cleaned)) return "";
  return cleaned.slice(0, 140);
}

export function normalizeCustomerType(value: unknown): CustomerType | null {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return null;
  if (raw === "privat" || raw === "private") return "privat";
  if (
    raw === "firma" ||
    raw === "gewerblich" ||
    raw === "gewerbe" ||
    raw === "unternehmen" ||
    raw === "business" ||
    raw === "company" ||
    raw === "b2b"
  ) {
    return "firma";
  }
  return null;
}

export function normalizeCustomerPhone(value: unknown): string {
  const phone = String(value || "").replace(/[^\d+]/g, "");
  if (!phone) return "";
  if (phone.length < 6 || phone.length > 20) return "";
  if ((phone.match(/\d/g) || []).length < 6) return "";
  return phone;
}

export function normalizeCustomerEmail(value: unknown): string {
  const email = String(value || "").trim().toLowerCase();
  return email;
}

export function resolveInvoiceRecipientName(input: {
  customerType?: unknown;
  invoiceRecipientName?: unknown;
  kundeName?: unknown;
  kundeFirma?: unknown;
  companyName?: unknown;
}): string {
  const type = normalizeCustomerType(input.customerType);
  const explicit = sanitizeCustomerText(input.invoiceRecipientName);
  const person = sanitizeCustomerText(input.kundeName);
  const company = sanitizeCustomerText(input.kundeFirma) || sanitizeCustomerText(input.companyName);

  if (type === "firma") return explicit || company || person;
  return explicit || person || company;
}

export function resolveCustomerDisplayName(input: {
  customerType?: unknown;
  invoiceRecipientName?: unknown;
  kundeName?: unknown;
  kundeFirma?: unknown;
  companyName?: unknown;
}): string {
  const type = normalizeCustomerType(input.customerType);
  const invoice = resolveInvoiceRecipientName(input);
  const company = sanitizeCustomerText(input.kundeFirma) || sanitizeCustomerText(input.companyName);
  const person = sanitizeCustomerText(input.kundeName);

  if (type === "firma") return invoice || company || person;
  return invoice || person || company;
}
