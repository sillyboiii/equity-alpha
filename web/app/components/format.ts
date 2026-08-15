export function fmtMoney(v: number | null | undefined, currency = "USD"): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const sym = currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : `${currency} `;
  if (Math.abs(v) >= 1_000_000_000_000) return `${sym}${(v / 1_000_000_000_000).toFixed(2)}T`;
  if (Math.abs(v) >= 1_000_000_000) return `${sym}${(v / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(v) >= 1_000_000) return `${sym}${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1000) return `${sym}${(v / 1000).toFixed(2)}K`;
  return `${sym}${v.toFixed(2)}`;
}

export function fmtPrice(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v >= 1000 ? `$${v.toFixed(0)}` : `$${v.toFixed(2)}`;
}

export function fmtPct(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${(v * 100).toFixed(digits)}%`;
}

export function fmtMarketCap(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  if (v >= 1_000_000_000_000) return `$${(v / 1_000_000_000_000).toFixed(2)}T`;
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  return `$${v.toFixed(0)}`;
}

export function fmtDate(iso: string): string {
  if (!iso) return "—";
  const d = iso.slice(0, 10);
  const [y, m, day] = d.split("-");
  return `${m}/${day}/${y.slice(2)}`;
}

export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  const seed = values.slice(0, period).reduce((a: number, b: number) => a + b, 0) / period;
  out[period - 1] = seed;
  for (let i = period; i < values.length; i++) out[i] = values[i] * k + (out[i - 1] as number) * (1 - k);
  return out;
}

export function rsi(closes: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length <= period) return out;
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) avgGain += diff;
    else avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;
  out[period] = avgLoss === 0 ? (avgGain === 0 ? 50 : 100) : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff >= 0 ? diff : 0;
    const loss = diff >= 0 ? 0 : -diff;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? (avgGain === 0 ? 50 : 100) : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export function macdHist(closes: number[], fast = 12, slow = 26, signalPeriod = 9): number | null {
  const fastLine = ema(closes, fast);
  const slowLine = ema(closes, slow);
  const macdLine = closes.map((_, i) =>
    fastLine[i] != null && slowLine[i] != null ? (fastLine[i] as number) - (slowLine[i] as number) : null
  );
  const macdOnly = macdLine.filter((v): v is number => v != null);
  const offset = macdLine.length - macdOnly.length;
  const signal = ema(macdOnly, signalPeriod);
  return macdLine[macdLine.length - 1] != null && signal[macdLine.length - 1 - offset] != null
    ? (macdLine[macdLine.length - 1] as number) - (signal[macdLine.length - 1 - offset] as number)
    : null;
}

export const VERDICT_STYLE: Record<string, { text: string; bg: string; ring: string; label: string }> = {
  "STRONG BUY": { text: "text-good", bg: "bg-good/10", ring: "ring-good/30", label: "Strong buy" },
  BUY: { text: "text-good", bg: "bg-good/10", ring: "ring-good/30", label: "Buy" },
  HOLD: { text: "text-ink-soft", bg: "bg-ink-soft/10", ring: "ring-ink-soft/30", label: "Hold" },
  SELL: { text: "text-bad", bg: "bg-bad/10", ring: "ring-bad/30", label: "Sell" },
  "STRONG SELL": { text: "text-bad-deep", bg: "bg-bad/10", ring: "ring-bad/30", label: "Strong sell" },
};

export function toneClass(tone: string): { text: string; chip: string } {
  if (tone === "cheap" || tone === "good") return { text: "text-good", chip: "bg-good/10 text-good" };
  if (tone === "expensive" || tone === "bad") return { text: "text-bad", chip: "bg-bad/10 text-bad" };
  return { text: "text-ink-soft", chip: "bg-ink-soft/10 text-ink-soft" };
}
