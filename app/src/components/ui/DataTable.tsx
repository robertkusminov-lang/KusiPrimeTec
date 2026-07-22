import React from "react";
import clsx from "clsx";

interface Column<T> {
  key: string;
  title: string;
  render: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({ columns, rows, rowKey, onRowClick }: Props<T>) {
  const isActionColumn = (key: string) => key === "actions" || key === "action";

  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:hidden">
        {rows.map((row) => (
          <article
            key={rowKey(row)}
            className={clsx(
              "admin-mobile-card rounded-xl2 border border-[var(--line)] bg-slate-950/35 p-3 shadow-[0_14px_26px_rgba(2,8,20,0.24)]",
              onRowClick
                ? "cursor-pointer transition-all duration-180 active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-300/70"
                : ""
            )}
            role={onRowClick ? "button" : undefined}
            tabIndex={onRowClick ? 0 : undefined}
            onClick={() => onRowClick?.(row)}
            onKeyDown={(event) => {
              if (!onRowClick || (event.key !== "Enter" && event.key !== " ")) return;
              event.preventDefault();
              onRowClick(row);
            }}
          >
            <div className="grid gap-2.5">
              {columns.map((col, columnIndex) => (
                <section
                  key={col.key}
                  className={clsx(
                    "admin-mobile-field min-w-0 rounded-xl border border-[var(--line)]/70 bg-slate-900/30 p-3",
                    columnIndex === 0 && "admin-mobile-field-primary",
                    isActionColumn(col.key) && "border-[var(--line-strong)]/70 bg-slate-900/55"
                  )}
                >
                  <p className="admin-mobile-field-label mb-2 font-semibold uppercase text-[var(--text-soft)]">
                    {col.title}
                  </p>
                  <div className="admin-mobile-field-value min-w-0">{col.render(row)}</div>
                </section>
              ))}
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto overflow-y-hidden rounded-xl2 border border-[var(--line)] bg-slate-950/30 lg:block">
        <table className="w-max min-w-full border-collapse text-left text-sm">
          <thead className="bg-slate-900/70 text-[var(--text-soft)]">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={clsx(
                    "px-3 py-2 font-medium",
                    col.headerClassName,
                    isActionColumn(col.key) &&
                      "w-[230px] min-w-[230px] border-l border-[var(--line)] bg-slate-900/95 lg:sticky lg:right-0 lg:z-20 lg:w-[250px] lg:min-w-[250px] lg:shadow-[-14px_0_18px_rgba(2,6,23,0.45)] xl:w-[260px] xl:min-w-[260px]"
                  )}
                >
                  {col.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                className={clsx(
                  "border-t border-[var(--line)] transition-all duration-180",
                  onRowClick
                    ? "cursor-pointer hover:bg-slate-900/55 hover:shadow-[inset_0_0_0_1px_rgba(56,189,248,0.3)]"
                    : "hover:bg-slate-900/40"
                )}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={clsx(
                      "px-3 py-2 align-top break-words",
                      col.className,
                      isActionColumn(col.key) &&
                        "w-[230px] min-w-[230px] border-l border-[var(--line)] bg-slate-950/96 lg:sticky lg:right-0 lg:z-10 lg:w-[250px] lg:min-w-[250px] lg:shadow-[-14px_0_18px_rgba(2,6,23,0.45)] xl:w-[260px] xl:min-w-[260px]"
                    )}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


