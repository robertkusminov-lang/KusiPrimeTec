import { PropsWithChildren } from "react";

export function SectionTitle({ title, subtitle, action }: PropsWithChildren<{ title: string; subtitle?: string; action?: React.ReactNode }>) {
  return (
    <header className="mb-3 flex min-w-0 flex-wrap items-end justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h1 className="section-heading text-white">{title}</h1>
        {subtitle ? <p className="section-subtitle mt-1">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}


