"use client";

import { useEffect, useState } from "react";
import { fmtPrice, VERDICT_STYLE } from "./format";
import { useWatchlist } from "./watchlistStore";

type Row = {
  symbol: string;
  name: string;
  price: number | null;
  score: number;
  verdict: string;
};

export default function Watchlist({ onResearch }: { onResearch: (symbol: string) => void }) {
  const { list, remove } = useWatchlist();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!list.length) {
      setRows([]);
      return;
    }
    let alive = true;
    setLoading(true);
    fetch(`/api/screener?tickers=${encodeURIComponent(list.slice(0, 12).join(","))}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d?.rows?.length) {
          setRows(
            d.rows
              .filter((r: Row) => !(r as Row & { error?: string }).error)
              .map((r: Row) => ({
                symbol: r.symbol,
                name: r.name,
                price: r.price,
                score: r.score,
                verdict: r.verdict,
              })),
          );
        }
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [list.join(",")]);

  if (!list.length) {
    return (
      <section className="mx-auto w-full max-w-5xl px-5 pb-20">
        <div className="rounded-2xl border border-dashed border-hairline bg-paper px-6 py-10 text-center">
          <p className="font-display text-lg font-semibold text-ink">Your watchlist is empty.</p>
          <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-ink-soft">
            Keep an eye on the names that matter to you. Research any ticker, then hit Add to watchlist, and
            they&apos;ll line up here with a live snapshot of the call.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-5xl px-5 pb-20">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint">Watchlist</p>
          <h2 className="font-display mt-1 text-2xl font-semibold text-ink sm:text-3xl">
            What&apos;s on your radar.
          </h2>
        </div>
        <span className="num text-xs text-ink-faint">{list.length} {list.length === 1 ? "name" : "names"}</span>
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-hairline bg-panel">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-hairline text-left text-[10px] uppercase tracking-widest text-ink-faint">
              <th className="py-2.5 pl-5 pr-4 font-semibold">Ticker</th>
              <th className="py-2.5 pr-4 text-right font-semibold">Price</th>
              <th className="py-2.5 pr-4 font-semibold">Call</th>
              <th className="py-2.5 pr-4 text-right font-semibold">Score</th>
              <th className="py-2.5 pr-5 text-right font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const vs = VERDICT_STYLE[r.verdict] ?? VERDICT_STYLE.HOLD;
              return (
                <tr key={r.symbol} className="border-b border-hairline-soft transition-colors last:border-0 hover:bg-paper">
                  <td className="py-3 pl-5 pr-4">
                    <span className="font-semibold text-ink">{r.symbol}</span>
                    <span className="block max-w-[200px] truncate text-[11px] text-ink-faint">{r.name}</span>
                  </td>
                  <td className="num py-3 pr-4 text-right text-ink">{r.price != null ? fmtPrice(r.price) : "·"}</td>
                  <td className="py-3 pr-4">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${vs.bg} ${vs.text}`}>
                      {r.verdict}
                    </span>
                  </td>
                  <td className="num py-3 pr-4 text-right font-semibold text-ink">
                    {r.score >= 0 ? "+" : ""}
                    {r.score.toFixed(2)}
                  </td>
                  <td className="py-3 pr-5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onResearch(r.symbol)}
                        className="rounded-full border border-hairline px-3 py-1 text-[11px] font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink"
                      >
                        Deep dive
                      </button>
                      <button
                        onClick={() => remove(r.symbol)}
                        aria-label={`Remove ${r.symbol} from watchlist`}
                        title="Remove from watchlist"
                        className="flex h-6 w-6 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-bad/10 hover:text-bad"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-3.5 w-3.5">
                          <path d="M6 6l12 12M18 6L6 18" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {loading && <p className="border-t border-hairline-soft px-5 py-2 text-[11px] text-ink-faint">Refreshing quotes…</p>}
      </div>
    </section>
  );
}
