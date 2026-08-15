import { NextResponse } from "next/server";
import { getQuote } from "../../../src/market.js";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

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
  ].slice(0, 20);

  if (!tickers.length) {
    return NextResponse.json({ error: "Provide tickers, e.g. ?tickers=NVDA,AAPL" }, { status: 400 });
  }

  const results = await Promise.allSettled(
    tickers.map(async (symbol) => {
      const q = await getQuote(symbol);
      return {
        symbol,
        name: q.longName ?? q.shortName ?? symbol,
        price: q.price,
        changePct: q.changePct,
      };
    }),
  );

  const rows = results.map((r, i) =>
    r.status === "fulfilled" ? r.value : { symbol: tickers[i], error: r.reason?.message ?? "Failed to fetch quote" },
  );

  return NextResponse.json({ rows });
}
