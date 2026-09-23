"use client";

import { useId, useMemo, useState } from "react";
import type { TransactionDto } from "@/contracts/portfolio";
import { ASSET_SYMBOLS, EXCHANGES, SIDES } from "@/domain/model";
import { formatPrice, formatQuantity, formatUsd, formatUtc } from "@/ui/format";
import { applyFilter, dateRangeError, DEFAULT_FILTER, paginate, summarize, type TransactionFilter } from "@/ui/transactions";
import { SignedUsd } from "./signed";

const PAGE_SIZES = [25, 50, 100];
const NUM = "px-3 py-2 text-right num whitespace-nowrap";
const HEAD = "px-3 py-2 text-right font-medium text-ink-2 whitespace-nowrap";
const CONTROL =
  "mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-action";

export function TransactionExplorer({
  transactions,
  filter,
  onFilterChange,
}: {
  transactions: TransactionDto[];
  filter: TransactionFilter;
  onFilterChange: (filter: TransactionFilter) => void;
}) {
  const id = useId();
  const [pageSize, setPageSize] = useState(25);
  // The page resets whenever the filter changes (including from the holdings table), without an effect.
  const filterKey = JSON.stringify([filter, pageSize]);
  const [paging, setPaging] = useState({ key: filterKey, page: 1 });
  const requestedPage = paging.key === filterKey ? paging.page : 1;

  const filtered = useMemo(() => applyFilter(transactions, filter), [transactions, filter]);
  const summary = useMemo(() => summarize(filtered), [filtered]);
  const { page, pageCount, start, rows } = paginate(filtered, requestedPage, pageSize);
  const rangeError = dateRangeError(filter);
  const isFiltered = JSON.stringify({ ...filter, sort: DEFAULT_FILTER.sort }) !== JSON.stringify(DEFAULT_FILTER);

  const set = <K extends keyof TransactionFilter>(key: K, value: TransactionFilter[K]) => onFilterChange({ ...filter, [key]: value });
  const goTo = (next: number) => setPaging({ key: filterKey, page: next });

  return (
    <section id="transactions" aria-labelledby={`${id}-heading`} className="rounded-lg border border-line bg-surface">
      <div className="px-4 pt-4">
        <h2 id={`${id}-heading`} tabIndex={-1} className="text-lg font-semibold focus:outline-none">
          Transactions
        </h2>
        <p className="text-xs text-muted">Every row of trades.csv, with gross value and the realized P&amp;L each sell produced. Times and dates are UTC.</p>
      </div>

      <form role="search" aria-label="Filter transactions" onSubmit={(e) => e.preventDefault()} className="grid grid-cols-2 gap-3 px-4 pt-3 sm:grid-cols-3 lg:grid-cols-6">
        <label className="col-span-2 text-xs text-ink-2 sm:col-span-1">
          Search trade ID
          <input type="search" value={filter.query} onChange={(e) => set("query", e.target.value)} placeholder="e.g. TRD-0042" className={CONTROL} />
        </label>
        <label className="text-xs text-ink-2">
          Asset
          <select value={filter.asset} onChange={(e) => set("asset", e.target.value as TransactionFilter["asset"])} className={CONTROL}>
            <option value="all">All assets</option>
            {ASSET_SYMBOLS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-ink-2">
          Exchange
          <select value={filter.exchange} onChange={(e) => set("exchange", e.target.value as TransactionFilter["exchange"])} className={CONTROL}>
            <option value="all">All exchanges</option>
            {EXCHANGES.map((x) => (
              <option key={x} value={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-ink-2">
          Side
          <select value={filter.side} onChange={(e) => set("side", e.target.value as TransactionFilter["side"])} className={CONTROL}>
            <option value="all">Buys and sells</option>
            {SIDES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-ink-2">
          From
          <input type="date" value={filter.from} onChange={(e) => set("from", e.target.value)} aria-invalid={rangeError ? true : undefined} className={CONTROL} />
        </label>
        <label className="text-xs text-ink-2">
          To
          <input type="date" value={filter.to} onChange={(e) => set("to", e.target.value)} aria-invalid={rangeError ? true : undefined} className={CONTROL} />
        </label>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3 text-sm" aria-live="polite">
        {rangeError ? (
          <p role="alert" className="text-loss">{rangeError}</p>
        ) : (
          <p className="text-ink-2">
            <span className="num">{summary.count}</span> of <span className="num">{transactions.length}</span> trades · gross{" "}
            <span className="num">{formatUsd(summary.grossValue)}</span> · fees <span className="num">{formatUsd(summary.fees)}</span> · realized{" "}
            <SignedUsd value={summary.realizedPnl} />
          </p>
        )}
        {isFiltered && (
          <button type="button" onClick={() => onFilterChange({ ...DEFAULT_FILTER, sort: filter.sort })} className="text-sm text-action underline underline-offset-4">
            Clear filters
          </button>
        )}
      </div>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[1040px] border-collapse text-sm">
          <caption className="sr-only">Trades, page {page} of {pageCount}</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" aria-sort={filter.sort === "asc" ? "ascending" : "descending"} className="px-3 py-2 text-left font-medium text-ink-2">
                <button type="button" onClick={() => set("sort", filter.sort === "asc" ? "desc" : "asc")} className="inline-flex items-center gap-1 rounded hover:text-ink focus-visible:outline-2 focus-visible:outline-action">
                  Time (UTC)
                  <span aria-hidden="true">{filter.sort === "asc" ? "↑" : "↓"}</span>
                  <span className="sr-only">, sorted {filter.sort === "asc" ? "oldest first" : "newest first"}. Activate to reverse.</span>
                </button>
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium text-ink-2">Trade ID</th>
              <th scope="col" className="px-3 py-2 text-left font-medium text-ink-2">Exchange</th>
              <th scope="col" className="px-3 py-2 text-left font-medium text-ink-2">Asset</th>
              <th scope="col" className="px-3 py-2 text-left font-medium text-ink-2">Side</th>
              <th scope="col" className={HEAD}>Quantity</th>
              <th scope="col" className={HEAD}>Price</th>
              <th scope="col" className={HEAD}>Gross value</th>
              <th scope="col" className={HEAD}>Fee</th>
              <th scope="col" className={HEAD}>Realized P&amp;L</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.tradeId} className="border-b border-line last:border-0">
                <td className="num px-3 py-2 whitespace-nowrap">{formatUtc(t.timestamp).replace(" UTC", "")}</td>
                <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{t.tradeId}</td>
                <td className="px-3 py-2">{t.exchange}</td>
                <td className="px-3 py-2 font-medium">{t.symbol}</td>
                <td className="px-3 py-2">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${t.side === "BUY" ? "bg-series-1/10 text-action" : "bg-series-2/10 text-[#a4401a]"}`}>
                    {t.side}
                  </span>
                </td>
                <td className={NUM}>{formatQuantity(t.quantity)}</td>
                <td className={NUM}>{formatPrice(t.priceUsd)}</td>
                <td className={NUM}>{formatUsd(t.grossValue)}</td>
                <td className={NUM}>{formatUsd(t.feeUsd)}</td>
                <td className={NUM}>{t.realizedPnl === null ? <span className="text-muted">—</span> : <SignedUsd value={t.realizedPnl} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && !rangeError && <p className="px-4 py-8 text-center text-sm text-ink-2">No trades match these filters.</p>}
      </div>

      <nav aria-label="Transaction pages" className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm">
        <label className="flex items-center gap-2 text-ink-2">
          Rows per page
          <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="rounded-md border border-line bg-surface px-2 py-1">
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <p className="num text-ink-2">
          {filtered.length === 0 ? "0" : `${start + 1}–${start + rows.length}`} of {filtered.length}
        </p>
        <div className="flex items-center gap-2">
          <PageButton onClick={() => goTo(page - 1)} disabled={page <= 1}>Previous</PageButton>
          <span className="num text-ink-2">Page {page} of {pageCount}</span>
          <PageButton onClick={() => goTo(page + 1)} disabled={page >= pageCount}>Next</PageButton>
        </div>
      </nav>
    </section>
  );
}

function PageButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="rounded-md border border-line px-3 py-1 hover:bg-page disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-action"
    >
      {children}
    </button>
  );
}
