export const SUPPORT_OPTIONS = [
  "ObjektBetreuung",
  "ObjektCheck Gewerbe",
  "individuelles Betreuungskonzept",
  "unverbindliche Erstabstimmung",
] as const;

export const QUERY_TO_SUPPORT: Record<string, string> = {
  objektbetreuung: "ObjektBetreuung",
  objektcheck: "ObjektCheck Gewerbe",
  individuell: "individuelles Betreuungskonzept",
  erstabstimmung: "unverbindliche Erstabstimmung",
} as const;

export function resolveDesiredSupport(value: string | null): string {
  const normalized = String(value || "").trim().toLowerCase();
  return QUERY_TO_SUPPORT[normalized] || "";
}
