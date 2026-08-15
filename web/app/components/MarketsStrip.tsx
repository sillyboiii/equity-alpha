"use client";

import { useEffect, useState } from "react";
import { fmtPrice, fmtPct } from "./format";

type Row = { symbol: string; label: string; name: string; price: number; changePct: number | null };

export default function MarketsStrip() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/markets")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d?.rows?.length) setRows(d.rows);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!rows?.length) return null;

  return (
    <section className="border-y border-hairline-soft bg-panel/60">
      <div className="mx-auto flex w-full max-w-5xl items-stretch justify-between gap-4 overflow-x-auto px-5 py-3">
        {rows.map((r) => {
          const up = r.changePct != null && r.changePct > 0;
          const down = r.changePct != null && r.changePct < 0;
          return (
            <div key={r.symbol} className="flex min-w-[86px] flex-col items-start gap-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint">{r.label}</span>
              <span className="num text-sm font-semibold text-ink">{fmtPrice(r.price)}</span>
              <span
                className={`num text-[11px] font-semibold ${
                  r.changePct == null ? "text-ink-faint" : up ? "text-good" : down ? "text-bad" : "text-ink-faint"
                }`}
              >
                {r.changePct == null ? "—" : `${up ? "+" : ""}${fmtPct(r.changePct)}`}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
