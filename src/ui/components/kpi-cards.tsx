import type { PortfolioResponse } from "@/contracts/portfolio";
import { formatUsd } from "@/ui/format";
import { SignedUsd } from "./signed";

export function KpiCards({ data }: { data: PortfolioResponse }) {
  const { totals, missingPrices, holdings, source } = data;
  const open = holdings.filter((h) => h.status === "open").length;
  const partial = missingPrices.length > 0 ? `Excludes ${missingPrices.join(", ")} (no price)` : null;

  const cards = [
    { label: "Portfolio value", value: formatUsd(totals.currentValue), note: partial ?? `${open} open position${open === 1 ? "" : "s"}` },
    { label: "Cost basis", value: formatUsd(totals.costBasis), note: "Open positions, buy fees included" },
    { label: "Realized P&L", signed: totals.realizedPnl, note: "From sells, net of fees" },
    { label: "Unrealized P&L", signed: totals.unrealizedPnl, note: partial ?? "Value minus cost basis" },
    { label: "Total P&L", signed: totals.totalPnl, note: "Realized + unrealized" },
    { label: "Total fees", value: formatUsd(totals.feesPaid), note: `Across ${source.tradeCount} trades` },
  ];

  return (
    <section aria-labelledby="summary-heading">
      <h2 id="summary-heading" className="sr-only">
        Portfolio summary
      </h2>
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-line bg-surface p-4">
            <dt className="text-sm text-ink-2">{card.label}</dt>
            <dd className="mt-1 text-xl font-semibold sm:text-2xl">
              {"signed" in card ? <SignedUsd value={card.signed ?? null} /> : <span className="num">{card.value}</span>}
            </dd>
            <dd className={`mt-1 text-xs ${partial && card.note === partial ? "text-loss" : "text-muted"}`}>{card.note}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
