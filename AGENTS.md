# AGENTS.md — always read this first

## Project
Equity Alpha: a Discord equity-research bot (QUANT) that gives grounded Buy/Hold/Sell verdicts, logs every signal, and builds a verifiable track record for the user's Finance CV (Westminster). US stocks only. Personal use now, consumer later. **Target: end of year.**

## Core principle (user directive — do not drift)
We are an **equity-research business**: deep, grounded research on companies is the core product — verdicts, thesis, quality/value grades, screens, and an honest track record that proves the research. **BUT** the strategy engine (and future strategies in the pool) is ALSO a product pillar, built out for the user and private consumers. Two pillars: (1) research, (2) strategies. The backtester/simulator validates both — don't drop the strategy work, but don't let backtest-optimization drown out research quality either. A research call is a ~2-month view, not a 1-month view.

## Status
Phase 1 Foundation is the current focus — still POLISHING the engine itself (grades, screener, engine validation). Do NOT jump into Phase 2 until the user says so. Phase 2 stays NEXT.

## Commands
- `npm start` / `npm stop` / `npm run restart` / `npm run status` / `npm run logs`
- `npm run test` — unit tests (`node --test test/`)
- `npm run analyze -- <TICKER>` — CLI research (no Discord needed)
- `npm run scan` — CLI watchlist scan
- `npm run screen -- NVDA XOM ...` — rank candidates (works in bot too)
- `npm run performance` — track record
- Node v24+ (npm only, no pnpm/bun). ESM, vanilla JS.

## ROADMAP (checklist — update as we go)

