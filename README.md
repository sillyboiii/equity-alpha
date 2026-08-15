# Equity Alpha 📈

A Discord bot that runs **equity research** on your watchlist, gives a clear **Buy / Hold / Sell** verdict, and logs **every signal** so it can prove its track record over time.

Built for swing trading — daily bars, technicals for timing, fundamentals for filtering.

## What it does

- **`/analyze <ticker>`** — full research report: trend, momentum (RSI/MACD), volatility (ATR), volume, valuation. Returns a verdict with a score from -1 to +1.
- **`/watch <ticker>`** — add a ticker to your watchlist.
- **`/scan`** — research everything on your watchlist and post a report for each.
- **`/performance`** — the track record: every BUY/SELL signal is checked against the actual price N days later. Win rate, avg return, wins/losses.
- **`/watchlist`**, **`/unwatch`**, **`/status`**, **`/setchannel`**.

The research engine (`src/analysis.js`) is a clean, dependency-free module — the same one that will power the website version later.

## Setup

1. **Create the bot** — https://discord.com/developers/applications → New Application → **Bot** tab → Reset Token → copy it.
2. Copy `.env.example` → `.env` and paste your token.
3. Install and run:
   ```bash
   npm install
   npm start        # daemon mode (or ./run.sh for foreground)
   ```
4. Invite it to your server:
   ```
   https://discord.com/oauth2/authorize?client_id=YOUR_APP_ID&permissions=19456&scope=bot%20applications.commands
   ```

## First commands

```
/watch NVDA          → add to watchlist
/analyze MSFT        → full research + logs a signal
/scan                → research the whole watchlist
/performance         → your track record so far
```

## CLI (no Discord needed)

```bash
npm run analyze -- NVDA    # research + log a signal
npm run scan               # research the whole watchlist
```

## How the score works

Weighted blend of five components, each scored -1..+1:

| Component | Weight | What it looks at |
|---|---|---|
| Trend | 30% | Price vs 50/200-day EMA, golden/death alignment |
| Momentum | 25% | RSI, MACD histogram, 14-day return |
| Volatility | 15% | ATR % — the swing-trading sweet spot is ~1.5–3.5%/day |
| Volume | 15% | Volume vs 20-day average, accumulation/distribution |
| Fundamentals | 15% | P/E, margins, revenue growth, debt/equity |

Verdict thresholds: `≥0.5` Strong Buy · `≥0.25` Buy · `>-0.25` Hold · `>-0.5` Sell · else Strong Sell.

## Track record

Every `/analyze` and `/scan` logs a signal (ticker, verdict, score, price, timestamp). After your horizon (default **14 days**, set `HORIZON_DAYS` in `.env`), the bot checks the actual price and marks the signal correct/incorrect. `/performance` rolls it all up.

**This is the CV artifact**: "N signals logged, X% win rate, Y% avg return" — actual decisions, measured against the market.

## Data

- **Prices & fundamentals**: Yahoo Finance (free, `yahoo-finance2`), daily bars.
- **Storage**: SQLite (`data/equity.db`) — watchlist, price history, signals. Delete it to reset.

## Roadmap

- [ ] News/earnings-call signal input
- [ ] LLM-written narrative reports grounded in the computed numbers
- [ ] S&P 500 benchmark comparison in `/performance`
- [ ] Website version powered by the same engine

> Research tool, not financial advice. The engine reports what the numbers say — you decide what to do with it.
