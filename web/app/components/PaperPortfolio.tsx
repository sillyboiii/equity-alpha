"use client";

import { useCallback, useEffect, useState } from "react";
import { fmtDate, fmtPrice, fmtPct, VERDICT_STYLE } from "./format";

const UNIVERSE = ["NVDA", "AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA"];
const STARTER = 10000;
const KEY = "qntl:book";

type Position = {
  symbol: string;
  qty: number;
  avgCost: number;
  openedAt: string;
  lastVerdict: string;
  grade?: { ret: number; spxRet: number | null; alpha: number | null; gradedAt: string } | null;
};
type Call = { ts: string; kind: "BUY" | "EXIT"; symbol: string; verdict: string; price: number | null };
type Snapshot = { ts: string; value: number; cash: number; invested: number };
type Book = { cash: number; positions: Position[]; snapshots: Snapshot[]; calls: Call[]; startedAt: string };

const START_BOOK: Book = { cash: STARTER, positions: [], snapshots: [], calls: [], startedAt: new Date().toISOString() };

function loadBook(): Book {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const b = JSON.parse(raw);
      if (typeof b.cash === "number" && Array.isArray(b.positions)) {
        return { ...START_BOOK, ...b, calls: Array.isArray(b.calls) ? b.calls : [] };
      }
    }
  } catch {}
  return START_BOOK;
}

function saveBook(b: Book) {
  try {
    localStorage.setItem(KEY, JSON.stringify(b));
    window.dispatchEvent(new Event("qntl:book"));
  } catch {}
}

type Quote = { symbol: string; price: number | null };

