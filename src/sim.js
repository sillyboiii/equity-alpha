import { backtestTicker } from "./backtest.js";
import { suggestedSize } from "./analysis.js";

export async function simulate({
  tickers,
  startCash = 10000,
  positionPct = 0.2,
  maxPositions = 5,
  days = 760,
  step = 20,
  horizon = 60,
  sizing = false,
  onProgress,
}) {
  const events = [];
  for (const t of tickers) {
    onProgress?.(t);
    try {
      const bt = await backtestTicker(t, { days, step, horizon });
      for (const s of bt.signals) {
        events.push({
          date: s.date,
          exitDate: s.exitDate,
          ret: s.return,
          score: s.score,
          signal: s.signal,
          ticker: bt.symbol,
        });
      }
    } catch {
      // ticker without enough history — skip
    }
  }
  events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  let cash = startCash;
  const positions = [];
  const trades = [];
  const curve = [{ date: events[0]?.date ?? "start", equity: startCash }];

  const closeDue = (beforeDate) => {
    let changed = false;
    for (let i = positions.length - 1; i >= 0; i--) {
      if (positions[i].exitDate <= beforeDate) {
        const p = positions.splice(i, 1)[0];
        cash += p.value;
        trades.push(p);
        curve.push({ date: p.exitDate, equity: cash + positions.reduce((s, x) => s + x.value, 0) });
        changed = true;
      }
    }
    return changed;
  };

  for (const e of events) {
    closeDue(e.date);
    if (positions.length >= maxPositions) continue;
    const pct = sizing ? Math.max(0.02, Math.min(0.2, suggestedSize({ verdict: e.signal, atrPct: e.atrPct }) / 100)) : positionPct;
    const alloc = cash * pct;
    if (alloc < 1) continue;
    cash -= alloc;
    positions.push({
      date: e.date,
      exitDate: e.exitDate,
      value: alloc * (1 + e.ret),
      ret: e.ret,
      score: e.score,
      signal: e.signal,
      ticker: e.ticker,
      sizePct: pct,
    });
  }
  closeDue("9999-12-31");

  const finalEquity = cash + positions.reduce((s, p) => s + p.value, 0);
  const pnl = finalEquity - startCash;
  const wins = trades.filter((t) => t.ret > 0).length;
  const losses = trades.filter((t) => t.ret <= 0).length;
  const avgWin = wins ? trades.filter((t) => t.ret > 0).reduce((s, t) => s + t.ret, 0) / wins : null;
  const avgLoss = losses ? trades.filter((t) => t.ret <= 0).reduce((s, t) => s + t.ret, 0) / losses : null;

  let peak = startCash;
  let maxDrawdown = 0;
  for (const c of curve) {
    peak = Math.max(peak, c.equity);
    maxDrawdown = Math.max(maxDrawdown, (peak - c.equity) / peak);
  }

  const avgOpen = curve.reduce((s, c) => s + c.equity, 0) / Math.max(1, curve.length);
  return {
    startCash,
    finalEquity,
    pnl,
    totalReturn: pnl / startCash,
    trades: trades.length,
    wins,
    losses,
    winRate: trades.length ? wins / trades.length : null,
    avgWin,
    avgLoss,
    maxDrawdown,
    avgEquity: avgOpen,
    config: { positionPct, maxPositions, days, step, horizon, sizing, tickers: tickers.length },
  };
}

export function simSummary(sim) {
  const fmt = (n) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  const lines = [];
  lines.push(`Simulation: $${sim.startCash.toLocaleString()} · ${sim.config.sizing ? "suggested position sizes (volatility-capped)" : `${sim.config.positionPct * 100}% per position`} · max ${sim.config.maxPositions} concurrent · ${sim.config.horizon}-day horizon`);
  lines.push(`${sim.trades} trades over ${sim.config.days}-day window`);
  lines.push(`Final equity: ${fmt(sim.finalEquity)} (${sim.pnl >= 0 ? "+" : ""}${fmt(sim.pnl)})`);
  lines.push(`Total return: ${(sim.totalReturn * 100).toFixed(1)}%`);
  lines.push(`Win rate: ${sim.winRate != null ? (sim.winRate * 100).toFixed(1) + "%" : "—"} (${sim.wins}W / ${sim.losses}L)`);
  lines.push(`Avg win: ${sim.avgWin != null ? (sim.avgWin * 100).toFixed(2) + "%" : "—"} · Avg loss: ${sim.avgLoss != null ? (sim.avgLoss * 100).toFixed(2) + "%" : "—"}`);
  lines.push(`Max drawdown: ${(sim.maxDrawdown * 100).toFixed(1)}%`);
  return lines.join("\n");
}
