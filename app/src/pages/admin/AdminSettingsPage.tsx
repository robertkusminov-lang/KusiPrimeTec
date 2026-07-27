import React from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { GlassCard } from "@/components/ui/GlassCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Toast } from "@/components/ui/Toast";
import { PREISE } from "@/data/content";
import { toUserMessage } from "@/lib/errors";
import { apiPost } from "@/lib/api";
import { supabase } from "@/lib/supabase";

type LocalAdminSettings = {
  kontaktName: string;
  kontaktEmail: string;
  kontaktTelefon: string;
  standardStundensatz: number;
  standardEinsatzpauschale: number;
  slaBestaetigungStunden: number;
  slaTerminStunden: number;
  includeArbeitsstunden: boolean;
  includeEinsatzpauschale: boolean;
};

const STORAGE_KEY = "kpt_admin_settings_v1";

const DEFAULTS: LocalAdminSettings = {
  kontaktName: "",
  kontaktEmail: "",
  kontaktTelefon: "",
  standardStundensatz: PREISE.stundensatz,
  standardEinsatzpauschale: PREISE.einsatzpauschale,
  slaBestaetigungStunden: 24,
  slaTerminStunden: 48,
  includeArbeitsstunden: true,
  includeEinsatzpauschale: true,
};

function loadSettings(): LocalAdminSettings {
  if (typeof window === "undefined") return DEFAULTS;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<LocalAdminSettings>;
    const numberOrDefault = (value: unknown, fallback: number): number => {
      const number = Number(value);
      return Number.isFinite(number) ? number : fallback;
    };
    return {
      ...DEFAULTS,
      ...parsed,
      standardStundensatz: numberOrDefault(parsed.standardStundensatz, DEFAULTS.standardStundensatz),
      standardEinsatzpauschale: numberOrDefault(parsed.standardEinsatzpauschale, DEFAULTS.standardEinsatzpauschale),
      slaBestaetigungStunden: numberOrDefault(parsed.slaBestaetigungStunden, DEFAULTS.slaBestaetigungStunden),
      slaTerminStunden: numberOrDefault(parsed.slaTerminStunden, DEFAULTS.slaTerminStunden),
    };
  } catch {
    return DEFAULTS;
  }
}

function settingsFingerprint(value: LocalAdminSettings): string {
  return JSON.stringify(value);
}

function validateSettings(settings: LocalAdminSettings): string {
  const email = settings.kontaktEmail.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Bitte eine gültige E-Mail-Adresse eingeben.";
  }
  if (!Number.isFinite(settings.standardStundensatz) || settings.standardStundensatz < 0) {
    return "Der Stundensatz muss eine positive Zahl oder 0 sein.";
  }
  if (!Number.isFinite(settings.standardEinsatzpauschale) || settings.standardEinsatzpauschale < 0) {
    return "Die Einsatzpauschale muss eine positive Zahl oder 0 sein.";
  }
  if (!Number.isFinite(settings.slaBestaetigungStunden) || settings.slaBestaetigungStunden < 1) {
    return "Die Bestätigungszeit muss mindestens 1 Stunde betragen.";
  }
  if (!Number.isFinite(settings.slaTerminStunden) || settings.slaTerminStunden < 1) {
    return "Die Terminzeit muss mindestens 1 Stunde betragen.";
  }
  return "";
}

