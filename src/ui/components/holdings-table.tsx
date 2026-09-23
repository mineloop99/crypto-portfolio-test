import type { HoldingDto, TotalsDto } from "@/contracts/portfolio";
import type { AssetSymbol } from "@/domain/model";
import { formatFraction, formatPrice, formatQuantity, formatUsd } from "@/ui/format";
import { SignedUsd, Unavailable } from "./signed";

const NUM = "px-3 py-2 text-right num whitespace-nowrap";
const HEAD = "px-3 py-2 text-right font-medium text-ink-2 whitespace-nowrap";

export function HoldingsTable({
  holdings,
  totals,
  onShowTrades,
}: {
  holdings: HoldingDto[];
  totals: TotalsDto;
  onShowTrades: (symbol: AssetSymbol) => void;
}) {
  return (
    <section aria-labelledby="holdings-heading" className="rounded-lg border border-line bg-surface">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-4">
        <h2 id="holdings-heading" className="text-lg font-semibold">
          Holdings
        </h2>
        <p className="text-xs text-muted">Weighted-average cost. Select an asset to see its trades.</p>
      </div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <caption className="sr-only">Holdings per asset with cost basis, value and profit or loss</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="sticky left-0 bg-surface px-3 py-2 text-left font-medium text-ink-2">
                Asset
              </th>
              <th scope="col" className={HEAD}>Quantity</th>
              <th scope="col" className={HEAD}>Avg cost</th>
              <th scope="col" className={HEAD}>Price</th>
              <th scope="col" className={HEAD}>Cost basis</th>
              <th scope="col" className={HEAD}>Value</th>
              <th scope="col" className={HEAD}>Realized P&amp;L</th>
              <th scope="col" className={HEAD}>Unrealized P&amp;L</th>
              <th scope="col" className={HEAD}>Total P&amp;L</th>
              <th scope="col" className={HEAD}>Allocation</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h) => (
              <tr key={h.symbol} className="border-b border-line last:border-0">
                <th scope="row" className="sticky left-0 bg-surface px-3 py-2 text-left font-semibold">
                  <button
                    type="button"
                    onClick={() => onShowTrades(h.symbol)}
                    className="rounded underline decoration-baseline underline-offset-4 hover:decoration-ink focus-visible:outline-2 focus-visible:outline-action"
                  >
                    {h.symbol}
                    <span className="sr-only"> — show trades</span>
                  </button>
                  {h.status === "closed" && (
                    <span className="ml-2 rounded border border-line px-1.5 py-0.5 text-xs font-normal text-ink-2">Closed</span>
                  )}
                </th>
                <td className={NUM}>{formatQuantity(h.quantity)}</td>
                <td className={NUM}>{h.status === "closed" ? "—" : formatPrice(h.averageCost)}</td>
                <td className={NUM}>{h.currentPrice === null ? <Unavailable /> : formatPrice(h.currentPrice)}</td>
                <td className={NUM}>{formatUsd(h.costBasis)}</td>
                <td className={NUM}>{h.currentValue === null ? <Unavailable /> : formatUsd(h.currentValue)}</td>
                <td className={NUM}><SignedUsd value={h.realizedPnl} /></td>
                <td className={NUM}><SignedUsd value={h.unrealizedPnl} /></td>
                <td className={NUM}><SignedUsd value={h.totalPnl} /></td>
                <td className={NUM}>
                  {h.allocation !== null ? formatFraction(h.allocation) : h.currentValue === null ? <Unavailable /> : "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-baseline font-semibold">
              <th scope="row" className="sticky left-0 bg-surface px-3 py-2 text-left">
                Total
              </th>
              <td className={NUM} colSpan={3} />
              <td className={NUM}>{formatUsd(totals.costBasis)}</td>
              <td className={NUM}>{formatUsd(totals.currentValue)}</td>
              <td className={NUM}><SignedUsd value={totals.realizedPnl} /></td>
              <td className={NUM}><SignedUsd value={totals.unrealizedPnl} /></td>
              <td className={NUM}><SignedUsd value={totals.totalPnl} /></td>
              <td className={NUM}>{holdings.some((h) => h.allocation !== null) ? "100.00%" : "—"}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="px-4 pb-3 pt-2 text-xs text-muted">
        Totals are summed at full precision and rounded once, so adding up the rounded rows can differ from the total by a
        few cents.
      </p>
    </section>
  );
}
