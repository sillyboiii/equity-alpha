"use client";

import { useState } from "react";
import { fmtPrice, fmtPct, VERDICT_STYLE } from "./format";
import { useWatchlist } from "./watchlistStore";

type Row = {
  symbol: string;
  name: string;
  price: number | null;
  score: number;
  verdict: string;
  direction: string;
  rsi: number | null;
  atrPct: number | null;
  volatilityRisk: string;
  strategy: string;
  grades?: { quality: string; value: string };
  error?: string;
};

const UNIVERSES: Record<string, string[]> = {
  "Mag 7": ["NVDA", "AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA"],
  Tech: ["AAPL", "MSFT", "NVDA", "AMD", "AVGO", "CRM", "ADBE", "ORCL"],
  Chips: ["NVDA", "AMD", "INTC", "MU", "TSM", "QCOM", "AVGO", "ARM"],
  Retail: ["WMT", "COST", "TGT", "AMZN", "NKE", "SBUX", "MCD", "LULU"],
  Pharma: ["PFE", "MRK", "JNJ", "LLY", "ABBV", "BMY", "GILD", "AMGN"],
  Energy: ["XOM", "CVX", "COP", "EOG", "OXY", "SLB", "VLO", "PSX"],
};

const VOL_TONE: Record<string, string> = {
  TRADEABLE: "text-good",
  ELEVATED: "text-amber",
  HIGH: "text-bad",
};

