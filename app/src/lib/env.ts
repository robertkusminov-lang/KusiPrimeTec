const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || "");
const derivedApiBase = "/api";

const configuredApiBase = String(import.meta.env.VITE_API_BASE || "").trim();
const normalizedConfiguredApiBase =
  configuredApiBase &&
  (configuredApiBase.includes(".functions.supabase.co") || configuredApiBase.includes(".supabase.co/functions/v1"))
    ? "/api"
    : configuredApiBase;

const googleTagIds = Array.from(
  new Set(
    [import.meta.env.VITE_GOOGLE_TAG_ID, import.meta.env.VITE_GOOGLE_ANALYTICS_ID]
      .map((value) => String(value || "").trim())
      .filter(Boolean),
  ),
);

export const ENV = {
  apiBase: String(normalizedConfiguredApiBase || derivedApiBase).replace(/\/+$/, ""),
  supabaseUrl,
  supabaseAnonKey: String(import.meta.env.VITE_SUPABASE_ANON_KEY || ""),
  googleTagIds,
  promoVideoUrl: String(import.meta.env.VITE_PROMO_VIDEO_URL || "/Werbung.mp4").trim(),
  promoVideoPoster: String(import.meta.env.VITE_PROMO_VIDEO_POSTER || "").trim(),
};

if (!ENV.supabaseUrl || !ENV.supabaseAnonKey) {
  // Kein throw im Build: Admin-Login und APIs prüfen selbst auf gültige Session/Config.
  console.warn("Supabase Public ENV fehlt oder ist unvollständig.");
}
