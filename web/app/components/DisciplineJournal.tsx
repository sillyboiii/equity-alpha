"use client";

import { useEffect, useState } from "react";
import { fmtPct, fmtDate } from "./format";
import { loadJournal, saveJournal, type JournalEntry } from "./disciplineStore";

const DAYS = 30;
const GRADE_MS = DAYS * 86400000;

export default function DisciplineJournal() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [grading, setGrading] = useState(false);

  function refresh() {
    setEntries(loadJournal());
  }

  useEffect(() => {
    refresh();
    const onJournal = () => refresh();
    window.addEventListener("qntl:journal", onJournal);
    window.addEventListener("qntl:book", onJournal);
    return () => {
      window.removeEventListener("qntl:journal", onJournal);
      window.removeEventListener("qntl:book", onJournal);
    };
  }, []);

  async function grade() {
    const due = entries.filter((e) => e.scored == null && Date.now() - new Date(e.ts).getTime() >= GRADE_MS);
    if (!due.length) return;
    setGrading(true);
    try {
      const tickers = [...new Set(due.map((e) => e.symbol))];
      const qRes = await fetch(`/api/quote?tickers=${encodeURIComponent(tickers.join(","))}`);
      const qJson = await qRes.json();
      const prices = new Map<string, number>();
      for (const row of qJson.rows ?? []) {
        if (row.price != null) prices.set(row.symbol, row.price);
      }

      const next = await Promise.all(
        entries.map(async (e) => {
          if (e.scored != null) return e;
          const due = Date.now() - new Date(e.ts).getTime() >= GRADE_MS;
          const cur = e.price != null ? prices.get(e.symbol) : null;
          if (!due || cur == null || e.price == null) return e;
          let ret = 0;
          let spxRet: number | null = null;
          try {
            ret = cur / e.price - 1;
            const spx = await fetch(`/api/spx?since=${e.ts.slice(0, 10)}`);
            const spxJson = await spx.json();
            spxRet = spxJson.ret ?? null;
          } catch {
            spxRet = null;
          }
          return {
            ...e,
            scored: {
              ret,
              spxRet,
              alpha: spxRet != null ? ret - spxRet : null,
              at: new Date().toISOString(),
            },
          };
        }),
      );
      saveJournal(next);
      setEntries(next);
    } catch {
    } finally {
      setGrading(false);
    }
  }

  useEffect(() => {
    if (!grading && entries.some((e) => e.scored == null)) {
      const t = setTimeout(grade, 400);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries.length, grading]);

  const graded = entries.filter((e) => e.scored != null);
  const avgAlpha = graded.length
    ? graded.reduce((s, e) => s + (e.scored?.alpha ?? 0), 0) / graded.length
    : null;
  const winRate = graded.length
    ? graded.filter((e) => (e.scored?.alpha ?? -1) >= 0).length / graded.length
    : null;
  const overrides = entries.filter((e) => e.rule === "gate-override").length;
  const compliance = graded.length
    ? graded.filter((e) => e.rule !== "gate-override").length / graded.length
    : null;
  const score =
    winRate != null && compliance != null
      ? Math.round(winRate * 70 + compliance * 30)
      : null;

  const dueCount = entries.filter((e) => e.scored == null && Date.now() - new Date(e.ts).getTime() >= GRADE_MS).length;

  return (
    <section id="journal" className="mx-auto w-full max-w-5xl scroll-mt-20 px-5 pb-20">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint">The journal</p>
          <h2 className="font-display mt-1 text-2xl font-semibold text-ink sm:text-3xl">
            Every trade, graded at 30 days.
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
            Trades that hit the journal get graded against the S&amp;P 500 over the same window. Beating the
            index is a good call; breaking the gate is a black mark. The score is win rate vs S&amp;P weighted
            with how often you followed the rules. Your decisions, your record.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-hairline bg-panel p-4">
          <p className="text-[10px] uppercase tracking-widest text-ink-faint">Discipline score</p>
          <p className="num mt-1 text-2xl font-bold text-ink">{score != null ? score : "·"}</p>
          <p className="mt-0.5 text-[11px] text-ink-faint">0-100, win rate + rule-following</p>
        </div>
        <div className="rounded-2xl border border-hairline bg-panel p-4">
          <p className="text-[10px] uppercase tracking-widest text-ink-faint">Graded trades</p>
          <p className="num mt-1 text-2xl font-bold text-ink">{graded.length}</p>
          <p className="mt-0.5 text-[11px] text-ink-faint">{dueCount > 0 ? `${dueCount} due for grading` : "all up to date"}</p>
        </div>
        <div className="rounded-2xl border border-hairline bg-panel p-4">
          <p className="text-[10px] uppercase tracking-widest text-ink-faint">Avg alpha vs S&amp;P</p>
          <p className={`num mt-1 text-2xl font-bold ${avgAlpha != null ? (avgAlpha >= 0 ? "text-good" : "text-bad") : "text-ink"}`}>
            {avgAlpha != null ? fmtPct(avgAlpha) : "·"}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-faint">per graded trade</p>
        </div>
        <div className="rounded-2xl border border-hairline bg-panel p-4">
          <p className="text-[10px] uppercase tracking-widest text-ink-faint">Win rate vs S&amp;P</p>
          <p className={`num mt-1 text-2xl font-bold ${winRate != null ? (winRate >= 0.5 ? "text-good" : "text-bad") : "text-ink"}`}>
            {winRate != null ? `${Math.round(winRate * 100)}%` : "·"}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-faint">{overrides > 0 ? `${overrides} gate overrides` : "no gate overrides"}</p>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-hairline bg-panel">
        {entries.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="font-display text-lg font-semibold text-ink">No trades on the ledger yet.</p>
            <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-ink-soft">
              Buy something through the gate and it lands here, stamped with your thesis, then graded against the
              S&amp;P 500 at 30 days. A discipline score of zero is better than no score at all.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-hairline text-left text-[10px] uppercase tracking-widest text-ink-faint">
                  <th className="py-3 pl-5 pr-4 font-semibold">Ticker</th>
                  <th className="py-3 pr-4 font-semibold">Bought</th>
                  <th className="py-3 pr-4 font-semibold">Thesis</th>
                  <th className="py-3 pr-4 font-semibold">Rule</th>
                  <th className="py-3 pr-4 text-right font-semibold">Return</th>
                  <th className="py-3 pr-4 text-right font-semibold">S&amp;P 500</th>
                  <th className="py-3 pr-5 text-right font-semibold">Alpha</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const vs = (e.scored?.alpha ?? null) != null ? (e.scored!.alpha! >= 0 ? "text-good" : "text-bad") : "text-ink-faint";
                  return (
                    <tr key={e.id} className="border-b border-hairline-soft last:border-0">
                      <td className="py-3 pl-5 pr-4">
                        <span className="font-semibold text-ink">{e.symbol}</span>
                        <span className="block text-[11px] text-ink-faint">{e.name}</span>
                      </td>
                      <td className="py-3 pr-4 text-ink-soft">{fmtDate(e.ts)}</td>
                      <td className="max-w-[220px] truncate py-3 pr-4 text-xs text-ink-soft" title={e.thesis}>
                        {e.thesis || "·"}
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          e.rule === "gate" ? "bg-good/10 text-good" : "bg-bad/10 text-bad"
                        }`}>
                          {e.rule === "gate" ? "Through the gate" : "Gate override"}
                        </span>
                      </td>
                      <td className="num py-3 pr-4 text-right font-semibold text-ink">
                        {e.scored ? fmtPct(e.scored.ret) : "pending"}
                      </td>
                      <td className="num py-3 pr-4 text-right text-ink-soft">
                        {e.scored?.spxRet != null ? fmtPct(e.scored.spxRet) : "·"}
                      </td>
                      <td className={`num py-3 pr-5 text-right font-bold ${vs}`}>
                        {e.scored?.alpha != null ? fmtPct(e.scored.alpha) : "·"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-3 text-[11px] text-ink-faint">
        {grading ? "Grading due trades…" : `Grades run automatically at ${DAYS} days, live against the S&amp;P 500. No deleting the record.`}
      </p>
    </section>
  );
}
