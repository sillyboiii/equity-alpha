"use client";

import { useState } from "react";
import CountUp from "./CountUp";
import { fmtPct, VERDICT_STYLE } from "./format";

type Row = {
  symbol: string;
  name: string;
  price: number | null;
  score: number;
  verdict: string;
  direction: string;
  volatilityRisk: string;
  strategy: string;
  error?: string;
};

type Checkup = {
  rows: Row[];
  score: number;
  buys: number;
  warns: number;
  counts: Record<string, number>;
};

function parseInput(raw: string): string[] {
  return [
    ...new Set(
      raw
        .toUpperCase()
        .replace(/[0-9.%$,\-–—()+\n]/g, " ")
        .split(/\s+/)
        .filter((t) => /^[A-Z][A-Z0-9.]{0,9}$/.test(t)),
    ),
  ].slice(0, 8);
}

export default function PortfolioCheckup() {
  const [input, setInput] = useState("NVDA, AAPL, MSFT, GOOGL, AMZN, META, TSLA, AMD");
  const [data, setData] = useState<Checkup | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    const tickers = parseInput(input);
    if (!tickers.length) {
      setError("Drop some tickers first, e.g. NVDA, AAPL, MSFT");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/screener?tickers=${encodeURIComponent(tickers.join(","))}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Checkup failed");
      const rows: Row[] = d.rows.filter((r: Row) => !r.error);
      const score = rows.length ? rows.reduce((a: number, r: Row) => a + r.score, 0) / rows.length : 0;
      const buys = rows.filter((r: Row) => r.verdict === "BUY" || r.verdict === "STRONG BUY").length;
      const warns = rows.filter((r: Row) => r.verdict === "SELL" || r.verdict === "STRONG SELL").length;
      const counts: Record<string, number> = {};
      for (const r of rows) counts[r.verdict] = (counts[r.verdict] ?? 0) + 1;
      setData({ rows, score, buys, warns, counts });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkup failed");
    } finally {
      setLoading(false);
    }
  }

  const verdict = data ? (data.score >= 0.25 ? "GREEN LIGHT" : data.score > -0.25 ? "YELLOW LIGHT" : "RED LIGHT") : null;
  const verdictColor = data
    ? data.score >= 0.25
      ? "text-good"
      : data.score > -0.25
        ? "text-amber"
        : "text-bad"
    : "text-ink";

  return (
    <section id="checkup" className="mx-auto w-full max-w-5xl px-5 pb-20 scroll-mt-20">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint">Portfolio checkup</p>
        <h2 className="font-display mt-1 text-2xl font-semibold text-ink sm:text-3xl">
          What would QNTL say about your portfolio?
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
          Paste your holdings. We&apos;ll run each one through the same six signals that drive every call, then tell
          you straight: green light, yellow light, or red light. This is the desk&apos;s first look at your money.
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={2}
          placeholder="NVDA, AAPL, MSFT, …"
          spellCheck={false}
          className="h-auto flex-1 resize-none rounded-xl border border-hairline bg-panel px-4 py-3 font-mono text-sm tracking-wide text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-ink"
        />
        <button
          onClick={run}
          disabled={loading}
          className="h-fit shrink-0 rounded-xl bg-ink px-7 py-3 text-sm font-semibold text-paper transition-opacity hover:opacity-85 disabled:opacity-50"
        >
          {loading ? "Checking…" : "Check my portfolio"}
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-xl border border-bad/30 bg-bad/5 px-4 py-3 text-sm text-bad">{error}</p>
      )}

      {data && (
        <>
          <div className="mt-6 rounded-2xl border border-hairline bg-panel p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint">Overall verdict</p>
                <p className={`font-display mt-1 text-4xl font-bold tracking-tight ${verdictColor}`}>{verdict}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint">Avg conviction</p>
                <p className={`num mt-1 text-3xl font-semibold ${verdictColor}`}>
                  <CountUp value={data.score} className={verdictColor} />
                </p>
                <p className="mt-1 text-[11px] text-ink-faint">
                  {data.buys} {data.buys === 1 ? "buy" : "buys"} · {data.warns} {data.warns === 1 ? "warning" : "warnings"}
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {Object.entries(data.counts).map(([v, n]) => {
                const vs = VERDICT_STYLE[v] ?? VERDICT_STYLE.HOLD;
                return (
                  <span key={v} className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${vs.bg} ${vs.text}`}>
                    {v} · {n}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-2xl border border-hairline bg-panel">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-hairline text-left text-[10px] uppercase tracking-widest text-ink-faint">
                  <th className="py-2.5 pl-5 pr-4 font-semibold">Holding</th>
                  <th className="py-2.5 pr-4 font-semibold">Call</th>
                  <th className="py-2.5 pr-4 font-semibold">Strategy</th>
                  <th className="py-2.5 pr-4 text-right font-semibold">Conviction</th>
                  <th className="py-2.5 pr-5 font-semibold">Risk</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => {
                  const vs = VERDICT_STYLE[r.verdict] ?? VERDICT_STYLE.HOLD;
                  const riskBad = r.volatilityRisk === "HIGH" || r.volatilityRisk === "ELEVATED";
                  return (
                    <tr key={r.symbol} className="border-b border-hairline-soft last:border-0">
                      <td className="py-3 pl-5 pr-4">
                        <span className="font-semibold text-ink">{r.symbol}</span>
                        {r.name && <span className="block max-w-[180px] truncate text-[11px] text-ink-faint">{r.name}</span>}
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${vs.bg} ${vs.text}`}>
                          {r.verdict}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-ink-soft">{r.strategy}</td>
                      <td className="num py-3 pr-4 text-right">
                        <span className={`font-semibold ${r.score >= 0.25 ? "text-good" : r.score > -0.25 ? "text-ink" : "text-bad"}`}>
                          {r.score >= 0 ? "+" : ""}
                          {r.score.toFixed(2)}
                        </span>
                      </td>
                      <td className={`py-3 pr-5 text-xs font-semibold uppercase tracking-widest ${riskBad ? "text-bad" : "text-ink-soft"}`}>
                        {r.volatilityRisk}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-[11px] text-ink-faint">
            The checkup is a snapshot, not a trade. Nothing here is financial advice; it&apos;s the same
            trend-first read we&apos;d give anyone, including ourselves.
          </p>
        </>
      )}
    </section>
  );
}
