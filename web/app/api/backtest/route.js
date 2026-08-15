import { NextResponse } from "next/server";
import { runBacktest } from "../../../src/backtest.js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PRESETS = {
  mag7: ["NVDA", "AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA"],
  chips: ["NVDA", "AMD", "AVGO", "QCOM", "INTC", "MU", "TXN", "MRVL"],
  retail: ["WMT", "COST", "TGT", "HD", "LOW", "AMZN", "TJX"],
  fintech: ["PYPL", "SQ", "ADYEY", "COIN", "HOOD", "AFRM", "UPST"],
  green: ["TSLA", "RIVN", "NIO", "ENPH", "FSLR", "PLUG", "FSLR"],
};

const cache = new Map();

function cacheKey(universe, days) {
  return `${universe.join(",")}:${days}`;
}

export async function GET(req) {
  const params = new URL(req.url).searchParams;
  const preset = params.get("preset");
  const years = Math.min(Math.max(Number(params.get("years") ?? 5), 1), 10);
  const raw = params.get("tickers");

  let symbols;
  if (raw) {
    symbols = [
      ...new Set(
        raw
          .toUpperCase()
          .split(",")
          .map((s) => s.trim())
          .filter((s) => /^[A-Z0-9.\-]{1,10}$/.test(s)),
      ),
    ].slice(0, 8);
  } else if (preset && PRESETS[preset]) {
    symbols = PRESETS[preset];
  } else {
    return NextResponse.json({ error: "Pick a preset or pass ?tickers=NVDA,AAPL" }, { status: 400 });
  }

  if (symbols.length < 1) {
    return NextResponse.json({ error: "Provide at least one ticker" }, { status: 400 });
  }

  const days = Math.round(years * 365.25) + 40;
  const key = cacheKey(symbols, days);
  if (cache.has(key) && Date.now() - cache.get(key).at < 30 * 60_000) {
    return NextResponse.json(cache.get(key).data);
  }

  try {
    const result = await runBacktest({ symbols, days });
    cache.set(key, { at: Date.now(), data: result });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e?.message ?? "Backtest failed" }, { status: 500 });
  }
}
