"use client";

import { useState } from "react";
import { fmtPct, fmtDate, VERDICT_STYLE } from "./format";

type ScopePerf = {
  horizonDays: number;
  totalSignals: number;
  scoredSignals: number;
  tradeCount: number;
  incomplete: number;
  wins: number;
  losses: number;
  longWins: number;
  longCount: number;
  shortWins: number;
  shortCount: number;
  winRate: number | null;
  avgReturn: number | null;
  spxScored: number;
  spxAvgReturn: number | null;
  netAlpha: number | null;
  beatMarket: number;
  byQuarter: { label: string; wins: number; losses: number; winRate: number | null }[];
  maxDrawdown: number;
  avgHoldingDays: { long: number | null; short: number | null };
  scored: {
    ticker: string;
    name: string;
    verdict: string;
    signaled_at: string;
    exitDate: string;
    ret: number;
    correct: boolean;
    isBuy: boolean;
    spxRet: number | null;
    alpha: number | null;
  }[];
};

export default function TrackRecord({ track }: { track: { generatedAt: string; research: ScopePerf; personal: ScopePerf } }) {
  const [scope, setScope] = useState<"research" | "personal">("research");
  const p = track[scope];

  const stats: { label: string; value: string; sub?: string }[] = [
    { label: "Scored calls", value: String(p.scoredSignals), sub: p.tradeCount ? `${p.tradeCount} closed trades` : undefined },
    { label: "Win rate", value: p.winRate == null ? "—" : `${(p.winRate * 100).toFixed(0)}%`, sub: `${p.wins}W / ${p.losses}L` },
    { label: "Avg return", value: fmtPct(p.avgReturn), sub: `over ${p.horizonDays}-day horizon` },
    { label: "Net alpha vs S&P", value: p.netAlpha == null ? "—" : fmtPct(p.netAlpha), sub: p.netAlpha != null && p.netAlpha >= 0 ? "beating the market" : "trailing the market" },
    { label: "Beat S&P 500", value: p.spxScored ? `${p.beatMarket}/${p.spxScored}` : "—" },
    { label: "Max drawdown", value: p.maxDrawdown ? `${(p.maxDrawdown * 100).toFixed(0)}%` : "—", sub: "on signal equity curve" },
    { label: "Longs", value: p.longCount ? `${(p.longWins / p.longCount) * 100}%` : "—", sub: p.longCount ? `${p.longWins}/${p.longCount} correct` : undefined },
    { label: "Shorts", value: p.shortCount ? `${(p.shortWins / p.shortCount) * 100}%` : "—", sub: p.shortCount ? `${p.shortWins}/${p.shortCount} correct` : undefined },
  ];

  const maxQ = Math.max(...p.byQuarter.map((q) => q.wins + q.losses), 1);

  return (
    <section id="track" className="mx-auto w-full max-w-5xl px-5 py-20">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint">Track record</p>
          <h2 className="font-display mt-1 text-3xl font-semibold text-ink sm:text-4xl">
            Every call, scored.
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
            Every non-hold signal is timestamped at entry and re-checked the moment the horizon runs out.
            Public ledger, verifiable by anyone, built on zero cherry-picking.
          </p>
        </div>
        <div className="flex rounded-full border border-hairline bg-panel p-0.5 text-sm">
          <button
            onClick={() => setScope("research")}
            className={`rounded-full px-4 py-1.5 transition-colors ${scope === "research" ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"}`}
          >
            Research
          </button>
          <button
            onClick={() => setScope("personal")}
            className={`rounded-full px-4 py-1.5 transition-colors ${scope === "personal" ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"}`}
          >
            Personal swing
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-hairline bg-panel p-6 sm:p-8">
        <div className="mb-2 flex items-center justify-between text-[11px] text-ink-faint">
          <span>{scope === "personal" ? "Personal ≤7-day swing calls (your options account)" : "Public long-term research calls"}</span>
          <span className="num">Updated {fmtDate(track.generatedAt)}</span>
        </div>

        {p.scoredSignals === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="flex gap-1.5">
              <span className="h-2 w-2 rounded-full bg-ink animate-pulse-dot" />
              <span className="h-2 w-2 rounded-full bg-ink animate-pulse-dot" style={{ animationDelay: "0.2s" }} />
              <span className="h-2 w-2 rounded-full bg-ink animate-pulse-dot" style={{ animationDelay: "0.4s" }} />
            </div>
            <p className="text-sm text-ink-soft">
              No scored signals yet{scope === "personal" ? " — run <code>/trade</code> in Discord" : " — the next long-term signal will land here"}.
            </p>
            <p className="max-w-sm text-xs leading-relaxed text-ink-faint">
              Signals have to survive the full horizon before we&apos;ll grade them. Holds are filed, never
              scored — you can&apos;t be right about nothing.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-hairline bg-hairline sm:grid-cols-4">
              {stats.map((s) => (
                <div key={s.label} className="bg-panel p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint">{s.label}</p>
                  <p className="num mt-1 text-xl font-semibold text-ink sm:text-2xl">{s.value}</p>
                  {s.sub && <p className="mt-0.5 text-[11px] text-ink-soft">{s.sub}</p>}
                </div>
              ))}
            </div>

            {p.byQuarter.length > 0 && (
              <div className="mt-8">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-ink-faint">Win rate by quarter</p>
                <div className="flex items-end gap-2 sm:gap-3">
                  {p.byQuarter.map((q) => {
                    const total = q.wins + q.losses;
                    const h = Math.max(8, (total / maxQ) * 120);
                    return (
                      <div key={q.label} className="flex flex-1 flex-col items-center gap-1.5">
                        <div className="flex h-[120px] w-full max-w-[64px] items-end overflow-hidden rounded-md bg-hairline-soft">
                          <div className="flex h-full w-full flex-col-reverse">
                            <div className="w-full bg-bad/70" style={{ height: `${(q.losses / total) * 100}%` }} />
                            <div className="w-full bg-good" style={{ height: `${(q.wins / total) * 100}%` }} />
                          </div>
                        </div>
                        <span className="num text-[10px] text-ink-soft">{q.label}</span>
                        <span className="num text-[11px] font-semibold text-ink">{q.winRate == null ? "—" : `${(q.winRate * 100).toFixed(0)}%`}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-8">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-ink-faint">Recent scored calls</p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-hairline text-left text-[10px] uppercase tracking-widest text-ink-faint">
                      <th className="py-2 pr-4 font-semibold">Ticker</th>
                      <th className="py-2 pr-4 font-semibold">Call</th>
                      <th className="py-2 pr-4 font-semibold">Signaled</th>
                      <th className="py-2 pr-4 font-semibold">Exit</th>
                      <th className="py-2 pr-4 text-right font-semibold">Return</th>
                      <th className="py-2 pr-4 text-right font-semibold">S&P</th>
                      <th className="py-2 pr-4 text-right font-semibold">Alpha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...p.scored].reverse().map((s) => {
                      const vs = VERDICT_STYLE[s.verdict] ?? VERDICT_STYLE.HOLD;
                      return (
                        <tr key={`${s.ticker}-${s.signaled_at}`} className="border-b border-hairline-soft">
                          <td className="py-2.5 pr-4">
                            <span className="font-semibold text-ink">{s.ticker}</span>
                            {s.name && <span className="block max-w-[180px] truncate text-[11px] text-ink-faint">{s.name}</span>}
                          </td>
                          <td className="py-2.5 pr-4">
                            <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${vs.bg} ${vs.text}`}>
                              {s.verdict}
                            </span>
                          </td>
                          <td className="num py-2.5 pr-4 text-ink-soft">{fmtDate(s.signaled_at)}</td>
                          <td className="num py-2.5 pr-4 text-ink-soft">{fmtDate(s.exitDate)}</td>
                          <td className={`num py-2.5 pr-4 text-right font-semibold ${s.correct ? "text-good" : "text-bad"}`}>{fmtPct(s.ret)}</td>
                          <td className="num py-2.5 pr-4 text-right text-ink-soft">{s.spxRet == null ? "—" : fmtPct(s.spxRet)}</td>
                          <td className={`num py-2.5 pr-4 text-right ${s.alpha != null && s.alpha > 0 ? "text-good" : s.alpha != null ? "text-bad" : "text-ink-faint"}`}>
                            {s.alpha == null ? "—" : fmtPct(s.alpha)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
