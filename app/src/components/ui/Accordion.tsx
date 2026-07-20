import React from "react";

export function Accordion({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="rounded-xl2 border border-[var(--line)] bg-[rgba(14,24,38,0.6)]">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span>{title}</span>
        <span className={`transition-transform duration-180 ${open ? "rotate-180" : ""}`}>?</span>
      </button>
      {open ? <div className="border-t border-[var(--line)] px-4 py-3">{children}</div> : null}
    </div>
  );
}