export default function AdminSettingsPage() {
  const [adminEmail, setAdminEmail] = React.useState("");
  const [loadingEmail, setLoadingEmail] = React.useState(true);
  const [settings, setSettings] = React.useState<LocalAdminSettings>(() => loadSettings());
  const [savedSettings, setSavedSettings] = React.useState<LocalAdminSettings>(() => loadSettings());
  const [saving, setSaving] = React.useState(false);
  const [toast, setToast] = React.useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [graphLoading, setGraphLoading] = React.useState(true);
  const [graphConnected, setGraphConnected] = React.useState(false);
  const [graphExpiresAt, setGraphExpiresAt] = React.useState<string | null>(null);
  const [graphBusy, setGraphBusy] = React.useState(false);
  const [pendingCriticalAction, setPendingCriticalAction] = React.useState<"disconnect" | "clear" | null>(null);
  const [criticalActionError, setCriticalActionError] = React.useState("");
  const isDirty = settingsFingerprint(settings) !== settingsFingerprint(savedSettings);

  React.useEffect(() => {
    const warning = "Es gibt noch nicht gespeicherte Änderungen. Möchtest du die Seite wirklich verlassen?";
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = warning;
    };
    const handleDocumentClick = (event: MouseEvent) => {
      if (!isDirty || event.defaultPrevented || event.button !== 0) return;
      const target = event.target as Element | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.download) return;
      if (!window.confirm(warning)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [isDirty]);

  React.useEffect(() => {
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        setAdminEmail(data.session?.user?.email || "");
      } catch (err) {
        setToast({ kind: "error", text: toUserMessage(err, "Session konnte nicht gelesen werden.") });
      } finally {
        setLoadingEmail(false);
      }
    })();
  }, []);

  async function getAccessToken(): Promise<string> {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.access_token) throw new Error("Session fehlt. Bitte neu anmelden.");
    return data.session.access_token;
  }

  const refreshGraphStatus = React.useCallback(async () => {
    setGraphLoading(true);
    try {
      const token = await getAccessToken();
      const res = await apiPost<{}, { connected: boolean; expires_at?: string | null }>("graph-status", {}, token);
      setGraphConnected(Boolean(res.connected));
      setGraphExpiresAt(res.expires_at || null);
    } catch (err) {
      setGraphConnected(false);
      setGraphExpiresAt(null);
      setToast({ kind: "error", text: toUserMessage(err, "Outlook-Status konnte nicht geladen werden.") });
    } finally {
      setGraphLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refreshGraphStatus();
  }, [refreshGraphStatus]);

  async function connectOutlook() {
    setGraphBusy(true);
    setToast(null);
    try {
      const token = await getAccessToken();
      const res = await apiPost<{}, { auth_url: string }>("graph-connect", {}, token);
      if (!res.auth_url) throw new Error("Auth-URL fehlt.");
      window.open(res.auth_url, "_blank", "noopener,noreferrer");
      setToast({ kind: "ok", text: "Outlook-Login geöffnet. Nach Freigabe Seite neu laden." });
    } catch (err) {
      setToast({ kind: "error", text: toUserMessage(err, "Outlook-Verbindung konnte nicht gestartet werden.") });
    } finally {
      setGraphBusy(false);
    }
  }

  async function disconnectOutlook() {
    setGraphBusy(true);
    setToast(null);
    setCriticalActionError("");
    try {
      const token = await getAccessToken();
      await apiPost<{}, { ok: true }>("graph-disconnect", {}, token);
      await refreshGraphStatus();
      setToast({ kind: "ok", text: "Outlook-Verbindung getrennt." });
      setPendingCriticalAction(null);
    } catch (err) {
      const message = toUserMessage(err, "Outlook-Verbindung konnte nicht getrennt werden.");
      setCriticalActionError(message);
      setToast({ kind: "error", text: message });
    } finally {
      setGraphBusy(false);
    }
  }

  function patch<K extends keyof LocalAdminSettings>(key: K, value: LocalAdminSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setToast(null);
  }

  async function save() {
    if (typeof window === "undefined") return;
    const validationError = validateSettings(settings);
    if (validationError) {
      setToast({ kind: "error", text: validationError });
      return;
    }
    setSaving(true);
    setToast(null);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      setSavedSettings(settings);
      setToast({ kind: "ok", text: "Einstellungen gespeichert und erneut geprüft." });
    } catch (err) {
      console.error("Lokale Einstellungen konnten nicht gespeichert werden.", err);
      setToast({ kind: "error", text: "Die Änderungen konnten nicht gespeichert werden." });
    } finally {
      setSaving(false);
    }
  }

  function resetDefaults() {
    setSettings(DEFAULTS);
    setToast({ kind: "ok", text: "Auf Standardwerte zurückgesetzt. Bitte speichern." });
  }

  function clearLocalSettings() {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      setSettings(DEFAULTS);
      setSavedSettings(DEFAULTS);
      setToast({ kind: "ok", text: "Lokale Einstellungen gelöscht." });
      setPendingCriticalAction(null);
      return;
    } catch (err) {
      console.error("Lokale Einstellungen konnten nicht gelöscht werden.", err);
      const message = "Lokale Einstellungen konnten nicht gelöscht werden.";
      setCriticalActionError(message);
      setToast({ kind: "error", text: message });
      return;
    }
  }

  return (
    <div className="space-y-4 page-enter">
      <SectionTitle title="Einstellungen" subtitle="Profil, Standardwerte und Wartung" />
      {toast ? <Toast kind={toast.kind} text={toast.text} /> : null}

      <GlassCard className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-white">Speicherstatus</p>
          <p className={isDirty ? "mt-1 text-sm text-amber-200" : "mt-1 text-sm text-emerald-200"}>
            {isDirty ? "Nicht gespeicherte Änderungen vorhanden" : "Alle lokalen Änderungen gespeichert"}
          </p>
        </div>
        <Button className="min-h-11 w-full sm:w-auto" disabled={saving || !isDirty} onClick={() => void save()}>
          {saving ? "Speichert..." : "Änderungen speichern"}
        </Button>
      </GlassCard>

      <GlassCard className="p-4">
        <h2 className="font-semibold text-white">Admin-Profil</h2>
        <p className="mt-2 text-sm text-[var(--text-soft)]">
          Diese Angaben werden lokal gespeichert und für Vorbelegungen im Admin genutzt.
        </p>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span>Name</span>
            <input
              className="premium-input min-h-11 px-3 py-2"
              value={settings.kontaktName}
              onChange={(e) => patch("kontaktName", e.target.value)}
              placeholder="z. B. Robert Kusminov"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span>E-Mail</span>
            <input
              className="premium-input min-h-11 px-3 py-2"
              value={settings.kontaktEmail}
              onChange={(e) => patch("kontaktEmail", e.target.value)}
              placeholder="name@firma.de"
            />
          </label>

          <label className="grid gap-1 text-sm md:col-span-2">
            <span>Telefon</span>
            <input
              className="premium-input min-h-11 px-3 py-2"
              value={settings.kontaktTelefon}
              onChange={(e) => patch("kontaktTelefon", e.target.value)}
              placeholder="+49 ..."
            />
          </label>
        </div>

        <div className="mt-3">
          {loadingEmail ? (
            <LoadingSpinner label="Session wird geprüft..." />
          ) : (
            <p className="text-xs text-[var(--text-soft)]">Aktive Admin-Session: {adminEmail || "nicht erkannt"}</p>
          )}
        </div>
      </GlassCard>

      <GlassCard className="p-4">
        <h2 className="font-semibold text-white">Outlook Verbindung</h2>
        <p className="mt-2 text-sm text-[var(--text-soft)]">
          Dokumente und Kalendertermine werden über Microsoft Graph versendet/synchronisiert.
        </p>
        <div className="mt-3 text-sm">
          {graphLoading ? (
            <LoadingSpinner label="Outlook-Status wird geprüft..." />
          ) : (
            <p className="text-[var(--text-soft)]">
              Status:{" "}
              <span className={graphConnected ? "text-emerald-300" : "text-amber-300"}>
                {graphConnected ? "Verbunden" : "Nicht verbunden"}
              </span>
              {graphExpiresAt ? ` · Token gültig bis: ${new Date(graphExpiresAt).toLocaleString("de-DE")}` : ""}
            </p>
          )}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Button className="min-h-11 w-full" onClick={connectOutlook} disabled={graphBusy}>Outlook verbinden</Button>
          <Button className="min-h-11 w-full" variant="secondary" onClick={() => void refreshGraphStatus()} disabled={graphBusy}>Status aktualisieren</Button>
          <Button
            className="min-h-11 w-full"
            variant="danger"
            onClick={() => {
              setCriticalActionError("");
              setPendingCriticalAction("disconnect");
            }}
            disabled={graphBusy || !graphConnected}
          >
            {graphBusy ? "Bitte warten..." : "Verbindung trennen"}
          </Button>
        </div>
      </GlassCard>

      <GlassCard className="p-4">
        <h2 className="font-semibold text-white">Dokument-Standardwerte</h2>
        <p className="mt-2 text-sm text-[var(--text-soft)]">
          Diese Werte werden für den Rapport als Startwerte verwendet.
        </p>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span>Stundensatz (EUR)</span>
            <input
              type="number"
              min={0}
              step="1"
              className="premium-input min-h-11 px-3 py-2"
              value={settings.standardStundensatz}
              onChange={(e) => patch("standardStundensatz", Number(e.target.value || 0))}
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span>Einsatzpauschale (EUR)</span>
            <input
              type="number"
              min={0}
              step="1"
              className="premium-input min-h-11 px-3 py-2"
              value={settings.standardEinsatzpauschale}
              onChange={(e) => patch("standardEinsatzpauschale", Number(e.target.value || 0))}
            />
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.includeArbeitsstunden}
              onChange={(e) => patch("includeArbeitsstunden", e.target.checked)}
            />
            <span>Arbeitsstunden als Standardposition aktiv</span>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.includeEinsatzpauschale}
              onChange={(e) => patch("includeEinsatzpauschale", e.target.checked)}
            />
            <span>Einsatzpauschale als Standardposition aktiv</span>
          </label>
        </div>
      </GlassCard>

      <GlassCard className="p-4">
        <h2 className="font-semibold text-white">SLA / Prozesszeiten</h2>
        <p className="mt-2 text-sm text-[var(--text-soft)]">
          Zielwerte für interne Steuerung und Dashboard-Vergleich.
        </p>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span>Bestätigung innerhalb (Stunden)</span>
            <input
              type="number"
              min={1}
              step="1"
              className="premium-input min-h-11 px-3 py-2"
              value={settings.slaBestaetigungStunden}
              onChange={(e) => patch("slaBestaetigungStunden", Number(e.target.value || 1))}
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span>Terminvergabe innerhalb (Stunden)</span>
            <input
              type="number"
              min={1}
              step="1"
              className="premium-input min-h-11 px-3 py-2"
              value={settings.slaTerminStunden}
              onChange={(e) => patch("slaTerminStunden", Number(e.target.value || 1))}
            />
          </label>
        </div>
      </GlassCard>

      <GlassCard className="p-4">
        <h2 className="font-semibold text-white">Wartung</h2>
        <p className="mt-2 text-sm text-[var(--text-soft)]">
          Hilfreiche Aktionen für Browserdaten und Admin-Oberfläche.
        </p>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <Button className="min-h-11 w-full" disabled={saving || !isDirty} onClick={() => void save()}>
            {saving ? "Speichert..." : "Speichern"}
          </Button>
          <Button className="min-h-11 w-full" variant="secondary" disabled={saving} onClick={resetDefaults}>Standardwerte laden</Button>
          <Button
            className="min-h-11 w-full"
            variant="danger"
            disabled={saving}
            onClick={() => {
              setCriticalActionError("");
              setPendingCriticalAction("clear");
            }}
          >
            Lokale Einstellungen löschen
          </Button>
          <Button className="min-h-11 w-full" variant="secondary" disabled={isDirty} onClick={() => window.location.reload()}>Seite neu laden</Button>
        </div>
      </GlassCard>

      <ConfirmDialog
        open={Boolean(pendingCriticalAction)}
        title={pendingCriticalAction === "disconnect" ? "Outlook-Verbindung trennen?" : "Lokale Einstellungen löschen?"}
        description={
          pendingCriticalAction === "disconnect"
            ? "Der gespeicherte Microsoft-Zugriff wird getrennt. Dokumente und Kalender können bis zur erneuten Verbindung nicht synchronisiert werden."
            : "Die lokal gespeicherten Admin-Standardwerte werden auf diesem Gerät entfernt."
        }
        error={criticalActionError}
        confirmLabel={pendingCriticalAction === "disconnect" ? "Verbindung trennen" : "Einstellungen löschen"}
        busy={graphBusy}
        onClose={() => {
          setCriticalActionError("");
          setPendingCriticalAction(null);
        }}
        onConfirm={() => {
          if (pendingCriticalAction === "disconnect") void disconnectOutlook();
          if (pendingCriticalAction === "clear") clearLocalSettings();
        }}
      />
    </div>
  );
}
