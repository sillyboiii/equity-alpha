import { getStrategy, listStrategies } from "./strategies/index.js";

export const DEFAULT_WEIGHTS = {
  trend: 0.25,
  momentum: 0.2,
  volatility: 0.1,
  volume: 0.1,
  value: 0.2,
  quality: 0.15,
};

const clamp = (v, min = -1, max = 1) => Math.max(min, Math.min(max, v));

export function sma(values, period) {
  const out = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function ema(values, period) {
  const out = new Array(values.length).fill(null);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  const seed = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = seed;
  for (let i = period; i < values.length; i++) {
    out[i] = values[i] * k + out[i - 1] * (1 - k);
  }
  return out;
}

export function rsi(closes, period = 14) {
  const out = new Array(closes.length).fill(null);
  if (closes.length <= period) return out;
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) avgGain += diff;
    else avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;
  out[period] = avgLoss === 0 ? (avgGain === 0 ? 50 : 100) : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff >= 0 ? diff : 0;
    const loss = diff >= 0 ? 0 : -diff;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? (avgGain === 0 ? 50 : 100) : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export function macd(closes, fast = 12, slow = 26, signalPeriod = 9) {
  const fastLine = ema(closes, fast);
  const slowLine = ema(closes, slow);
  const macdLine = closes.map((_, i) =>
    fastLine[i] != null && slowLine[i] != null ? fastLine[i] - slowLine[i] : null
  );
  const macdOnly = macdLine.filter((v) => v != null);
  const offset = macdLine.length - macdOnly.length;
  const signal = ema(macdOnly, signalPeriod);
  const signalLine = new Array(closes.length).fill(null);
  for (let i = 0; i < signal.length; i++) signalLine[i + offset] = signal[i];
  const histogram = macdLine.map((v, i) =>
    v != null && signalLine[i] != null ? v - signalLine[i] : null
  );
  return { macd: macdLine, signal: signalLine, histogram };
}

export function atr(candles, period = 14) {
  const out = new Array(candles.length).fill(null);
  if (candles.length <= period) return out;
  const trs = candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const prevClose = candles[i - 1].close;
    return Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose));
  });
  let a = trs.slice(1, period + 1).reduce((s, t) => s + t, 0) / period;
  out[period] = a;
  for (let i = period + 1; i < trs.length; i++) {
    a = (a * (period - 1) + trs[i]) / period;
    out[i] = a;
  }
  return out;
}

export function bollinger(closes, period = 20, mult = 2) {
  const middle = sma(closes, period);
  const upper = new Array(closes.length).fill(null);
  const lower = new Array(closes.length).fill(null);
  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = middle[i];
    const variance = slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    upper[i] = mean + mult * sd;
    lower[i] = mean - mult * sd;
  }
  return { upper, middle, lower };
}

function last(vals) {
  for (let i = vals.length - 1; i >= 0; i--) {
    if (vals[i] != null) return vals[i];
  }
  return null;
}

