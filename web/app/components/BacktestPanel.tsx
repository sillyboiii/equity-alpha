"use client";

import { useEffect, useState } from "react";
import { fmtPct } from "./format";

type Point = { month: string; strategy: number; buyHold: number; benchmark: number };
type Ticker = { symbol: string; strategyRet: number; buyHoldRet: number; trades: number; wins: number; winRate: number | null };
type Result = {
  period: { start: string; end: string; years: number };
  universe: string[];
  failed: string[];
  strategy: { totalReturn: number; cagr: number; maxDrawdown: number; trades: number; wins: number; winRate: number | null; avgHoldingDays: number; monthsInMarket: number };
  buyHold: { totalReturn: number; cagr: number; maxDrawdown: number };
  benchmark: { totalReturn: number; cagr: number; maxDrawdown: number };
  alpha: number;
  curve: Point[];
  tickers: Ticker[];
};

const PRESETS = [
  { id: "mag7", label: "Mag 7" },
  { id: "chips", label: "Chips" },
  { id: "retail", label: "Retail" },
  { id: "fintech", label: "Fintech" },
];

function Line({ data, color, base }: { data: number[]; color: string; base: number }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const path = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * 600;
      const y = 110 - ((v - min) / range) * 90;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  void base;
  return <path d={path} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" opacity="0.9" />;
}

