# Equity Alpha — Roadmap

**Goal:** a personal equity-research bot that builds a verifiable track record, becomes a polished product by the end of the year, and powers a website later.

**Target: end of year.**

---

## Phase 1 · Foundation — DONE ✅

The bot is live in Discord.

- Discord bot **QUANT** running with 8 slash commands
- Research engine: trend · momentum · volatility · volume · fundamentals → Buy/Hold/Sell
- Watchlist + `/scan` + `/analyze`
- Signal logging + basic `/performance` (win rate, avg return over 14-day horizon)
- SQLite storage, free Yahoo Finance data, unit tests (14 passing)

## Phase 2 · Deepen the track record — the CV core

The interview-proof numbers. This is the priority.

- **S&P 500 benchmark** in `/performance` — per-signal alpha vs the index (already have the SPX feed wired, needs the comparison math)
- **Backtest mode** — run the engine over past years of price data, measure what the verdicts *would have* returned
- **Auto-evaluation** — a daily job that re-checks open signals when their horizon hits, instead of only on demand
- **Rolling stats** — win rate by month/quarter, max drawdown, avg holding period
- **Position sizing** — suggested % of portfolio per signal based on score + volatility

## Phase 3 · LLM research reports

Turn numbers into a readable thesis.

- Narrative reports grounded in the computed indicators (no hallucinated figures)
- Earnings-call and news input as a signal source
- Per-ticker research dossier that accumulates over time

## Phase 4 · Web app on Vercel

Bot feeds the website; the same engine powers both.

- Standalone API exposing the research engine
- Dashboard: watchlist, reports, track-record charts
- Free deploy on Vercel; live URL for the CV

## Phase 5 · More data + alerts

- Price alerts (target hit / breakout / RSI extremes) posted to Discord
- Earnings calendar + news headlines per ticker

## Phase 6 · Consumer (figure out later)

- Auth, multi-user, billing, mobile (iOS)
- Keep the engine and API so this is a layer on top, not a rewrite

---

## Guiding principles

- The engine (`src/analysis.js`) stays dependency-free and reusable — the website and iOS app consume it later.
- Every signal is timestamped and evaluated against real prices. No verdict without a paper trail.
- Free tier as long as possible (Yahoo Finance, Vercel, SQLite).
- Research tool, not financial advice.
