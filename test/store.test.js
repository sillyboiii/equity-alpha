import { test } from "node:test";
import assert from "node:assert";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../src/store.js";

function makeStore() {
  return new Store(join(mkdtempSync(join(tmpdir(), "eqa-")), "test.db"));
}

const S = (d, c) => ({ date: d, open: c, high: c, low: c, close: c, volume: 100 });

test("performance computes per-signal SPX return and net alpha", () => {
  const store = makeStore();
  store.savePrices("TEST", [S("2026-01-05", 100), S("2026-01-06", 101), S("2026-02-04", 110)]);
  store.savePrices("TEST2", [S("2026-01-06", 50), S("2026-02-05", 45)]);
  store.savePrices("^GSPC", [
    S("2026-01-05", 5000),
    S("2026-01-06", 5000),
    S("2026-02-04", 5100),
    S("2026-02-05", 5200),
  ]);
  store.logSignal({ ticker: "TEST", name: "T", verdict: "BUY", score: 0.5, price: 100, signaledAt: "2026-01-05T14:00:00Z" });
  store.logSignal({ ticker: "TEST2", name: "T2", verdict: "SELL", score: -0.5, price: 50, signaledAt: "2026-01-06T14:00:00Z" });

  const p = store.performance();
  assert.equal(p.tradeCount, 2);
  assert.equal(p.spxScored, 2);
  assert.equal(p.beatMarket, 1, "TEST beat SPX (+10% vs +2%), TEST2 short did not (-10% vs +4%)");
  assert.ok(Math.abs(p.netAlpha + 0.03) < 1e-9, `netAlpha = ${p.netAlpha} (expect -0.03)`);
  assert.ok(Math.abs(p.spxAvgReturn - 0.03) < 1e-9, `spxAvgReturn = ${p.spxAvgReturn}`);
  const test1 = p.scored.find((s) => s.ticker === "TEST");
  assert.ok(Math.abs(test1.alpha - 0.08) < 1e-9, `TEST alpha = ${test1.alpha} (expect +0.08)`);
  assert.ok(Math.abs(test1.spxRet - 0.02) < 1e-9);
  const test2 = p.scored.find((s) => s.ticker === "TEST2");
  assert.ok(Math.abs(test2.alpha + 0.14) < 1e-9, `TEST2 alpha = ${test2.alpha} (expect -0.14)`);
});

test("signals without SPX history still score, alpha is null", () => {
  const store = makeStore();
  store.savePrices("TEST", [S("2026-03-01", 100), S("2026-03-31", 105)]);
  store.logSignal({ ticker: "TEST", name: "T", verdict: "BUY", score: 0.5, price: 100, signaledAt: "2026-03-01T14:00:00Z" });
  const p = store.performance();
  assert.equal(p.tradeCount, 1);
  assert.equal(p.spxScored, 0);
  assert.equal(p.netAlpha, null);
  assert.equal(p.scored[0].alpha, null);
});

test("dueForEvaluation finds mature unevaluated signals; markEvaluated prevents re-eval", () => {
  const store = makeStore();
  store.savePrices("TEST", [S("2026-01-05", 100), S("2026-02-04", 110)]);
  store.logSignal({ ticker: "TEST", verdict: "BUY", score: 0.5, price: 100, signaledAt: "2026-01-05T14:00:00Z" });

  let due = store.dueForEvaluation();
  assert.equal(due.length, 1);
  assert.equal(due[0].ticker, "TEST");
  assert.ok(Math.abs(due[0].ret - 0.1) < 1e-9);
  assert.equal(due[0].alpha, null, "no SPX bars in this fixture");

  store.markEvaluated([due[0].id]);
  due = store.dueForEvaluation();
  assert.equal(due.length, 0, "evaluated signal must not come back");

  const p = store.performance();
  assert.equal(p.tradeCount, 1, "performance still counts it after marking");
});

test("dueForEvaluation skips HOLD and not-yet-mature signals", () => {
  const store = makeStore();
  store.savePrices("HOLDY", [S("2026-01-05", 100), S("2026-02-04", 110)]);
  store.logSignal({ ticker: "HOLDY", verdict: "HOLD", score: 0, price: 100, signaledAt: "2026-01-05T14:00:00Z" });

  const recent = new Date(Date.now() - 5 * 86400_000).toISOString();
  const futureExit = new Date(Date.now() + 25 * 86400_000).toISOString().slice(0, 10);
  store.savePrices("NEW", [S(recent.slice(0, 10), 100), S(futureExit, 110)]);
  store.logSignal({ ticker: "NEW", verdict: "BUY", score: 0.5, price: 100, signaledAt: recent });

  const due = store.dueForEvaluation();
  assert.equal(due.length, 0);
});

