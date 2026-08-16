"use client";

import { useEffect, useRef, useState } from "react";
import AuthButton from "./AuthButton";
import BacktestPanel from "./BacktestPanel";
import CountUp from "./CountUp";
import DecisionGate from "./DecisionGate";
import DisciplineJournal from "./DisciplineJournal";
import HowItWorks from "./HowItWorks";
import Hub from "./Hub";
import Leaderboard from "./Leaderboard";
import MarketsStrip from "./MarketsStrip";
import NewsStrip from "./NewsStrip";
import PaperPortfolio from "./PaperPortfolio";
import PortfolioCheckup from "./PortfolioCheckup";
import PriceChart from "./PriceChart";
import Reveal from "./Reveal";
import Screener from "./Screener";
import ShareButton from "./ShareCard";
import ThemeToggle from "./ThemeToggle";
import TrackRecord from "./TrackRecord";
import Watchlist from "./Watchlist";
import WeeklyLetter from "./WeeklyLetter";
import { useWatchlist } from "./watchlistStore";
import {
  ema,
  fmtMarketCap,
  fmtPct,
  fmtPrice,
  toneClass,
  VERDICT_STYLE,
} from "./format";

type Component = { score: number; note: string };
type ResearchData = {
  symbol: string;
  name: string;
  quote: Record<string, unknown>;
  analysis: {
    score: number;
    verdict: string;
    direction: string;
    strategy: { id: string; name: string; description: string; timeframe: string };
    guards: { id: string; rule: string }[];
    components: Record<string, Component>;
    grades: { quality: string; value: string };
    volatilityRisk: string;
    thesis: string;
    indicators: {
      price: number;
      rsi: number | null;
      ema50: number | null;
      ema200: number | null;
      emaFast: number | null;
      emaSlow: number | null;
      atrPct: number | null;
      macdHistogram: number | null;
    };
    fairValue: { dcf: number | null; dcfMethod: string | null; analyst: number | null; blended: number | null; marginOfSafety: number | null; price: number | null };
    scenarios: { price: number; bull: number | null; base: number; bear: number | null; upside: { bull: number | null; base: number; bear: number | null } } | null;
    suggestedSize: number;
    reasoning: string[];
  };
  comps: {
    metrics: { label: string; ours: number; peerMedian: number; diffPct: number; tone: string }[];
    verdict: string | null;
    tone: string;
    peerCount: number;
  } | null;
  candles: { date: string; open: number; high: number; low: number; close: number; volume: number }[];
};

const SAMPLES = ["NVDA", "AAPL", "MSFT", "TSLA", "SPOT", "META"];
const COMPONENT_LABELS: Record<string, string> = {
  trend: "Trend",
  momentum: "Momentum",
  volatility: "Volatility",
  volume: "Volume",
  value: "Value",
  quality: "Quality",
};
const GUARD_TEXT: Record<string, string> = {
  noOverpay: "Won't overpay. Refuses to pay a premium for the trend",
  noKnifeCatch: "Won't catch falling knives",
  noPumpShort: "Won't short a momentum pump",
};

function ScoreGauge({ score }: { score: number }) {
  const pct = ((score + 1) / 2) * 100;
  const color = score >= 0.25 ? "bg-good" : score > -0.25 ? "bg-ink-soft" : "bg-bad";
  const text = score >= 0.25 ? "text-good" : score > -0.25 ? "text-ink-soft" : "text-bad";
  return (
    <div>
      <div className="flex justify-between text-[10px] uppercase tracking-widest text-ink-faint">
        <span>-1</span>
        <span className="font-semibold">Conviction</span>
        <span>+1</span>
      </div>
      <div className="relative mt-1.5 h-2 rounded-full bg-hairline-soft">
        <div className="absolute left-0 top-1/2 h-full w-1/2 -translate-y-1/2 border-r border-dashed border-ink/30" />
        <div
          className={`absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${color}`}
          style={{ left: `${pct}%` }}
        />
      </div>
      <p className={`mt-1.5 text-center text-sm font-semibold ${text}`}>
        <CountUp value={score} className={text} />
      </p>
    </div>
  );
}

