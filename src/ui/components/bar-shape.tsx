import type { BarShapeProps } from "recharts";

/**
 * Bar with a 4px rounded data end and a square end on the zero baseline — for negative values the rounded end is
 * at the bottom. Works for vertical and horizontal bars.
 */
export function RoundedDataEndBar(props: BarShapeProps & { horizontal?: boolean }) {
  const { x, y, width, height, fill } = props;
  const value = Array.isArray(props.value) ? props.value[1] - props.value[0] : props.value;
  const left = Math.min(x, x + width);
  const top = Math.min(y, y + height);
  const w = Math.abs(width);
  const h = Math.abs(height);
  if (w === 0 || h === 0) return <g />;

  const r = Math.min(4, props.horizontal ? h / 2 : w / 2, props.horizontal ? w : h);
  const right = left + w;
  const bottom = top + h;
  let d: string;
  if (props.horizontal) {
    d =
      value >= 0
        ? `M${left},${top} H${right - r} Q${right},${top} ${right},${top + r} V${bottom - r} Q${right},${bottom} ${right - r},${bottom} H${left} Z`
        : `M${right},${top} H${left + r} Q${left},${top} ${left},${top + r} V${bottom - r} Q${left},${bottom} ${left + r},${bottom} H${right} Z`;
  } else {
    d =
      value >= 0
        ? `M${left},${bottom} V${top + r} Q${left},${top} ${left + r},${top} H${right - r} Q${right},${top} ${right},${top + r} V${bottom} Z`
        : `M${left},${top} H${right} V${bottom - r} Q${right},${bottom} ${right - r},${bottom} H${left + r} Q${left},${bottom} ${left},${bottom - r} Z`;
  }
  return <path d={d} fill={fill} />;
}
