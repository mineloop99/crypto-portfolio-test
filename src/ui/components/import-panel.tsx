"use client";

import { useRef } from "react";
import type { PortfolioResponse } from "@/contracts/portfolio";
import { formatUtc } from "@/ui/format";
import type { ImportState } from "@/ui/use-portfolio";

const BUTTON =
  "inline-flex items-center rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action disabled:cursor-not-allowed disabled:opacity-50";

export function ImportPanel({
  data,
  importState,
  onImport,
  onReset,
  onDismiss,
}: {
  data: PortfolioResponse;
  importState: ImportState;
  onImport: (file: File) => void;
  onReset: () => void;
  onDismiss: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const busy = importState.status === "importing";
  const { source } = data;

  return (
    <section aria-label="Data source" className="rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <p>
            <span className="text-ink-2">Trades: </span>
            <strong>{source.fileName}</strong>{" "}
            <span className="text-ink-2">
              ({source.tradeCount} trades, {source.kind === "sample" ? "supplied sample" : "imported — kept in this tab only, not saved"})
            </span>
          </p>
          <p>
            <span className="text-ink-2">Prices: </span>
            {data.pricesAsOf ? (
              <>
                valued at <strong className="num">{formatUtc(data.pricesAsOf)}</strong>
                {data.pricesAsOfMixed && <span className="text-ink-2"> (latest of several snapshot times)</span>}
              </>
            ) : (
              <strong className="text-loss">no price snapshot available</strong>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            id="trades-file"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = ""; // allow re-importing the same file
              if (file) onImport(file);
            }}
          />
          <button type="button" disabled={busy} onClick={() => input.current?.click()} className={`${BUTTON} bg-action text-white hover:bg-action-hover`}>
            {busy ? "Importing…" : "Import trades.csv"}
          </button>
          <button
            type="button"
            disabled={busy || (source.kind === "sample" && importState.status !== "rejected")}
            onClick={onReset}
            className={`${BUTTON} border border-line hover:bg-page`}
          >
            Reset to sample data
          </button>
        </div>
      </div>

      <div aria-live="polite" className="text-sm">
        {importState.status === "importing" && <p className="mt-3 text-ink-2">Validating {importState.fileName}…</p>}
        {importState.status === "imported" && (
          <p className="mt-3 text-gain">
            <span aria-hidden="true">✓ </span>Imported {importState.fileName}: {importState.tradeCount} trades.
          </p>
        )}
      </div>

      {importState.status === "rejected" && (
        <div role="alert" className="mt-3 rounded-md border border-loss/30 bg-danger-bg p-3 text-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">
                <span aria-hidden="true">✕ </span>
                {importState.message}
              </p>
              <p className="text-ink-2">Nothing was imported — the numbers below are unchanged.</p>
            </div>
            <button type="button" onClick={onDismiss} className="shrink-0 rounded px-2 py-1 text-ink-2 hover:bg-surface focus-visible:outline-2 focus-visible:outline-action">
              Dismiss
            </button>
          </div>
          {importState.issues.length > 0 && (
            <ol className="mt-2 max-h-64 list-none space-y-1 overflow-y-auto">
              {importState.issues.map((issue, i) => (
                <li key={i} className="num">
                  {issue.line !== null && <strong>Line {issue.line}</strong>}
                  {issue.column && <span className="text-ink-2"> · {issue.column}</span>}
                  {(issue.line !== null || issue.column) && ": "}
                  {issue.message}
                </li>
              ))}
            </ol>
          )}
          {importState.issueCount > importState.issues.length && (
            <p className="mt-2 text-ink-2">…and {importState.issueCount - importState.issues.length} more.</p>
          )}
        </div>
      )}
    </section>
  );
}
