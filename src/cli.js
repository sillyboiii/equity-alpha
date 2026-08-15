import { Store } from "./store.js";
import { researchTicker, refreshBenchmark } from "../web/src/research.js";
import { screenTable } from "./report.js";
import { backtestTicker, backtestSummary } from "./backtest.js";
import { simulate, simSummary } from "./sim.js";
import { buildDeepDive, deepDiveEmbeds } from "./deepdive.js";
import { evaluateDue } from "./autoeval.js";

const store = new Store();

async function cmdAnalyze(ticker) {
  const res = await researchTicker(ticker);
  store.savePrices(res.symbol, res.candles);
  await refreshBenchmark(store);
  const dup = store.recentSignal(res.symbol, 7);
  const signalId = dup ? null : store.logSignal({
    ticker: res.symbol,
    name: res.name,
    verdict: res.analysis.verdict,
    score: res.analysis.score,
    price: res.quote.price ?? res.analysis.indicators.price,
  });
  const { verdict, score, fairValue, thesis } = res.analysis;
  console.log(`\n${res.symbol} (${res.name}): ${verdict} · score ${score.toFixed(3)}`);
  if (thesis) console.log(`Thesis: ${thesis}`);
  if (fairValue) {
    console.log(`Fair value: DCF ${fairValue.dcf?.toFixed(2) ?? "—"} · analyst ${fairValue.analyst?.toFixed(2) ?? "—"} · blended ${fairValue.blended?.toFixed(2) ?? "—"} · MOS ${fairValue.marginOfSafety != null ? (fairValue.marginOfSafety * 100).toFixed(1) + "%" : "—"}`);
  }
  console.log(dup ? `already analyzed within 7 days — no signal logged` : `signal #${signalId}`);
  return res;
}

async function cmdScan() {
  const list = store.watchlist;
  if (!list.length) {
    console.log("Watchlist is empty. Add tickers first (npm run analyze -- <TICKER> logs a signal, or edit the db).");
    return;
  }
  await refreshBenchmark(store);
  for (const w of list) {
    try {
      const res = await researchTicker(w.ticker);
      store.savePrices(res.symbol, res.candles);
      let logged = "dup-skip";
      if (!store.recentSignal(res.symbol, 7)) {
        logged = `signal #${store.logSignal({
          ticker: res.symbol,
          name: res.name,
          verdict: res.analysis.verdict,
          score: res.analysis.score,
          price: res.quote.price ?? res.analysis.indicators.price,
        })}`;
      }
      console.log(`${w.ticker}: ${res.analysis.verdict} (${res.analysis.score.toFixed(2)}) — ${logged}`);
    } catch (e) {
      console.log(`${w.ticker}: ERROR ${e.message}`);
    }
  }
  const p = store.performance();
  console.log(`\nTrack record: ${p.wins}W / ${p.losses}L over ${p.tradeCount} scored signals (${p.horizonDays}d horizon)`);
  if (p.winRate != null) console.log(`Win rate: ${(p.winRate * 100).toFixed(1)}% · Avg return: ${(p.avgReturn * 100).toFixed(2)}%`);
}

async function cmdPerformance() {
  const p = store.performance();
  console.log(JSON.stringify(p, null, 2));
}

async function cmdWatch(ticker) {
  const res = await researchTicker(ticker);
  store.savePrices(res.symbol, res.candles);
  await refreshBenchmark(store);
  store.addToWatchlist(res.symbol, res.name);
  console.log(`Added ${res.symbol} (${res.name}) to watchlist`);
}

