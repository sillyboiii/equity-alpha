"use client";

import { useEffect, useState } from "react";

type Item = { title: string; link: string; publisher: string | null; ts: number | null; tickers: string[] };

function relTime(ts: number | null): string {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function NewsStrip() {
  const [items, setItems] = useState<Item[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/news")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d?.items?.length) setItems(d.items.slice(0, 6));
        else if (alive) setFailed(true);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  if (failed || items.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-5xl px-5 pb-20">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint">Today&apos;s tape</p>
        <span className="text-[11px] text-ink-faint">straight from the news feed</span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((n, i) => (
          <a
            key={i}
            href={n.link}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col justify-between rounded-2xl border border-hairline bg-panel p-5 transition-all hover:-translate-y-0.5 hover:border-ink"
          >
            <p className="text-sm font-medium leading-snug text-ink transition-colors group-hover:text-ink">
              {n.title}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-faint">
              {n.publisher && <span className="font-semibold uppercase tracking-widest">{n.publisher}</span>}
              {n.ts && <span className="num">{relTime(n.ts)}</span>}
              {n.tickers.map((t) => (
                <span key={t} className="num rounded-full border border-hairline-soft bg-paper px-2 py-0.5">
                  {t}
                </span>
              ))}
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
