import React from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useSeo } from "@/hooks/useSeo";
import { loadCustomerReport, saveCustomerReportSignature } from "@/features/apiClient";
import { supabase } from "@/lib/supabase";
import { dateTime, formatTicketNumber, formatTimeRange, labelCustomerStatus } from "@/lib/format";
import type { CustomerReportData, CustomerReportDetailResponse } from "@/types/domain";

type NormalizedPoint = { x: number; y: number };
type NormalizedStroke = NormalizedPoint[];

type SignatureCanvasHandle = {
  clear: () => void;
  hasSignature: () => boolean;
  exportPng: () => string | null;
};

function cleanText(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .trim();
}

function hasText(value: string | number | null | undefined): boolean {
  return cleanText(value) !== "";
}

function formatDate(value: string | null | undefined): string {
  const raw = cleanText(value);
  if (!raw) return "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split("-");
    return `${day}.${month}.${year}`;
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
}

function formatShortDate(value: string | null | undefined): string {
  const raw = cleanText(value);
  if (!raw) return "-";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString("de-DE");
}

function formatClock(value: string | null | undefined): string {
  const raw = cleanText(value);
  if (!raw) return "-";
  const match = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return raw;
  return `${match[1].padStart(2, "0")}:${match[2]} Uhr`;
}

function formatHours(value: string | number | null | undefined): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return cleanText(value) || "-";
  if (num <= 0) return "0 Std.";
  const fullHours = Math.floor(num);
  const minutes = Math.round((num - fullHours) * 60);
  if (fullHours > 0 && minutes > 0) return `${fullHours} Std. ${minutes} Min.`;
  if (fullHours > 0) return `${fullHours} Std.`;
  return `${minutes} Min.`;
}

function computeWorkedHours(report: CustomerReportData): number | null {
  if (Array.isArray(report.arbeitstage) && report.arbeitstage.length > 0) {
    const total = report.arbeitstage.reduce((sum, item) => sum + Number(item.stunden || 0), 0);
    return Number.isFinite(total) ? Number(total.toFixed(2)) : null;
  }
  const total = Number(report.zeiten?.gesamtstunden ?? NaN);
  if (Number.isFinite(total)) return total;
  return null;
}

function toListItems(value: string | number | null | undefined): string[] {
  return cleanText(value)
    .split(/\n+/)
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);
}

