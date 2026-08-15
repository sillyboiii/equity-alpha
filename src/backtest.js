import { analyze, DEFAULT_WEIGHTS } from "../web/src/analysis.js";
import { getHistory } from "../web/src/market.js";

const TECH_WEIGHTS = {
  trend: DEFAULT_WEIGHTS.trend,
  momentum: DEFAULT_WEIGHTS.momentum,
  volatility: DEFAULT_WEIGHTS.volatility,
  volume: DEFAULT_WEIGHTS.volume,
};

const VERDICT_THRESHOLDS = {
  "STRONG BUY": 0.5,
  BUY: 0.25,
  SELL: -0.25,
  "STRONG SELL": -0.5,
};

export async function backtestTicker(symbol, { days = 760, step = 20, horizon = 30, minBars = 250 } = {}) {
  const candles = await getHistory(symbol, { days });
  if (candles.length < minBars) {
    throw new Error(`Not enough history for ${symbol} (${candles.length} bars, need ${minBars})`);
  }

  const results = [];
  const buyAndHold = candles[candles.length - 1].close / candles[0].close - 1;

  for (let i = minBars; i <= candles.length - 1 - horizon; i += step) {
    const window = candles.slice(0, i + 1);
    const analysis = analyze({ candles: window, quote: {}, weights: TECH_WEIGHTS });
    const entry = candles[i].close;
    const exit = candles[i + horizon].close;
    const isBuy = analysis.score >= VERDICT_THRESHOLDS.BUY;
    const isSell = analysis.score <= VERDICT_THRESHOLDS.SELL;
    if (!isBuy && !isSell) continue;
    const ret = exit / entry - 1;
    results.push({
      date: candles[i].date,
      exitDate: candles[i + horizon].date,
      entry,
      exit,
      return: isBuy ? ret : -ret,
      score: analysis.score,
      signal: isBuy ? "BUY" : "SELL",
      atrPct: analysis.indicators.atrPct ?? null,
    });
  }

  const wins = results.filter((r) => r.return > 0).length;
  const total = results.length;
  const avgReturn = total ? results.reduce((s, r) => s + r.return, 0) / total : 0;
  const buyAvg = results.filter((r) => r.signal === "BUY").length;
  const sellAvg = results.filter((r) => r.signal === "SELL").length;
  const winReturns = results.filter((r) => r.return > 0).map((r) => r.return);
  const lossReturns = results.filter((r) => r.return <= 0).map((r) => r.return);
  const avgWin = winReturns.length ? winReturns.reduce((s, r) => s + r, 0) / winReturns.length : null;
  const avgLoss = lossReturns.length ? lossReturns.reduce((s, r) => s + r, 0) / lossReturns.length : null;
  const rr = avgWin != null && avgLoss != null && avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : null;

  return {
    symbol,
    window: { days, step, horizon, signals: total },
    buyAndHold,
    total,
    wins,
    losses: total - wins,
    winRate: total ? wins / total : null,
    avgReturn,
    avgWin,
    avgLoss,
    rewardRisk: rr,
    expectancy: total ? results.reduce((s, r) => s + r.return, 0) / total : null,
    avgBuyReturn: buyAvg ? results.filter((r) => r.signal === "BUY").reduce((s, r) => s + r.return, 0) / buyAvg : null,
    avgSellReturn: sellAvg ? results.filter((r) => r.signal === "SELL").reduce((s, r) => s + r.return, 0) / sellAvg : null,
    vsBuyHold: total ? avgReturn - buyAndHold : null,
    signals: results,
    byMonth: results.reduce((acc, r) => {
      const m = r.date.slice(0, 7);
      (acc[m] ??= []).push(r);
      return acc;
    }, {}),
  };
}

export function backtestSummary(bt) {
  const lines = [];
  lines.push(`${bt.symbol} — engine backtest (${bt.window.step}-day checks, ${bt.window.horizon}-day horizon)`);
  lines.push(`Signals: ${bt.total} (${bt.wins}W/${bt.losses}L)`);
  if (bt.winRate != null) lines.push(`Win rate: ${(bt.winRate * 100).toFixed(1)}%`);
  lines.push(`Avg signal return: ${(bt.avgReturn * 100).toFixed(2)}%`);
  if (bt.avgWin != null) lines.push(`Avg win: ${(bt.avgWin * 100).toFixed(2)}%`);
  if (bt.avgLoss != null) lines.push(`Avg loss: ${(bt.avgLoss * 100).toFixed(2)}%`);
  if (bt.rewardRisk != null) lines.push(`Reward:risk: ${bt.rewardRisk.toFixed(2)}:1`);
  if (bt.avgBuyReturn != null) lines.push(`Avg BUY return: ${(bt.avgBuyReturn * 100).toFixed(2)}%`);
  if (bt.avgSellReturn != null) lines.push(`Avg SELL return: ${(bt.avgSellReturn * 100).toFixed(2)}%`);
  lines.push(`Buy & hold: ${(bt.buyAndHold * 100).toFixed(2)}%`);
  if (bt.vsBuyHold != null) lines.push(`Alpha vs buy & hold: ${(bt.vsBuyHold * 100).toFixed(2)}%`);
  return lines.join("\n");
}
