import { test } from "node:test";
import assert from "node:assert/strict";
import { sma, ema, rsi, macd, atr, bollinger, verdictFor, analyze, DEFAULT_WEIGHTS, qualityGrade, valueGrade, volatilityRiskFor, buildThesis, fairValueAnalysis, scenarioAnalysis, suggestedSize } from "../web/src/analysis.js";
import { trendStrategy } from "../web/src/strategies/trend.js";
import { swingStrategy } from "../web/src/strategies/swing.js";
import { financialInsights } from "../src/deepdive.js";
import { peerComp } from "../web/src/comps.js";

function makeCloses(n, base = 100, step = 1) {
  const out = [];
  let v = base;
  for (let i = 0; i < n; i++) {
    out.push(v);
    v += step;
  }
  return out;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function randomWalk(n, drift, sd, start, seed) {
  const rand = mulberry32(seed);
  const closes = [];
  let v = start;
  for (let i = 0; i < n; i++) {
    v *= 1 + drift + (rand() - 0.5) * 2 * sd;
    closes.push(v);
  }
  return closes;
}

const makeBullish = (n = 260) => randomWalk(n, 0.003, 0.015, 100, 42);
const makeBearish = (n = 260) => randomWalk(n, -0.003, 0.015, 200, 43);
const makeFlat = (n = 260) => randomWalk(n, 0, 0.004, 100, 44);

function makeCandles(closes) {
  return closes.map((close, i) => ({
    date: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
    open: close * 0.998,
    high: close * 1.008,
    low: close * 0.992,
    close,
    volume: 1_000_000 * (1 + 0.1 * Math.sin(i / 5)),
  }));
}

test("sma matches a known value", () => {
  const out = sma([1, 2, 3, 4, 5], 3);
  assert.equal(out[2], 2);
  assert.equal(out[3], 3);
  assert.equal(out[4], 4);
  assert.equal(out[0], null);
});

test("ema is seeded by SMA and trails an uptrend", () => {
  const closes = makeCloses(30, 100, 1);
  const out = ema(closes, 10);
  assert.ok(out[9] != null);
  assert.ok(out[29] > out[9]);
  assert.ok(out[29] < closes[29]);
});

test("rsi of rising prices is high", () => {
  const out = rsi(makeBullish(), 14);
  assert.ok(out[out.length - 1] > 55, `got ${out[out.length - 1]}`);
  assert.ok(out[out.length - 1] <= 90, `got ${out[out.length - 1]}`);
});

test("rsi of falling prices is low", () => {
  const out = rsi(makeBearish(), 14);
  assert.ok(out[out.length - 1] < 45, `got ${out[out.length - 1]}`);
});

test("rsi of flat prices is neutral, not extreme", () => {
  const out = rsi(makeFlat(), 14);
  const r = out[out.length - 1];
  assert.ok(r >= 40 && r <= 60, `got ${r}`);
});

test("macd line is positive on average in an uptrend", () => {
  const { macd: macdLine } = macd(makeBullish());
  const recent = macdLine.slice(-60).filter((v) => v != null);
  const avg = recent.reduce((s, v) => s + v, 0) / recent.length;
  assert.ok(avg > 0, `avg ${avg.toFixed(4)}`);
});

test("atr is positive and bounded by range", () => {
  const candles = makeCandles(makeCloses(30, 100, 0));
  const out = atr(candles, 14);
  const lastAtr = out[out.length - 1];
  assert.ok(lastAtr > 0);
  assert.ok(lastAtr < 5);
});

test("bollinger upper >= middle >= lower", () => {
  const closes = makeBullish(120);
  const { upper, middle, lower } = bollinger(closes, 20, 2);
  const i = closes.length - 1;
  assert.ok(upper[i] >= middle[i]);
  assert.ok(middle[i] >= lower[i]);
});

test("verdictFor maps score bands", () => {
  assert.equal(verdictFor(0.8), "STRONG BUY");
  assert.equal(verdictFor(0.3), "BUY");
  assert.equal(verdictFor(0), "HOLD");
  assert.equal(verdictFor(-0.3), "SELL");
  assert.equal(verdictFor(-0.8), "STRONG SELL");
});

test("analyze scores a healthy uptrend positively", () => {
  const res = analyze({ candles: makeCandles(makeBullish()), quote: {} });
  assert.ok(res.score > 0, `expected positive score, got ${res.score}`);
  assert.ok(res.verdict === "BUY" || res.verdict === "STRONG BUY", `got ${res.verdict}`);
  assert.ok(Array.isArray(res.reasoning));
  assert.ok(res.indicators.price === makeBullish()[makeBullish().length - 1]);
});

test("analyze scores a downtrend negatively", () => {
  const res = analyze({ candles: makeCandles(makeBearish()), quote: {} });
  assert.ok(res.score < 0, `expected negative score, got ${res.score}`);
  assert.ok(res.verdict === "SELL" || res.verdict === "STRONG SELL", `got ${res.verdict}`);
});

test("analyze treats a flat stock as HOLD", () => {
  const res = analyze({ candles: makeCandles(makeFlat()), quote: {} });
  assert.equal(res.verdict, "HOLD");
});

test("fundamental data moves the score", () => {
  const candles = makeCandles(makeFlat());
  const cheap = analyze({ candles, quote: { trailingPE: 8, profitMargins: 0.25, revenueGrowth: 0.2, debtToEquity: 20 } });
  const expensive = analyze({ candles, quote: { trailingPE: 90, profitMargins: -0.1, revenueGrowth: -0.2, debtToEquity: 300 } });
  assert.ok(cheap.score > expensive.score);
});

test("weights are honored", () => {
  const candles = makeCandles(makeBullish());
  const base = analyze({ candles, quote: {} });
  const zeroTrend = analyze({ candles, quote: {}, weights: { ...DEFAULT_WEIGHTS, trend: 0 } });
  assert.notEqual(base.score, zeroTrend.score);
});

test("grades map score bands", () => {
  assert.equal(qualityGrade(0.5), "STRONG");
  assert.equal(qualityGrade(0.2), "GOOD");
  assert.equal(qualityGrade(0), "FAIR");
  assert.equal(qualityGrade(-0.2), "WEAK");
  assert.equal(qualityGrade(-0.6), "POOR");
  assert.equal(valueGrade(0.5), "CHEAP");
  assert.equal(valueGrade(0.05), "FAIR");
  assert.equal(valueGrade(-0.1), "RICH");
  assert.equal(valueGrade(-0.5), "EXPENSIVE");
});

test("analyze returns grades for quality and value", () => {
  const candles = makeCandles(makeFlat());
  const good = analyze({
    candles,
    quote: {
      trailingPE: 10, priceToBook: 1, pegRatio: 0.8, enterpriseToEbitda: 8, priceToSalesTrailing12Months: 1.5,
      returnOnEquity: 0.3, profitMargins: 0.25, debtToEquity: 30, currentRatio: 2,
    },
  });
  assert.equal(good.grades.quality, "STRONG");
  assert.equal(good.grades.value, "CHEAP");
  const bad = analyze({ candles, quote: { trailingPE: 80, returnOnEquity: -0.1, profitMargins: -0.2, debtToEquity: 400 } });
  assert.ok(["POOR", "WEAK"].includes(bad.grades.quality));
  assert.equal(bad.grades.value, "EXPENSIVE");
});

test("volatilityRiskFor maps ATR bands to tradability", () => {
  assert.equal(volatilityRiskFor(0.3), "TOO FLAT");
  assert.equal(volatilityRiskFor(2), "TRADEABLE");
  assert.equal(volatilityRiskFor(4), "ELEVATED");
  assert.equal(volatilityRiskFor(8), "HIGH");
  assert.equal(volatilityRiskFor(null), "UNKNOWN");
});

test("buildThesis mentions verdict, quality, valuation and volatility", () => {
  const t = buildThesis({
    name: "Exxon Mobil",
    verdict: "STRONG BUY",
    grades: { quality: "STRONG", value: "CHEAP" },
    fairValue: { marginOfSafety: 0.34 },
    components: { trend: { note: "Price above 50-day EMA" } },
    volatilityRisk: "TRADEABLE",
  });
  assert.ok(t.includes("STRONG BUY"));
  assert.ok(t.includes("strong-quality"));
  assert.ok(t.includes("margin of safety"));
  assert.ok(t.includes("uptrend"));
  assert.ok(t.includes("sweet spot"));
});

test("analyze exposes thesis and volatility risk", () => {
  const res = analyze({ candles: makeCandles(makeBullish()), quote: { longName: "Test Inc" } });
  assert.ok(typeof res.thesis === "string" && res.thesis.length > 10);
  assert.ok(["TRADEABLE", "ELEVATED", "HIGH", "TOO FLAT", "UNKNOWN"].includes(res.volatilityRisk));
});

test("noKnifeCatch guard blocks BUY on a sharp bounce below the 200-day EMA", () => {
  let closes = randomWalk(380, -0.003, 0.015, 250, 123);
  const last = closes[closes.length - 1];
  for (let i = 0; i < 20; i++) closes.push(last * (1 + 0.03 + i * 0.001));
  const candles = makeCandles(closes);
  const res = analyze({
    candles,
    quote: {
      trailingPE: 8, priceToBook: 0.8, pegRatio: 0.7,
      returnOnEquity: 0.3, profitMargins: 0.25, debtToEquity: 30, currentRatio: 2,
      freeCashflow: 1e9, netIncomeToCommon: 1e9,
    },
  });
  assert.ok(res.indicators.price < res.indicators.ema200, "test needs price below ema200");
  assert.notEqual(res.verdict, "BUY");
  assert.notEqual(res.verdict, "STRONG BUY");
  assert.ok(res.guards.some((g) => g.id === "noKnifeCatch"), "knife guard should fire");
});

test("engine does not short extended pumps, even with terrible fundamentals", () => {
  const closes = randomWalk(300, 0.004, 0.01, 100, 101);
  const candles = makeCandles(closes);
  const res = analyze({
    candles,
    quote: { trailingPE: 90, returnOnEquity: -0.3, profitMargins: -0.5, debtToEquity: 500 },
  });
  if (res.indicators.rsi != null && res.indicators.rsi > 70 && res.indicators.price > res.indicators.ema50) {
    assert.notEqual(res.verdict, "SELL");
    assert.notEqual(res.verdict, "STRONG SELL");
  }
});

test("noOverpay guard blocks BUY on EXPENSIVE premium names", () => {
  const candles = makeCandles(makeBullish());
  const res = analyze({
    candles,
    quote: {
      trailingPE: 80, priceToBook: 30, priceToSalesTrailing12Months: 20, enterpriseToEbitda: 30, pegRatio: 2.5,
      returnOnEquity: 0.4, profitMargins: 0.35, debtToEquity: 20,
    },
  });
  assert.equal(res.grades.value, "EXPENSIVE", "test needs EXPENSIVE grade");
  assert.notEqual(res.verdict, "BUY");
  assert.notEqual(res.verdict, "STRONG BUY");
  assert.ok(res.guards.some((g) => g.id === "noOverpay"), "overpay guard should fire");
});

test("noOverpay does not block CHEAP/FAIR buys", () => {
  const candles = makeCandles(makeBullish());
  const res = analyze({
    candles,
    quote: {
      trailingPE: 10, priceToBook: 1.2, priceToSalesTrailing12Months: 1.5, enterpriseToEbitda: 8,
      returnOnEquity: 0.3, profitMargins: 0.25, debtToEquity: 30,
    },
  });
  assert.ok(["CHEAP", "FAIR"].includes(res.grades.value));
  assert.ok(!res.guards.some((g) => g.id === "noOverpay"), "overpay guard should not fire");
  assert.ok(res.verdict === "BUY" || res.verdict === "STRONG BUY", `got ${res.verdict}`);
});

test("EPS-based DCF fallback covers banks with no free cash flow", () => {
  const fv = fairValueAnalysis({
    price: 100,
    freeCashflow: null,
    trailingEps: 8,
    earningsGrowth: 0.1,
    beta: 1,
    targetMeanPrice: 110,
  });
  assert.ok(fv.dcf != null, "EPS-based DCF should fill the gap");
  assert.equal(fv.dcfMethod, "eps");
  assert.ok(fv.blended > 0, "blended fair value should exist");
});

test("FCF-based DCF still preferred when free cash flow exists", () => {
  const fv = fairValueAnalysis({
    price: 100,
    freeCashflow: 10,
    sharesOutstanding: 10,
    earningsGrowth: 0.1,
    beta: 1,
    totalDebt: 0,
    totalCash: 0,
    targetMeanPrice: 110,
  });
  assert.equal(fv.dcfMethod, "fcf");
});

test("financialInsights reads growth, margins, debt and cash from 5-year data", () => {
  const years = [
    { year: 2022, revenue: 100, netIncome: 15, eps: 1.5, totalDebt: 40, operatingCashFlow: 14 },
    { year: 2023, revenue: 115, netIncome: 19, eps: 1.9, totalDebt: 42, operatingCashFlow: 17 },
    { year: 2024, revenue: 130, netIncome: 24, eps: 2.4, totalDebt: 46, operatingCashFlow: 22 },
    { year: 2025, revenue: 150, netIncome: 31, eps: 3.1, totalDebt: 50, operatingCashFlow: 28 },
  ];
  const notes = financialInsights(years);
  const text = notes.map((n) => n.text).join(" ");
  assert.ok(/compounding/.test(text), "should mention revenue compounding");
  assert.ok(/margin/.test(text), "should read the margin trend");
  assert.ok(/debt/.test(text), "should read the debt trend");
  assert.ok(/conversion/.test(text), "should read cash conversion");
  assert.ok(notes.some((n) => /Improving/.test(n.text)), "healthy trajectory = Improving");
});

test("financialInsights flags a deteriorating story", () => {
  const years = [
    { year: 2022, revenue: 100, netIncome: 20, eps: 2.0, totalDebt: 30, operatingCashFlow: 10 },
    { year: 2023, revenue: 95, netIncome: 15, eps: 1.5, totalDebt: 60, operatingCashFlow: 8 },
    { year: 2024, revenue: 88, netIncome: 10, eps: 1.0, totalDebt: 90, operatingCashFlow: 5 },
  ];
  const notes = financialInsights(years);
  assert.ok(notes.some((n) => /Deteriorating/.test(n.text)), "failing company = Deteriorating");
  assert.ok(notes.some((n) => /watch leverage|debt build-up/.test(n.text)), "debt spike should be flagged");
});

test("scenarioAnalysis returns ordered bull/base/bear targets", () => {
  const sc = scenarioAnalysis({
    price: 100,
    freeCashflow: 12,
    sharesOutstanding: 10,
    earningsGrowth: 0.1,
    beta: 1,
    totalDebt: 0,
    totalCash: 0,
    targetMeanPrice: 110,
    targetHighPrice: 130,
    targetLowPrice: 90,
  });
  assert.ok(sc, "scenarios should compute");
  assert.ok(sc.bull != null && sc.base != null && sc.bear != null);
  assert.ok(sc.bull >= sc.base, "bull >= base");
  assert.ok(sc.base >= sc.bear, "base >= bear");
  assert.ok(sc.upside.bull > sc.upside.bear, "bull upside > bear upside");
});

test("scenarioAnalysis guards against absurd values", () => {
  const sc = scenarioAnalysis({
    price: 50,
    freeCashflow: 2,
    sharesOutstanding: 10,
    earningsGrowth: 0.6,
    beta: 2,
    totalDebt: 0,
    totalCash: 0,
  });
  if (!sc) return;
  assert.ok(sc.bull >= sc.base && sc.base >= sc.bear, "ordering holds under stress");
});

test("guard checks trigger on the right market conditions", () => {
  const { noKnifeCatch, noPumpShort } = trendStrategy.guards;
  assert.ok(noKnifeCatch.check({ price: 90, ema200: 100 }), "below 200-day EMA");
  assert.ok(!noKnifeCatch.check({ price: 110, ema200: 100 }), "above 200-day EMA");
  assert.ok(noPumpShort.check({ price: 110, ema50: 100, rsi: 75 }), "extended + hot RSI");
  assert.ok(!noPumpShort.check({ price: 110, ema50: 100, rsi: 60 }), "not hot RSI");
  assert.ok(!noPumpShort.check({ price: 90, ema50: 100, rsi: 75 }), "not extended");
});

test("analyze returns strategy metadata", () => {
  const res = analyze({ candles: makeCandles(makeBullish()), quote: {} });
  assert.equal(res.strategy.id, "trend");
  assert.equal(res.strategy.name, "Trend Follower");
});

test("peerComp flags a stock trading rich vs its peers", () => {
  const quote = { symbol: "AAA", forwardPE: 40, priceToBook: 9, pegRatio: 3.2 };
  const peers = [
    { symbol: "BBB", forwardPE: 18, priceToBook: 3, pegRatio: 1.4 },
    { symbol: "CCC", forwardPE: 20, priceToBook: 4, pegRatio: 1.6 },
    { symbol: "DDD", forwardPE: 22, priceToBook: 5, pegRatio: 1.9 },
  ];
  const res = peerComp(quote, peers);
  assert.equal(res.verdict, "EXPENSIVE vs peers");
  assert.equal(res.tone, "bad");
  assert.ok(res.metrics.every((m) => m.tone === "expensive"));
});

test("peerComp flags a cheap stock and needs 2+ peers", () => {
  const quote = { symbol: "AAA", forwardPE: 12, priceToBook: 1.5 };
  const peers = [
    { symbol: "BBB", forwardPE: 25, priceToBook: 5 },
    { symbol: "CCC", forwardPE: 30, priceToBook: 6 },
    { symbol: "DDD", forwardPE: 28, priceToBook: 7 },
  ];
  const res = peerComp(quote, peers);
  assert.equal(res.verdict, "CHEAP vs peers");
  assert.equal(res.tone, "good");
  const few = peerComp(quote, [{ symbol: "BBB", forwardPE: 25 }]);
  assert.equal(few.verdict, null);
  assert.equal(few.metrics.length, 0);
});

test("suggestedSize scales base by verdict and caps on volatility", () => {
  assert.equal(suggestedSize({ verdict: "HOLD", atrPct: 5 }), 0, "HOLD is always 0");
  assert.equal(suggestedSize({ verdict: "STRONG BUY", atrPct: 2 }), 20, "low vol keeps full STRONG BUY size");
  assert.equal(suggestedSize({ verdict: "BUY", atrPct: 2.5 }), 12, "BUY base at 2.5%/day vol");
  assert.equal(suggestedSize({ verdict: "BUY", atrPct: 5 }), 6, "BUY at 5%/day vol = 12 * 2.5/5 = 6");
  assert.equal(suggestedSize({ verdict: "SELL", atrPct: 2.5 }), 10, "SELL base");
  assert.equal(suggestedSize({ verdict: "STRONG SELL", atrPct: 1 }), 15, "STRONG SELL base");
  assert.ok(suggestedSize({ verdict: "BUY", atrPct: 0.1 }) <= 20, "never exceeds 20%");
});

test("analyze reports suggestedSize", () => {
  const res = analyze({ candles: makeCandles(makeBullish()), quote: {} });
  assert.ok(res.suggestedSize >= 0 && res.suggestedSize <= 20);
});

test("swing strategy uses fast indicators and caps suggested size", () => {
  const res = analyze({ candles: makeCandles(makeBullish()), quote: {}, strategy: "swing" });
  assert.equal(res.strategy.id, "swing");
  assert.equal(res.strategy.timeframe, "swing");
  assert.ok(res.indicators.emaFast != null && res.indicators.emaSlow != null, "fast/slow EMAs computed");
  assert.ok(res.suggestedSize <= 15, "swing size capped at 15%");
  assert.ok(res.components.momentum.note.includes("5-day return"), "momentum uses 5-day lookback");
  assert.ok(res.components.volatility.note.startsWith("ATR"), "volatility is computed for swing");
});

test("swing volatility thresholds differ from long-term thresholds", () => {
  const swingCandles = [];
  let v = 100;
  for (let i = 0; i < 40; i++) {
    swingCandles.push({ date: `2026-05-${String((i % 28) + 1).padStart(2, "0")}`, open: 100, high: 103.5, low: 96.5, close: 100, volume: 1_000_000 });
    v = 100;
  }
  const longNote = analyze({ candles: swingCandles, quote: {}, strategy: "trend" }).components.volatility.note;
  const swingNote = analyze({ candles: swingCandles, quote: {}, strategy: "swing" }).components.volatility.note;
  assert.notEqual(longNote, swingNote, "7%/day ATR reads differently for swing vs long-term");
  assert.ok(swingNote.includes("elevated"), `swing: ${swingNote}`);
  assert.ok(longNote.includes("too volatile"), `long: ${longNote}`);
});

test("swing noKnifeCatch blocks buys below the 21-day EMA", () => {
  const g = swingStrategy.guards.noKnifeCatch;
  assert.equal(g.check({ price: 100, emaSlow: 101 }), true, "price below 21-day EMA blocks buy");
  assert.equal(g.check({ price: 102, emaSlow: 101 }), false);
});

test("swing noPumpShort blocks shorts above 9-day EMA with RSI > 70", () => {
  const g = swingStrategy.guards.noPumpShort;
  assert.equal(g.check({ price: 100, emaFast: 99, rsi: 74 }), true);
  assert.equal(g.check({ price: 100, emaFast: 101, rsi: 74 }), false, "below fast EMA is fine to short");
  assert.equal(g.check({ price: 100, emaFast: 99, rsi: 60 }), false);
});

test("swing noKnifeCatch refuses buys on a 21-day trend break that trend strategy allows", () => {
  const closes = [];
  let v = 100;
  for (let i = 0; i < 240; i++) {
    closes.push(v);
    v *= 1.01;
  }
  v *= 0.9;
  closes.push(v);
  const candles = makeCandles(closes);
  const quote = {
    trailingPE: 8, priceToBook: 0.8, pegRatio: 0.7,
    returnOnEquity: 0.3, profitMargins: 0.25, debtToEquity: 30, currentRatio: 2,
    freeCashflow: 1e9, netIncomeToCommon: 1e9,
  };
  const swing = analyze({ candles, quote, weights: { value: 0.2, quality: 0.2 }, strategy: "swing" });
  const trend = analyze({ candles, quote });
  assert.ok(swing.indicators.price < swing.indicators.emaSlow, "price broke below the 21-day EMA");
  assert.ok(swing.indicators.price > swing.indicators.ema200, "but remains above the 200-day EMA");
  assert.ok(trend.verdict === "BUY" || trend.verdict === "STRONG BUY", `trend allows the buy: ${trend.verdict}`);
  assert.ok(swing.guards.some((g) => g.id === "noKnifeCatch"), "swing 21-day knife-catch fired");
  assert.ok(swing.verdict !== "BUY" && swing.verdict !== "STRONG BUY", `swing refused the buy: ${swing.verdict}`);
});