function RichText({ value, preferList = false }: { value: string | number | null | undefined; preferList?: boolean }) {
  const text = cleanText(value);
  if (!text) return null;

  if (preferList) {
    const items = toListItems(text);
    if (items.length > 1) {
      return (
        <ul className="customer-report-list">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    }
  }

  const paragraphs = text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (paragraphs.length > 1) {
    return (
      <div className="customer-report-copy">
        {paragraphs.map((paragraph, index) => (
          <p key={`${index}-${paragraph.slice(0, 24)}`}>{paragraph}</p>
        ))}
      </div>
    );
  }

  const lines = text.split("\n").map((part) => part.trim()).filter(Boolean);
  if (lines.length > 1) {
    return (
      <div className="customer-report-copy">
        {lines.map((line, index) => (
          <p key={`${index}-${line.slice(0, 24)}`}>{line}</p>
        ))}
      </div>
    );
  }

  return (
    <div className="customer-report-copy">
      <p>{text}</p>
    </div>
  );
}

function Section({
  title,
  eyebrow,
  children,
  tone = "card",
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
  tone?: "card" | "plain" | "highlight";
}) {
  return (
    <section className={`customer-report-section customer-report-section-${tone}`}>
      {eyebrow ? <p className="customer-report-eyebrow">{eyebrow}</p> : null}
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function InfoField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="customer-report-field">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MetaPill({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="customer-report-pill">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusBadge({ text, tone = "neutral" }: { text: string; tone?: "neutral" | "ok" | "warn" }) {
  return <span className={`customer-report-status customer-report-status-${tone}`}>{text}</span>;
}

function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: NormalizedStroke,
  width: number,
  height: number,
) {
  if (!stroke.length) return;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 2.1;

  const toPx = (point: NormalizedPoint) => ({
    x: point.x * width,
    y: point.y * height,
  });

  if (stroke.length === 1) {
    const point = toPx(stroke[0]);
    ctx.beginPath();
    ctx.arc(point.x, point.y, 1.1, 0, Math.PI * 2);
    ctx.fillStyle = "#0f172a";
    ctx.fill();
    return;
  }

  ctx.beginPath();
  const start = toPx(stroke[0]);
  ctx.moveTo(start.x, start.y);
  for (let i = 1; i < stroke.length; i += 1) {
    const prev = toPx(stroke[i - 1]);
    const curr = toPx(stroke[i]);
    const mx = (prev.x + curr.x) / 2;
    const my = (prev.y + curr.y) / 2;
    ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
  }
  const last = toPx(stroke[stroke.length - 1]);
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
}

const CustomerSignatureCanvas = React.forwardRef<
  SignatureCanvasHandle,
  { height?: number; className?: string }
>(function CustomerSignatureCanvas({ height = 260, className = "" }, ref) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const strokesRef = React.useRef<NormalizedStroke[]>([]);
  const activeStrokeRef = React.useRef<NormalizedStroke | null>(null);
  const pointerIdRef = React.useRef<number | null>(null);
  const [hasSignature, setHasSignature] = React.useState(false);

  const redraw = React.useCallback(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    const cssWidth = Math.max(280, Math.floor(rect.width));
    const cssHeight = Math.max(180, Math.floor(height));
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    ctx.strokeStyle = "rgba(148, 163, 184, 0.42)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, cssWidth - 1, cssHeight - 1);

    for (const stroke of strokesRef.current) {
      drawStroke(ctx, stroke, cssWidth, cssHeight);
    }
    if (activeStrokeRef.current?.length) {
      drawStroke(ctx, activeStrokeRef.current, cssWidth, cssHeight);
    }
  }, [height]);

  React.useEffect(() => {
    redraw();
  }, [redraw]);

  React.useEffect(() => {
    const onResize = () => redraw();
    const observer = typeof ResizeObserver !== "undefined" && wrapperRef.current
      ? new ResizeObserver(() => redraw())
      : null;

    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    if (observer && wrapperRef.current) observer.observe(wrapperRef.current);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      observer?.disconnect();
    };
  }, [redraw]);

  const eventPoint = React.useCallback((event: React.PointerEvent<HTMLCanvasElement>): NormalizedPoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1),
      y: Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1),
    };
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    if (pointerIdRef.current !== null) return;
    const point = eventPoint(event);
    if (!point) return;
    pointerIdRef.current = event.pointerId;
    activeStrokeRef.current = [point];
    event.currentTarget.setPointerCapture(event.pointerId);
    setHasSignature(true);
    redraw();
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    if (pointerIdRef.current !== event.pointerId) return;
    const point = eventPoint(event);
    if (!point || !activeStrokeRef.current) return;
    activeStrokeRef.current = [...activeStrokeRef.current, point];
    redraw();
  };

  const finishStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    if (pointerIdRef.current !== event.pointerId) return;
    pointerIdRef.current = null;
    if (activeStrokeRef.current?.length) {
      strokesRef.current = [...strokesRef.current, activeStrokeRef.current];
      activeStrokeRef.current = null;
      setHasSignature(strokesRef.current.length > 0);
      redraw();
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  React.useImperativeHandle(ref, () => ({
    clear() {
      strokesRef.current = [];
      activeStrokeRef.current = null;
      setHasSignature(false);
      redraw();
    },
    hasSignature() {
      return strokesRef.current.length > 0 || Boolean(activeStrokeRef.current?.length);
    },
    exportPng() {
      if (!canvasRef.current) return null;
      if (strokesRef.current.length === 0 && !activeStrokeRef.current?.length) return null;
      if (activeStrokeRef.current?.length) {
        strokesRef.current = [...strokesRef.current, activeStrokeRef.current];
        activeStrokeRef.current = null;
        redraw();
      }
      return canvasRef.current.toDataURL("image/png");
    },
  }), [redraw]);

  return (
    <div className={`customer-signature-canvas-shell ${className}`.trim()}>
      <div ref={wrapperRef} className="customer-signature-canvas-frame">
        <canvas
          ref={canvasRef}
          className="customer-signature-canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
        />
      </div>
      <p className="customer-signature-canvas-note">
        {hasSignature ? "Unterschrift erfasst." : "Mit Finger, Stift oder Maus direkt in die Fläche unterschreiben."}
      </p>
    </div>
  );
});

