"use client";

import Logo from "./Logo";

type EntryId = "research" | "board" | "method" | "track";

const ENTRIES: { id: EntryId; title: string; body: string; tag: string }[] = [
  {
    id: "research",
    title: "Deep-dive research",
    body: "Score any ticker on six signals — trend, momentum, volatility, volume, value, quality — into one conviction call with a full breakdown.",
    tag: "Any ticker, no judgment",
  },
  {
    id: "board",
    title: "Board scan",
    body: "Scan a whole universe in one pass. Mag 7, Chips, Retail, Pharma, Energy — or roll your own list and see who's flashing green.",
    tag: "Whole sectors, one pass",
  },
  {
    id: "method",
    title: "How QNTL works",
    body: "The six signals, the three guards, and why we'd rather pass than catch a falling knife. Read the fine print before you trust the call.",
    tag: "Zero vibes, all receipts",
  },
  {
    id: "track",
    title: "Track record",
    body: "Every non-hold signal, timestamped at entry and graded at the 30-day exit against the S&P 500. Public ledger, no cherry-picking.",
    tag: "The receipts live here",
  },
];

export default function Hub({ onEnter }: { onEnter: (tab: EntryId) => void }) {
  return (
    <>
      <section className="hero-grid mx-auto w-full max-w-5xl px-5 pt-20 pb-14 text-center">
        <div className="relative">
          <Logo className="animate-hero-logo mx-auto h-20 w-20 text-ink sm:h-28 sm:w-28" />
          <p className="animate-hero-word text-[11px] font-semibold uppercase tracking-[0.25em] text-ink-faint" style={{ animationDelay: "150ms" }}>
            Trend-first research, zero opinions
          </p>
        <h1 className="font-display relative mt-4 text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-6xl">
          <span className="inline-block animate-hero-word">We</span>{" "}
          <span className="inline-block animate-hero-word" style={{ animationDelay: "260ms" }}>
            never
          </span>{" "}
          <span className="inline-block animate-hero-word" style={{ animationDelay: "370ms" }}>
            buy
          </span>{" "}
          <span className="inline-block animate-hero-word" style={{ animationDelay: "480ms" }}>
            a
          </span>{" "}
          <span className="inline-block animate-hero-word font-normal text-ink-soft" style={{ animationDelay: "590ms" }}>
            falling knife.
          </span>
        </h1>
        <p className="relative mx-auto mt-5 max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg">
          QNTL scores long-term trends against a valuation guardrail — it refuses to overpay, won&apos;t
          catch falling knives, and logs every call to a public ledger. No cherry-picking. No rose-tinted
          hindsight. Just the receipts.
        </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-5 pb-20">
        <div className="grid gap-4 sm:grid-cols-2">
          {ENTRIES.map((e, i) => (
            <button
              key={e.id}
              onClick={() => onEnter(e.id)}
              className="animate-tab-in group rounded-2xl border border-hairline bg-panel p-7 text-left transition-all hover:-translate-y-0.5 hover:border-ink hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)]"
              style={{ animationDelay: `${600 + i * 120}ms` }}
            >
              <p className="font-display text-xl font-semibold text-ink">{e.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{e.body}</p>
              <p className="mt-5 text-[11px] font-semibold uppercase tracking-widest text-ink-faint transition-colors group-hover:text-ink">
                {e.tag} →
              </p>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