export default function PaperPortfolio() {
  const [book, setBook] = useState<Book | null>(null);
  const [marks, setMarks] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setBook(loadBook());
    const onSync = () => setBook(loadBook());
    window.addEventListener("qntl:book", onSync);
    return () => window.removeEventListener("qntl:book", onSync);
  }, []);

  const refreshMarks = useCallback(async () => {
    if (!book || book.positions.length === 0) return;
    const symbols = book.positions.map((p) => p.symbol);
    try {
      const res = await fetch(`/api/quote?tickers=${encodeURIComponent(symbols.join(","))}`);
      const d = await res.json();
      if (d?.rows) {
        const m: Record<string, number> = {};
        for (const r of d.rows) if (r.price != null) m[r.symbol] = r.price;
        setMarks(m);
      }
    } catch {}
  }, [book]);

  useEffect(() => {
    refreshMarks();
    const id = setInterval(refreshMarks, 45000);
    return () => clearInterval(id);
  }, [refreshMarks]);

  useEffect(() => {
    if (!book) return;
    const aged = book.positions.filter((p) => {
      if (p.grade) return false;
      return Date.now() - new Date(p.openedAt).getTime() >= 30 * 86400000;
    });
    if (aged.length === 0) return;
    let alive = true;
    (async () => {
      const updates: Partial<Record<string, Position["grade"]>> = {};
      for (const p of aged) {
        try {
          const res = await fetch(`/api/spx?since=${encodeURIComponent(p.openedAt.slice(0, 10))}`);
          const d = await res.json();
          if (!res.ok || d.ret == null) continue;
          const px = priceOf(p.symbol);
          const ret = px != null ? px / p.avgCost - 1 : null;
          if (ret == null) continue;
          updates[p.symbol] = {
            ret,
            spxRet: d.ret,
            alpha: ret - d.ret,
            gradedAt: new Date().toISOString(),
          };
        } catch {}
      }
      if (!alive) return;
      const syms = Object.keys(updates);
      if (syms.length === 0) return;
      const newBook: Book = {
        ...book,
        positions: book.positions.map((p) => (updates[p.symbol] ? { ...p, grade: updates[p.symbol] } : p)),
      };
      setBook(newBook);
      saveBook(newBook);
    })();
    return () => {
      alive = false;
    };
  }, [book?.positions.length]);

  if (!book) return null;

  const priceOf = (s: string) => marks[s] ?? null;
  const invested = book.positions.reduce((t, p) => t + p.qty * (priceOf(p.symbol) ?? p.avgCost), 0);
  const bookValue = book.cash + invested;
  const unrealized = book.positions.reduce((t, p) => t + p.qty * ((priceOf(p.symbol) ?? p.avgCost) - p.avgCost), 0);
  const totalReturn = bookValue / STARTER - 1;
  const graded = book.positions.filter((p) => p.grade);

  async function rebalance() {
    if (!book || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/screener?tickers=${encodeURIComponent(UNIVERSE.join(","))}`);
      const d = await res.json();
      if (!d?.rows) throw new Error("Scan failed");

      const valid = d.rows.filter((r: { error?: string }) => !r.error);
      const buys = valid.filter((r: { verdict: string }) => r.verdict === "BUY" || r.verdict === "STRONG BUY");
      const marks2: Record<string, number> = {};
      for (const r of valid) if (r.price != null) marks2[r.symbol] = r.price;
      setMarks(marks2);

      let cash = book.cash;
      let positions = [...book.positions];
      const calls: Call[] = [];

      for (const p of positions) {
        if (buys.some((b: { symbol: string }) => b.symbol === p.symbol)) continue;
        const px = marks2[p.symbol] ?? p.avgCost;
        cash += p.qty * px;
        calls.push({ ts: new Date().toISOString(), kind: "EXIT", symbol: p.symbol, verdict: p.lastVerdict, price: px });
        positions = positions.filter((x) => x.symbol !== p.symbol);
      }

      if (buys.length > 0) {
        const alloc = cash / buys.length;
        for (const b of buys) {
          const px = marks2[b.symbol];
          if (px == null || px <= 0) continue;
          const existing = positions.find((p) => p.symbol === b.symbol);
          if (existing) {
            positions = positions.map((p) =>
              p.symbol === b.symbol ? { ...p, avgCost: (p.avgCost * p.qty + alloc) / (p.qty + alloc / px), qty: p.qty + alloc / px, lastVerdict: b.verdict } : p,
            );
          } else {
            positions.push({ symbol: b.symbol, qty: alloc / px, avgCost: px, openedAt: new Date().toISOString(), lastVerdict: b.verdict });
            calls.push({ ts: new Date().toISOString(), kind: "BUY", symbol: b.symbol, verdict: b.verdict, price: px });
          }
          cash -= alloc;
        }
      }

      const newBook: Book = {
        ...book,
        cash,
        positions,
        calls: [...calls.reverse(), ...book.calls].slice(0, 40),
        snapshots: [...book.snapshots, { ts: new Date().toISOString(), value: cash + positions.reduce((t, p) => t + p.qty * (marks2[p.symbol] ?? p.avgCost), 0), cash, invested: 0 }].slice(-200),
      };
      setBook(newBook);
      saveBook(newBook);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function close(symbol: string) {
    if (!book) return;
    const p = book.positions.find((x) => x.symbol === symbol);
    if (!p) return;
    const px = priceOf(symbol) ?? p.avgCost;
    const newBook: Book = {
      ...book,
      cash: book.cash + p.qty * px,
      positions: book.positions.filter((x) => x.symbol !== symbol),
      calls: [{ ts: new Date().toISOString(), kind: "EXIT", symbol, verdict: p.lastVerdict, price: px } as Call, ...book.calls].slice(0, 40),
      snapshots: [...book.snapshots, { ts: new Date().toISOString(), value: book.cash + p.qty * px + book.positions.filter((x) => x.symbol !== symbol).reduce((t, x) => t + x.qty * (priceOf(x.symbol) ?? x.avgCost), 0), cash: book.cash + p.qty * px, invested: 0 }].slice(-200),
    };
    setBook(newBook);
    saveBook(newBook);
  }

  function reset() {
    setBook(START_BOOK);
    saveBook(START_BOOK);
    setMarks({});
  }

  const pts = [STARTER, ...book.snapshots.map((s) => s.value)];
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min || 1;
  const path = pts
    .map((v, i) => {
      const x = (i / (pts.length - 1)) * 600;
      const y = 110 - ((v - min) / range) * 90;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const lastVal = pts[pts.length - 1];

  return (
    <section className="mx-auto w-full max-w-5xl px-5 pb-20">
        <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint">Paper portfolio</p>
          <h2 className="font-display mt-1 text-2xl font-semibold text-ink sm:text-3xl">
            QNTL puts $10k where its mouth is.
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
            A simulated book that auto-follows the engine. Hit rebalance and the account buys every name QNTL rates a
            buy, exits everything else, and re-prices live from the tape. Every buy and exit is logged as a public
            call and graded at 30 days against the S&amp;P 500.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={reset} className="rounded-full border border-hairline px-3.5 py-1.5 text-xs font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink">
            Reset
          </button>
          <button
            onClick={rebalance}
            disabled={loading}
            className="rounded-full bg-ink px-5 py-1.5 text-xs font-semibold text-paper transition-opacity hover:opacity-85 disabled:opacity-50"
          >
            {loading ? "Rebalancing…" : "Rebalance now"}
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-hairline bg-panel p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint">Book value</p>
          <p className="num mt-1 text-2xl font-semibold text-ink">${bookValue.toFixed(2)}</p>
        </div>
        <div className="rounded-2xl border border-hairline bg-panel p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint">Cash</p>
          <p className="num mt-1 text-2xl font-semibold text-ink">${book.cash.toFixed(2)}</p>
        </div>
        <div className="rounded-2xl border border-hairline bg-panel p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint">Unrealized P&amp;L</p>
          <p className={`num mt-1 text-2xl font-semibold ${unrealized >= 0 ? "text-good" : "text-bad"}`}>
            {unrealized >= 0 ? "+" : ""}${unrealized.toFixed(2)}
          </p>
        </div>
        <div className="rounded-2xl border border-hairline bg-panel p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint">All-time return</p>
          <p className={`num mt-1 text-2xl font-semibold ${totalReturn >= 0 ? "text-good" : "text-bad"}`}>{fmtPct(totalReturn)}</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-hairline bg-panel p-6">
        <div className="mb-2 flex items-baseline justify-between text-[11px] text-ink-faint">
          <span>Equity curve</span>
          <span className="num">{book.snapshots.length} rebalance{book.snapshots.length === 1 ? "" : "s"} tracked</span>
        </div>
        <svg viewBox="0 0 600 120" className="w-full" preserveAspectRatio="none">
          <line x1="0" y1="110" x2="600" y2="110" stroke="var(--hairline)" strokeWidth="1" />
          <path d={path} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-ink" vectorEffect="non-scaling-stroke" />
          <circle cx="600" cy={110 - ((lastVal - min) / range) * 90} r="4" fill="var(--ink)" />
        </svg>
        <p className="num mt-1 text-right text-[11px] text-ink-faint">${lastVal.toFixed(0)}</p>
      </div>

      {book.positions.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-hairline bg-paper px-6 py-8 text-center">
          <p className="font-display text-lg font-semibold text-ink">All in cash. Waiting for the engine.</p>
          <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-ink-soft">
            Hit Rebalance now and QNTL will load up on every name it currently rates a buy. If it says the board is
            too rich, the book just sits here and waits. That&apos;s the discipline.
          </p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-hairline bg-panel">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-[10px] uppercase tracking-widest text-ink-faint">
                <th className="py-2.5 pl-5 pr-4 font-semibold">Position</th>
                <th className="py-2.5 pr-4 text-right font-semibold">Qty</th>
                <th className="py-2.5 pr-4 text-right font-semibold">Avg cost</th>
                <th className="py-2.5 pr-4 text-right font-semibold">Last</th>
                <th className="py-2.5 pr-4 text-right font-semibold">Unrealized</th>
                <th className="py-2.5 pr-5 text-right font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {book.positions.map((p) => {
                const px = priceOf(p.symbol) ?? p.avgCost;
                const u = p.qty * (px - p.avgCost);
                const vs = VERDICT_STYLE[p.lastVerdict] ?? VERDICT_STYLE.HOLD;
                return (
                  <tr key={p.symbol} className="border-b border-hairline-soft transition-colors last:border-0 hover:bg-paper">
                    <td className="py-3 pl-5 pr-4">
                      <span className="flex items-center gap-2">
                        <span className="font-semibold text-ink">{p.symbol}</span>
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${vs.bg} ${vs.text}`}>{p.lastVerdict}</span>
                        {p.grade && (
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${p.grade.alpha != null && p.grade.alpha >= 0 ? "bg-good/10 text-good" : "bg-bad/10 text-bad"}`}
                            title={`Graded at 30 days vs S&P 500`}
                          >
                            {p.grade.alpha != null ? `graded ${fmtPct(p.grade.alpha)} vs S&P` : "graded"}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="num py-3 pr-4 text-right text-ink">{p.qty.toFixed(3)}</td>
                    <td className="num py-3 pr-4 text-right text-ink-soft">{fmtPrice(p.avgCost)}</td>
                    <td className="num py-3 pr-4 text-right font-semibold text-ink">{fmtPrice(px)}</td>
                    <td className={`num py-3 pr-4 text-right font-semibold ${u >= 0 ? "text-good" : "text-bad"}`}>
                      {u >= 0 ? "+" : ""}${u.toFixed(2)}
                    </td>
                    <td className="py-3 pr-5 text-right">
                      <button
                        onClick={() => close(p.symbol)}
                        className="rounded-full border border-hairline px-3 py-1 text-[11px] font-semibold text-ink-soft transition-colors hover:border-bad hover:text-bad"
                      >
                        Close
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8 rounded-2xl border border-hairline bg-panel p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint">Public call log</p>
          <span className="num text-[11px] text-ink-faint">{book.calls.length} calls · {graded.length} graded at 30 days</span>
        </div>
        {graded.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {graded.map((p) => (
              <span
                key={p.symbol}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                  p.grade?.alpha != null && p.grade.alpha >= 0 ? "border-good/30 bg-good/10 text-good" : "border-bad/30 bg-bad/10 text-bad"
                }`}
              >
                {p.symbol} · {fmtPct(p.grade?.ret ?? 0)} vs S&amp;P {fmtPct(p.grade?.spxRet ?? 0)} · alpha {fmtPct(p.grade?.alpha ?? 0)}
              </span>
            ))}
          </div>
        )}
        {book.calls.length === 0 ? (
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            No calls yet. Hit Rebalance now and the first entries land here, timestamped and public.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-hairline text-left text-[10px] uppercase tracking-widest text-ink-faint">
                  <th className="py-2 pr-4 font-semibold">Date</th>
                  <th className="py-2 pr-4 font-semibold">Action</th>
                  <th className="py-2 pr-4 font-semibold">Ticker</th>
                  <th className="py-2 pr-4 font-semibold">Call</th>
                  <th className="py-2 pr-0 text-right font-semibold">Price</th>
                </tr>
              </thead>
              <tbody>
                {book.calls.map((c, i) => {
                  const cv = VERDICT_STYLE[c.verdict] ?? VERDICT_STYLE.HOLD;
                  return (
                    <tr key={`${c.ts}-${i}`} className="border-b border-hairline-soft last:border-0">
                      <td className="py-2 pr-4 text-ink-soft">{fmtDate(c.ts)}</td>
                      <td className={`py-2 pr-4 font-semibold ${c.kind === "BUY" ? "text-good" : "text-bad"}`}>{c.kind}</td>
                      <td className="py-2 pr-4 font-semibold text-ink">{c.symbol}</td>
                      <td className="py-2 pr-4">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${cv.bg} ${cv.text}`}>{c.verdict}</span>
                      </td>
                      <td className="num py-2 pr-0 text-right text-ink">{c.price != null ? fmtPrice(c.price) : "·"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
