import type { ReactNode } from "react";

/** Chart frame: title and description, the chart, and the same numbers as a table for screen readers and printing. */
export function ChartCard({
  title,
  description,
  children,
  table,
}: {
  title: string;
  description: string;
  children: ReactNode;
  table: ReactNode;
}) {
  return (
    <figure className="flex flex-col rounded-lg border border-line bg-surface p-4">
      <figcaption>
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-xs text-muted">{description}</p>
      </figcaption>
      <div className="mt-3 flex-1">{children}</div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-ink-2 hover:text-ink">View data as a table</summary>
        <div className="mt-2 overflow-x-auto">{table}</div>
      </details>
    </figure>
  );
}

export function ChartEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-56 items-center justify-center rounded-md border border-dashed border-line px-4 text-center text-sm text-ink-2">
      {children}
    </div>
  );
}
