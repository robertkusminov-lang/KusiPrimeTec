import clsx from "clsx";
import { GlassCard } from "./GlassCard";

interface Props {
  label: string;
  value: string;
  hint?: string;
  trendPercent?: number;
  compareText?: string;
  onClick?: () => void;
  bright?: boolean;
}

function trendText(value: number): string {
  if (value > 0) return `\u2197 ${Math.abs(value).toFixed(1)} %`;
  if (value < 0) return `\u2198 ${Math.abs(value).toFixed(1)} %`;
  return "\u2192 0.0 %";
}

export function KpiCard({ label, value, hint, trendPercent, compareText, onClick, bright = false }: Props) {
  const Body = (
    <GlassCard
      className={clsx(
        "group border-transparent p-4 transition-all duration-180 hover:-translate-y-1 hover:border-electric-300/45 hover:shadow-glow",
        bright && "bg-[linear-gradient(180deg,rgba(26,42,74,0.74),rgba(12,20,37,0.72))]"
      )}
    >
      <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-soft)]">{label}</p>
      <p className="mt-2 text-3xl font-extrabold leading-none text-white">{value}</p>
      {typeof trendPercent === "number" ? (
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className={clsx(trendPercent >= 0 ? "text-emerald-300" : "text-rose-300")}>{trendText(trendPercent)}</span>
          <span className="text-[var(--text-soft)]">{compareText || "Vergleich"}</span>
        </div>
      ) : null}
      {hint ? <p className="mt-1.5 text-xs text-[var(--text-soft)]">{hint}</p> : null}
    </GlassCard>
  );

  if (!onClick) return Body;
  return (
    <button className="w-full text-left" onClick={onClick} type="button">
      {Body}
    </button>
  );
}
