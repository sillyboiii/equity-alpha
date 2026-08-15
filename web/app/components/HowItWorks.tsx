const SIGNALS = [
  { name: "Trend", blurb: "Where the 50/200-day EMAs sit, and which way price respects them. The boss signal." },
  { name: "Momentum", blurb: "RSI and MACD — how hard the tape is pushing, and whether the push is real." },
  { name: "Volatility", blurb: "ATR vs. realized range. Volatility is fuel, but a blown fuel line still burns you." },
  { name: "Volume", blurb: "Whether the move is backed by money or just echo. Price without volume is a rumor." },
  { name: "Value", blurb: "PE, margin of safety, and blended DCF vs. where the tape is trading today." },
  { name: "Quality", blurb: "Margins, growth, balance-sheet discipline. The part that keeps the thesis honest." },
];

const GUARDS = [
  {
    title: "No falling knives",
    body: "We only buy trends that are still intact. A collapsing chart has to earn its way back onto the list — nobody catches knives around here.",
  },
  {
    title: "No overpaying",
    body: "Trend is the boss, but valuation is the bouncer. A hot trend at a silly multiple gets a pass, not a buy.",
  },
  {
    title: "No pumping short squeezes",
    body: "We never short a runaway momentum pump. Shorting hype is how you end up holding the bag in reverse.",
  },
];

export default function HowItWorks() {
  return (
    <section className="mx-auto w-full max-w-5xl px-5 py-16">
      <div className="max-w-2xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint">How QNTL works</p>
        <h2 className="font-display mt-1 text-3xl font-semibold text-ink sm:text-4xl">
          Six signals. One conviction score. Zero vibes.
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Every ticker gets weighed on six independent signals, each scored −1…+1. The composite becomes a
          conviction score, the score becomes a call, and every call gets graded when the 30-day horizon runs out.
        </p>
      </div>

      <div className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-3">
        {SIGNALS.map((s) => (
          <div key={s.name} className="bg-panel p-6">
            <p className="font-display text-lg font-semibold text-ink">{s.name}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{s.blurb}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {GUARDS.map((g) => (
          <div key={g.title} className="rounded-2xl border border-hairline bg-paper p-6">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              <span className="h-1.5 w-1.5 rounded-full bg-bad" />
              {g.title}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{g.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-hairline-soft bg-panel px-6 py-5 text-sm text-ink-soft">
        <span className="font-semibold uppercase tracking-widest text-ink-soft">The ledger</span> — every
        non-hold signal is timestamped at entry, re-checked at its 30-day exit, and compared against the S&amp;P 500.
        Holds are filed, never graded. The full record is public, below.
      </div>
    </section>
  );
}