function ComponentBars({ components }: { components: Record<string, Component> }) {
  return (
    <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
      {Object.entries(components).map(([key, c]) => {
        const pct = ((c.score + 1) / 2) * 100;
        const color = c.score >= 0.25 ? "bg-good" : c.score > -0.25 ? "bg-ink-soft" : "bg-bad";
        const text = c.score >= 0.25 ? "text-good" : c.score > -0.25 ? "text-ink-soft" : "text-bad";
        return (
          <div key={key}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-ink">{COMPONENT_LABELS[key] ?? key}</span>
              <span className={`num font-semibold ${text}`}>
                {c.score >= 0 ? "+" : ""}
                {c.score.toFixed(2)}
              </span>
            </div>
            <div className="relative h-1.5 rounded-full bg-hairline-soft">
              <div className="absolute left-0 top-1/2 h-full w-1/2 -translate-y-1/2 border-r border-dashed border-ink/25" />
              <div className={`absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${color}`} style={{ left: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function IndRow({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" | "flat" }) {
  const cls = tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : "text-ink";
  return (
    <div className="flex items-baseline justify-between border-b border-hairline-soft py-2 text-sm last:border-0">
      <span className="text-ink-soft">{label}</span>
      <span className={`num font-semibold ${cls}`}>{value}</span>
    </div>
  );
}

function FairValueBar({ price, blended }: { price: number; blended: number }) {
  const lo = Math.min(price, blended) * 0.9;
  const hi = Math.max(price, blended) * 1.1;
  const pPct = ((price - lo) / (hi - lo)) * 100;
  const bPct = ((blended - lo) / (hi - lo)) * 100;
  return (
    <div className="relative mt-4 h-1.5 rounded-full bg-hairline-soft">
      <div className="absolute left-0 top-1/2 h-full w-1/2 -translate-y-1/2 border-r border-dashed border-ink/25" />
      <div className="absolute top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-ink" style={{ left: `${pPct}%` }} title="Price" />
      <div className="absolute top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-good" style={{ left: `${bPct}%` }} title="Fair value" />
    </div>
  );
}

type Tab = "hub" | "research" | "board" | "method" | "track";
const TABS: { id: Tab; label: string }[] = [
  { id: "research", label: "Research" },
  { id: "board", label: "Board" },
  { id: "method", label: "Method" },
  { id: "track", label: "Track record" },
];

export default function ResearchApp({ initialTrack }: { initialTrack: unknown }) {
  const [tab, setTab] = useState<Tab>("hub");
  const [ticker, setTicker] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ResearchData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<{ symbol: string; verdict: string; ts: string }[]>([]);
  const resultRef = useRef<HTMLDivElement>(null);
  const { list: watchlist, toggle: toggleWatch } = useWatchlist();

  function go(t: Tab) {
    setTab(t);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem("qntl:recent");
      if (raw) setRecent(JSON.parse(raw));
    } catch {}
  }, []);

  function remember(symbol: string, verdict: string) {
    setRecent((prev) => {
      const next = [{ symbol, verdict, ts: new Date().toISOString() }, ...prev.filter((r) => r.symbol !== symbol)].slice(0, 8);
      try {
        localStorage.setItem("qntl:recent", JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  async function run(sym: string) {
    const t = sym.trim().toUpperCase();
    if (!t) return;
    setTab("research");
    setTicker(t);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/research?ticker=${encodeURIComponent(t)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Research failed");
      setData(json);
      remember(t, json.analysis?.verdict ?? "·");
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Research failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  const a = data?.analysis;
  const candles = data?.candles ?? [];
  const closes = candles.map((c) => c.close);
  const dayChange = closes.length >= 2 ? closes[closes.length - 1] / closes[closes.length - 2] - 1 : null;
  const ema50Arr = ema(closes, 50);
  const ema200Arr = ema(closes, 200);
  const vs = (emaVal: number | null) =>
    emaVal != null && a?.indicators.price ? (a.indicators.price / emaVal - 1) * 100 : null;
  const fair = a?.fairValue;
  const scenarios = a?.scenarios;
  const comps = data?.comps;
  const quote = data?.quote as Record<string, any> | undefined;
  const guardChips = a?.guards.map((g) => GUARD_TEXT[g.id] ?? g.rule).filter(Boolean) ?? [];
  const vsStyle = a ? VERDICT_STYLE[a.verdict] ?? VERDICT_STYLE.HOLD : null;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-hairline bg-paper/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-5 py-3">
          <button
            onClick={() => go("hub")}
            className="flex shrink-0 items-center gap-2 transition-opacity hover:opacity-80"
            aria-label="Back to hub"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="QNTL" height={32} className="h-8 w-auto" />
            <span className="font-display text-lg font-semibold tracking-tight text-ink">
              QNTL<span className="italic text-ink-soft">.</span>
            </span>
          </button>

          <nav className="flex min-w-0 items-center gap-1 overflow-x-auto text-sm">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => go(t.id)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  tab === t.id ? "bg-ink text-paper" : "text-ink-soft hover:bg-panel hover:text-ink"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <AuthButton />
            <ThemeToggle />
            <a
              href="https://github.com/sillyboiii/equity-alpha"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-hairline px-3.5 py-1.5 text-xs font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink"
            >
              GitHub
            </a>
          </div>
        </div>
      </header>

      <main id="top">
        {tab === "hub" && (
          <div key="hub" className="animate-tab-in">
            <MarketsStrip />
            <Hub onEnter={go} />
            <PortfolioCheckup />
            <DecisionGate />
            <DisciplineJournal />
            <BacktestPanel />
            <Leaderboard track={initialTrack} />
            <PaperPortfolio />
            <Watchlist onResearch={(s: string) => run(s)} />
            <WeeklyLetter scoredCount={(initialTrack as { research?: { scoredSignals?: number } } | null)?.research?.scoredSignals ?? 0} />
            <NewsStrip />
          </div>
        )}

        {tab === "research" && (
          <div key="research" className="animate-tab-in">
            <section className="mx-auto w-full max-w-5xl px-5 pt-14 pb-10">
              <div className="mx-auto max-w-2xl text-center">
                <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-ink-faint">
                  Deep-dive research
                </p>
                <h2 className="font-display mt-2 text-3xl font-semibold text-ink sm:text-4xl">
                  Score a ticker, get the receipts.
                </h2>
              </div>

              <form
                className="mx-auto mt-8 flex max-w-xl items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(ticker);
            }}
          >
            <input
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              placeholder="Drop a ticker. We'll be honest."
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className="h-14 w-full flex-1 rounded-xl border border-hairline bg-panel px-5 text-lg font-medium tracking-wide text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-ink"
            />
            <button
              type="submit"
              disabled={loading}
              className="h-14 rounded-xl bg-ink px-7 text-sm font-semibold text-paper transition-opacity hover:opacity-85 disabled:opacity-50"
            >
              {loading ? "Sharpening the knife…" : "Research"}
            </button>
          </form>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
            <span className="text-ink-faint">Try:</span>
            {SAMPLES.map((s) => (
              <button
                key={s}
                onClick={() => run(s)}
                className="num rounded-full border border-hairline bg-panel px-3.5 py-1 text-xs font-medium text-ink-soft transition-colors hover:border-ink hover:text-ink"
              >
                {s}
              </button>
            ))}
          </div>

          {recent.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm">
              <span className="text-ink-faint">Recent:</span>
              {recent.map((r) => {
                const vs = VERDICT_STYLE[r.verdict] ?? VERDICT_STYLE.HOLD;
                return (
                  <button
                    key={r.symbol}
                    onClick={() => run(r.symbol)}
                    className="num rounded-full border border-hairline bg-panel px-3.5 py-1 text-xs font-medium text-ink-soft transition-colors hover:border-ink hover:text-ink"
                  >
                    {r.symbol}{" "}
                    <span className={`font-semibold ${vs.text}`}>{r.verdict}</span>
                  </button>
                );
              })}
            </div>
          )}

          {error && (
            <p className="mx-auto mt-8 max-w-lg rounded-xl border border-bad/30 bg-bad/5 px-4 py-3 text-center text-sm text-bad">
              {error}
            </p>
          )}
            </section>

            {a && data && (
              <section ref={resultRef} className="mx-auto w-full max-w-5xl px-5 pb-20 scroll-mt-20">
            <Reveal>
              <div className="animate-fade-up overflow-hidden rounded-2xl border border-hairline bg-panel">
              <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto]">
                <div>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h2 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                      {data.symbol}
                    </h2>
                    <span className="text-sm text-ink-faint">{data.name}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="num text-2xl font-semibold text-ink">{fmtPrice(a.indicators.price)}</span>
                    {dayChange != null && (
                      <span className={`num text-sm font-semibold ${dayChange >= 0 ? "text-good" : "text-bad"}`}>
                        {fmtPct(dayChange)}
                      </span>
                    )}
                    <span className="text-xs text-ink-faint">
                      {quote?.exchange ?? ""} · {quote?.currency ?? "USD"} · {fmtMarketCap(quote?.marketCap as number)}
                    </span>
                  </div>
                  {a.suggestedSize > 0 && (
                    <p className="mt-4 inline-flex items-center gap-2 rounded-lg border border-hairline bg-paper px-3 py-1.5 text-xs text-ink-soft">
                      <span className="font-semibold uppercase tracking-widest text-ink-faint">Suggested size</span>
                      <span className="num font-semibold text-ink">{a.suggestedSize}%</span>
                      <span className="text-ink-faint">of portfolio</span>
                    </p>
                  )}
                </div>
                <div className="lg:w-56">
                  {vsStyle && (
                    <div className={`rounded-xl px-5 py-4 text-center ring-1 ${vsStyle.bg} ${vsStyle.ring}`}>
                      <p className={`text-[10px] font-semibold uppercase tracking-[0.25em] ${vsStyle.text}`}>
                        {a.strategy.name}
                      </p>
                      <p className={`font-display mt-1 text-2xl font-bold uppercase tracking-tight ${vsStyle.text}`}>
                        {a.verdict}
                      </p>
                      <p className="mt-1 text-[11px] font-medium uppercase tracking-widest text-ink-faint">
                        {a.direction}
                      </p>
                    </div>
                  )}
                  <div className="mt-4">
                    <ScoreGauge score={a.score} />
                  </div>
                  <div className="mt-4">
                    <button
                      onClick={() => toggleWatch(data.symbol)}
                      className={`flex w-full items-center justify-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
                        watchlist.includes(data.symbol)
                          ? "border-good/40 bg-good/10 text-good"
                          : "border-hairline text-ink-soft hover:border-ink hover:text-ink"
                      }`}
                    >
                      {watchlist.includes(data.symbol) ? (
                        <>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                          On watchlist
                        </>
                      ) : (
                        <>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-3.5 w-3.5">
                            <path d="M12 5v14M5 12h14" />
                          </svg>
                          Add to watchlist
                        </>
                      )}
                    </button>
                  </div>
                  <div className="mt-2">
                    <ShareButton
                      card={{
                        symbol: data.symbol,
                        name: data.name,
                        price: a.indicators.price,
                        dayChangePct: dayChange,
                        verdict: a.verdict,
                        score: a.score,
                        thesis: a.thesis,
                        guards: guardChips.slice(0, 3),
                        suggestedSize: a.suggestedSize > 0 ? a.suggestedSize : null,
                        exchange: quote?.exchange,
                        currency: quote?.currency,
                      }}
                    />
                  </div>
                </div>
              </div>

              {a.thesis && (
                <p className="font-display border-t border-hairline px-6 py-4 text-[15px] italic leading-relaxed text-ink-soft sm:px-8">
                  {a.thesis}
                </p>
              )}

              {guardChips.length > 0 && (
                <div className="flex flex-wrap gap-2 border-t border-hairline px-6 py-4 sm:px-8">
                  {guardChips.map((g) => (
                    <span key={g} className="rounded-full border border-bad/25 bg-bad/5 px-3 py-1 text-xs text-bad">
                      {g}
                    </span>
                  ))}
                </div>
              )}
            </div>
            </Reveal>

            <Reveal delay={80}>
              <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
              <div className="rounded-2xl border border-hairline bg-panel p-6 sm:p-7">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint">
                    Price & trend
                  </p>
                  <span className={`text-[11px] font-semibold uppercase tracking-widest ${
                    a.volatilityRisk === "TRADEABLE" ? "text-good" : a.volatilityRisk === "ELEVATED" || a.volatilityRisk === "HIGH" ? "text-bad" : "text-ink-soft"
                  }`}>
                    {a.volatilityRisk} volatility
                  </span>
                </div>
                <PriceChart closes={closes} dates={candles.map((c) => c.date)} ema50={ema50Arr} ema200={ema200Arr} />
              </div>

              <div className="rounded-2xl border border-hairline bg-panel p-6 sm:p-7">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint">Vitals</p>
                <div>
                  <IndRow
                    label="RSI (14)"
                    value={a.indicators.rsi == null ? "·" : a.indicators.rsi.toFixed(0)}
                    tone={a.indicators.rsi != null ? (a.indicators.rsi > 70 ? "bad" : a.indicators.rsi < 30 ? "bad" : a.indicators.rsi >= 55 ? "good" : "flat") : "flat"}
                  />
                  <IndRow
                    label="vs 50-day EMA"
                    value={(() => {
                      const g = vs(a.indicators.ema50);
                      return g == null ? "·" : fmtPct(g / 100);
                    })()}
                    tone={(() => {
                      const g = vs(a.indicators.ema50);
                      return g != null && g > 0 ? "good" : "bad";
                    })()}
                  />
                  <IndRow
                    label="vs 200-day EMA"
                    value={(() => {
                      const g = vs(a.indicators.ema200);
                      return g == null ? "·" : fmtPct(g / 100);
                    })()}
                    tone={(() => {
                      const g = vs(a.indicators.ema200);
                      return g != null && g > 0 ? "good" : "bad";
                    })()}
                  />
                  <IndRow label="ATR (14)" value={a.indicators.atrPct == null ? "·" : `${a.indicators.atrPct.toFixed(2)}%`} tone={a.indicators.atrPct != null && a.indicators.atrPct > 6 ? "bad" : "flat"} />
                  <IndRow
                    label="MACD histogram"
                    value={a.indicators.macdHistogram == null ? "·" : a.indicators.macdHistogram >= 0 ? "positive" : "negative"}
                    tone={a.indicators.macdHistogram == null ? "flat" : a.indicators.macdHistogram >= 0 ? "good" : "bad"}
                  />
                  <IndRow label="Quality grade" value={a.grades.quality} tone={a.grades.quality === "STRONG" || a.grades.quality === "GOOD" ? "good" : a.grades.quality === "WEAK" || a.grades.quality === "POOR" ? "bad" : "flat"} />
                  <IndRow label="Value grade" value={a.grades.value} tone={a.grades.value === "CHEAP" ? "good" : a.grades.value === "EXPENSIVE" ? "bad" : "flat"} />
                  <IndRow label="Strategy" value={a.strategy.name} />
                </div>
              </div>
              </div>
            </Reveal>

            {fair && fair.blended != null && (
              <Reveal delay={120}>
                <div className="mt-6 rounded-2xl border border-hairline bg-panel p-6 sm:p-7">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint">Fair value</p>
                  <span className={`num text-sm font-semibold ${
                    fair.marginOfSafety != null && fair.marginOfSafety > 0 ? "text-good" : fair.marginOfSafety != null ? "text-bad" : "text-ink-soft"
                  }`}>
                    Margin of safety {fair.marginOfSafety == null ? "·" : fmtPct(fair.marginOfSafety)}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-ink-faint">Price</p>
                    <p className="num mt-1 text-xl font-semibold text-ink">{fmtPrice(fair.price)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-ink-faint">Blended fair value</p>
                    <p className="num mt-1 text-xl font-semibold text-good">{fmtPrice(fair.blended)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-ink-faint">{fair.dcfMethod === "eps" ? "DCF (EPS)" : "DCF (FCF)"}</p>
                    <p className="num mt-1 text-xl font-semibold text-ink">{fmtPrice(fair.dcf)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-ink-faint">Analyst mean</p>
                    <p className="num mt-1 text-xl font-semibold text-ink">{fmtPrice(fair.analyst)}</p>
                  </div>
                </div>
                <FairValueBar price={fair.price ?? 0} blended={fair.blended} />
                <div className="mt-2 flex justify-between text-[11px] text-ink-faint">
                  <span className="num">{fmtPrice(fair.price)} (price)</span>
                  <span className="num">{fmtPrice(fair.blended)} (fair value)</span>
                </div>
                </div>
              </Reveal>
            )}

            {scenarios && (
              <Reveal delay={160}>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {(["bear", "base", "bull"] as const).map((k) => {
                  const label = k === "bear" ? "Bear" : k === "base" ? "Base" : "Bull";
                  const up = scenarios.upside[k];
                  const good = up != null && up > 0;
                  return (
                    <div key={k} className="rounded-2xl border border-hairline bg-panel p-6">
                      <p className="text-[10px] uppercase tracking-widest text-ink-faint">{label} case</p>
                      <p className="num mt-2 text-2xl font-semibold text-ink">{fmtPrice(scenarios[k])}</p>
                      <p className={`num mt-1 text-sm font-semibold ${good ? "text-good" : up != null ? "text-bad" : "text-ink-faint"}`}>
                        {up == null ? "·" : `${fmtPct(up)} from today`}
                      </p>
                    </div>
                  );
                })}
              </div>
              </Reveal>
            )}

            <Reveal delay={200}>
              <div className="mt-6 rounded-2xl border border-hairline bg-panel p-6 sm:p-7">
                <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint">What&apos;s driving the call</p>
              <ComponentBars components={a.components} />
              </div>
            </Reveal>

            {comps && comps.metrics.length > 0 && (
              <Reveal delay={240}>
              <div className="mt-6 rounded-2xl border border-hairline bg-panel p-6 sm:p-7">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint">Peer comparison</p>
                  <span className={`text-xs font-semibold uppercase tracking-widest ${toneClass(comps.tone).text}`}>
                    {comps.verdict}
                  </span>
                </div>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[420px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-hairline text-left text-[10px] uppercase tracking-widest text-ink-faint">
                        <th className="py-2 pr-4 font-semibold">Metric</th>
                        <th className="py-2 pr-4 text-right font-semibold">{data.symbol}</th>
                        <th className="py-2 pr-4 text-right font-semibold">Peer median</th>
                        <th className="py-2 pr-4 text-right font-semibold">vs peers</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comps.metrics.map((m) => (
                        <tr key={m.label} className="border-b border-hairline-soft last:border-0">
                          <td className="py-2.5 pr-4 text-ink-soft">{m.label}</td>
                          <td className="num py-2.5 pr-4 text-right font-semibold text-ink">{m.ours >= 100 ? m.ours.toFixed(0) : m.ours.toFixed(2)}</td>
                          <td className="num py-2.5 pr-4 text-right text-ink-soft">{m.peerMedian >= 100 ? m.peerMedian.toFixed(0) : m.peerMedian.toFixed(2)}</td>
                          <td className={`num py-2.5 pr-4 text-right font-semibold ${toneClass(m.tone).text}`}>
                            {fmtPct(m.diffPct)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-[11px] text-ink-faint">
                  vs {comps.peerCount} sector peers (market-cap band ±8×).
                </p>
              </div>
              </Reveal>
            )}

            {a.reasoning.length > 0 && (
              <Reveal delay={280}>
              <div className="mt-6 rounded-2xl border border-hairline bg-panel p-6 sm:p-7">
                <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint">The receipts</p>
                <ul className="grid gap-2.5 text-sm leading-relaxed text-ink-soft sm:grid-cols-2">
                  {a.reasoning.map((r, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-faint" />
                      <span className="[&_em]:font-semibold [&_em]:not-italic [&_em]:text-ink">{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
              </Reveal>
            )}

            <div className="mt-6 rounded-2xl border border-hairline-soft bg-paper px-6 py-4 text-[11px] leading-relaxed text-ink-faint">
              <span className="font-semibold uppercase tracking-widest text-ink-soft">Method</span>. Six signals
              (trend, momentum, volatility, volume, value, quality) weighed into one conviction score (−1…+1),
              then put on a leash. The trend rules are law. Long-term research only, informational. Not financial
              advice, and definitely not a vibes check.
            </div>
              </section>
            )}
          </div>
        )}

        {tab === "board" && (
          <div key="board" className="animate-tab-in">
            <Screener onResearch={(s) => { go("research"); run(s); }} />
          </div>
        )}

        {tab === "method" && (
          <div key="method" className="animate-tab-in">
            <HowItWorks />
          </div>
        )}

        {tab === "track" && (
          <div key="track" className="animate-tab-in">
            <Reveal delay={120}>
              <TrackRecord track={initialTrack as never} />
            </Reveal>
          </div>
        )}
      </main>

      <footer className="border-t border-hairline">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-xs text-ink-faint">
          <span className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="QNTL" height={22} className="h-[22px] w-auto" />
            <span className="font-display text-sm font-semibold text-ink">QNTL</span>
            <span>The trend is your friend. The knife is not.</span>
          </span>
          <div className="flex items-center gap-4">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => go(t.id)} className="transition-colors hover:text-ink">
                {t.label}
              </button>
            ))}
            <a
              href="https://github.com/sillyboiii/equity-alpha/blob/main/ROADMAP.md"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-ink"
            >
              Roadmap
            </a>
            <ThemeToggle />
          </div>
          <span>Informational, not financial advice. Check your own knives.</span>
        </div>
      </footer>
    </div>
  );
}
