import { PropsWithChildren } from "react";
import clsx from "clsx";

type Props = PropsWithChildren<{ className?: string }>;

export function GlassCard({ className, children }: Props) {
  return <section className={clsx("premium-card p-4", className)}>{children}</section>;
}


