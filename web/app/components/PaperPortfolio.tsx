"use client";

import { useCallback, useEffect, useState } from "react";
import { fmtPrice, fmtPct, VERDICT_STYLE } from "./format";

const UNIVERSE = ["NVDA", "AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA"];
const STARTER = 10000;
const KEY = "qntl:book";

type Position = { symbol: string; qty: number; avgCost: number; openedAt: string; lastVerdict: string };
type Snapshot = { ts: string; value: number; cash: number; invested: number };
type Book = { cash: number; positions: Position[]; snapshots: Snapshot[]; startedAt: string };

const START_BOOK: Book = { cash: STARTER, positions: [], snapshots: [], startedAt: new Date().toISOString() };

function loadBook(): Book {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const b = JSON.parse(raw);
      if (typeof b.cash === "number" && Array.isArray(b.positions)) return b;
    }
  } catch {}
  return START_BOOK;
}

function saveBook(b: Book) {
  try {
    localStorage.setItem(KEY, JSON.stringify(b));
  } catch {}
}

type Quote = { symbol: string; price: number | null };

export default function PaperPortfolio() {
  const [book, setBook] = useState<Book | null>(null);
  const [marks, setMarks] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => setBook(loadBook()), []);

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

  if (!book) return null;

  const priceOf = (s: string) => marks[s] ?? null;
  const invested = book.positions.reduce((t, p) => t + p.qty * (priceOf(p.symbol) ?? p.avgCost), 0);
  const bookValue = book.cash + invested;
  const unrealized = book.positions.reduce((t, p) => t + p.qty * ((priceOf(p.symbol) ?? p.avgCost) - p.avgCost), 0);
  const totalReturn = bookValue / STARTER - 1;

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

      for (const p of positions) {
        if (buys.some((b: { symbol: string }) => b.symbol === p.symbol)) continue;
        const px = marks2[p.symbol] ?? p.avgCost;
        cash += p.qty * px;
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
          }
          cash -= alloc;
        }
      }

      const newBook: Book = {
        ...book,
        cash,
        positions,
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
            buy, exits everything else, and re-prices live from the tape.
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
    </section>
  );
}
