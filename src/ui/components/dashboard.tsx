"use client";

import { useState } from "react";
import type { AssetSymbol } from "@/domain/model";
import { DEFAULT_FILTER, type TransactionFilter } from "@/ui/transactions";
import { usePortfolio } from "@/ui/use-portfolio";
import { AllocationChart } from "./allocation-chart";
import { HoldingsTable } from "./holdings-table";
import { ImportPanel } from "./import-panel";
import { KpiCards } from "./kpi-cards";
import { PnlChart } from "./pnl-chart";
import { TransactionExplorer } from "./transaction-explorer";

export function Dashboard() {
  const { load, importState, loadSample, importFile, dismissImport } = usePortfolio();
  const [filter, setFilter] = useState<TransactionFilter>(DEFAULT_FILTER);

  const showTrades = (symbol: AssetSymbol) => {
    setFilter({ ...DEFAULT_FILTER, sort: filter.sort, asset: symbol });
    const section = document.getElementById("transactions");
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
    section?.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Crypto Portfolio Analytics</h1>
        <p className="text-sm text-ink-2">Holdings, cost basis and profit/loss across Binance and Coinbase, using weighted-average cost.</p>
      </header>

      {load.status === "loading" && <DashboardSkeleton />}

      {load.status === "error" && (
        <div role="alert" className="rounded-lg border border-line bg-danger-bg p-6">
          <p className="font-semibold">The portfolio could not be loaded.</p>
          <p className="mt-1 text-sm text-ink-2">
            {load.message}
            {load.requestId && ` Reference: ${load.requestId}.`}
          </p>
          <button type="button" onClick={() => void loadSample()} className="mt-3 rounded-md bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action-hover">
            Try again
          </button>
        </div>
      )}

      {load.status === "ready" && (
        <>
          <ImportPanel
            data={load.data}
            importState={importState}
            onImport={(file) => void importFile(file)}
            onReset={() => {
              setFilter(DEFAULT_FILTER);
              void loadSample();
            }}
            onDismiss={dismissImport}
          />
          {load.data.missingPrices.length > 0 && (
            <p role="status" className="rounded-lg border border-warn-line bg-warn-bg p-3 text-sm">
              <strong>
                <span aria-hidden="true">⚠ </span>No current price for {load.data.missingPrices.join(", ")}.
              </strong>{" "}
              Value, unrealized P&amp;L and allocation exclude {load.data.missingPrices.length === 1 ? "it" : "them"}; realized P&amp;L and cost
              basis are complete.
            </p>
          )}
          <KpiCards data={load.data} />
          <div className="grid gap-4 lg:grid-cols-2">
            <AllocationChart holdings={load.data.holdings} />
            <PnlChart holdings={load.data.holdings} />
          </div>
          <HoldingsTable holdings={load.data.holdings} totals={load.data.totals} onShowTrades={showTrades} />
          <TransactionExplorer transactions={load.data.transactions} filter={filter} onFilterChange={setFilter} />
        </>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true" className="space-y-4">
      <p className="sr-only" role="status">Loading portfolio…</p>
      <div className="h-20 animate-pulse rounded-lg bg-grid" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-grid" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-72 animate-pulse rounded-lg bg-grid" />
        <div className="h-72 animate-pulse rounded-lg bg-grid" />
      </div>
    </div>
  );
}
