"use client";

import { useState } from "react";
import { fmtPct } from "./format";
import { useWatchlist } from "./watchlistStore";

export default function WeeklyLetter({ scoredCount }: { scoredCount: number }) {
  const [letter, setLetter] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { list } = useWatchlist();

  async function write() {
    setLoading(true);
    try {
      const [mres, sres, wres] = await Promise.all([
        fetch("/api/markets").then((r) => r.json()).catch(() => null),
        fetch(`/api/screener?tickers=${encodeURIComponent("NVDA,AAPL,MSFT,GOOGL,AMZN,META,TSLA")}`).then((r) => r.json()).catch(() => null),
        list.length ? fetch(`/api/quote?tickers=${encodeURIComponent(list.slice(0, 10).join(","))}`).then((r) => r.json()).catch(() => null) : null,
      ]);

      const d = new Date();
      const week = d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      const lines: string[] = [];
      lines.push("# The QNTL Letter");
      lines.push(`Week of ${week}`);
      lines.push("");
      lines.push("The trend is your friend. The knife is not.");
      lines.push("");

      lines.push("## The tape this week");
      if (mres?.rows?.length) {
        for (const r of mres.rows) {
          const c = r.changePct;
          lines.push(`- ${r.label} (${r.symbol}): ${c == null ? "n/a" : fmtPct(c / 100)}`);
        }
      } else {
        lines.push("- Tape unavailable this week.");
      }
      lines.push("");

      lines.push("## The engine's top reads");
      if (sres?.rows?.length) {
        const sorted = sres.rows.filter((r: { error?: string }) => !r.error).sort((a: { score: number }, b: { score: number }) => b.score - a.score);
        const top = sorted.slice(0, 3);
        if (top.length) {
          lines.push("| Ticker | Call | Conviction |");
          lines.push("| --- | --- | --- |");
          for (const r of top) {
            lines.push(`| ${r.symbol} | ${r.verdict} | ${r.score >= 0 ? "+" : ""}${r.score.toFixed(2)} |`);
          }
        } else {
          lines.push("- The engine is holding its fire. No name on the board is worth paying up for right now.");
        }
      } else {
        lines.push("- Engine unavailable this week.");
      }
      lines.push("");

      if (list.length && wres?.rows?.length) {
        lines.push("## On your watchlist");
        for (const r of wres.rows) {
          if (r.error) continue;
          const c = r.changePct;
          lines.push(`- ${r.symbol}: ${r.price != null ? `$${r.price}` : "n/a"} (${c == null ? "n/a" : fmtPct(c / 100)})`);
        }
        lines.push("");
      }

      lines.push("## Track record");
      lines.push(
        scoredCount > 0
          ? `${scoredCount} graded call${scoredCount === 1 ? "" : "s"} on the public ledger so far, each scored against the S&P 500 at its 30-day exit.`
          : "No graded calls on the ledger yet. Every signal has to survive its full 30-day horizon before QNTL will grade it. Holds are filed, never scored. You can't be right about nothing.",
      );
      lines.push("");
      lines.push("---");
      lines.push("QNTL is a research tool, not financial advice. Check your own knives.");

      setLetter(lines.join("\n"));
    } catch {
      setLetter("Couldn't gather this week's data. Try again in a minute.");
    } finally {
      setLoading(false);
    }
  }

  function copy() {
    if (letter) navigator.clipboard.writeText(letter);
  }

  function download() {
    if (!letter) return;
    const blob = new Blob([letter], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `QNTL-letter-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  return (
    <section className="mx-auto w-full max-w-5xl px-5 pb-20">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint">The QNTL letter</p>
          <h2 className="font-display mt-1 text-2xl font-semibold text-ink sm:text-3xl">
            The week, filed.
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
            One page of what mattered: the tape, the engine&apos;s reads, and what moved on your watchlist.
            Copy it, drop it in a newsletter, or download it as markdown.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {letter && (
            <>
              <button onClick={copy} className="rounded-full border border-hairline px-3.5 py-1.5 text-xs font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink">
                Copy
              </button>
              <button onClick={download} className="rounded-full border border-hairline px-3.5 py-1.5 text-xs font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink">
                Download .md
              </button>
            </>
          )}
          <button
            onClick={write}
            disabled={loading}
            className="rounded-full bg-ink px-5 py-1.5 text-xs font-semibold text-paper transition-opacity hover:opacity-85 disabled:opacity-50"
          >
            {loading ? "Gathering the week…" : letter ? "Regenerate" : "Write the letter"}
          </button>
        </div>
      </div>

      {letter && (
        <div className="mt-5 rounded-2xl border border-hairline bg-panel p-6 sm:p-8">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink">{letter}</pre>
        </div>
      )}
    </section>
  );
}
