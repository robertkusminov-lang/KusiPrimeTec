import React from "react";
import { useOutletContext } from "react-router-dom";
import { GlassCard } from "@/components/ui/GlassCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Toast } from "@/components/ui/Toast";
import { analytics } from "@/features/apiClient";
import { SESSION_EXPIRED_MESSAGE, toUserMessage } from "@/lib/errors";
import { AnalyticsPayload } from "@/types/domain";

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const width = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between text-xs">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-800">
        <div className="h-2 rounded-full bg-electric-400 transition-all duration-180" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const outlet = useOutletContext<{ token?: string } | undefined>();
  const token = outlet?.token ?? "";
  const [data, setData] = React.useState<AnalyticsPayload | null>(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!token) {
      setError(SESSION_EXPIRED_MESSAGE);
      return;
    }
    analytics(token).then(setData).catch((err) => setError(toUserMessage(err, "Analytics konnte nicht geladen werden.")));
  }, [token]);

  const max = (arr: { value: number }[]) => Math.max(...arr.map((x) => x.value), 1);

  return (
    <div className="space-y-4 page-enter">
      <SectionTitle title="Analytics" subtitle="Besucher, Funnel und regionale Verteilung" />
      {error ? <Toast kind="error" text={error} /> : null}
      {!data ? (
        <LoadingSpinner label="Analytics werden geladen..." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          <GlassCard className="p-4">
            <h2 className="font-semibold text-white">Besucher pro Tag</h2>
            <div className="mt-3 grid gap-2">{data.besucher_pro_tag.map((x) => <Bar key={x.label} label={x.label} value={x.value} max={max(data.besucher_pro_tag)} />)}</div>
          </GlassCard>
          <GlassCard className="p-4">
            <h2 className="font-semibold text-white">Ticket Funnel</h2>
            <div className="mt-3 grid gap-2">{data.funnel.map((x) => <Bar key={x.label} label={x.label} value={x.value} max={max(data.funnel)} />)}</div>
          </GlassCard>
          <GlassCard className="p-4">
            <h2 className="font-semibold text-white">Kategorien</h2>
            <div className="mt-3 grid gap-2">{data.kategorien.map((x) => <Bar key={x.label} label={x.label} value={x.value} max={max(data.kategorien)} />)}</div>
          </GlassCard>
          <GlassCard className="p-4">
            <h2 className="font-semibold text-white">PLZ Statistik</h2>
            <div className="mt-3 grid gap-2">{data.plz.map((x) => <Bar key={x.label} label={x.label} value={x.value} max={max(data.plz)} />)}</div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
