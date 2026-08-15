import { fmtPrice } from "./format";

type Series = (number | null)[];

function linePath(
  values: number[],
  w: number,
  innerH: number,
  pad: number,
  bottom: number,
  top: number
) {
  if (values.length === 0) return "";
  const x = (i: number) => (i / (values.length - 1)) * w;
  const y = (v: number) => pad + innerH - ((v - bottom) / (top - bottom)) * innerH;
  return values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
}

export default function PriceChart({
  closes,
  dates,
  ema50,
  ema200,
  height = 220,
}: {
  closes: number[];
  dates: string[];
  ema50: Series;
  ema200: Series;
  height?: number;
}) {
  const W = 800;
  const pad = 4;
  const innerH = height - pad * 2;

  const all = closes.concat(
    ema50.filter((v): v is number => v != null),
    ema200.filter((v): v is number => v != null)
  );
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const top = max + span * 0.04;
  const bottom = Math.max(0, min - span * 0.04);
  const y = (v: number) => pad + innerH - ((v - bottom) / (top - bottom)) * innerH;

  const closePath = linePath(closes, W, innerH, pad, bottom, top);
  const areaPath = `M0,${y(bottom)} L${closePath} L${W},${y(bottom)} Z`;

  const ema50Nums = ema50.filter((v): v is number => v != null);
  const ema200Nums = ema200.filter((v): v is number => v != null);
  const offset50 = ema50.length - ema50Nums.length;
  const offset200 = ema200.length - ema200Nums.length;
  const ema50Path = linePath(ema50Nums, W, innerH, pad, bottom, top);
  const ema200Path = linePath(ema200Nums, W, innerH, pad, bottom, top);

  const last = closes[closes.length - 1];
  const lastY = y(last);
  const firstDate = dates[0]?.slice(5) ?? "";
  const lastDate = dates[dates.length - 1]?.slice(5) ?? "";
  const midIdx = Math.floor(dates.length / 2);
  const midDate = dates[midIdx]?.slice(5) ?? "";

  return (
    <div className="relative w-full select-none">
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.14" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#areaFill)" className="text-ink" />
        <path d={ema200Path} fill="none" stroke="#a39c8d" strokeWidth="1" strokeDasharray="5 4" opacity="0.9" />
        <path d={ema50Path} fill="none" stroke="#c49a3a" strokeWidth="1.2" opacity="0.9" />
        <path d={closePath} fill="none" stroke="currentColor" strokeWidth="1.6" className="text-ink" strokeLinejoin="round" />
        <line x1={0} y1={lastY} x2={W} y2={lastY} stroke="currentColor" strokeWidth="1" strokeDasharray="2 4" opacity="0.4" className="text-ink" />
        <circle cx={W - 2} cy={lastY} r="3" fill="currentColor" className="text-ink" />
      </svg>
      <div
        className="absolute right-0 -translate-y-1/2 translate-x-1 rounded-sm bg-ink px-1.5 py-0.5 text-[11px] font-medium text-paper num"
        style={{ top: `${(y(last) / height) * 100}%` }}
      >
        {fmtPrice(last)}
      </div>
      <div className="mt-1 flex justify-between text-[11px] uppercase tracking-wider text-ink-faint num">
        <span>{firstDate}</span>
        <span>{midDate}</span>
        <span>{lastDate}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-soft">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3 rounded-full bg-ink" /> Close
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3 rounded-full bg-[#c49a3a]" /> 50-day EMA
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3 border-t border-dashed border-[#a39c8d]" /> 200-day EMA
        </span>
      </div>
    </div>
  );
}