function SignaturePreview({
  report,
  canReplace,
  onReplace,
}: {
  report: CustomerReportData;
  canReplace: boolean;
  onReplace: () => void;
}) {
  return (
    <Section title="Bestätigung / Signatur" eyebrow="Kundenbestätigung" tone="highlight">
      <div className="customer-report-signature-card">
        <div>
          <p className="customer-report-signature-label">
            {report.signatur_kunde_label || "Unterschrift Kunde / Ansprechpartner"}
          </p>
          <p className="customer-report-signature-confirmation">
            Rapport erhalten und Leistungen/Feststellungen zur Kenntnis genommen.
          </p>
        </div>
        <div className="customer-report-signature-meta">
          {hasText(report.signatur_kunde_name) ? (
            <InfoField label="Name" value={report.signatur_kunde_name} />
          ) : null}
          {hasText(report.signatur_kunde_funktion) ? (
            <InfoField label="Funktion" value={report.signatur_kunde_funktion} />
          ) : null}
          {hasText(report.signatur_kunde_bestaetigt_at) ? (
            <InfoField label="Bestätigt am" value={dateTime(report.signatur_kunde_bestaetigt_at)} />
          ) : null}
        </div>
        {report.signatur_kunde_image ? (
          <div className="customer-report-signature-image-wrap">
            <img src={report.signatur_kunde_image} alt="Kundensignatur" className="customer-report-signature-image" />
          </div>
        ) : null}
        {canReplace ? (
          <div className="customer-report-signature-actions no-print">
            <Button type="button" variant="secondary" className="customer-report-mobile-button" onClick={onReplace}>
              Signatur anzeigen / ersetzen
            </Button>
          </div>
        ) : null}
      </div>
    </Section>
  );
}

function SignaturePrompt({ onSign }: { onSign: () => void }) {
  return (
    <Section title="Bestätigung / Signatur" eyebrow="Kundenbestätigung" tone="highlight">
      <div className="customer-report-signature-card">
        <p className="customer-report-signature-confirmation">
          Mit Ihrer Unterschrift bestätigen Sie, dass Sie den Rapport erhalten und die aufgeführten Leistungen und Feststellungen zur Kenntnis genommen haben.
        </p>
        <p className="customer-report-signature-hint">
          Die Unterschrift stellt keine technische Prüfung, Fachprüfung oder Abnahme dar.
        </p>
        <div className="customer-report-signature-actions no-print">
          <Button type="button" className="customer-report-mobile-button" onClick={onSign}>
            Signatur setzen
          </Button>
        </div>
      </div>
    </Section>
  );
}

