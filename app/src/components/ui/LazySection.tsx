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

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }

    let timeoutId: number | null = null;
    let idleId: number | null = null;
    let revealed = false;

    const reveal = () => {
      if (revealed) return;
      revealed = true;
      setVisible(true);
      observer.disconnect();
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          reveal();
        }
      },
      { rootMargin: "180px 0px" }
    );

    observer.observe(node);

    // Fallback: reveal off-screen marketing sections shortly after mount so smaller
    // screens and full-page captures do not show large empty gaps before scroll.
    if (typeof globalThis.requestIdleCallback === "function") {
      idleId = globalThis.requestIdleCallback(reveal, { timeout: 280 });
    } else {
      timeoutId = globalThis.setTimeout(reveal, 220);
    }

    return () => {
      observer.disconnect();
      if (idleId !== null && typeof globalThis.cancelIdleCallback === "function") {
        globalThis.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) {
        globalThis.clearTimeout(timeoutId);
      }
    };
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