async function cmdScreen(tickers) {
  const list = tickers.split(/[\s,]+/).filter(Boolean).slice(0, 15);
  if (!list.length) {
    console.log("Usage: node src/cli.js screen NVDA XOM JPM");
    return;
  }
  const results = [];
  for (const t of list) {
    try {
      const res = await researchTicker(t);
      results.push({ ok: true, ...res });
    } catch (e) {
      results.push({ ok: false, ticker: t.toUpperCase(), error: e.message });
    }
  }
  console.log(screenTable(results).replace(/\*\*/g, "").replace(/`/g, ""));
}

async function cmdBacktest(ticker) {
  const bt = await backtestTicker(ticker);
  console.log(backtestSummary(bt));
  const bad = Object.entries(bt.byMonth)
    .filter(([, rs]) => rs.length >= 3)
    .map(([m, rs]) => [m, rs.filter((r) => r.return > 0).length / rs.length])
    .filter(([, w]) => w < 0.4);
  if (bad.length) {
    console.log(`\nWeak months (<40% win rate): ${bad.map(([m, w]) => `${m} (${(w * 100).toFixed(0)}%)`).join(", ")}`);
  }
}

async function cmdSpy() {
  await refreshBenchmark(store);
  console.log("Saved SPX benchmark history");
}

async function cmdSim(sizingArg) {
  const watchlist = store.watchlist;
  const tickers = watchlist.length ? watchlist.map((w) => w.ticker) : ["SPY", "QQQ", "NVDA", "MSFT", "AAPL"];
  const sizing = /sizing/i.test(sizingArg ?? "");
  console.log(`Running portfolio simulation on ${tickers.join(", ")} — $10k start, ${sizing ? "suggested sizes (volatility-capped)" : "20% per position"}, max 5 concurrent, 60-day horizon...\n`);
  const sim = await simulate({ tickers, sizing });
  console.log(simSummary(sim));
}

async function cmdDeepdive(ticker) {
  const dd = await buildDeepDive(ticker);
  for (const eb of deepDiveEmbeds(dd)) {
    const d = eb.data;
    console.log(`\n### ${d.title}`);
    if (d.description) console.log(d.description.replace(/`/g, ""));
    for (const f of d.fields ?? []) console.log(`${f.name}: ${f.value}`);
  }
}

async function cmdEval() {
  const results = evaluateDue(store);
  let anyDue = false;
  for (const { scope, due, performance: p } of results) {
    if (!due.length) continue;
    anyDue = true;
    const label = scope === "personal" ? "personal (≤7-day)" : "research";
    console.log(`\n[${label}] ${due.length} signal(s) hit their ${p.horizonDays}-day horizon:`);
    for (const d of due) {
      const ret = `${(d.ret * 100).toFixed(1)}%`;
      const alpha = d.spxRet != null ? ` · SPX ${(d.spxRet * 100).toFixed(1)}% · alpha ${(d.alpha * 100).toFixed(1)}%` : "";
      console.log(`#${d.id} ${d.ticker} ${d.verdict}: ${ret}${alpha} — ${d.correct ? "✅" : "❌"}`);
    }
    console.log(`Track record now: ${p.wins}W/${p.losses}L · avg ${(p.avgReturn * 100).toFixed(2)}% · alpha ${p.netAlpha != null ? (p.netAlpha * 100).toFixed(2) + "%" : "—"}`);
  }
  if (!anyDue) console.log("No signals due for evaluation.");
}

async function cmdTrade(ticker) {
  const res = await researchTicker(ticker, { strategy: "swing" });
  store.savePrices(res.symbol, res.candles);
  await refreshBenchmark(store);
  const dup = store.recentSignal(res.symbol, 7, "personal");
  const signalId = dup ? null : store.logSignal({
    ticker: res.symbol,
    name: res.name,
    verdict: res.analysis.verdict,
    score: res.analysis.score,
    price: res.quote.price ?? res.analysis.indicators.price,
  }, "personal");
  const { verdict, score, suggestedSize, thesis, strategy } = res.analysis;
  console.log(`\n${res.symbol} (${res.name}): ${verdict} · score ${score.toFixed(3)} · suggested size ${suggestedSize}%`);
  if (thesis) console.log(`Thesis: ${thesis}`);
  console.log(`Strategy: ${strategy.name} (personal ≤${store.personalHorizonDays}-day horizon)`);
  console.log(dup ? `already traded within 7 days — no duplicate signal` : `personal signal #${signalId}`);
  return res;
}

async function cmdMyTrades() {
  const p = store.performance("personal");
  console.log(JSON.stringify(p, null, 2));
}

const actions = { analyze: cmdAnalyze, scan: cmdScan, performance: cmdPerformance, watch: cmdWatch, screen: cmdScreen, backtest: cmdBacktest, spy: cmdSpy, sim: cmdSim, deepdive: cmdDeepdive, eval: cmdEval, trade: cmdTrade, mytrades: cmdMyTrades };

const [,, sub, ...rest] = process.argv;
if (!actions[sub]) {
  console.log("Usage: node src/cli.js <analyze TICKER | scan | performance | watch TICKER | screen TICKERS | backtest TICKER | spy | sim [sizing] | deepdive TICKER | eval | trade TICKER | mytrades>");
  process.exit(1);
}

actions[sub](rest.join(" ")).then(() => store.close()).catch((e) => {
  console.error(e.message);
  store.close();
  process.exit(1);
});
