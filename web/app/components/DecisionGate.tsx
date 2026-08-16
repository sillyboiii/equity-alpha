"use client";

import { useState } from "react";
import { fmtPct, fmtPrice, VERDICT_STYLE } from "./format";
import { loadGate, saveGate, loadJournal, saveJournal, type GateEntry, type JournalEntry } from "./disciplineStore";

type Analysis = {
  symbol: string;
  name: string;
  quote: { price?: number | null };
  analysis: {
    score: number;
    verdict: string;
    guards: { id: string; rule: string }[];
    suggestedSize: number;
    thesis: string;
    fairValue: { blended: number | null };
    indicators: { price: number; atrPct: number | null };
  };
};

export default function DecisionGate() {
  const [ticker, setTicker] = useState("");
  const [size, setSize] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<Analysis | null>(null);
  const [thesis, setThesis] = useState("");
  const [justLogged, setJustLogged] = useState<string | null>(null);
  const [entries, setEntries] = useState<GateEntry[]>([]);

  const a = res?.analysis;
  const passed = a ? a.verdict === "BUY" || a.verdict === "STRONG BUY" : false;
  const guardTexts = a?.guards.map((g) => g.rule) ?? [];
  const intendedSize = parseFloat(size);
  const oversized = a != null && intendedSize > 0 && intendedSize > a.suggestedSize;
  const vStyle = a ? VERDICT_STYLE[a.verdict] ?? VERDICT_STYLE.HOLD : null;

  function refresh() {
    setEntries(loadGate());
  }

  function reset() {
    setTicker("");
    setSize("");
    setThesis("");
    setRes(null);
    setError(null);
    setJustLogged(null);
  }

  async function run() {
    const t = ticker.trim().toUpperCase();
    if (!t) return;
    setLoading(true);
    setError(null);
    setJustLogged(null);
    try {
      const r = await fetch(`/api/research?ticker=${encodeURIComponent(t)}`);
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? "The gate is down");
      setRes(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The gate is down");
      setRes(null);
    } finally {
      setLoading(false);
    }
  }

  function logDecision(traded: boolean, overrideThesis?: string) {
    if (!res || !a) return;
    const ts = new Date().toISOString();
    const entry: GateEntry = {
      ts,
      symbol: res.symbol,
      name: res.name,
      size: intendedSize || a.suggestedSize || 0,
      score: a.score,
      verdict: a.verdict,
      passed,
      guards: guardTexts,
      thesis: overrideThesis ?? thesis.trim(),
      traded,
    };
    const next = [entry, ...loadGate()].slice(0, 200);
    saveGate(next);
    setEntries(next);

    if (traded) {
      const j: JournalEntry = {
        id: `${ts}-${res.symbol}-BUY`,
        symbol: res.symbol,
        name: res.name,
        side: "BUY",
        size: intendedSize || a.suggestedSize || 0,
        price: a.indicators.price ?? null,
        ts,
        thesis: overrideThesis ?? thesis.trim(),
        rule: passed ? "gate" : "gate-override",
        verdict: a.verdict,
        scored: null,
      };
      saveJournal([j, ...loadJournal()].slice(0, 200));
    }
    setJustLogged(passed ? "buy" : traded ? "override" : "respect");
  }

  return (
    <section id="gate" className="mx-auto w-full max-w-5xl scroll-mt-20 px-5 pb-20">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint">The gate</p>
          <h2 className="font-display mt-1 text-2xl font-semibold text-ink sm:text-3xl">
            Plan before you buy. Or don&apos;t, and it&apos;s on record.
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
            Run a trade past the desk before you pull the trigger. It scores your idea, checks your size, and
            enforces the rules. If the gate refuses and you buy anyway, that goes on your record too. That&apos;s
            the whole point.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-hairline bg-panel p-6 sm:p-7">
        <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto]">
          <input
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="Ticker, e.g. NVDA"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="h-12 w-full rounded-xl border border-hairline bg-paper px-4 text-base font-medium tracking-wide text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-ink"
          />
          <input
            value={size}
            onChange={(e) => setSize(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="Size %"
            inputMode="decimal"
            className="h-12 w-full rounded-xl border border-hairline bg-paper px-4 text-base font-medium text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-ink"
          />
          <button
            onClick={run}
            disabled={loading}
            className="h-12 rounded-xl bg-ink px-6 text-sm font-semibold text-paper transition-opacity hover:opacity-85 disabled:opacity-50"
          >
            {loading ? "Running it…" : "Run it through"}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-bad">{error}</p>}

        {a && res && (
          <div className="mt-5 border-t border-hairline pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-display text-xl font-semibold text-ink">{res.symbol}</span>
                <span className="text-sm text-ink-faint">{res.name}</span>
                <span className="num text-sm text-ink-soft">{fmtPrice(a.indicators.price)}</span>
                {a.fairValue.blended != null && (
                  <span className="num text-xs text-ink-faint">fair {fmtPrice(a.fairValue.blended)}</span>
                )}
              </div>
              {vStyle && (
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${vStyle.bg} ${vStyle.ring} ${vStyle.text}`}>
                  {a.verdict} · {fmtPct(a.score)}
                </span>
              )}
            </div>

            {guardTexts.length > 0 && (
              <div className="mt-4 rounded-xl border border-bad/25 bg-bad/5 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-bad">Rules that would fire</p>
                <ul className="mt-1.5 space-y-1 text-sm text-bad">
                  {guardTexts.map((g) => (
                    <li key={g}>• {g}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              {a.suggestedSize > 0 && (
                <span className="rounded-full border border-hairline bg-paper px-3 py-1 text-ink-soft">
                  Suggested size <span className="num font-semibold text-ink">{a.suggestedSize}%</span>
                </span>
              )}
              {oversized && (
                <span className="rounded-full border border-bad/25 bg-bad/5 px-3 py-1 font-semibold text-bad">
                  Oversized vs the desk&apos;s {a.suggestedSize}%
                </span>
              )}
            </div>

            {passed && !oversized ? (
              <div className="mt-5 rounded-xl border border-good/30 bg-good/5 px-4 py-3">
                <p className="text-sm font-semibold text-good">The gate is open. {a.thesis}</p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={thesis}
                    onChange={(e) => setThesis(e.target.value)}
                    placeholder="One-line thesis, your words, before you buy"
                    className="h-11 flex-1 rounded-lg border border-hairline bg-paper px-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-ink"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => logDecision(false, thesis.trim() || "No thesis written")}
                      className="rounded-lg border border-hairline px-4 text-sm font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink"
                    >
                      Passed, no trade
                    </button>
                    <button
                      onClick={() => logDecision(true, thesis.trim() || "No thesis written")}
                      disabled={!thesis.trim()}
                      className="rounded-lg bg-good px-4 text-sm font-semibold text-paper transition-opacity hover:opacity-85 disabled:opacity-40"
                      title="Requires a thesis"
                    >
                      Bought it
                    </button>
                  </div>
                </div>
              </div>
            ) : passed && oversized ? (
              <div className="mt-5 rounded-xl border border-amber/40 bg-amber/5 px-4 py-3">
                <p className="text-sm font-semibold text-amber">Trend is green, but the size is greedy.</p>
                <p className="mt-1 text-xs text-ink-soft">
                  The desk would size this at {a.suggestedSize}% of your portfolio. You can log it anyway at your
                  size, and it gets graded like everything else.
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={thesis}
                    onChange={(e) => setThesis(e.target.value)}
                    placeholder="One-line thesis, your words, before you buy"
                    className="h-11 flex-1 rounded-lg border border-hairline bg-paper px-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-ink"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => logDecision(false, thesis.trim() || "No thesis written")}
                      className="rounded-lg border border-hairline px-4 text-sm font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink"
                    >
                      Pass, at desk size
                    </button>
                    <button
                      onClick={() => logDecision(true, thesis.trim() || "No thesis written")}
                      disabled={!thesis.trim()}
                      className="rounded-lg bg-amber px-4 text-sm font-semibold text-paper transition-opacity hover:opacity-85 disabled:opacity-40"
                      title="Requires a thesis"
                    >
                      Bought it oversized
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-bad/30 bg-bad/5 px-4 py-3">
                <p className="text-sm font-semibold text-bad">The gate refuses this trade.</p>
                <p className="mt-1 text-xs text-ink-soft">
                  {guardTexts.length > 0
                    ? "The trend rules are law around here. A buy against a fired rule is a discipline break, and it gets graded like a trade."
                    : "The desk would not put money here on the current setup. A buy now is a discipline break, and it gets graded like a trade."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => logDecision(false)}
                    className="rounded-lg border border-hairline bg-paper px-4 py-2 text-sm font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink"
                  >
                    Respect the gate
                  </button>
                  <button
                    onClick={() => logDecision(true)}
                    className="rounded-lg bg-bad px-4 py-2 text-sm font-semibold text-paper transition-opacity hover:opacity-85"
                  >
                    Bought it anyway
                  </button>
                </div>
              </div>
            )}

            {justLogged && (
              <p className="mt-3 text-xs font-medium text-good">
                Logged. {justLogged === "buy" && "Trade added to your journal, to be graded at 30 days."}
                {justLogged === "override" && "Trade added to your journal as a gate override. It gets graded like a trade."}
                {justLogged === "respect" && "Noted: you stayed disciplined. Nothing hit your journal."}
              </p>
            )}
          </div>
        )}

        {entries.length > 0 && (
          <div className="mt-5 border-t border-hairline pt-4">
            <div className="mb-2 flex items-baseline justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint">Recent gate runs</p>
              <button onClick={refresh} className="text-xs text-ink-faint transition-colors hover:text-ink">
                Refresh
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[540px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-hairline text-left text-[10px] uppercase tracking-widest text-ink-faint">
                    <th className="py-2 pr-4 font-semibold">When</th>
                    <th className="py-2 pr-4 font-semibold">Symbol</th>
                    <th className="py-2 pr-4 font-semibold">Verdict</th>
                    <th className="py-2 pr-4 font-semibold">Size</th>
                    <th className="py-2 pr-4 font-semibold">Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.slice(0, 8).map((e) => (
                    <tr key={e.ts} className="border-b border-hairline-soft last:border-0">
                      <td className="py-2 pr-4 text-xs text-ink-faint">{e.ts.slice(0, 16).replace("T", " ")}</td>
                      <td className="py-2 pr-4 font-semibold text-ink">{e.symbol}</td>
                      <td className="py-2 pr-4 text-ink-soft">{e.verdict}</td>
                      <td className="num py-2 pr-4 text-ink-soft">{e.size > 0 ? `${e.size}%` : "·"}</td>
                      <td className="py-2 pr-4 text-xs font-semibold">
                        {e.passed
                          ? e.traded
                            ? "Passed · bought"
                            : "Passed · stood down"
                          : e.traded
                            ? "Override · bought anyway"
                            : "Refused · respected"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
