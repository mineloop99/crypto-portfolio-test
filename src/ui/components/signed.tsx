import { direction, formatSignedUsd } from "@/ui/format";

const TONE = { positive: "text-gain", negative: "text-loss", zero: "text-ink-2" } as const;
const GLYPH = { positive: "▲", negative: "▼", zero: "" } as const;

/** A signed USD amount. The sign is in the text; the ▲/▼ glyph and colour are extra cues, never the only one. */
export function SignedUsd({ value, className = "" }: { value: string | null; className?: string }) {
  if (value === null) return <Unavailable />;
  const dir = direction(value);
  return (
    <span className={`num whitespace-nowrap ${TONE[dir]} ${className}`}>
      {GLYPH[dir] && (
        <span aria-hidden="true" className="mr-1 inline-block text-[0.65em] align-[0.12em]">
          {GLYPH[dir]}
        </span>
      )}
      {formatSignedUsd(value)}
    </span>
  );
}

export function Unavailable() {
  return (
    <span className="text-muted" title="No current price for this asset">
      n/a<span className="sr-only"> (no current price)</span>
    </span>
  );
}
