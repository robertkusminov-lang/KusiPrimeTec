export const SESSION_EXPIRED_MESSAGE = "Sitzung abgelaufen. Bitte erneut anmelden.";
export const GENERIC_UI_ERROR_MESSAGE = "Aktion aktuell nicht möglich. Bitte erneut versuchen.";

export function isAuthTokenErrorMessage(message: unknown): boolean {
  const lower = String(message || "").toLowerCase();
  const isGraphOrMailContext =
    lower.includes("graph") ||
    lower.includes("microsoft") ||
    lower.includes("outlook") ||
    lower.includes("smtp") ||
    lower.includes("sendmail");
  if (isGraphOrMailContext) return false;

  return (
    lower.includes("invalid jwt") ||
    lower.includes("jwt expired") ||
    lower.includes("jwt malformed") ||
    lower.includes("auth session missing") ||
    lower.includes("session missing") ||
    lower.includes("ungueltige session") ||
    lower.includes("ungultige session") ||
    lower.includes("bearer token fehlt") ||
    lower.includes("not authenticated")
  );
}

export function isTechnicalErrorMessage(message: unknown): boolean {
  const lower = String(message || "").toLowerCase();
  return (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("http ") ||
    lower.includes("jwt") ||
    lower.includes("authorization") ||
    lower.includes("unauthorized") ||
    lower.includes("forbidden") ||
    lower.includes("supabase") ||
    lower.includes("schema") ||
    lower.includes("column") ||
    lower.includes("constraint") ||
    lower.includes("cannot coerce the result to a single json object") ||
    lower.includes("json object requested") ||
    lower.includes("syntax error") ||
    lower.includes("stack") ||
    lower.includes("trace")
  );
}

export function normalizeUiErrorMessage(message: unknown, fallback = "Ein Fehler ist aufgetreten."): string {
  const text = String(message || "").trim();
  if (isAuthTokenErrorMessage(text)) return SESSION_EXPIRED_MESSAGE;
  if (isTechnicalErrorMessage(text)) return fallback || GENERIC_UI_ERROR_MESSAGE;
  return text || fallback;
}

export function toUserMessage(error: unknown, fallback = "Ein Fehler ist aufgetreten."): string {
  if (error instanceof Error) return normalizeUiErrorMessage(error.message, fallback);
  return normalizeUiErrorMessage(error, fallback);
}
