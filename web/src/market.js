import YahooFinance from "yahoo-finance2";

export const SPX = "^GSPC";

export const MARKET = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const DAY = 86400;

export async function withRetry(fn, { retries = 3, label = "request" } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const limited = /429|rate.?limit|too many/i.test(String(e?.message ?? e));
      if (limited && attempt < retries) {
        const wait = 1000 * 2 ** attempt + Math.random() * 500;
        console.log(`[market] ${label} rate-limited, retrying in ${Math.round(wait)}ms (${attempt + 1}/${retries})`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      throw e;
    }
  }
}

function toISODate(v) {
  if (v instanceof Date) {
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, "0");
    const d = String(v.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

export async function getHistory(symbol, { days = 380 } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const period1 = now - days * DAY;
  const res = await withRetry(() => MARKET.chart(symbol, { period1, interval: "1d" }), { label: `chart ${symbol}` });
  const quotes = res.quotes ?? [];
  const bars = quotes
    .filter((q) => q.close != null && q.high != null && q.low != null)
    .map((q) => ({
      date: toISODate(q.date),
      open: q.open,
      high: q.high,
      low: q.low,
      close: q.close,
      volume: q.volume ?? 0,
    }))
    .filter((b) => b.date != null);
  if (bars.length < 30) {
    throw new Error(`Not enough price history for ${symbol} (${bars.length} bars)`);
  }
  return bars;
}

export async function getQuote(symbol) {
  const q = await withRetry(() => MARKET.quote(symbol), { label: `quote ${symbol}` });
  return {
    shortName: q.shortName ?? q.longName ?? symbol,
    longName: q.longName ?? q.shortName ?? symbol,
    price: q.regularMarketPrice ?? q.postMarketPrice ?? null,
    currency: q.currency ?? "USD",
    marketCap: q.marketCap ?? null,
    fiftyTwoWeekHigh: q.fiftyTwoWeekHigh ?? null,
    fiftyTwoWeekLow: q.fiftyTwoWeekLow ?? null,
    trailingPE: q.trailingPE ?? null,
    forwardPE: q.forwardPE ?? null,
    profitMargins: q.profitMargins ?? null,
    grossMargins: q.grossMargins ?? null,
    revenueGrowth: q.revenueGrowth ?? null,
    debtToEquity: q.debtToEquity ?? null,
    beta: q.beta ?? null,
    dividendYield: q.dividendYield ?? null,
    exchange: q.exchange ?? null,
  };
}

export async function lookup(ticker) {
  const res = await withRetry(() => MARKET.search(ticker, { quotesCount: 8, newsCount: 0 }), { label: `search ${ticker}` });
  const q = (res.quotes ?? []).find(
    (x) => x.symbol?.toUpperCase() === ticker.toUpperCase() || x.symbol?.toUpperCase().startsWith(ticker.toUpperCase())
  );
  return {
    symbol: q?.symbol ?? ticker.toUpperCase(),
    name: q?.shortname ?? q?.longname ?? null,
  };
}

export async function enrichQuote(symbol) {
  try {
    const summary = await withRetry(() => MARKET.quoteSummary(symbol, {
      modules: ["summaryDetail", "financialData", "defaultKeyStatistics", "recommendationTrend", "assetProfile"],
    }), { label: `quoteSummary ${symbol}` });
    const d = summary.summaryDetail ?? {};
    const f = summary.financialData ?? {};
    const k = summary.defaultKeyStatistics ?? {};
    const rt = summary.recommendationTrend ?? {};
    const t = rt.trend?.[0] ?? {};
    const ap = summary.assetProfile ?? {};
    return {
      sector: ap.sector ?? null,
      industry: ap.industry ?? null,
      peers: f.comparables?.peers ?? [],
      trailingPE: d.trailingPE ?? null,
      forwardPE: d.forwardPE ?? null,
      priceToBook: d.priceToBook ?? k.priceToBook ?? null,
      priceToSalesTrailing12Months: d.priceToSalesTrailing12Months ?? null,
      debtToEquity: d.debtToEquity ?? f.debtToEquity ?? null,
      beta: d.beta ?? k.beta ?? null,
      dividendYield: d.dividendYield ?? null,
      payoutRatio: d.payoutRatio ?? null,
      trailingEps: k.trailingEps ?? d.trailingEps ?? null,
      forwardEps: k.forwardEps ?? d.forwardEps ?? null,
      pegRatio: k.pegRatio ?? null,
      enterpriseToEbitda: k.enterpriseToEbitda ?? null,
      enterpriseToRevenue: k.enterpriseToRevenue ?? null,
      netIncomeToCommon: k.netIncomeToCommon ?? null,
      sharesOutstanding: k.sharesOutstanding ?? null,
      targetMeanPrice: f.targetMeanPrice ?? null,
      targetHighPrice: f.targetHighPrice ?? null,
      targetLowPrice: f.targetLowPrice ?? null,
      recommendationKey: f.recommendationKey ?? null,
      recommendationMean: f.recommendationMean ?? null,
      numberOfAnalystOpinions: f.numberOfAnalystOpinions ?? null,
      totalRevenue: f.totalRevenue ?? null,
      totalCash: f.totalCash ?? null,
      totalDebt: f.totalDebt ?? null,
      freeCashflow: f.freeCashflow ?? null,
      operatingCashflow: f.operatingCashflow ?? null,
      currentRatio: f.currentRatio ?? null,
      quickRatio: f.quickRatio ?? null,
      returnOnAssets: f.returnOnAssets ?? null,
      returnOnEquity: f.returnOnEquity ?? null,
      profitMargins: f.profitMargins ?? k.profitMargins ?? null,
      grossMargins: f.grossMargins ?? null,
      operatingMargins: f.operatingMargins ?? null,
      ebitdaMargins: f.ebitdaMargins ?? null,
      earningsGrowth: f.earningsGrowth ?? null,
      revenueGrowth: f.revenueGrowth ?? null,
      analystBreakdown: t,
    };
  } catch {
    return {};
  }
}

const SECTOR_ETFS = {
  Technology: "XLK",
  "Financial Services": "XLF",
  Healthcare: "XLV",
  "Consumer Cyclical": "XLY",
  "Consumer Defensive": "XLP",
  Energy: "XLE",
  Industrials: "XLI",
  Materials: "XLB",
  Utilities: "XLU",
  "Communication Services": "XLC",
  "Real Estate": "XLRE",
};

const peerHoldingsCache = new Map();

export async function getPeerCandidates({ sector, peers = [] }) {
  if (peers.length > 0) return peers.slice(0, 10);
  const etf = sector ? SECTOR_ETFS[sector] : null;
  if (!etf) return [];
  const cached = peerHoldingsCache.get(etf);
  if (cached && Date.now() - cached.at < 24 * 3600_000) return cached.symbols;
  const summary = await withRetry(() => MARKET.quoteSummary(etf, { modules: ["topHoldings"] }), { label: `topHoldings ${etf}` });
  const holdings = summary.topHoldings?.holdings ?? [];
  const symbols = holdings.map((h) => h.symbol).filter(Boolean).slice(0, 12);
  peerHoldingsCache.set(etf, { at: Date.now(), symbols });
  return symbols;
}

export async function getPeerQuotes(symbols, { max = 6 } = {}) {
  const list = [...new Set(symbols.filter(Boolean))].slice(0, max);
  if (list.length === 0) return [];
  const rows = await withRetry(() => MARKET.quote(list), { label: `quote peers [${list.join(",")}]` });
  const arr = Array.isArray(rows) ? rows : [rows];
  return arr
    .map((q) => ({
      symbol: q.symbol,
      forwardPE: q.forwardPE ?? null,
      trailingPE: q.trailingPE ?? null,
      priceToBook: q.priceToBook ?? null,
      pegRatio: q.pegRatio ?? null,
      enterpriseToEbitda: q.enterpriseToEbitda ?? null,
      marketCap: q.marketCap ?? null,
    }))
    .filter((p) => p.symbol != null);
}
