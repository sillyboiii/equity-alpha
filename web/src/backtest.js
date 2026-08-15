import { getHistory } from "./market.js";

function ema(values, period) {
  const out = new Array(values.length).fill(null);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let seed = 0;
  for (let i = 0; i < period; i++) seed += values[i];
  out[period - 1] = seed / period;
  for (let i = period; i < values.length; i++) out[i] = values[i] * k + out[i - 1] * (1 - k);
  return out;
}

function simulate(symbol, bars) {
  const closes = bars.map((b) => b.close);
  const dates = bars.map((b) => b.date);
  const e50 = ema(closes, 50);
  const e200 = ema(closes, 200);
  const n = bars.length;
  const equity = new Array(n).fill(1);
  const active = new Array(n).fill(false);
  const trades = [];
  let holding = false;
  let entryIdx = -1;
  let entryClose = 0;
  for (let i = 0; i < n; i++) {
    const c = closes[i];
    const trend = e50[i] != null && e200[i] != null && c > e50[i] && e50[i] > e200[i];
    if (trend && !holding) {
      holding = true;
      entryIdx = i;
      entryClose = c;
    } else if (!trend && holding) {
      const ret = c / entryClose - 1;
      trades.push({
        symbol,
        entry: dates[entryIdx],
        exit: dates[i],
        ret,
        win: ret > 0,
        open: false,
        holdingDays: Math.max(0, Math.round((new Date(dates[i]) - new Date(dates[entryIdx])) / 86400000)),
      });
      holding = false;
    }
    equity[i] = holding ? c / entryClose : 1;
    active[i] = holding;
  }
  if (holding) {
    trades.push({
      symbol,
      entry: dates[entryIdx],
      exit: null,
      ret: closes[n - 1] / entryClose - 1,
      open: true,
      holdingDays: Math.max(0, Math.round((new Date(dates[n - 1]) - new Date(dates[entryIdx])) / 86400000)),
    });
  }
  return { symbol, dates, closes, equity, active, trades };
}

function align(grid, dates, values) {
  const out = new Array(grid.length).fill(1);
  let ptr = 0;
  for (let g = 0; g < grid.length; g++) {
    while (ptr + 1 < dates.length && dates[ptr + 1] <= grid[g]) ptr++;
    out[g] = values[ptr];
  }
  return out;
}

export async function runBacktest({ symbols, days = 1300 } = {}) {
  const per = [];
  for (const s of symbols) {
    try {
      const bars = await getHistory(s, { days });
      per.push({ symbol: s, bars, sim: simulate(s, bars) });
    } catch (e) {
      per.push({ symbol: s, bars: null, sim: null, error: e?.message ?? "no history" });
    }
  }
  const ok = per.filter((p) => p.sim);
  if (!ok.length) throw new Error("No price history available for this universe");

  const spxBars = await getHistory("^GSPC", { days });
  const spxCloses = spxBars.map((b) => b.close);
  const spxDates = spxBars.map((b) => b.date);

  const grid = [...new Set([...spxDates, ...ok.flatMap((p) => p.sim.dates)])].sort();
  const first = grid[0];
  const last = grid[grid.length - 1];

  const strat = new Array(grid.length).fill(0);
  const bh = new Array(grid.length).fill(0);
  const inMarket = new Array(grid.length).fill(false);
  const N = ok.length;

  const spxGrid = align(grid, spxDates, spxCloses.map((c) => c / spxCloses[0] * 100));
  const spxFirstIdx = spxDates.findIndex((d) => d >= first);
  const spxBase = spxFirstIdx >= 0 ? spxCloses[spxFirstIdx] : spxCloses[0];

  for (const p of ok) {
    const eq = align(grid, p.sim.dates, p.sim.equity.map((v) => v * 100));
    const bhSeries = align(grid, p.sim.dates, p.sim.closes.map((c) => c / p.sim.closes[0] * 100));
    for (let g = 0; g < grid.length; g++) {
      strat[g] += eq[g];
      bh[g] += bhSeries[g];
      if (p.sim.active[Math.min(g, p.sim.active.length - 1)]) inMarket[g] = true;
    }
  }
  for (let g = 0; g < grid.length; g++) {
    strat[g] /= N;
    bh[g] /= N;
  }

  const spxIdx = spxCloses.map((c) => c / spxBase * 100);

  const allTrades = ok.flatMap((p) => p.sim.trades.filter((t) => !t.open));
  const wins = allTrades.filter((t) => t.win).length;
  const tradesCount = allTrades.length;
  const avgHolding = allTrades.length ? allTrades.reduce((a, t) => a + t.holdingDays, 0) / allTrades.length : 0;
  const avgRet = allTrades.length ? allTrades.reduce((a, t) => a + t.ret, 0) / allTrades.length : 0;

  const stratEnd = strat[strat.length - 1];
  const bhEnd = bh[bh.length - 1];
  const spxEnd = spxIdx[spxIdx.length - 1];
  const years = (new Date(last) - new Date(first)) / (365.25 * 86400000) || 1;

  function stats(endVal, series) {
    const totalReturn = endVal / 100 - 1;
    let peak = series[0];
    let maxDD = 0;
    for (const v of series) {
      if (v > peak) peak = v;
      const dd = v / peak - 1;
      if (dd < maxDD) maxDD = dd;
    }
    return {
      totalReturn,
      cagr: (1 + totalReturn) ** (1 / Math.max(years, 0.01)) - 1,
      maxDrawdown: maxDD,
    };
  }

  const strategy = stats(stratEnd, strat);
  const buyHold = stats(bhEnd, bh);
  const benchmark = stats(spxEnd, spxIdx);

  const curve = [];
  let lastMonth = "";
  for (let g = 0; g < grid.length; g++) {
    const m = grid[g].slice(0, 7);
    if (m !== lastMonth) {
      lastMonth = m;
      curve.push({ month: m, strategy: strat[g], buyHold: bh[g], benchmark: spxIdx[g] });
    } else if (g === grid.length - 1) {
      curve[curve.length - 1] = { month: m, strategy: strat[g], buyHold: bh[g], benchmark: spxIdx[g] };
    }
  }

  const tickers = ok.map((p) => {
    const trades = p.sim.trades.filter((t) => !t.open);
    const w = trades.filter((t) => t.win).length;
    return {
      symbol: p.symbol,
      strategyRet: p.sim.equity[p.sim.equity.length - 1] - 1,
      buyHoldRet: p.sim.closes[p.sim.closes.length - 1] / p.sim.closes[0] - 1,
      trades: trades.length,
      wins: w,
      winRate: trades.length ? w / trades.length : null,
    };
  });

  return {
    period: { start: first, end: last, years: Number(years.toFixed(1)) },
    universe: ok.map((p) => p.symbol),
    failed: per.filter((p) => p.error).map((p) => p.symbol),
    strategy: { ...strategy, trades: tradesCount, wins, winRate: tradesCount ? wins / tradesCount : null, avgHoldingDays: Number(avgHolding.toFixed(1)), avgTradeRet: avgRet, monthsInMarket: (inMarket.filter(Boolean).length / grid.length || 0) },
    buyHold,
    benchmark,
    alpha: strategy.totalReturn - benchmark.totalReturn,
    curve,
    tickers,
  };
}
