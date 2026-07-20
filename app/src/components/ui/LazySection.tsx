import React, { PropsWithChildren } from "react";
import clsx from "clsx";

interface Props extends PropsWithChildren {
  className?: string;
  minHeight?: number;
  delayMs?: number;
  placeholderClassName?: string;
}

export function LazySection({
  className,
  minHeight = 180,
  delayMs = 0,
  placeholderClassName = "premium-card h-full w-full animate-pulse p-4",
  children,
}: Props) {
  const [visible, setVisible] = React.useState(false);
  const ref = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "180px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      className={clsx("reveal", visible && "reveal-visible", className)}
      style={
        {
          minHeight: visible ? undefined : minHeight,
          "--reveal-delay": `${delayMs}ms`,
        } as React.CSSProperties
      }
    >
      {visible ? children : <div className={placeholderClassName} />}
    </section>
  );
}
