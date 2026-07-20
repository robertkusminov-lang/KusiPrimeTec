import React from "react";
import { useOutletContext } from "react-router-dom";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Toast } from "@/components/ui/Toast";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";
import { SESSION_EXPIRED_MESSAGE } from "@/lib/errors";
import { OBJEKTBETREUUNG_INQUIRY_STATUSES, ObjektbetreuungInquiry } from "@/types/domain";

function toReadableError(err: unknown, fallback: string): string {
  const message = String((err as { message?: string })?.message || "").trim();
  return message || fallback;
}

export default function AdminInteressentenPage() {
  const outlet = useOutletContext<{ token?: string } | undefined>();
  const token = outlet?.token ?? "";
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [items, setItems] = React.useState<ObjektbetreuungInquiry[]>([]);
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [savingId, setSavingId] = React.useState("");
  const [toast, setToast] = React.useState<{ kind: "ok" | "error"; text: string } | null>(null);

  React.useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(id);
  }, [toast]);

  const load = React.useCallback(async () => {
    if (!token) {
      setError(SESSION_EXPIRED_MESSAGE);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data, error: loadError } = await supabase
        .from("objectbetreuung_inquiries")
        .select("*")
        .order("requested_at", { ascending: false })
        .limit(300);
      if (loadError) throw loadError;
      setItems((data || []) as ObjektbetreuungInquiry[]);
    } catch (err) {
      setError(toReadableError(err, "Interessenten konnten nicht geladen werden."));
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function savePatch(id: string, patch: Partial<ObjektbetreuungInquiry>) {
    setSavingId(id);
    try {
      const { error: saveError } = await supabase
        .from("objectbetreuung_inquiries")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (saveError) throw saveError;
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
      setToast({ kind: "ok", text: "Interessenten-Anfrage gespeichert." });
    } catch (err) {
      setToast({ kind: "error", text: toReadableError(err, "Änderung konnte nicht gespeichert werden.") });
    } finally {
      setSavingId("");
    }
  }

  const visibleItems = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesStatus = status ? item.status === status : true;
      const haystack = `${item.inquiry_number} ${item.company_name} ${item.contact_name} ${item.email} ${item.property_type || ""}`.toLowerCase();
      return matchesStatus && (!q || haystack.includes(q));
    });
  }, [items, query, status]);

  return (
    <div className="page-enter space-y-4">
      <SectionTitle title="Interessenten" subtitle="ObjektBetreuung-Anfragen als eigener Vertriebs- und Beratungsprozess" />
      {toast ? <Toast kind={toast.kind} text={toast.text} /> : null}

      <section className="glass rounded-xl2 border border-[var(--line)] p-4">
        <div className="flex flex-wrap gap-2">
          <input
            className="premium-input w-full px-3 py-2 text-sm sm:w-80"
            placeholder="Suche Anfrage, Unternehmen, E-Mail"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select className="premium-input px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Alle Status</option>
            {OBJEKTBETREUUNG_INQUIRY_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <Button variant="secondary" className="px-3 py-2 text-sm" onClick={() => void load()}>
            Neu laden
          </Button>
        </div>
      </section>

      <section className="glass rounded-xl2 border border-[var(--line)] p-4">
        {loading ? <LoadingSpinner label="Interessenten werden geladen..." /> : null}
        {error ? <Toast kind="error" text={error} /> : null}
        {!loading && !error && !visibleItems.length ? <EmptyState text="Keine passenden ObjektBetreuung-Anfragen gefunden." /> : null}

        {!loading && !error ? (
          <div className="grid gap-4">
            {visibleItems.map((item) => (
              <article key={item.id} className="rounded-xl border border-[var(--line)] bg-slate-950/35 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{item.inquiry_number} · {item.company_name}</p>
                    <p className="text-xs text-[var(--text-soft)]">
                      {item.contact_name} · {item.email} {item.phone ? `· ${item.phone}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-soft)]">
                      {item.property_type || "Objektart offen"} {item.property_size ? `· ${item.property_size}` : ""} {item.address_line ? `· ${item.address_line}` : ""}
                    </p>
                  </div>
                  <div className="text-right text-xs text-[var(--text-soft)]">
                    <p>Angefragt: {new Date(item.requested_at).toLocaleString("de-DE")}</p>
                    <p>Zuständig: {item.assigned_to || "Robert Kusminov"}</p>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_280px]">
                  <div className="space-y-3">
                    <div className="rounded-xl border border-[var(--line)]/70 bg-slate-900/40 p-3 text-sm text-[var(--text-main)]">
                      <p className="font-semibold text-white">Gewünschte Betreuung</p>
                      <p className="mt-1">{item.desired_support || "Nicht näher beschrieben"}</p>
                    </div>
                    <div className="rounded-xl border border-[var(--line)]/70 bg-slate-900/40 p-3 text-sm text-[var(--text-main)]">
                      <p className="font-semibold text-white">Nachricht</p>
                      <p className="mt-1 whitespace-pre-wrap">{item.message}</p>
                    </div>
                    <label className="grid gap-1 text-sm">
                      <span>Notizen</span>
                      <textarea
                        className="premium-input min-h-28 rounded-xl px-3 py-2"
                        value={item.notes || ""}
                        onChange={(e) => setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, notes: e.target.value } : row)))}
                      />
                    </label>
                  </div>

                  <div className="grid gap-3">
                    <label className="grid gap-1 text-sm">
                      <span>Status</span>
                      <select
                        className="premium-input rounded-xl px-3 py-2"
                        value={item.status}
                        onChange={(e) => setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, status: e.target.value as ObjektbetreuungInquiry["status"] } : row)))}
                      >
                        {OBJEKTBETREUUNG_INQUIRY_STATUSES.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1 text-sm">
                      <span>Wiedervorlage</span>
                      <input
                        type="date"
                        className="premium-input rounded-xl px-3 py-2"
                        value={item.follow_up_at || ""}
                        onChange={(e) => setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, follow_up_at: e.target.value || null } : row)))}
                      />
                    </label>
                    <label className="grid gap-1 text-sm">
                      <span>Zuständig</span>
                      <input
                        className="premium-input rounded-xl px-3 py-2"
                        value={item.assigned_to || "Robert Kusminov"}
                        onChange={(e) => setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, assigned_to: e.target.value } : row)))}
                      />
                    </label>
                    <Button
                      className="px-4 py-2 text-sm"
                      disabled={savingId === item.id}
                      onClick={() =>
                        void savePatch(item.id, {
                          status: item.status,
                          follow_up_at: item.follow_up_at,
                          notes: item.notes,
                          assigned_to: item.assigned_to,
                        })
                      }
                    >
                      {savingId === item.id ? "Speichert..." : "Änderungen speichern"}
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
