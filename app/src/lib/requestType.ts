import { Anfrageart } from "@/types/domain";

export type RequestType = "direct" | "offer";

export function anfrageartToRequestType(value: unknown): RequestType {
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!raw) return "direct";
  if (raw.includes("direkt") || raw.includes("einsatz") || raw.includes("direct")) return "direct";
  if (raw.includes("angebot") || raw.includes("offer")) return "offer";
  return "direct";
}

export function requestTypeToAnfrageart(value: unknown): Anfrageart {
  return anfrageartToRequestType(value) === "offer" ? "angebot_anfordern" : "direkt_einsatz";
}

export function requestTypeLabel(value: unknown): "Direkt Einsatz" | "Angebot anfordern" {
  return anfrageartToRequestType(value) === "offer" ? "Angebot anfordern" : "Direkt Einsatz";
}