### Phase 1 · Foundation — current focus, still polishing
- [x] Discord bot QUANT live (App ID 1537784971249455124, 14 slash commands)
- [x] Research engine: trend · momentum · volatility · volume · value · quality
- [x] DCF fair value + analyst blend + margin of safety
- [x] Watchlist, `/scan`, `/analyze`, `/screen`
- [x] Signal logging + `/performance` (win rate, avg return, 14-day horizon)
- [x] SQLite storage, free Yahoo data, unit tests (16 passing)
- [x] Engine polish: quality/value grades on the summary (STRONG/GOOD/FAIR/WEAK/POOR + CHEAP/FAIR/RICH/EXPENSIVE)
- [x] Plain-English investment thesis line on every report (auto-composed, no LLM)
- [x] Volatility risk flag (tradability): TOO FLAT / TRADEABLE / ELEVATED / HIGH on summary embed + thesis
- [x] Signal dedup — skip logging if same ticker analyzed in last 7 days (analyze + scan, bot + CLI)
- [x] `/screen` command — rank candidates by score + margin of safety (CLI: `npm run screen -- TICKERS`)
- [x] Engine validation — `/backtest` runs engine over past prices (CLI: `npm run backtest -- TICKER`)
- [x] Evaluation horizon moved 14d → 30d (matches engine sweet spot; /performance track record now builds at 30d)
- [x] Backtest reports reward:risk + expectancy per signal (avg win / avg loss / RR)
- [x] **"Sell the premium" rule (user-driven)**: EXPENSIVE name + uptrend intact → HOLD (wait, don't chase); EXPENSIVE + trend breaking → SELL (premium deflation). Implemented as `noOverpay` guard (premium: "EXPENSIVE", flip to RICH to tighten). Evidence: 3-month backtest 45.5% WR / -4.8% driven by 5/29 cluster of premium momentum BUYs into the tech meltdown + MSFT whipsaw; noOverpay would have HOLD'd NVDA/MSFT/KO while keeping AMZN (CHEAP) & JPM (FAIR) as buys.
- [x] **Portfolio simulator** (`/sim` + CLI `sim`): $10k through backtest signals — position %, max concurrent, horizon configurable; reports final equity, total return, WR, avg win/loss, max drawdown. Finding: 60d horizon is the profit window (~+8% / 2% DD at 20%/5pos vs ~flat at 30d; every 60d config beat its 30d twin). Horizon default still 30d in store.js — pending user's go to flip to 60d.
- [x] **EPS-based DCF fallback (user-requested, dumbed-down explainers welcome)**: FCF DCF returns null for banks/insurers (no free cash flow) → fair value collapsed to analyst target alone. Added `epsDcfFairValue`: grow trailing EPS 5 yrs at capped growth (≤15%), apply fair P/E (8–24, growth-based), discount back. `fairValueAnalysis` now returns `dcfMethod` ("fcf"|"eps"); report labels "DCF fair value (EPS-based)". JPM before: DCF —, MOS +3%. After: DCF $459.89, blended $416.87, MOS +14.9%. 27 tests passing.
- [ ] **BACKTEST FINDING (RESOLVED): engine is momentum-chasing** — buys strength at local tops, whipsawed in reversals. User verdict: trend-follower is KEY, no pullback detection. RR profile is good: AAPL h60 71% WR / 4.22:1 RR / +9.2% exp; XOM h60 56% WR / 2.76:1 RR / +7.2% exp. MSFT is the outlier — 2026 whipsaw crushed it (sold $368 before +37% rip). Accept as cost of trend-following.
- [ ] PENDING DECISIONS: ~~(a) investment thesis~~ ✅ ~~(b) dedup~~ ✅ ~~(c) whipsaw flag~~ ✅ — all three resolved by user, done.

### Phase 2 · Deepen the track record — the CV core (NEXT, not started)
Scoped to the RESEARCH pillar's proof layer. Trading-side expansion is Phase 5/7 — but items 2 & 4 are the bridge to the private trading side (real-time signal validation + entry sizing).

- [x] **2.1 SPX alpha benchmark** — `/performance` shows per-signal return vs SPX over the same window → net alpha (the CV headline "outperformed SPX by X%")
  - [x] SPX daily closes stored in `price_history` as `^GSPC` — `refreshBenchmark(store)` in research.js called once per analyze/scan/watch/spy (CLI + bot); `npm run analyze -- spy`-style backfill via `node src/cli.js spy`
  - [x] Per-signal SPX return over the identical window as the signal's eval (`_findBar(^GSPC, ...)` matches entry + exit dates)
  - [x] Alpha column (per-signal `alpha`, `spxRet`) + aggregate `netAlpha`, `spxAvgReturn`, `beatMarket` in performance(); embed shows SPX avg, Net alpha vs SPX, Beat S&P 500 (x/y) — green when alpha ≥ 0, red below
  - [x] Test: alpha = signal return − SPX return over identical window (fixture in test/store.test.js); signals without SPX history still score with alpha null. 35 tests passing.
- [x] **2.2 Auto-evaluation** — daily job re-checks open signals at horizon, no waiting for on-demand
  - [x] `signals` table gained `evaluated` + `evaluated_at` columns (ALTER TABLE migration in `_init`, safe for existing DBs)
  - [x] Refactored store: shared `_evaluateSignal(s)` (used by both `performance()` and `dueForEvaluation()`) — no duplicated eval logic
  - [x] `dueForEvaluation()` = verdict ≠ HOLD + not evaluated + exit date arrived + exit bar exists; `markEvaluated(ids)` stamps evaluated_at
  - [x] Scheduler: `startAutoEvaluation` in `src/autoeval.js` — first run 15s after boot, then every 6h; posts per-signal results (ret, SPX, alpha, ✅/❌) + updated track-record embed to the setchannel channel. CLI manual run: `node src/cli.js eval`
  - [x] Test: mature signal found once, markEvaluated stops re-eval; HOLD + future signals skipped. 37 tests passing.
- [x] **2.3 Rolling stats** — the track record gets deeper
  - [x] Win rate by month and by quarter (`byMonth` / `byQuarter` series in performance(); grouped on exit-date month/quarter)
  - [x] Max drawdown across the trade-by-trade equity curve (chronological by exit date, peak-to-trough)
  - [x] Avg holding period per direction (`avgHoldingDays.long/short`, computed date-only to avoid time-of-day drift)
  - [x] Rolling table in `/performance` description (last 6 months + quarters, 🟢≥50% 🟡≥35% 🔴<35%) + Max drawdown / Avg hold fields; max drawdown hides when no scored trades
  - [x] Test: fixture across Mar/Apr 2026 → month + quarter grouping, 20% drawdown, 30d holding exact. 38 tests passing.
- [x] **2.4 Position sizing** — suggested % of portfolio per signal from score + volatility (trading-side bridge)
  - [x] `suggestedSize({ verdict, atrPct })` in analysis.js (dependency-free): base by verdict (STRONG BUY 20% / BUY 12% / STRONG SELL 15% / SELL 10%), scaled by vol factor `min(1, 2.5/atrPct)`, floored at 2% capped at 20%, HOLD = 0
  - [x] "Suggested size" field on the summary embed; `analyze()` returns it
  - [x] Backtest signals now carry `atrPct`; `simulate({ sizing: true })` sizes each entry via `suggestedSize` instead of fixed 20% — `/sim sizing:true`, CLI `sim sizing`
  - [x] Test: base/vol-cap/HOLD fixtures. 40 tests passing.
- [x] **2.5 Pending decisions** — all settled
  - [x] Sim horizon default flipped 30d → **60d** (60d beat 30d in every backtest config) — sim is the TRADING validation tool, so longer horizon there is fine; `/sim` + CLI messages updated
  - [x] Performance track-record eval horizon **stays 30d** — research side is long-term by design (user: "most investors are looking to invest in longer term, some purely look at YTD %")
  - [x] Private trading tools: **Phase 2b · Private trading (personal)** added below — short-horizon (≤7d) options-focused variant + alerts land there, deliberately separate from the public research side
- [x] **Polish pass (from early version)** — throttled SPX refresh (1h TTL in-memory), cached sector-ETF peer holdings (24h), stale "11 slash commands" → 14, sim/sizing messages consistent. 40 tests passing.

### Phase 2b · Private trading (PERSONAL — never public) · NEXT after Phase 2, before Phase 3
The user's own trading tool, deliberately separate from the public research product.
- [x] **Short-horizon variant of the engine (≤7-day, options-friendly)** — new `swing` strategy in the strategy pool: fast trend (9/21-day EMA), 5-day momentum lookback, swing-tuned volatility thresholds (sweet spot 2–5% ATR). Same engine, faster windows. Valuation downweighted (0.05) and NEVER vetoes (noOverpay disabled for swing — a ≤7-day move doesn't care about long-term premium; discipline comes from noKnifeCatch on the 21-day EMA + noPumpShort). Suggested size capped at 15% (options are capital-efficient). Live: NVDA reads STRONG BUY / 15% on swing vs HOLD on trend — exactly the intended divergence.
  - [x] `analyze({ strategy })` parameterized: components take indicator config, guard context gets emaFast/emaSlow for swing, `suggestedSize` takes a `cap`.
  - [x] `/trade <TICKER>` + CLI `trade` — swing analysis, logs to `personal_signals` table.
- [x] **Separate personal track record** — `personal_signals` table (never mixed into public `signals`), `personalHorizonDays` setting (default **7**), scope-aware `dueForEvaluation`/`markEvaluated`/`performance(scope)`, `/mytrades` + CLI `mytrades` (same performance embed, 7-day horizon), auto-eval runs BOTH scopes every 6h, `/status` shows personal counts. Tests: 7-day fixture eval, 3-day configurable horizon, scope separation both ways. 47 tests passing.
- [ ] **Price alerts (target hit / breakout / RSI extremes) — personal first** (NEXT)

### Phase 3 · LLM research reports
- [ ] Narrative reports grounded in computed indicators (no hallucinated figures)
- [ ] Earnings-call / news input as a signal source
- [ ] Per-ticker research dossier accumulating over time

### Phase 4 · Web app on Vercel
- [ ] Standalone API exposing the research engine (reuse `src/analysis.js`)
- [ ] Dashboard: watchlist, reports, track-record charts
- [ ] Free deploy on Vercel; live URL for CV

### Phase 5 · More data + alerts
- [ ] Price alerts (target hit / breakout / RSI extremes) posted to Discord
- [ ] Earnings calendar + news headlines per ticker

### Phase 6 · Consumer (decide later)
- [ ] Auth, multi-user, billing, mobile (iOS) — engine/API stays a layer on top

### Phase 7 · Quant strategies (FAR FUTURE — after a strong real foundation)
- [x] Both-direction capability already core: SELL/STRONG SELL verdicts = SHORT signals; track record + backtest score shorts. Explicit LONG/HOLD/SHORT direction tag now on every report.
- [x] **Strategy pool architecture** — `src/strategies/` registry (`getStrategy`/`listStrategies`); Trend Follower is the ONLY active strategy (id `trend`). `analyze()` takes `strategy` param, uses strategy weights + guards. `/strategies` command lists the pool.
- [x] **Continuation guards** (trend strategy): `noKnifeCatch` (no BUY while price < 200-day EMA) + `noPumpShort` (no SELL while extended above 50-day EMA with RSI > 70) + `noOverpay` (no BUY when valuation grade is EXPENSIVE; `premium` field can flip to RICH). Fired guards recorded in `analysis.guards`, shown on report footer.
- [x] **Deep Dive research** (`/deepdive` + CLI `deepdive`): analyst-style deck — business overview (assetProfile), 5-year annual financials (fundamentalsTimeSeries: rev/NI/EPS/OCF/FCF/equity/debt/cash), growth & earnings momentum (last EPS surprise, next-qtr estimates + growth), ownership & governance (insider/institutional %, recent insider buys/sells, governance risk, analyst buy-rating split), recent SEC filings (10-K/10-Q/8-K with links). NOTE: old quoteSummary income/balance/cashflow submodules return nothing since Nov 2024 — use `fundamentalsTimeSeries` with `module` + `type` options.
- [x] **Deep Dive auto-interpretation** (`financialInsights` in deepdive.js): reads the 5-year numbers into a story — revenue CAGR, EPS CAGR, net-margin trend, debt trend vs revenue, cash conversion (skipped when operating cash flow ≤ 0 → avoids the bank/insurance false alarm), overall trajectory verdict (Improving/Mixed/Deteriorating). Purple "🧠 Financial Insights & Trends" embed after the financials table. 29 tests passing.
- [x] **Scenario valuation** (`scenarioAnalysis` in analysis.js): bull/base/bear targets. Bear & bull = average of (our DCF run on scaled inputs) + (analyst low/high target). KEY gotcha: scale the CAPPED values (baseG1/basePe), NOT raw growth — raw growth ×0.5 can still exceed the 0.15 EPS cap → bear silently equals base (JPM bug). Base = existing blended fair value. Guards: clamp bull ≥ base ≥ bear. On report as "🎯 Scenario Valuation" embed (amber). JPM now: $276 / $417 / $497 (+37%/-24%); NVDA $105/$174/$272; KO $54/$72/$81 — all three honestly say current price is rich. 31 tests passing.
- [x] **Peer & sector comps** (`src/comps.js` + `peerComp`): compares our valuation multiples to a real peer set. KEY gotcha: Yahoo `financialData.comparables.peers` is EMPTY for most tickers → fallback = sector ETF `topHoldings` (SECTOR_ETFS map: Technology→XLK, Financial Services→XLF, etc.), top 12 holdings as candidates. Peer quotes fetched in ONE batched `MARKET.quote()` call, then filtered by market-cap band (ours/8 .. ours×8) to drop irrelevant sizes. Metrics: fwd P/E, trail P/E, P/B, PEG, EV/EBITDA; per-metric tone cheap/fair/expensive (±15% vs peer median), verdict EXPENSIVE/CHEAP/in line (needs ≥2 metrics agreeing; needs ≥2 peers). Embed "👥 Peer & Sector Comps". Live: AAPL EXPENSIVE (fwd P/E 32 vs 20.6), JPM cheap fwd P/E, NVDA P/B rich. 33 tests passing.
- [ ] Future strategies for the pool later: mean reversion, breakout, momentum engines. User wants a "portfolio of strategies" but ONLY trend-follower for now — do NOT add more until the user asks.
- [ ] **USER IDEAS (parked, later):** (1) short-horizon personal strategy tuned for ≤7-day / day / intraday trades for **options trading** — same engine, shorter horizon, PERSONAL only (research side stays 30-day+ for long-term investors, and some purely watch YTD %). (2) quant strategies (stat arb, factor models, pairs). Do NOT start until the user says so.
- [ ] User wants to eventually involve or build quant strategies (statistical arb, factor models, pairs) — explicitly parked until the engine + track record are proven. Do NOT start early.

## Guiding principles
- Engine (`src/analysis.js`) stays dependency-free and reusable — website/iOS consume it later.
- Every signal timestamped + evaluated against real prices. No verdict without a paper trail.
- Free tier as long as possible (Yahoo Finance, Vercel, SQLite).
- Research tool, not financial advice.

## Gotchas (memorize)
- yahoo-finance2 v4: default export is a class → `import YahooFinance from "yahoo-finance2"; const MARKET = new YahooFinance({ suppressNotices: ["yahooSurvey"] });`
- `quoteSummary` modules: `summaryDetail`, `financialData`, `defaultKeyStatistics`, `recommendationTrend`. Chart `q.date` is a `Date` → format via `toISODate()`.
- `node:sqlite` `DatabaseSync` has no `.transaction()` — use manual `BEGIN`/`COMMIT`/`ROLLBACK`. Experimental warning suppressed via `--disable-warning=ExperimentalWarning`.
- Engine weights: trend .25, momentum .2, volatility .1, volume .1, value .2, quality .15. Verdicts: ≥.5 STRONG BUY, ≥.25 BUY, >-.25 HOLD, >-.5 SELL, else STRONG SELL.
- Bot token lives in `.env` — never echo it.
