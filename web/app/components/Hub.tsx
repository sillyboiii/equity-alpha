"use client";

const GUARDS = [
  {
    id: "noKnife",
    title: "No falling knives",
    body: "A name in a downtrend is a name we wait on. The trend is the law and the knife is not.",
  },
  {
    id: "noOverpay",
    title: "No overpaying",
    body: "Strong trend, absurd valuation? We pass. Momentum is not a reason to pay a decade of growth upfront.",
  },
  {
    id: "noPumpShort",
    title: "No shorting pumps",
    body: "We don't short momentum, no matter how loud the take gets. Discipline cuts both ways.",
  },
];

export default function Hub({ onEnter }: { onEnter: (tab: "research" | "board" | "method" | "track") => void }) {
  return (
    <>
      <section className="hero-grid mx-auto w-full max-w-5xl px-5 pt-20 pb-14 text-center">
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="QNTL"
            width={160}
            height={160}
            className="animate-hero-logo mx-auto h-24 w-auto sm:h-32"
          />
          <p className="animate-hero-word text-[11px] font-semibold uppercase tracking-[0.25em] text-ink-faint" style={{ animationDelay: "150ms" }}>
            The discipline of a pro desk. On your phone.
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
            QNTL runs your research like a quant desk: trend rules as law, a valuation guardrail, and every
            call graded in public. It refuses to overpay, won&apos;t chase knives, and never lets you forget
            what it told you. No cherry-picking. No rose-tinted hindsight. Just the receipts.
          </p>

          <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#checkup"
              className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper transition-opacity hover:opacity-85"
            >
              Check my portfolio
            </a>
            <a
              href="#gate"
              className="rounded-full border border-hairline px-6 py-3 text-sm font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink"
            >
              Run it through the gate ↓
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-5 pb-10">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.25em] text-ink-faint">
          The method, in three refusals
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {GUARDS.map((g) => (
            <div key={g.id} className="rounded-2xl border border-hairline bg-panel p-6">
              <p className="font-display text-lg font-semibold text-ink">{g.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{g.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-5 pb-20">
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              id: "research" as const,
              title: "Deep-dive research",
              body: "Score any ticker on six signals into one conviction call, reasoning laid out line by line. An analyst memo you can actually audit.",
              tag: "The memo",
            },
            {
              id: "board" as const,
              title: "Board scan",
              body: "Sweep a whole universe in one pass and see who's flashing green and who's asking for a round trip.",
              tag: "The sweep",
            },
            {
              id: "method" as const,
              title: "How QNTL works",
              body: "Six signals, three guards, and the fine print you should read before trusting any call. This is the method.",
              tag: "The fine print",
            },
            {
              id: "track" as const,
              title: "Track record",
              body: "Every call, timestamped at entry and graded against the S&P 500 at the 30-day mark. An audit trail, not a highlight reel.",
              tag: "The audit",
            },
          ].map((e) => (
            <button
              key={e.id}
              onClick={() => onEnter(e.id)}
              className="group rounded-2xl border border-hairline bg-panel p-7 text-left transition-all hover:-translate-y-0.5 hover:border-ink hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)]"
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
