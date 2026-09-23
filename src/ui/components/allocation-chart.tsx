"use client";

import { Bar, BarChart, CartesianGrid, LabelList, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import type { HoldingDto } from "@/contracts/portfolio";
import { formatAxisUsd, formatFraction, formatUsd } from "@/ui/format";
import { RoundedDataEndBar } from "./bar-shape";
import { ChartCard, ChartEmpty } from "./chart-card";

interface Row {
  symbol: string;
  value: number;
  valueText: string;
  share: string;
}

// Allocation shares are close to each other (≈14–26 %), which a donut hides; sorted bars make the ranking readable.
export function AllocationChart({ holdings }: { holdings: HoldingDto[] }) {
  const rows: Row[] = holdings
    .filter((h) => h.status === "open" && h.currentValue !== null && h.allocation !== null)
    .map((h) => ({
      symbol: h.symbol,
      value: Number(h.currentValue), // chart geometry only; labels use the exact strings
      valueText: formatUsd(h.currentValue!),
      share: formatFraction(h.allocation!),
    }))
    .sort((a, b) => b.value - a.value);

  const table = (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-ink-2">
          <th scope="col" className="py-1 font-medium">Asset</th>
          <th scope="col" className="py-1 text-right font-medium">Value</th>
          <th scope="col" className="py-1 text-right font-medium">Allocation</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.symbol} className="border-t border-line">
            <th scope="row" className="py-1 text-left font-medium">{r.symbol}</th>
            <td className="num py-1 text-right">{r.valueText}</td>
            <td className="num py-1 text-right">{r.share}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <ChartCard title="Allocation by current value" description="Share of the portfolio's current value per open position." table={table}>
      {rows.length === 0 ? (
        <ChartEmpty>No open positions with a current price — nothing to allocate.</ChartEmpty>
      ) : (
        <BarChart
          responsive
          style={{ width: "100%", height: rows.length * 44 + 40 }}
          data={rows}
          layout="vertical"
          margin={{ top: 4, right: 64, bottom: 4, left: 4 }}
          accessibilityLayer
        >
          <CartesianGrid horizontal={false} stroke="var(--color-grid)" />
          <XAxis type="number" tickFormatter={formatAxisUsd} tick={{ fill: "var(--color-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="symbol" width={48} tick={{ fill: "var(--color-ink-2)", fontSize: 12 }} axisLine={{ stroke: "var(--color-baseline)" }} tickLine={false} />
          <Tooltip content={AllocationTooltip} cursor={{ fill: "var(--color-grid)", opacity: 0.4 }} />
          <Bar dataKey="value" fill="var(--color-series-1)" maxBarSize={24} shape={(p) => <RoundedDataEndBar {...p} horizontal />} isAnimationActive={false}>
            <LabelList dataKey="share" position="right" fill="var(--color-ink-2)" fontSize={12} />
          </Bar>
        </BarChart>
      )}
    </ChartCard>
  );
}

function AllocationTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as Row;
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold">{row.symbol}</p>
      <p className="num">
        <strong>{row.valueText}</strong> <span className="text-ink-2">· {row.share} of portfolio</span>
      </p>
    </div>
  );
}
