type EmptyStateProps = {
  text: string;
};

export function EmptyState({ text }: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-slate-950/35 px-4 py-6 text-center text-sm text-[var(--text-soft)]">
      {text}
    </div>
  );
}
