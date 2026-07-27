import { ButtonHTMLAttributes, forwardRef, PropsWithChildren } from "react";
import clsx from "clsx";

type Props = PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", className, children, ...rest },
  ref
) {
  const visualVariant = variant === "ghost" ? "secondary" : variant;
  return (
    <button
      ref={ref}
      className={clsx(
        "rounded-full px-4 py-3 text-[1rem] font-semibold transition-all duration-180 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60 sm:px-4 sm:py-2 sm:text-sm",
        visualVariant === "primary"
          ? "btn-primary-premium text-slate-50"
          : visualVariant === "danger"
            ? "btn-danger-premium text-rose-50"
            : "btn-secondary-premium border border-[var(--line)] text-[var(--text-main)]",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
});


