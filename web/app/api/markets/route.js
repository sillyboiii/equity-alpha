import { NextResponse } from "next/server";
import { withRetry, MARKET } from "../../../src/market.js";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const INDICES = [
  { symbol: "^GSPC", label: "S&P 500" },
  { symbol: "^IXIC", label: "Nasdaq" },
  { symbol: "^DJI", label: "Dow" },
  { symbol: "^RUT", label: "Russell 2K" },
  { symbol: "GC=F", label: "Gold" },
  { symbol: "DX-Y.NYB", label: "Dollar" },
  { symbol: "^TNX", label: "10Y Yield" },
  { symbol: "^VIX", label: "VIX" },
];

export async function GET() {
  try {
    const res = await withRetry(() => MARKET.quote(INDICES.map((i) => i.symbol)), { label: "indices quote" });
    const quotes = Array.isArray(res) ? res : [];
    const rows = quotes
      .map((q) => {
        const meta = INDICES.find((i) => i.symbol === q.symbol) ?? {};
        const price = q.regularMarketPrice ?? q.postMarketPrice ?? null;
        const prev = q.regularMarketPreviousClose ?? q.previousClose ?? null;
        return {
          symbol: q.symbol ?? meta.symbol,
          label: meta.label,
          name: q.longName ?? q.shortName ?? meta.symbol,
          price,
          changePct: price != null && prev != null ? ((price - prev) / prev) * 100 : null,
        };
      })
      .filter((r) => r.price != null);
    return NextResponse.json({ updatedAt: new Date().toISOString(), rows });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Markets fetch failed" }, { status: 502 });
  }
}