export default function Screener({ onResearch }: { onResearch: (symbol: string) => void }) {
  const [universe, setUniverse] = useState<string | null>("Mag 7");
  const [custom, setCustom] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { list: watchlist, toggle: toggleWatch } = useWatchlist();

  async function scan() {
    const list = universe ? UNIVERSES[universe] : custom.split(",").map((s) => s.trim()).filter(Boolean);
    if (!list.length) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/screener?tickers=${encodeURIComponent(list.join(","))}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Scan failed");
      setRows(json.rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
      setRows(null);
    } finally {
      setLoading(false);
    }
  }

  const goodCount = rows?.filter((r) => !r.error && (r.verdict === "BUY" || r.verdict === "STRONG BUY")).length ?? 0;

  return (
    <section className="mx-auto w-full max-w-5xl px-5 py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint">Board scan</p>
          <h2 className="font-display mt-1 text-3xl font-semibold text-ink sm:text-4xl">
            Scan the board.
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
            Score a whole universe in one pass. Trend, momentum, volatility, value and quality in a single
            conviction number. Then click any row to run the full deep-dive.
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {Object.keys(UNIVERSES).map((u) => (
          <button
            key={u}
            onClick={() => {
              setUniverse(u);
              setCustom("");
            }}
            className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors ${
              universe === u ? "border-ink bg-ink text-paper" : "border-hairline bg-panel text-ink-soft hover:border-ink hover:text-ink"
            }`}
          >
            {u}
          </button>
        ))}
        <button
          onClick={() => {
            setUniverse(null);
            setRows(null);
          }}
          className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors ${
            universe === null ? "border-ink bg-ink text-paper" : "border-hairline bg-panel text-ink-soft hover:border-ink hover:text-ink"
          }`}
        >
          Custom
        </button>
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && scan()}
          placeholder={universe === null ? "TSM, MU, LLY, XOM…" : "or type your own"}
          className="h-9 w-52 rounded-xl border border-hairline bg-panel px-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-ink"
        />
        <button
          onClick={scan}
          disabled={loading}
          className="h-9 rounded-xl bg-ink px-5 text-xs font-semibold text-paper transition-opacity hover:opacity-85 disabled:opacity-50"
        >
          {loading ? "Scanning…" : "Scan"}
        </button>
      </div>

      {error && (
        <p className="mt-6 max-w-lg rounded-xl border border-bad/30 bg-bad/5 px-4 py-3 text-sm text-bad">{error}</p>
      )}

      {rows && (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-hairline bg-panel">
          <div className="flex items-center justify-between border-b border-hairline px-5 py-3 text-[11px] text-ink-faint">
            <span>
              {rows.length} scored · {goodCount} flashing green
            </span>
            <span className="num">updated just now</span>
          </div>
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-[10px] uppercase tracking-widest text-ink-faint">
                <th className="py-2.5 pl-5 pr-4 font-semibold">Ticker</th>
                <th className="py-2.5 pr-4 text-right font-semibold">Price</th>
                <th className="py-2.5 pr-4 font-semibold">Call</th>
                <th className="py-2.5 pr-4 text-right font-semibold">Score</th>
                <th className="py-2.5 pr-4 text-right font-semibold">RSI</th>
                <th className="py-2.5 pr-4 text-right font-semibold">ATR</th>
                <th className="py-2.5 pr-4 font-semibold">Quality</th>
                <th className="py-2.5 pr-4 font-semibold">Value</th>
                <th className="py-2.5 pr-5 text-right font-semibold">Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const vs = VERDICT_STYLE[r.verdict] ?? VERDICT_STYLE.HOLD;
                return (
                  <tr key={r.symbol} className="border-b border-hairline-soft transition-colors last:border-0 hover:bg-paper">
                        <td className="py-3 pl-5 pr-4">
                          <span className="flex items-center gap-1.5">
                            <button
                              onClick={() => toggleWatch(r.symbol)}
                              aria-label={watchlist.includes(r.symbol) ? `Remove ${r.symbol} from watchlist` : `Add ${r.symbol} to watchlist`}
                              title={watchlist.includes(r.symbol) ? "On watchlist" : "Add to watchlist"}
                              className={`flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${
                                watchlist.includes(r.symbol)
                                  ? "border-good/40 bg-good/10 text-good"
                                  : "border-hairline text-ink-faint hover:border-ink hover:text-ink"
                              }`}
                            >
                              {watchlist.includes(r.symbol) ? (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-2.5 w-2.5">
                                  <path d="M20 6L9 17l-5-5" />
                                </svg>
                              ) : (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-2.5 w-2.5">
                                  <path d="M12 5v14M5 12h14" />
                                </svg>
                              )}
                            </button>
                            <span className="font-semibold text-ink">{r.symbol}</span>
                          </span>
                          <span className="block max-w-[160px] truncate pl-[26px] text-[11px] text-ink-faint">{r.name}</span>
                        </td>
                    {r.error ? (
                      <td colSpan={7} className="py-3 pr-5 text-sm text-bad">
                        {r.error}
                      </td>
                    ) : (
                      <>
                        <td className="num py-3 pr-4 text-right text-ink">{fmtPrice(r.price)}</td>
                        <td className="py-3 pr-4">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${vs.bg} ${vs.text}`}>
                            {r.verdict}
                          </span>
                        </td>
                        <td className="num py-3 pr-4 text-right font-semibold text-ink">
                          {r.score >= 0 ? "+" : ""}
                          {r.score.toFixed(2)}
                        </td>
                        <td className={`num py-3 pr-4 text-right ${r.rsi == null ? "text-ink-faint" : r.rsi > 70 || r.rsi < 30 ? "text-bad" : "text-ink-soft"}`}>
                          {r.rsi == null ? "·" : r.rsi.toFixed(0)}
                        </td>
                        <td className="num py-3 pr-4 text-right text-ink-soft">{r.atrPct == null ? "·" : `${r.atrPct.toFixed(1)}%`}</td>
                        <td className="py-3 pr-4 text-ink-soft">{r.grades?.quality ?? "·"}</td>
                        <td className={`py-3 pr-4 ${r.grades?.value === "CHEAP" ? "text-good" : r.grades?.value === "EXPENSIVE" ? "text-bad" : "text-ink-soft"}`}>
                          {r.grades?.value ?? "·"}
                        </td>
                        <td className="py-3 pr-5 text-right">
                          <button
                            onClick={() => onResearch(r.symbol)}
                            className="rounded-full border border-hairline px-3 py-1 text-[11px] font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink"
                          >
                            Deep dive →
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