function fmtPct(v) {
  const pct = v * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

const DEADBAND = 0.005;

function trendComponent(closes, price, { fast = 50, slow = 200 } = {}) {
  const eFast = last(ema(closes, fast));
  const eSlow = last(ema(closes, slow));
  const notes = [];
  let score = 0;
  const rel = (v) => v && price ? price / v - 1 : 0;
  if (eFast != null) {
    const r = rel(eFast);
    if (r > DEADBAND) {
      score += 0.4;
      notes.push(`Price **above** ${fast}-day EMA (${fmtPct(r)})`);
    } else if (r < -DEADBAND) {
      score -= 0.4;
      notes.push(`Price **below** ${fast}-day EMA (${fmtPct(r)})`);
    } else {
      notes.push(`Price at ${fast}-day EMA — neutral`);
    }
  }
  if (eSlow != null) {
    const r = rel(eSlow);
    if (r > DEADBAND) {
      score += 0.3;
      notes.push(`Price **above** ${slow}-day EMA — long-term trend intact`);
    } else if (r < -DEADBAND) {
      score -= 0.3;
      notes.push(`Price **below** ${slow}-day EMA — long-term trend broken`);
    }
  }
  if (eFast != null && eSlow != null) {
    const r = eFast / eSlow - 1;
    if (r > DEADBAND) {
      score += 0.3;
      notes.push(`${fast}-day EMA **above** ${slow}-day — golden alignment`);
    } else if (r < -DEADBAND) {
      score -= 0.3;
      notes.push(`${fast}-day EMA **below** ${slow}-day — death alignment`);
    }
  }
  return { score: clamp(score), note: notes.join(" · ") || "not enough history" };
}

function momentumComponent(closes, { lookback = 14 } = {}) {
  const r = last(rsi(closes, 14));
  const hist = last(macd(closes).histogram);
  const retN = closes.length >= lookback + 1 ? closes[closes.length - 1] / closes[closes.length - 1 - lookback] - 1 : 0;
  const notes = [];
  let score = 0;
  if (r != null) {
    if (r >= 55 && r <= 70) {
      score += 0.5;
      notes.push(`RSI ${r.toFixed(0)} — healthy momentum`);
    } else if (r > 70 && r <= 80) {
      score += 0.1;
      notes.push(`RSI ${r.toFixed(0)} — overbought, momentum fading`);
    } else if (r > 80) {
      score -= 0.5;
      notes.push(`RSI ${r.toFixed(0)} — extreme overbought`);
    } else if (r >= 45 && r <= 55) {
      score += 0.1;
      notes.push(`RSI ${r.toFixed(0)} — neutral`);
    } else if (r >= 30 && r < 45) {
      score -= 0.3;
      notes.push(`RSI ${r.toFixed(0)} — weakening`);
    } else {
      score -= 0.4;
      notes.push(`RSI ${r.toFixed(0)} — oversold (falling knife / possible bounce)`);
    }
  }
  score += clamp(retN * 2, -0.5, 0.5);
  if (Math.abs(retN) > 0.01) notes.push(`${lookback}-day return ${fmtPct(retN)}`);
  if (hist != null) {
    if (hist > 0.0001) {
      score += 0.3;
      notes.push("MACD histogram positive");
    } else if (hist < -0.0001) {
      score -= 0.3;
      notes.push("MACD histogram negative");
    } else {
      notes.push("MACD histogram flat");
    }
  }
  return { score: clamp(score), note: notes.join(" · ") || "insufficient data" };
}

function volatilityComponent(candles, price, { swing = false } = {}) {
  const a = last(atr(candles, 14));
  if (a == null || !price) return { score: 0, note: "insufficient data" };
  const atrPct = (a / price) * 100;
  if (swing) {
    if (atrPct < 0.8) return { score: -0.6, note: `ATR ${atrPct.toFixed(2)}% — too flat for a quick move` };
    if (atrPct < 2) return { score: 0.2, note: `ATR ${atrPct.toFixed(2)}% — low, option premium cheap but moves small` };
    if (atrPct <= 5) return { score: 0.7, note: `ATR ${atrPct.toFixed(2)}% — sweet spot for short-horizon trades` };
    if (atrPct <= 10) return { score: 0.3, note: `ATR ${atrPct.toFixed(2)}% — elevated, size down` };
    return { score: -0.6, note: `ATR ${atrPct.toFixed(2)}% — too wild, avoid` };
  }
  if (atrPct < 0.6) return { score: -0.6, note: `ATR ${atrPct.toFixed(2)}% — too flat for swings` };
  if (atrPct < 1.5) return { score: 0.3, note: `ATR ${atrPct.toFixed(2)}% — low but tradable` };
  if (atrPct <= 3.5) return { score: 0.7, note: `ATR ${atrPct.toFixed(2)}% — sweet spot for swings` };
  if (atrPct <= 6) return { score: 0.1, note: `ATR ${atrPct.toFixed(2)}% — elevated, wider stops needed` };
  return { score: -0.6, note: `ATR ${atrPct.toFixed(2)}% — too volatile, high risk` };
}

function volumeComponent(candles) {
  const vols = candles.map((c) => c.volume || 0);
  if (vols.length < 25) return { score: 0, note: "insufficient volume data" };
  const closes = candles.map((c) => c.close);
  const ret5 = closes.length >= 6 ? closes[closes.length - 1] / closes[closes.length - 6] - 1 : 0;
  const recent = vols.slice(-5).reduce((s, v) => s + v, 0) / 5;
  const base = vols.slice(-20, -5).reduce((s, v) => s + v, 0) / 15 || 1;
  const ratio = recent / base;
  let score = clamp((ratio - 1) * 0.8, -0.5, 0.7);
  const notes = [];
  if (ratio > 1.3 && ret5 > 0) {
    score += 0.2;
    notes.push(`Volume ${ratio.toFixed(2)}x avg with price up — accumulation`);
  } else if (ratio > 1.3 && ret5 < 0) {
    score -= 0.3;
    notes.push(`Volume ${ratio.toFixed(2)}x avg with price down — distribution`);
  } else {
    notes.push(`Volume ${ratio.toFixed(2)}x avg`);
  }
  return { score: clamp(score), note: notes.join(" · ") };
}

function fmtPrice(v) {
  if (v == null || !Number.isFinite(v)) return "—";
  return v >= 1000 ? `$${v.toFixed(0)}` : `$${v.toFixed(2)}`;
}

export function dcfFairValue({
  freeCashflow,
  sharesOutstanding,
  growthRate = 0.05,
  beta = 1,
  discountRate,
  terminalGrowth = 0.03,
  totalDebt = 0,
  totalCash = 0,
}) {
  if (!freeCashflow || !sharesOutstanding || freeCashflow <= 0 || sharesOutstanding <= 0) return null;
  const r = discountRate ?? Math.max(0.07, Math.min(0.12, 0.04 + beta * 0.05));
  if (r <= terminalGrowth) return null;
  const g1 = Math.max(0, Math.min(0.2, growthRate ?? 0.05));
  let pv = 0;
  let fcf = freeCashflow;
  for (let year = 1; year <= 5; year++) {
    fcf *= 1 + g1;
    pv += fcf / Math.pow(1 + r, year);
  }
  const tv = (fcf * (1 + terminalGrowth)) / (r - terminalGrowth);
  pv += tv / Math.pow(1 + r, 5);
  const equityValue = pv - totalDebt + totalCash;
  const perShare = equityValue / sharesOutstanding;
  return Number.isFinite(perShare) && perShare > 0 ? perShare : null;
}

export function epsDcfFairValue({
  eps,
  earningsGrowth = 0.08,
  beta = 1,
  discountRate,
  terminalGrowth = 0.03,
  terminalMultiple,
}) {
  if (eps == null || !Number.isFinite(eps) || eps <= 0) return null;
  const r = discountRate ?? Math.max(0.07, Math.min(0.12, 0.04 + beta * 0.05));
  if (r <= terminalGrowth) return null;
  const g1 = Math.max(0, Math.min(0.15, earningsGrowth ?? 0.08));
  let futureEps = eps;
  for (let year = 1; year <= 5; year++) futureEps *= 1 + g1;
  const fairPe = terminalMultiple ?? Math.max(8, Math.min(24, g1 * 100));
  const terminalPrice = futureEps * fairPe;
  const perShare = terminalPrice / Math.pow(1 + r, 5);
  return Number.isFinite(perShare) && perShare > 0 ? perShare : null;
}

export function fairValueAnalysis(quote = {}) {
  const price = quote.price ?? quote.currentPrice ?? null;
  let dcf = dcfFairValue({
    freeCashflow: quote.freeCashflow,
    sharesOutstanding: quote.sharesOutstanding,
    growthRate: quote.earningsGrowth ?? quote.revenueGrowth,
    beta: quote.beta,
    totalDebt: quote.totalDebt,
    totalCash: quote.totalCash,
  });
  let dcfMethod = dcf != null ? "fcf" : null;
  if (dcf == null) {
    dcf = epsDcfFairValue({
      eps: quote.trailingEps ?? quote.forwardEps,
      earningsGrowth: quote.earningsGrowth,
      beta: quote.beta,
    });
    if (dcf != null) dcfMethod = "eps";
  }
  const analyst = Number.isFinite(quote.targetMeanPrice) ? quote.targetMeanPrice : null;
  let blended = null;
  if (dcf && analyst) blended = (dcf + analyst) / 2;
  else blended = dcf ?? analyst;
  const marginOfSafety = price && blended ? blended / price - 1 : null;
  return { dcf, dcfMethod, analyst, blended, marginOfSafety, price };
}

function dcfWith(quote, { growthScale, multipleScale, method }) {
  const g = quote.earningsGrowth ?? quote.revenueGrowth ?? 0.08;
  if (method === "eps") {
    const baseG1 = Math.max(0, Math.min(0.15, g));
    const basePe = Math.max(8, Math.min(24, baseG1 * 100));
    return epsDcfFairValue({
      eps: quote.trailingEps ?? quote.forwardEps,
      earningsGrowth: Math.max(0, Math.min(0.2, baseG1 * growthScale)),
      beta: quote.beta,
      terminalMultiple: Math.max(6, Math.min(30, basePe * multipleScale)),
    });
  }
  const baseG1 = Math.max(0, Math.min(0.2, g));
  return dcfFairValue({
    freeCashflow: quote.freeCashflow,
    sharesOutstanding: quote.sharesOutstanding,
    growthRate: Math.max(0, Math.min(0.3, baseG1 * growthScale)),
    beta: quote.beta,
    totalDebt: quote.totalDebt,
    totalCash: quote.totalCash,
  });
}

export function scenarioAnalysis(quote = {}) {
  const { dcfMethod, analyst, blended, price } = fairValueAnalysis(quote);
  if (!blended || !price || !Number.isFinite(blended) || !Number.isFinite(price) || price <= 0) return null;
  const method = dcfMethod ?? (quote.freeCashflow ? "fcf" : "eps");

  const bullDcf = dcfWith(quote, { growthScale: 1.5, multipleScale: 1.25, method });
  const bearDcf = dcfWith(quote, { growthScale: 0.5, multipleScale: 0.75, method });

  const analystHigh = Number.isFinite(quote.targetHighPrice) ? quote.targetHighPrice : null;
  const analystLow = Number.isFinite(quote.targetLowPrice) ? quote.targetLowPrice : null;

  const avg = (a, b) => {
    const vals = [a, b].filter((v) => Number.isFinite(v) && v != null);
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
  };

  let bull = avg(bullDcf, analystHigh);
  let bear = avg(bearDcf, analystLow);
  const base = blended;
  if (bull != null && bear != null && bull < bear) [bull, bear] = [bear, bull];
  if (bull != null && bull < base) bull = base;
  if (bear != null && bear > base) bear = base;

  return {
    price,
    bull,
    base,
    bear,
    upside: {
      bull: bull != null ? bull / price - 1 : null,
      base: base / price - 1,
      bear: bear != null ? bear / price - 1 : null,
    },
  };
}

function valueComponent(quote = {}) {
  const notes = [];
  let score = 0;
  const { dcf, dcfMethod, analyst, blended, marginOfSafety, price } = fairValueAnalysis(quote);

  if (price && blended && marginOfSafety != null) {
    const mosLabel = fmtPct(marginOfSafety);
    notes.push(`Margin of safety ${mosLabel} vs blended fair value`);
    if (marginOfSafety >= 0.3) score += 0.7;
    else if (marginOfSafety >= 0.15) score += 0.5;
    else if (marginOfSafety >= 0) score += 0.2;
    else if (marginOfSafety >= -0.15) score -= 0.2;
    else if (marginOfSafety >= -0.3) score -= 0.4;
    else score -= 0.6;
    const dcfLabel = dcf != null ? `${dcfMethod === "eps" ? "DCF (EPS-based)" : "DCF"}` : "DCF —";
    notes.push(`Fair value: ${dcfLabel} ${fmtPrice(dcf)} · analyst ${fmtPrice(analyst)}`);
  }

  const pe = quote.trailingPE;
  if (pe != null && Number.isFinite(pe) && pe > 0) {
    if (pe < 15) { score += 0.25; notes.push(`P/E ${pe.toFixed(1)} — cheap`); }
    else if (pe <= 25) { score += 0.1; notes.push(`P/E ${pe.toFixed(1)} — fair`); }
    else if (pe <= 40) { score -= 0.15; notes.push(`P/E ${pe.toFixed(1)} — rich`); }
    else { score -= 0.3; notes.push(`P/E ${pe.toFixed(1)} — expensive`); }
  }
  const peg = quote.pegRatio;
  if (peg != null && Number.isFinite(peg) && peg > 0) {
    if (peg < 1) { score += 0.3; notes.push(`PEG ${peg.toFixed(2)} — growth at a fair price`); }
    else if (peg <= 1.5) { score += 0.1; notes.push(`PEG ${peg.toFixed(2)}`); }
    else if (peg <= 2) { score -= 0.1; notes.push(`PEG ${peg.toFixed(2)} — pricey growth`); }
    else { score -= 0.25; notes.push(`PEG ${peg.toFixed(2)} — expensive growth`); }
  }
  const pb = quote.priceToBook;
  if (pb != null && Number.isFinite(pb) && pb > 0) {
    if (pb < 1.5) { score += 0.25; notes.push(`P/B ${pb.toFixed(2)} — cheap vs book`); }
    else if (pb <= 3) { score += 0.1; notes.push(`P/B ${pb.toFixed(2)}`); }
    else if (pb <= 6) { score -= 0.1; notes.push(`P/B ${pb.toFixed(2)} — premium to book`); }
    else { score -= 0.2; notes.push(`P/B ${pb.toFixed(2)} — very rich vs book`); }
  }
  const evEbitda = quote.enterpriseToEbitda;
  if (evEbitda != null && Number.isFinite(evEbitda) && evEbitda > 0) {
    if (evEbitda < 10) { score += 0.25; notes.push(`EV/EBITDA ${evEbitda.toFixed(1)} — cheap`); }
    else if (evEbitda <= 15) { score += 0.1; notes.push(`EV/EBITDA ${evEbitda.toFixed(1)} — fair`); }
    else if (evEbitda <= 20) { score -= 0.1; notes.push(`EV/EBITDA ${evEbitda.toFixed(1)} — rich`); }
    else { score -= 0.25; notes.push(`EV/EBITDA ${evEbitda.toFixed(1)} — expensive`); }
  }
  const ps = quote.priceToSalesTrailing12Months;
  if (ps != null && Number.isFinite(ps) && ps > 0) {
    if (ps < 2) { score += 0.25; notes.push(`P/S ${ps.toFixed(2)} — cheap vs sales`); }
    else if (ps <= 5) { score += 0.1; notes.push(`P/S ${ps.toFixed(2)}`); }
    else if (ps <= 10) { score -= 0.1; notes.push(`P/S ${ps.toFixed(2)} — rich vs sales`); }
    else { score -= 0.2; notes.push(`P/S ${ps.toFixed(2)} — very rich vs sales`); }
  }
  if (!notes.length) return { score: 0, note: "valuation data unavailable — neutral" };
  return { score: clamp(score), note: notes.slice(0, 4).join(" · ") };
}

function qualityComponent(quote = {}) {
  const notes = [];
  let score = 0;
  const roe = quote.returnOnEquity;
  if (roe != null && Number.isFinite(roe)) {
    if (roe > 0.2) { score += 0.4; notes.push(`ROE ${fmtPct(roe)} — outstanding`); }
    else if (roe > 0.15) { score += 0.3; notes.push(`ROE ${fmtPct(roe)} — strong`); }
    else if (roe > 0.08) { score += 0.1; notes.push(`ROE ${fmtPct(roe)}`); }
    else if (roe > 0) { score -= 0.1; notes.push(`ROE ${fmtPct(roe)} — weak`); }
    else { score -= 0.4; notes.push(`ROE ${fmtPct(roe)} — destroying value`); }
  }
  const roa = quote.returnOnAssets;
  if (roa != null && Number.isFinite(roa)) {
    if (roa > 0.07) { score += 0.2; notes.push(`ROA ${fmtPct(roa)}`); }
    else if (roa > 0.03) { score += 0; notes.push(`ROA ${fmtPct(roa)}`); }
    else { score -= 0.15; notes.push(`ROA ${fmtPct(roa)} — thin`); }
  }
  const om = quote.operatingMargins;
  const pm = quote.profitMargins;
  const gm = quote.grossMargins;
  if (pm != null && Number.isFinite(pm)) {
    if (pm > 0.2) { score += 0.3; notes.push(`net margin ${fmtPct(pm)} — strong`); }
    else if (pm > 0.1) { score += 0.15; notes.push(`net margin ${fmtPct(pm)}`); }
    else if (pm > 0) { score -= 0.05; notes.push(`net margin ${fmtPct(pm)} — thin`); }
    else { score -= 0.3; notes.push(`net margin ${fmtPct(pm)} — loss-making`); }
  }
  if (om != null && Number.isFinite(om)) {
    if (om > 0.15) { score += 0.15; notes.push(`op margin ${fmtPct(om)}`); }
    else if (om < 0) { score -= 0.2; notes.push(`op margin ${fmtPct(om)}`); }
  }
  if (gm != null && Number.isFinite(gm)) {
    if (gm > 0.5) { score += 0.15; notes.push(`gross margin ${fmtPct(gm)} — wide moat`); }
    else if (gm < 0.2) { score -= 0.1; notes.push(`gross margin ${fmtPct(gm)}`); }
  }
  const de = quote.debtToEquity;
  if (de != null && Number.isFinite(de)) {
    if (de < 50) { score += 0.2; notes.push(`debt/equity ${de.toFixed(0)}% — low`); }
    else if (de <= 150) { score += 0; notes.push(`debt/equity ${de.toFixed(0)}%`); }
    else if (de <= 250) { score -= 0.2; notes.push(`debt/equity ${de.toFixed(0)}% — leveraged`); }
    else { score -= 0.4; notes.push(`debt/equity ${de.toFixed(0)}% — heavy leverage`); }
  }
  const cr = quote.currentRatio;
  if (cr != null && Number.isFinite(cr)) {
    if (cr > 1.5) { score += 0.2; notes.push(`current ratio ${cr.toFixed(2)} — liquid`); }
    else if (cr >= 1) { score += 0.1; notes.push(`current ratio ${cr.toFixed(2)}`); }
    else { score -= 0.2; notes.push(`current ratio ${cr.toFixed(2)} — tight liquidity`); }
  }
  const fcf = quote.freeCashflow;
  const ni = quote.netIncomeToCommon;
  if (fcf != null && ni != null && Number.isFinite(fcf) && Number.isFinite(ni) && ni > 0) {
    const eq = fcf / ni;
    if (eq > 1.2) { score += 0.2; notes.push(`FCF/earnings ${eq.toFixed(2)} — high quality earnings`); }
    else if (eq >= 0.8) { score += 0.1; notes.push(`FCF/earnings ${eq.toFixed(2)}`); }
    else if (eq < 0.5) { score -= 0.2; notes.push(`FCF/earnings ${eq.toFixed(2)} — earnings not backed by cash`); }
  }
  const dy = quote.dividendYield;
  if (dy != null && Number.isFinite(dy) && dy > 0.02) {
    score += 0.1;
    notes.push(`dividend yield ${(dy * 100).toFixed(1)}%`);
  }
  if (!notes.length) return { score: 0, note: "quality data unavailable — neutral" };
  return { score: clamp(score), note: notes.slice(0, 4).join(" · ") };
}

export function verdictFor(score) {
  if (score >= 0.5) return "STRONG BUY";
  if (score >= 0.25) return "BUY";
  if (score > -0.25) return "HOLD";
  if (score > -0.5) return "SELL";
  return "STRONG SELL";
}

export function directionFor(verdict) {
  if (verdict === "BUY" || verdict === "STRONG BUY") return "LONG";
  if (verdict === "SELL" || verdict === "STRONG SELL") return "SHORT";
  return "HOLD";
}

export function qualityGrade(score) {
  if (score >= 0.4) return "STRONG";
  if (score >= 0.1) return "GOOD";
  if (score > -0.1) return "FAIR";
  if (score > -0.4) return "WEAK";
  return "POOR";
}

export function valueGrade(score) {
  if (score >= 0.3) return "CHEAP";
  if (score >= 0) return "FAIR";
  if (score > -0.2) return "RICH";
  return "EXPENSIVE";
}

export function volatilityRiskFor(atrPct) {
  if (atrPct == null || !Number.isFinite(atrPct)) return "UNKNOWN";
  if (atrPct < 0.6) return "TOO FLAT";
  if (atrPct <= 3.5) return "TRADEABLE";
  if (atrPct <= 6) return "ELEVATED";
  return "HIGH";
}

export function buildThesis({ name, verdict, grades, fairValue, components, volatilityRisk }) {
  const parts = [];
  if (grades?.quality) {
    parts.push(grades.quality === "POOR" || grades.quality === "WEAK"
      ? "a weak-quality business"
      : `a ${grades.quality.toLowerCase()}-quality business`);
  }
  const mos = fairValue?.marginOfSafety;
  if (grades?.value && mos != null) {
    const dir = mos >= 0 ? "trading below" : mos > -0.15 ? "priced near" : "trading above";
    parts.push(`${dir} fair value (${Math.abs(mos * 100).toFixed(0)}% ${mos >= 0 ? "margin of safety" : "premium"})`);
  } else if (grades?.value) {
    parts.push(`valuation reading ${grades.value.toLowerCase()}`);
  }
  const trendNote = components?.trend?.note;
  const trendUp = trendNote?.includes("above") && !trendNote.includes("below");
  const trendDown = trendNote?.includes("below") && !trendNote.includes("above");
  if (trendUp) parts.push("in an intact uptrend");
  else if (trendDown) parts.push("in a downtrend");
  else parts.push("in a neutral trend");
  if (volatilityRisk === "TRADEABLE") {
    parts.push("with volatility in the sweet spot for swings");
  } else if (volatilityRisk === "ELEVATED") {
    parts.push("with elevated volatility — expect wider swings");
  } else if (volatilityRisk === "HIGH") {
    parts.push("though volatility is extreme, so this signal is less reliable");
  } else if (volatilityRisk === "TOO FLAT") {
    parts.push("though volatility is too low to swing-trade it");
  }

  let nameStr = name;
  if (nameStr) {
    const words = nameStr.split(" ");
    if (words.length > 4) nameStr = `${words.slice(0, 4).join(" ")}…`;
  }
  const lead = nameStr ? `${nameStr} is` : "This name is";
  const joined = parts.length > 2 ? parts.slice(0, -1).join(", ") + ", and " + parts[parts.length - 1] : parts.join(", ");
  return `${lead} ${joined}. Overall: ${verdict}.`;
}

export const VERDICT_COLORS = {
  "STRONG BUY": 0x00d26a,
  BUY: 0x00a35a,
  HOLD: 0x8a8f98,
  SELL: 0xe05e5e,
  "STRONG SELL": 0xb02b2b,
};

export function suggestedSize({ verdict, atrPct }, { cap = 20 } = {}) {
  const base = { "STRONG BUY": 20, BUY: 12, SELL: 10, "STRONG SELL": 15, HOLD: 0 }[verdict] ?? 0;
  if (base === 0) return 0;
  if (atrPct == null || !Number.isFinite(atrPct) || atrPct <= 0) return base;
  const volFactor = Math.min(1, 2.5 / atrPct);
  return Math.round(Math.max(2, Math.min(cap, base * volFactor)));
}

export function analyze({ candles, quote = {}, weights = {}, strategy: strategyId = "trend" }) {
  const strategy = getStrategy(strategyId);
  const swing = strategy.timeframe === "swing";
  const ind = strategy.indicators ?? {};
  const w = { ...DEFAULT_WEIGHTS, ...strategy.weights, ...weights };
  const closes = candles.map((c) => c.close);
  const price = closes[closes.length - 1];

  const trend = trendComponent(closes, price, ind);
  const momentum = momentumComponent(closes, { lookback: ind.momentumDays ?? 14 });
  const volatility = volatilityComponent(candles, price, { swing });
  const volume = volumeComponent(candles);
  const value = valueComponent(quote);
  const quality = qualityComponent(quote);

  const components = { trend, momentum, volatility, volume, value, quality };
  const score = clamp(
    Object.entries(components).reduce((sum, [key, c]) => sum + (w[key] ?? 0) * c.score, 0)
  );

  const indicators = {
    price,
    rsi: last(rsi(closes, 14)),
    ema50: last(ema(closes, 50)),
    ema200: last(ema(closes, 200)),
    emaFast: last(ema(closes, ind.fast ?? 50)),
    emaSlow: last(ema(closes, ind.slow ?? 200)),
    atrPct: (() => {
      const a = last(atr(candles, 14));
      return a != null && price ? (a / price) * 100 : null;
    })(),
    macdHistogram: last(macd(closes).histogram),
  };

  const volatilityRisk = volatilityRiskFor(indicators.atrPct);
  const grades = {
    quality: qualityGrade(quality.score),
    value: valueGrade(value.score),
  };
  let verdict = verdictFor(score);
  let finalScore = score;
  const guards = [];
  for (const [gid, g] of Object.entries(strategy.guards ?? {})) {
    if (!g.enabled) continue;
    const hit = g.check({
      price: indicators.price,
      rsi: indicators.rsi,
      valueGrade: grades.value,
      premium: g.premium,
      ...(swing
        ? { emaFast: indicators.emaFast, emaSlow: indicators.emaSlow }
        : { ema50: indicators.ema50, ema200: indicators.ema200 }),
    });
    if (!hit) continue;
    if (gid === "noKnifeCatch" && (verdict === "BUY" || verdict === "STRONG BUY")) {
      finalScore = Math.min(finalScore, 0.249);
      verdict = "HOLD";
      guards.push({ id: gid, rule: g.rule });
    }
    if (gid === "noPumpShort" && (verdict === "SELL" || verdict === "STRONG SELL")) {
      finalScore = Math.max(finalScore, -0.249);
      verdict = "HOLD";
      guards.push({ id: gid, rule: g.rule });
    }
    if (gid === "noOverpay" && (verdict === "BUY" || verdict === "STRONG BUY")) {
      finalScore = Math.min(finalScore, 0.249);
      verdict = "HOLD";
      guards.push({ id: gid, rule: g.rule });
    }
  }
  const fairValue = fairValueAnalysis(quote);
  const scenarios = scenarioAnalysis(quote);

  const reasoning = Object.values(components)
    .map((c) => c.note)
    .filter(Boolean)
    .slice(0, 6);

  return {
    score: finalScore,
    verdict,
    direction: directionFor(verdict),
    strategy: { id: strategy.id, name: strategy.name, description: strategy.description, timeframe: strategy.timeframe, indicators: strategy.indicators },
    guards,
    components,
    grades,
    volatilityRisk,
    thesis: buildThesis({
      name: quote.longName ?? quote.shortName,
      verdict,
      grades,
      fairValue,
      components,
      volatilityRisk,
    }),
    indicators,
    fairValue,
    scenarios,
    suggestedSize: suggestedSize({ verdict, atrPct: indicators.atrPct }, { cap: swing ? 15 : 20 }),
    reasoning,
  };
}
