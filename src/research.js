import { analyze } from "./analysis.js";
import { getHistory, getQuote, enrichQuote, lookup, getPeerQuotes, getPeerCandidates, SPX } from "./market.js";
import { peerComp } from "./comps.js";

let lastBenchmarkRefresh = 0;

export async function refreshBenchmark(store, { force = false, ttlMs = 3600_000 } = {}) {
  if (!force && Date.now() - lastBenchmarkRefresh < ttlMs) return;
  try {
    const candles = await getHistory(SPX);
    store.savePrices(SPX, candles);
    lastBenchmarkRefresh = Date.now();
  } catch (e) {
    console.log(`[benchmark] SPX refresh failed: ${e.message}`);
  }
}

export async function researchTicker(ticker, { strategy = "trend" } = {}) {
  const symbol = ticker.toUpperCase().trim();
  const candles = await getHistory(symbol);
  const [quote, meta] = await Promise.all([getQuote(symbol), enrichQuote(symbol)]);
  const fundQuote = { ...quote, ...meta };
  const analysis = analyze({ candles, quote: fundQuote, strategy });
  let comps = null;
  try {
    const candidates = await getPeerCandidates({ sector: fundQuote.sector, peers: fundQuote.peers });
    let peerQuotes = candidates.length ? await getPeerQuotes(candidates) : [];
    if (quote.marketCap != null) {
      const lo = quote.marketCap / 8;
      const hi = quote.marketCap * 8;
      peerQuotes = peerQuotes.filter((p) => p.marketCap != null && p.marketCap >= lo && p.marketCap <= hi);
    }
    comps = peerComp(fundQuote, peerQuotes);
  } catch {
    comps = null;
  }
  return {
    symbol,
    name: quote.longName ?? symbol,
    quote: fundQuote,
    analysis,
    comps,
    candles,
  };
}