export default function CustomerReportPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [ready, setReady] = React.useState(false);
  const [accessToken, setAccessToken] = React.useState("");
  const [detail, setDetail] = React.useState<CustomerReportDetailResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [signatureMode, setSignatureMode] = React.useState<"closed" | "preview" | "capture">("closed");
  const [signatureName, setSignatureName] = React.useState("");
  const [signatureRole, setSignatureRole] = React.useState("");
  const [replaceReason, setReplaceReason] = React.useState("");
  const [signatureError, setSignatureError] = React.useState("");
  const [signatureSaving, setSignatureSaving] = React.useState(false);
  const [portraitHint, setPortraitHint] = React.useState(false);
  const canvasRef = React.useRef<SignatureCanvasHandle | null>(null);

  useSeo({
    title: detail ? `Rapport ${detail.dokument_nummer} - KusiPrimeTec` : "Leistungsrapport - KusiPrimeTec",
    description: "Freigegebener Leistungsrapport im Kundenportal von KusiPrimeTec.",
  });

  const report = detail?.report;
  const workedHours = React.useMemo(() => (report ? computeWorkedHours(report) : null), [report]);
  const hasCustomerSignature = Boolean(report?.signatur_kunde_image);
  const signatureOpen = signatureMode !== "closed";
  const serviceDateLabel =
    report?.dokument_datum || detail?.ticket.terminwunsch || detail?.created_at || null;

  const loadDetail = React.useCallback(async (token: string, reportId: string) => {
    setLoading(true);
    setError("");
    try {
      const nextDetail = await loadCustomerReport(token, reportId);
      setDetail(nextDetail);
      setSignatureName(
        cleanText(
          nextDetail.report.signatur_kunde_name ||
            nextDetail.customer.contact_person ||
            nextDetail.customer.display_name,
        ),
      );
      setSignatureRole(cleanText(nextDetail.report.signatur_kunde_funktion));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rapport konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        if (!session?.access_token) {
          setReady(true);
          return;
        }
        setAccessToken(session.access_token);
        await loadDetail(session.access_token, id);
      } finally {
        setReady(true);
      }
    })();
  }, [id, loadDetail]);

  React.useEffect(() => {
    if (!signatureOpen) return;
    const updateOrientation = () => {
      const isTouchLike = window.matchMedia("(pointer: coarse)").matches;
      const portrait = window.matchMedia("(orientation: portrait)").matches;
      setPortraitHint(isTouchLike && portrait);
    };

    updateOrientation();
    document.body.style.overflow = "hidden";
    window.addEventListener("resize", updateOrientation);
    window.addEventListener("orientationchange", updateOrientation);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSignatureMode("closed");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("resize", updateOrientation);
      window.removeEventListener("orientationchange", updateOrientation);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [signatureOpen]);

  function openSignatureCapture() {
    setSignatureMode(hasCustomerSignature ? "preview" : "capture");
    setSuccess("");
    setError("");
    setSignatureError("");
    setReplaceReason("");
  }

  async function confirmSignature() {
    if (!accessToken || !detail) return;
    if (!signatureName.trim()) {
      setSignatureError("Bitte Namen des Unterzeichnenden angeben.");
      return;
    }
    const dataUrl = canvasRef.current?.exportPng();
    if (!dataUrl) {
      setSignatureError("Bitte zuerst unterschreiben.");
      return;
    }
    if (hasCustomerSignature && !replaceReason.trim()) {
      setSignatureError("Bitte einen Grund für das Ersetzen der Signatur angeben.");
      return;
    }

    setSignatureSaving(true);
    setSignatureError("");
    try {
      const result = await saveCustomerReportSignature(accessToken, {
        id: detail.id,
        signer_name: signatureName.trim(),
        signer_role: signatureRole.trim() || null,
        signature_data_url: dataUrl,
        replace_confirmed: hasCustomerSignature,
        replace_reason: hasCustomerSignature ? replaceReason.trim() : null,
      });
      setDetail(result.report);
      if (result.report.id !== detail.id) {
        navigate(`/konto/rapport/${result.report.id}`, { replace: true });
      }
      setSignatureMode("closed");
      setSuccess(
        hasCustomerSignature
          ? "Die Kundensignatur wurde erfolgreich ersetzt und protokolliert."
          : "Die Kundensignatur wurde erfolgreich gespeichert.",
      );
      canvasRef.current?.clear();
      setReplaceReason("");
    } catch (err) {
      setSignatureError(err instanceof Error ? err.message : "Signatur konnte nicht gespeichert werden.");
    } finally {
      setSignatureSaving(false);
    }
  }

  if (!ready) {
    return (
      <div className="page-enter">
        <LoadingSpinner label="Rapport wird geladen..." className="py-8" />
      </div>
    );
  }

  if (!accessToken) return <Navigate to="/konto/anmelden" replace state={{ from: `/konto/rapport/${id}` }} />;

  if (loading && !detail) {
    return (
      <div className="page-enter">
        <LoadingSpinner label="Rapport wird geladen..." className="py-8" />
      </div>
    );
  }

  if (!detail || !report) {
    return (
      <div className="page-enter page-stack">
        <section className="premium-card page-card">
          <h1 className="section-heading text-white">Rapport nicht verfügbar</h1>
          <p className="section-subtitle mt-2">
            {error || "Dieser Rapport ist derzeit nicht freigegeben oder konnte nicht geladen werden."}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button type="button" variant="secondary" onClick={() => navigate("/konto")}>
              Zurück ins Kundenportal
            </Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-enter page-stack customer-report-page">
      <section className="premium-card page-card no-print">
        <div className="customer-report-toolbar">
          <div>
            <p className="customer-report-toolbar-label">Kundenportal · Freigegebener Rapport</p>
            <h1 className="section-heading text-white">Leistungsrapport {detail.dokument_nummer}</h1>
            <p className="section-subtitle">
              Ticket {formatTicketNumber(detail.ticket.ticket_nummer)} · {detail.object.name}
            </p>
          </div>
          <div className="customer-report-actions">
            <Button type="button" variant="secondary" className="customer-report-mobile-button" onClick={() => navigate("/konto")}>
              Zur Übersicht
            </Button>
            <Button type="button" variant="secondary" className="customer-report-mobile-button" onClick={() => window.print()}>
              PDF herunterladen
            </Button>
            <Button type="button" variant="secondary" className="customer-report-mobile-button" onClick={() => window.print()}>
              Drucken
            </Button>
            {detail.signable ? (
              <Button type="button" className="customer-report-mobile-button" onClick={openSignatureCapture}>
                {hasCustomerSignature ? "Signatur anzeigen / ersetzen" : "Signatur setzen"}
              </Button>
            ) : null}
          </div>
        </div>
        {success ? <p className="mt-3 rounded-2xl border border-emerald-300/40 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">{success}</p> : null}
        {error ? <p className="mt-3 rounded-2xl border border-rose-300/40 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}
      </section>

      <article className="customer-report-sheet">
        <header className="customer-report-header">
          <div className="customer-report-brand">
            <img src="/kpt-logo.png" alt="KusiPrimeTec Logo" className="customer-report-logo" />
            <div>
              <p className="customer-report-company">KusiPrimeTec</p>
              <p className="customer-report-tagline">Technischer Immobilienservice für Bestandsobjekte</p>
            </div>
          </div>
          <div className="customer-report-title-block">
            <p className="customer-report-document-label">Leistungsrapport</p>
            <h1>{detail.dokument_nummer}</h1>
            <div className="customer-report-header-statuses">
              <StatusBadge text={detail.dokument_status === "akzeptiert" ? "Abgeschlossen" : "Freigegeben"} tone="ok" />
              <StatusBadge text={hasCustomerSignature ? "Signiert" : "Signatur offen"} tone={hasCustomerSignature ? "ok" : "warn"} />
            </div>
            <p className="customer-report-dates">
              Datum: {formatDate(serviceDateLabel)}
            </p>
          </div>
        </header>

        <section className="customer-report-info-grid">
          <InfoField label="Kunde / Unternehmen" value={report.kunde_firma || report.kunde} />
          <InfoField label="Ansprechpartner" value={report.ansprechpartner || report.kunde_name || report.kunde} />
          <InfoField label="Objekt" value={detail.object.name} />
          <InfoField label="Objektadresse" value={detail.object.address} />
          <InfoField label="Ticketnummer" value={formatTicketNumber(detail.ticket.ticket_nummer)} />
          <InfoField label="Rapportnummer" value={detail.dokument_nummer} />
          <InfoField label="Zuständiger Mitarbeiter" value={report.betreut_durch || "Robert Kusminov"} />
          <InfoField label="Termin / Einsatzdatum" value={formatDate(serviceDateLabel)} />
        </section>

        <section className="customer-report-pill-grid">
          <MetaPill label="Ticketstatus" value={labelCustomerStatus(detail.ticket.status)} />
          <MetaPill label="Kategorie" value={detail.ticket.kategorie || "Rapport"} />
          <MetaPill label="Einsatzzeit" value={formatTimeRange(detail.ticket.zeitfenster_von, detail.ticket.zeitfenster_bis)} />
          <MetaPill label="Erstellt" value={formatShortDate(detail.created_at)} />
        </section>

        <Section title="Einsatzdaten" eyebrow="Leistungsdaten">
          <div className="customer-report-meta-columns">
            <div className="customer-report-meta-card">
              <InfoField label="Einsatzdatum" value={formatDate(serviceDateLabel)} />
              {hasText(report.zeiten?.beginn) ? <InfoField label="Beginn" value={formatClock(report.zeiten?.beginn)} /> : null}
              {hasText(report.zeiten?.ende) ? <InfoField label="Ende" value={formatClock(report.zeiten?.ende)} /> : null}
              {workedHours != null ? <InfoField label="Tatsächliche Einsatzdauer" value={formatHours(workedHours)} /> : null}
            </div>
            <div className="customer-report-meta-card">
              {workedHours != null && report.zeiten?.gesamtstunden != null ? (
                <InfoField label="Berechnete Stunden" value={formatHours(report.zeiten.gesamtstunden)} />
              ) : null}
              {hasText(report.rapport_art) ? <InfoField label="Rapport-Art" value={report.rapport_art} /> : null}
              <InfoField label="Betreut durch" value={report.betreut_durch || "Robert Kusminov"} />
              {hasText(report.leistungszeitraum) ? <InfoField label="Leistungszeitraum" value={report.leistungszeitraum} /> : null}
            </div>
          </div>
        </Section>

        <Section title="Ausgeführte Arbeiten" eyebrow="Leistungsbeschreibung">
          <RichText value={report.leistungsbeschreibung} />
        </Section>

        {hasText(report.ergebnis) ? (
          <Section title="Ergebnis" tone="highlight">
            <RichText value={report.ergebnis} />
          </Section>
        ) : null}

        {hasText(report.hinweise) ? (
          <Section title="Ergebnis / Hinweise" tone="highlight">
            <RichText value={report.hinweise} />
          </Section>
        ) : null}

        {hasText(report.offene_punkte) || hasText(report.empfehlungen) ? (
          <Section title="Offene Punkte und Empfehlungen">
            {hasText(report.offene_punkte) ? (
              <div className="customer-report-stack">
                <h3>Offene Punkte</h3>
                <RichText value={report.offene_punkte} preferList />
              </div>
            ) : null}
            {hasText(report.empfehlungen) ? (
              <div className="customer-report-stack">
                <h3>Empfohlene Maßnahmen</h3>
                <RichText value={report.empfehlungen} preferList />
              </div>
            ) : null}
          </Section>
        ) : null}

        {report.materialliste.length > 0 ? (
          <Section title="Material und Komponenten">
            <div className="customer-report-material-list customer-report-material-mobile">
              {report.materialliste.map((item) => (
                <article key={item.id} className="customer-report-material-card">
                  <p>{item.beschreibung}</p>
                  <div>
                    {item.menge != null ? <span>{item.menge}</span> : null}
                    <span>{item.einheit}</span>
                  </div>
                  {hasText(item.bemerkung) ? <small>{item.bemerkung}</small> : null}
                </article>
              ))}
            </div>
            <div className="customer-report-material-table-wrap customer-report-material-desktop">
              <table className="customer-report-table">
                <thead>
                  <tr>
                    <th>Bezeichnung</th>
                    <th>Menge</th>
                    <th>Einheit</th>
                    <th>Bemerkung</th>
                  </tr>
                </thead>
                <tbody>
                  {report.materialliste.map((item) => (
                    <tr key={item.id}>
                      <td>{item.beschreibung}</td>
                      <td>{item.menge ?? "-"}</td>
                      <td>{item.einheit}</td>
                      <td>{item.bemerkung || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        ) : null}

        {report.fotodokumentation_kunden.length > 0 ? (
          <Section title="Fotodokumentation">
            <div className="customer-report-photo-grid">
              {report.fotodokumentation_kunden.map((photo, index) => (
                <figure key={`${photo.src}-${index}`} className="customer-report-photo-card">
                  <img
                    src={photo.src}
                    alt={photo.caption || `Fotodokumentation ${index + 1} zu Rapport ${detail.dokument_nummer}`}
                    loading="lazy"
                    className="customer-report-photo"
                  />
                  {photo.caption || photo.area || photo.beforeAfter ? (
                    <figcaption>
                      {photo.caption ? <strong>{photo.caption}</strong> : null}
                      {photo.area ? <span>{photo.area}</span> : null}
                      {photo.beforeAfter ? <span>{photo.beforeAfter}</span> : null}
                    </figcaption>
                  ) : null}
                </figure>
              ))}
            </div>
          </Section>
        ) : null}

        {hasText(report.naechste_schritte) ? (
          <Section title="Nächste Schritte">
            <RichText value={report.naechste_schritte} preferList />
          </Section>
        ) : null}

        {(workedHours != null || report.stundenkonto_verwendet != null || report.stundenkonto_verbleibend != null || report.zusatzstunden != null) ? (
          <Section title="Stundenübersicht">
            <div className="customer-report-meta-columns">
              <div className="customer-report-meta-card">
                {workedHours != null ? <InfoField label="Tatsächliche Einsatzdauer" value={formatHours(workedHours)} /> : null}
                {report.zeiten?.gesamtstunden != null ? (
                  <InfoField label="Berechnete Stunden" value={formatHours(report.zeiten.gesamtstunden)} />
                ) : null}
              </div>
              <div className="customer-report-meta-card">
                {report.stundenkonto_verwendet != null ? (
                  <InfoField label="Verwendetes Betreuungskontingent" value={formatHours(report.stundenkonto_verwendet)} />
                ) : null}
                {report.stundenkonto_verbleibend != null ? (
                  <InfoField label="Verbleibendes Stundenkonto" value={formatHours(report.stundenkonto_verbleibend)} />
                ) : null}
                {report.zusatzstunden != null ? (
                  <InfoField label="Zusatzstunden" value={formatHours(report.zusatzstunden)} />
                ) : null}
              </div>
            </div>
          </Section>
        ) : null}

        {hasCustomerSignature ? (
          <SignaturePreview report={report} canReplace={detail.replaceable} onReplace={openSignatureCapture} />
        ) : detail.signable ? (
          <SignaturePrompt onSign={openSignatureCapture} />
        ) : null}

        <Section title="Rechtlicher Hinweis" tone="plain">
          <RichText value={report.rechtlicher_hinweis} />
        </Section>

        <footer className="customer-report-footer">
          <div>
            <strong>KusiPrimeTec</strong>
            <span>Robert Kusminov</span>
            <span>Epplerinweg 31</span>
            <span>73614 Schorndorf</span>
          </div>
          <div>
            <span>Telefon: 0177 6364393</span>
            <span>E-Mail: info@kusiprimetec.de</span>
            <span>Webseite: kusiprimetec.de</span>
            <span>Planbar. Dokumentiert. Verlässlich.</span>
          </div>
        </footer>
      </article>

      {signatureOpen ? (
        <div className="customer-signature-overlay no-print" role="dialog" aria-modal="true" aria-label="Unterschrift Kunde / Ansprechpartner">
          <div className="customer-signature-modal">
            {signatureMode === "preview" ? (
              <>
                <div className="customer-signature-head">
                  <div>
                    <p className="customer-report-toolbar-label">Bestehende Signatur</p>
                    <h2>Unterschrift Kunde / Ansprechpartner</h2>
                  </div>
                  <Button type="button" variant="secondary" onClick={() => setSignatureMode("closed")}>
                    Schließen
                  </Button>
                </div>
                <div className="customer-signature-preview-box">
                  {report.signatur_kunde_image ? (
                    <img src={report.signatur_kunde_image} alt="Gespeicherte Kundensignatur" className="customer-signature-preview-image" />
                  ) : null}
                  <div className="customer-report-meta-columns">
                    {hasText(report.signatur_kunde_name) ? <InfoField label="Name" value={report.signatur_kunde_name} /> : null}
                    {hasText(report.signatur_kunde_funktion) ? <InfoField label="Funktion" value={report.signatur_kunde_funktion} /> : null}
                    {hasText(report.signatur_kunde_bestaetigt_at) ? <InfoField label="Bestätigt am" value={dateTime(report.signatur_kunde_bestaetigt_at)} /> : null}
                  </div>
                </div>
                <div className="customer-signature-footer">
                  <Button type="button" variant="secondary" onClick={() => setSignatureMode("closed")}>
                    Abbrechen
                  </Button>
                  <Button type="button" onClick={() => setSignatureMode("capture")}>
                    Signatur ersetzen
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="customer-signature-head">
                  <div>
                    <p className="customer-report-toolbar-label">Signaturmodus</p>
                    <h2>Unterschrift Kunde / Ansprechpartner</h2>
                  </div>
                  <Button type="button" variant="secondary" onClick={() => setSignatureMode("closed")}>
                    Abbrechen
                  </Button>
                </div>

                {portraitHint ? (
                  <div className="customer-signature-rotation-hint">
                    Bitte drehen Sie das Gerät ins Querformat, um bequem zu unterschreiben.
                  </div>
                ) : null}

                <div className="customer-signature-form-grid">
                  <label className="grid gap-2">
                    <span>Name des Unterzeichnenden</span>
                    <input
                      className="premium-input rounded-2xl px-4 py-3 text-base"
                      value={signatureName}
                      onChange={(event) => setSignatureName(event.target.value)}
                      placeholder="Name"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span>Funktion (optional)</span>
                    <input
                      className="premium-input rounded-2xl px-4 py-3 text-base"
                      value={signatureRole}
                      onChange={(event) => setSignatureRole(event.target.value)}
                      placeholder="z. B. Filialleitung"
                    />
                  </label>
                </div>

                {hasCustomerSignature ? (
                  <label className="grid gap-2">
                    <span>Grund für das Ersetzen der Signatur</span>
                    <textarea
                      className="premium-input min-h-28 rounded-2xl px-4 py-3 text-base"
                      value={replaceReason}
                      onChange={(event) => setReplaceReason(event.target.value)}
                      placeholder="Kurze Begründung"
                    />
                  </label>
                ) : null}

                <p className="customer-signature-confirmation-text">
                  Mit meiner Unterschrift bestätige ich, dass ich den Rapport erhalten und die aufgeführten Leistungen und Feststellungen zur Kenntnis genommen habe.
                </p>
                <p className="customer-signature-confirmation-subtext">
                  Die Unterschrift stellt keine technische Prüfung, Fachprüfung oder Abnahme dar.
                </p>

                <CustomerSignatureCanvas ref={canvasRef} height={portraitHint ? 220 : 300} />

                {signatureError ? (
                  <p className="rounded-2xl border border-rose-300/40 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                    {signatureError}
                  </p>
                ) : null}

                <div className="customer-signature-footer">
                  <Button type="button" variant="secondary" onClick={() => canvasRef.current?.clear()}>
                    Unterschrift löschen
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setSignatureMode("closed")}>
                    Abbrechen
                  </Button>
                  <Button type="button" onClick={() => void confirmSignature()} disabled={signatureSaving}>
                    {signatureSaving ? "Speichert..." : "Unterschrift bestätigen"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
