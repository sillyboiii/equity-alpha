import { NextResponse } from "next/server";
import { analyze } from "../../../src/analysis.js";
import { getHistory, getQuote } from "../../../src/market.js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req) {
  const raw = new URL(req.url).searchParams.get("tickers") ?? "";
  const tickers = [
    ...new Set(
      raw
        .toUpperCase()
        .split(",")
        .map((s) => s.trim())
        .filter((s) => /^[A-Z0-9.\-]{1,10}$/.test(s)),
    ),
  ].slice(0, 8);

  if (!tickers.length) {
    return NextResponse.json({ error: "Provide tickers, e.g. ?tickers=NVDA,AAPL" }, { status: 400 });
  }

  const results = await Promise.allSettled(
    tickers.map(async (symbol) => {
      const candles = await getHistory(symbol);
      const quote = await getQuote(symbol);
      const analysis = analyze({ candles, quote });
      return {
        symbol,
        name: quote.longName ?? quote.shortName ?? symbol,
        price: quote.price,
        score: analysis.score,
        verdict: analysis.verdict,
        direction: analysis.direction,
        grades: analysis.grades,
        rsi: analysis.indicators.rsi,
        atrPct: analysis.indicators.atrPct,
        volatilityRisk: analysis.volatilityRisk,
        strategy: analysis.strategy.name,
      };
    }),
  );

  const rows = results.map((r, i) =>
    r.status === "fulfilled" ? r.value : { symbol: tickers[i], error: r.reason?.message ?? "Failed to score" },
  );

  return NextResponse.json({ rows });
}