test("rolling stats: month/quarter win rates, max drawdown, holding days", () => {
  const store = makeStore();
  // March: BUY TEST +10% (win) ; April: BUY TEST2 +5% (win) then BUY TEST3 -20% (loss)
  store.savePrices("TEST", [S("2026-03-01", 100), S("2026-03-31", 110)]);
  store.savePrices("TEST2", [S("2026-04-01", 100), S("2026-05-01", 105)]);
  store.savePrices("TEST3", [S("2026-04-05", 100), S("2026-05-05", 80)]);
  store.logSignal({ ticker: "TEST", verdict: "BUY", score: 0.5, price: 100, signaledAt: "2026-03-01T14:00:00Z" });
  store.logSignal({ ticker: "TEST2", verdict: "BUY", score: 0.5, price: 100, signaledAt: "2026-04-01T14:00:00Z" });
  store.logSignal({ ticker: "TEST3", verdict: "BUY", score: 0.5, price: 100, signaledAt: "2026-04-05T14:00:00Z" });

  const p = store.performance();
  // months: 2026-03 (1W), 2026-04 (none — exits landed in May for TEST2/3), 2026-05 (1W/1L)
  const march = p.byMonth.find((m) => m.label === "2026-03");
  assert.equal(march.wins, 1);
  assert.equal(march.losses, 0);
  const may = p.byMonth.find((m) => m.label === "2026-05");
  assert.equal(may.wins, 1);
  assert.equal(may.losses, 1);
  assert.equal(may.winRate, 0.5);
  const q2 = p.byQuarter.find((q) => q.label === "2026Q2");
  assert.equal(q2.wins, 1);
  assert.equal(q2.losses, 1);

  // equity: 1.1 then 1.155 then 0.924 → peak 1.155, dd 0.924/1.155-1 = -0.20
  assert.ok(Math.abs(p.maxDrawdown - 0.2) < 1e-9, `maxDrawdown = ${p.maxDrawdown}`);
  // holding: TEST 30d, TEST2 ~30d, TEST3 ~30d
  assert.ok(Math.abs(p.avgHoldingDays.long - 30) < 1e-6, `hold ${p.avgHoldingDays.long}`);
});

test("personal signals are tracked in a separate 7-day track record", () => {
  const store = makeStore();
  store.savePrices("TEST", [
    S("2026-03-01", 100),
    S("2026-03-08", 108),
    S("2026-03-31", 115),
  ]);
  store.savePrices("^GSPC", [S("2026-03-01", 5000), S("2026-03-08", 5050)]);
  store.savePrices("TEST2", [S("2026-03-01", 50), S("2026-03-31", 55)]);
  store.logSignal({ ticker: "TEST", name: "T", verdict: "BUY", score: 0.5, price: 100, signaledAt: "2026-03-01T14:00:00Z" }, "personal");
  store.logSignal({ ticker: "TEST2", name: "T2", verdict: "BUY", score: 0.5, price: 50, signaledAt: "2026-03-01T14:00:00Z" });

  const my = store.performance("personal");
  const pub = store.performance();
  assert.equal(my.horizonDays, 7, "personal horizon defaults to 7 days");
  assert.equal(my.tradeCount, 1);
  assert.equal(my.winRate, 1, "7-day exit at 108 is a win");
  assert.ok(Math.abs(my.scored[0].ret - 0.08) < 1e-9, `ret ${my.scored[0].ret}`);
  assert.ok(Math.abs(my.scored[0].alpha - 0.07) < 1e-9, `alpha ${my.scored[0].alpha} (+8% vs SPX +1%)`);
  assert.equal(pub.scored.find((x) => x.ticker === "TEST"), undefined, "public record has no personal signal");
  assert.equal(pub.tradeCount, 1, "public record only has its own signal");
  assert.equal(pub.scored[0].ticker, "TEST2");
});

test("personal horizon is configurable and respected", () => {
  const store = makeStore();
  store.setPersonalHorizonDays(3);
  store.savePrices("TEST", [S("2026-04-01", 100), S("2026-04-04", 110), S("2026-04-08", 90)]);
  store.logSignal({ ticker: "TEST", name: "T", verdict: "BUY", score: 0.5, price: 100, signaledAt: "2026-04-01T14:00:00Z" }, "personal");
  const my = store.performance("personal");
  assert.equal(my.horizonDays, 3);
  assert.ok(Math.abs(my.scored[0].ret - 0.1) < 1e-9, `evaluated at the 3-day bar (110), got ${my.scored[0].ret}`);
});
