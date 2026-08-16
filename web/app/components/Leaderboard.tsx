"use client";

import { fmtPct, fmtDate, VERDICT_STYLE } from "./format";

type Scored = {
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
};

export default function Leaderboard({ track }: { track: unknown }) {
  const research = (track as { research?: { scored?: Scored[] } })?.research;
  const scored = [...(research?.scored ?? [])].sort((a, b) => (b.alpha ?? -999) - (a.alpha ?? -999));
  const total = scored.length;

  return (
    <section className="mx-auto w-full max-w-5xl px-5 pb-20">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint">The audit trail</p>
          <h2 className="font-display mt-1 text-2xl font-semibold text-ink sm:text-3xl">
            Every call, ranked by alpha.
          </h2>
        </div>
        {total > 0 && <span className="num text-xs text-ink-faint">{total} scored calls</span>}
      </div>

      {total === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-hairline bg-paper px-6 py-10 text-center">
          <p className="font-display text-lg font-semibold text-ink">The board is empty.</p>
          <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-ink-soft">
            Once QNTL&apos;s long-term signals survive their 30-day horizon, every graded call lands here ranked
            against the S&amp;P 500. Until then, the leaderboard waits like everyone else.
          </p>
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-2xl border border-hairline bg-panel">
          <table className="w-full min-w-[680px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-[10px] uppercase tracking-widest text-ink-faint">
                <th className="py-2.5 pl-5 pr-4 font-semibold">#</th>
                <th className="py-2.5 pr-4 font-semibold">Ticker</th>
                <th className="py-2.5 pr-4 font-semibold">Call</th>
                <th className="py-2.5 pr-4 font-semibold">Entered</th>
                <th className="py-2.5 pr-4 text-right font-semibold">Return</th>
                <th className="py-2.5 pr-4 text-right font-semibold">S&amp;P 500</th>
                <th className="py-2.5 pr-5 text-right font-semibold">Alpha</th>
              </tr>
            </thead>
            <tbody>
              {scored.map((s, i) => {
                const vs = VERDICT_STYLE[s.verdict] ?? VERDICT_STYLE.HOLD;
                return (
                  <tr key={`${s.ticker}-${s.signaled_at}`} className="border-b border-hairline-soft transition-colors last:border-0 hover:bg-paper">
                    <td className="num py-3 pl-5 pr-4 text-ink-faint">
                      {i + 1 === 1 ? "🥇" : i + 1 === 2 ? "🥈" : i + 1 === 3 ? "🥉" : `#${i + 1}`}
                    </td>
                    <td className="py-3 pr-4">
                      <span className="font-semibold text-ink">{s.ticker}</span>
                      {s.name && <span className="block max-w-[180px] truncate text-[11px] text-ink-faint">{s.name}</span>}
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${vs.bg} ${vs.text}`}>
                        {s.verdict}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-ink-soft">{fmtDate(s.signaled_at)}</td>
                    <td className={`num py-3 pr-4 text-right font-semibold ${s.ret >= 0 ? "text-good" : "text-bad"}`}>
                      {fmtPct(s.ret)}
                    </td>
                    <td className="num py-3 pr-4 text-right text-ink-soft">{s.spxRet != null ? fmtPct(s.spxRet) : "·"}</td>
                    <td className="py-3 pr-5 text-right">
                      <span className={`num font-bold ${(s.alpha ?? 0) >= 0 ? "text-good" : "text-bad"}`}>
                        {s.alpha != null ? fmtPct(s.alpha) : "·"}
                      </span>
                    </td>
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
