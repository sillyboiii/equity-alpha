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

  const items = [...rows, ...rows];

  return (
    <section className="relative overflow-hidden border-b border-hairline-soft bg-paper/60">
      <div className="animate-tape flex w-max items-center hover:[animation-play-state:paused]">
        {items.map((r, i) => {
          const up = r.changePct != null && r.changePct > 0;
          const down = r.changePct != null && r.changePct < 0;
          return (
            <div
              key={`${r.symbol}-${i}`}
              className="flex items-center gap-2.5 px-6 py-2.5"
              aria-hidden={i >= rows.length}
            >
              <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint">{r.label}</span>
              <span className="num text-sm font-semibold text-ink">{fmtPrice(r.price)}</span>
              <span
                className={`num text-[11px] font-semibold ${
                  r.changePct == null ? "text-ink-faint" : up ? "text-good" : down ? "text-bad" : "text-ink-faint"
                }`}
              >
                {r.changePct == null ? "·" : `${up ? "+" : ""}${fmtPct(r.changePct)}`}
              </span>
              <span className="ml-2 h-3 w-px bg-hairline-soft" aria-hidden />
            </div>
          );
        })}
      </div>
    </section>
  );
}
