"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import type { HoldingDto } from "@/contracts/portfolio";
import { formatSignedAxisUsd, formatSignedUsd } from "@/ui/format";
import { RoundedDataEndBar } from "./bar-shape";
import { ChartCard } from "./chart-card";
import { SignedUsd } from "./signed";

interface Row {
  symbol: string;
  realized: number;
  unrealized: number | null;
  holding: HoldingDto;
}

const SERIES = [
  { key: "realized", name: "Realized", color: "var(--color-series-1)" },
  { key: "unrealized", name: "Unrealized", color: "var(--color-series-2)" },
] as const;

export function PnlChart({ holdings }: { holdings: HoldingDto[] }) {
  const rows: Row[] = holdings.map((h) => ({
    symbol: h.symbol,
    realized: Number(h.realizedPnl), // chart geometry only; tooltips and the table use the exact strings
    unrealized: h.unrealizedPnl === null ? null : Number(h.unrealizedPnl),
    holding: h,
  }));

  const table = (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-ink-2">
          <th scope="col" className="py-1 font-medium">Asset</th>
          <th scope="col" className="py-1 text-right font-medium">Realized</th>
          <th scope="col" className="py-1 text-right font-medium">Unrealized</th>
          <th scope="col" className="py-1 text-right font-medium">Total</th>
        </tr>
      </thead>
      <tbody>
        {holdings.map((h) => (
          <tr key={h.symbol} className="border-t border-line">
            <th scope="row" className="py-1 text-left font-medium">{h.symbol}</th>
            <td className="py-1 text-right"><SignedUsd value={h.realizedPnl} /></td>
            <td className="py-1 text-right"><SignedUsd value={h.unrealizedPnl} /></td>
            <td className="py-1 text-right"><SignedUsd value={h.totalPnl} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <ChartCard
      title="Realized and unrealized P&L by asset"
      description="Bars above the line are gains, below are losses. Missing prices leave the unrealized bar out."
      table={table}
    >
      <BarChart
        responsive
        style={{ width: "100%", height: 280 }}
        data={rows}
        margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
        barGap={2}
        accessibilityLayer
      >
        <CartesianGrid vertical={false} stroke="var(--color-grid)" />
        <XAxis dataKey="symbol" tick={{ fill: "var(--color-ink-2)", fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={formatSignedAxisUsd} width={64} tick={{ fill: "var(--color-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
        <ReferenceLine y={0} stroke="var(--color-baseline)" />
        <Tooltip content={PnlTooltip} cursor={{ fill: "var(--color-grid)", opacity: 0.4 }} />
        <Legend
          verticalAlign="top"
          align="right"
          height={28}
          iconType="square"
          iconSize={10}
          formatter={(value: string) => <span className="text-xs text-ink-2">{value}</span>}
        />
        {SERIES.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name}
            fill={s.color}
            maxBarSize={24}
            shape={RoundedDataEndBar}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ChartCard>
  );
}

function PnlTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const { holding } = payload[0].payload as Row;
  const lines = [
    { name: "Realized", value: holding.realizedPnl, color: SERIES[0].color },
    { name: "Unrealized", value: holding.unrealizedPnl, color: SERIES[1].color },
  ];
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold">{holding.symbol}</p>
      {lines.map((l) => (
        <p key={l.name} className="num flex items-center gap-2">
          <span aria-hidden="true" className="inline-block h-0.5 w-3" style={{ background: l.color }} />
          <strong>{l.value === null ? "n/a" : formatSignedUsd(l.value)}</strong>
          <span className="text-ink-2">{l.name}</span>
        </p>
      ))}
      <p className="num mt-1 border-t border-line pt-1">
        <strong>{holding.totalPnl === null ? "n/a" : formatSignedUsd(holding.totalPnl)}</strong>{" "}
        <span className="text-ink-2">Total</span>
      </p>
    </div>
  );
}