function Stat({ label, value, tone = "text-ink" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-hairline bg-panel p-5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint">{label}</p>
      <p className={`num mt-1 text-2xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

export default function BacktestPanel() {
  const [preset, setPreset] = useState("mag7");
  const [years, setYears] = useState(5);
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetch(`/api/backtest?preset=${preset}&years=${years}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d.error) {
          setError(d.error);
          setData(null);
          return;
        }
        setData(d);
      })
      .catch((e) => alive && setError(e?.message ?? "Backtest failed"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [preset, years]);

  const s = data?.strategy;
  const bh = data?.buyHold;
  const bm = data?.benchmark;

  return (
    <section id="backtest" className="mx-auto w-full max-w-5xl px-5 pb-20">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint">Proof of method</p>
          <h2 className="font-display mt-1 text-2xl font-semibold text-ink sm:text-3xl">
            Did the rules actually make money?
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
            Before you trust the desk, audit the desk. The engine&apos;s exact trend rules replayed over
            {` ${data ? data.period.years : years}`} years of history: buy when price holds above the 50-day and
            200-day EMAs (a live uptrend), then ride it until price closes back below the 200-day. Equal weight,
            one decision a day, no hindsight. Strategy against buying and holding, and against the S&amp;P 500.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-full border border-hairline p-1">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPreset(p.id)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  preset === p.id ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-full border border-hairline p-1">
            {[1, 3, 5, 10].map((y) => (
              <button
                key={y}
                onClick={() => setYears(y)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  years === y ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
                }`}
              >
                {y}y
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && !data && (
        <div className="mt-6 rounded-2xl border border-dashed border-hairline bg-paper px-6 py-10 text-center">
          <p className="font-display text-lg font-semibold text-ink">Running the numbers…</p>
          <p className="mt-1.5 text-sm text-ink-soft">Pulling {years} years of daily history for the {PRESETS.find((p) => p.id === preset)?.label ?? preset} universe and the S&amp;P 500.</p>
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-2xl border border-bad/30 bg-bad/5 px-6 py-8 text-center text-sm text-bad">
          {error}
        </div>
      )}

      {data && s && bm && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="QNTL strategy"
              value={fmtPct(s.totalReturn)}
              tone={s.totalReturn >= 0 ? "text-good" : "text-bad"}
            />
            <Stat
              label="Buy & hold"
              value={fmtPct(bh?.totalReturn ?? 0)}
              tone={(bh?.totalReturn ?? 0) >= 0 ? "text-good" : "text-bad"}
            />
            <Stat
              label="S&P 500"
              value={fmtPct(bm.totalReturn)}
              tone={bm.totalReturn >= 0 ? "text-good" : "text-bad"}
            />
            <Stat
              label="Alpha vs S&P"
              value={fmtPct(data.alpha)}
              tone={data.alpha >= 0 ? "text-good" : "text-bad"}
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Win rate" value={s.winRate != null ? `${(s.winRate * 100).toFixed(0)}%` : "·"} tone={s.winRate != null && s.winRate > 0.5 ? "text-good" : "text-ink"} />
            <Stat label="Trades taken" value={String(s.trades)} />
            <Stat label="Max drawdown" value={fmtPct(s.maxDrawdown)} tone="text-bad" />
            <Stat label="Months in market" value={`${(s.monthsInMarket * 100).toFixed(0)}%`} />
          </div>

          <div className="mt-4 rounded-2xl border border-hairline bg-panel p-6">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-[11px] text-ink-faint">
              <span>Equity curve ({data.period.start} → {data.period.end})</span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1"><span className="h-0.5 w-4 bg-ink" /> QNTL</span>
                <span className="flex items-center gap-1"><span className="h-0.5 w-4 bg-good" /> Buy & hold</span>
                <span className="flex items-center gap-1"><span className="h-0.5 w-4 bg-amber" /> S&P 500</span>
              </div>
            </div>
            <svg viewBox="0 0 600 120" className="w-full" preserveAspectRatio="none">
              <line x1="0" y1="110" x2="600" y2="110" stroke="var(--hairline)" strokeWidth="1" />
              <Line data={data.curve.map((p) => p.benchmark)} color="var(--amber)" base={100} />
              <Line data={data.curve.map((p) => p.buyHold)} color="var(--good)" base={100} />
              <Line data={data.curve.map((p) => p.strategy)} color="var(--ink)" base={100} />
            </svg>
          </div>

          {data.tickers.length > 0 && (
            <div className="mt-4 overflow-x-auto rounded-2xl border border-hairline bg-panel">
              <table className="w-full min-w-[620px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-hairline text-left text-[10px] uppercase tracking-widest text-ink-faint">
                    <th className="py-2.5 pl-5 pr-4 font-semibold">Ticker</th>
                    <th className="py-2.5 pr-4 text-right font-semibold">Strategy</th>
                    <th className="py-2.5 pr-4 text-right font-semibold">Buy & hold</th>
                    <th className="py-2.5 pr-4 text-right font-semibold">Trades</th>
                    <th className="py-2.5 pr-4 text-right font-semibold">Wins</th>
                    <th className="py-2.5 pr-5 text-right font-semibold">Win rate</th>
                  </tr>
                </thead>
                <tbody>
                  {data.tickers.map((t) => (
                    <tr key={t.symbol} className="border-b border-hairline-soft last:border-0">
                      <td className="py-3 pl-5 pr-4 font-semibold text-ink">{t.symbol}</td>
                      <td className={`num py-3 pr-4 text-right font-semibold ${t.strategyRet >= 0 ? "text-good" : "text-bad"}`}>{fmtPct(t.strategyRet)}</td>
                      <td className={`num py-3 pr-4 text-right text-ink-soft ${t.buyHoldRet >= 0 ? "text-good" : "text-bad"}`}>{fmtPct(t.buyHoldRet)}</td>
                      <td className="num py-3 pr-4 text-right text-ink">{t.trades}</td>
                      <td className="num py-3 pr-4 text-right text-ink">{t.wins}</td>
                      <td className="num py-3 pr-5 text-right font-semibold text-ink">{t.winRate != null ? `${(t.winRate * 100).toFixed(0)}%` : "·"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.failed.length > 0 && (
            <p className="mt-2 text-[11px] text-ink-faint">Skipped: {data.failed.join(", ")}</p>
          )}

          <p className="mt-4 rounded-xl border border-hairline-soft bg-paper px-4 py-3 text-[11px] leading-relaxed text-ink-faint">
            Past performance does not predict future results. This is a historical replay of a rule, not a promise.
            Fees, slippage, and the human ability to panic are all excluded, and they are all real.
          </p>
        </>
      )}
    </section>
  );
}
