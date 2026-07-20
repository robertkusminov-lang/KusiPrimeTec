import { GlassCard } from "@/components/ui/GlassCard";

type LegalSection = {
  heading: string;
  paragraphs: readonly string[];
};

export function LegalPage({
  title,
  intro,
  sections,
}: {
  title: string;
  intro: string;
  sections: readonly LegalSection[];
}) {
  return (
    <div className="content-frame page-enter page-stack">
      <header>
        <h1 className="section-heading text-white">{title}</h1>
        <p className="section-subtitle mt-1">{intro}</p>
      </header>
      {sections.map((section) => (
        <GlassCard key={section.heading} className="p-5">
          <h2 className="text-base font-semibold md:text-lg">{section.heading}</h2>
          <div className="mt-2 grid gap-2 text-sm leading-relaxed text-[var(--text-soft)]">
            {section.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </GlassCard>
      ))}
    </div>
  );
}


