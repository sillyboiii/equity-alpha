import { MARKET, withRetry } from "../web/src/market.js";
import { EmbedBuilder } from "discord.js";

const fmt = (n, digits = 2) => (n == null || !Number.isFinite(n) ? "—" : n.toFixed(digits));
const fmtPct = (v) => (v == null || !Number.isFinite(v) ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`);
const fmtPrice = (v) => (v == null || !Number.isFinite(v) ? "—" : v >= 1000 ? `$${v.toFixed(0)}` : `$${v.toFixed(2)}`);
const fmtBig = (n) =>
  n == null ? "—" : n >= 1e12 ? `$${(n / 1e12).toFixed(2)}T` : n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(0)}M` : `$${n.toFixed(0)}`;
const toDateStr = (v) => {
  if (v instanceof Date) {
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, "0");
    const d = String(v.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(v ?? "");
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
};

async function safeQuoteSummary(symbol, modules) {
  try {
    return await withRetry(() => MARKET.quoteSummary(symbol, { modules }), { label: `deepdive ${symbol}` });
  } catch {
    return {};
  }
}

export async function fetchFinancials(symbol, { years = 5 } = {}) {
  const now = new Date();
  const period1 = new Date(now.getFullYear() - years - 1, 0, 1).toISOString().slice(0, 10);
  const res = await withRetry(() => MARKET.fundamentalsTimeSeries(symbol, {
    period1,
    period2: now.toISOString().slice(0, 10),
    type: "annual",
    module: "all",
  }), { label: `fundamentals ${symbol}` });
  const rows = Array.isArray(res) ? res : res?.timeseries?.result?.[0] ?? [];
  return rows
    .filter((r) => r.date instanceof Date && !Number.isNaN(r.date.getTime()))
    .filter((r) => r.totalRevenue != null || r.netIncome != null || r.dilutedEPS != null)
    .map((r) => ({
      year: r.date.getFullYear(),
      revenue: r.totalRevenue,
      netIncome: r.netIncome ?? r.netIncomeCommonStockholders,
      eps: r.dilutedEPS ?? r.normalizedDilutedEPS,
      operatingCashFlow: r.operatingCashFlow,
      freeCashFlow: r.freeCashFlow,
      equity: r.stockholdersEquity,
      totalDebt: r.totalDebt,
      cash: r.cashAndCashEquivalents,
      totalAssets: r.totalAssets,
      rnd: r.researchAndDevelopment,
    }))
    .sort((a, b) => a.year - b.year)
    .slice(-years);
}

export async function buildDeepDive(symbol) {
  const [financials, profile] = await Promise.all([
    fetchFinancials(symbol).catch(() => []),
    safeQuoteSummary(symbol, ["assetProfile", "majorHoldersBreakdown", "insiderTransactions", "earningsHistory", "earningsTrend", "recommendationTrend", "secFilings"]),
  ]);

  const ap = profile.assetProfile ?? {};
  const holders = profile.majorHoldersBreakdown ?? {};
  const insiders = (profile.insiderTransactions?.transactions ?? []).slice(0, 12);
  const earningsHist = profile.earningsHistory?.history ?? [];
  const earningsTrend = profile.earningsTrend?.trend ?? [];
  const recTrend = profile.recommendationTrend?.trend?.[0] ?? {};
  const filings = (profile.secFilings?.filings ?? []).filter((f) => /10-K|10-Q|8-K/.test(f.type ?? "")).slice(0, 5);

  const cur = earningsTrend.find((t) => t.period === "0q") ?? earningsTrend[0];
  const nxt = earningsTrend.find((t) => t.period === "1q");
  const lastEarnings = earningsHist[0];

  const insiderSells = insiders.filter((t) => /sale/i.test(t.transactionText ?? "")).length;
  const insiderBuys = insiders.filter((t) => /purchase/i.test(t.transactionText ?? "")).length;

  return {
    symbol: symbol.toUpperCase(),
    profile: {
      industry: ap.industryDisp ?? ap.industry ?? "—",
      sector: ap.sectorDisp ?? ap.sector ?? "—",
      website: ap.website ?? null,
      employees: ap.fullTimeEmployees ?? null,
      risk: ap.overallRisk ?? null,
      riskLevel: ap.auditRisk ?? ap.boardRisk ?? null,
      summary: ap.longBusinessSummary ?? null,
      officers: (ap.companyOfficers ?? []).slice(0, 4).map((o) => ({ name: o.name, title: o.title, pays: o.totalPay ?? null })),
    },
    financials,
    ownership: {
      insidersPct: holders.insidersPercentHeld ?? null,
      institutionsPct: holders.institutionsPercentHeld ?? null,
      institutionsCount: holders.institutionsCount ?? null,
      insiderBuys,
      insiderSells,
      recentInsiders: insiders.map((t) => ({
        name: t.filerName,
        relation: t.filerRelation,
        text: t.transactionText,
        shares: t.shares,
        value: t.value,
        date: toDateStr(t.startDate),
      })),
    },
    earnings: {
      lastActual: lastEarnings?.epsActual ?? null,
      lastEstimate: lastEarnings?.epsEstimate ?? null,
      lastSurprise: lastEarnings?.surprisePercent ?? null,
      lastQuarter: toDateStr(lastEarnings?.quarter),
      curEstimate: cur?.earningsEstimate?.avg ?? null,
      curGrowth: cur?.earningsEstimate?.growth ?? cur?.growth ?? null,
      curRevEstimate: cur?.revenueEstimate?.avg ?? null,
      curRevGrowth: cur?.revenueEstimate?.growth ?? null,
      curAnalysts: cur?.earningsEstimate?.numberOfAnalysts ?? null,
      nxtGrowth: nxt?.earningsEstimate?.growth ?? null,
      nxtEstimate: nxt?.earningsEstimate?.avg ?? null,
    },
    analysts: {
      strongBuy: recTrend.strongBuy ?? null,
      buy: recTrend.buy ?? null,
      hold: recTrend.hold ?? null,
      sell: recTrend.sell ?? null,
      strongSell: recTrend.strongSell ?? null,
    },
    filings: filings.map((f) => ({
      date: f.date ?? null,
      type: f.type ?? null,
      title: f.title ?? null,
      url: f.edgarUrl ?? null,
    })),
  };
}

function financialTable(financials) {
  if (!financials.length) return "No annual financial history available.";
  const years = financials.map((r) => r.year).join("  ");
  const rows = [
    ["Revenue", financials.map((r) => (r.revenue != null ? fmtBig(r.revenue) : "—"))],
    ["Net income", financials.map((r) => (r.netIncome != null ? fmtBig(r.netIncome) : "—"))],
    ["Diluted EPS", financials.map((r) => (r.eps != null ? fmt(r.eps) : "—"))],
    ["Op. cash flow", financials.map((r) => (r.operatingCashFlow != null ? fmtBig(r.operatingCashFlow) : "—"))],
    ["Free cash flow", financials.map((r) => (r.freeCashFlow != null ? fmtBig(r.freeCashFlow) : "—"))],
    ["Equity", financials.map((r) => (r.equity != null ? fmtBig(r.equity) : "—"))],
    ["Total debt", financials.map((r) => (r.totalDebt != null ? fmtBig(r.totalDebt) : "—"))],
    ["Cash", financials.map((r) => (r.cash != null ? fmtBig(r.cash) : "—"))],
  ];
  const colW = Math.max(...years.split("  ").map((y) => y.length), ...rows.map(([, v]) => Math.max(...v.map((x) => x.length))));
  const pad = (s) => s.padEnd(colW);
  const line = (label, vals) => `${label.padEnd(13)}${vals.map(pad).join("  ")}`;
  const head = `${"Metric".padEnd(13)}${years.split("  ").map(pad).join("  ")}`;
  return [`\`\`\`\n${head}\n${rows.map(([l, v]) => line(l, v)).join("\n")}\`\`\``];
}

function cagr(first, last, years) {
  if (first == null || last == null || !Number.isFinite(first) || !Number.isFinite(last) || first <= 0 || last <= 0 || years < 1) return null;
  return Math.pow(last / first, 1 / years) - 1;
}

export function financialInsights(financials) {
  const notes = [];
  if (!financials || financials.length < 3) {
    return [{ icon: "🪫", text: "Not enough annual history to read the trend (need 3+ years).", tone: "neutral" }];
  }

  const withRev = financials.filter((r) => r.revenue != null && r.revenue > 0);
  const first = financials[0];
  const last = financials[financials.length - 1];
  const span = financials.length - 1;

  const revCagr = cagr(first.revenue, last.revenue, span);
  if (revCagr != null) {
    const pct = (revCagr * 100).toFixed(1);
    notes.push({
      icon: revCagr > 0.15 ? "🚀" : revCagr > 0.05 ? "📈" : revCagr > 0 ? "➡️" : "📉",
      text: `Revenue compounding ~${pct}%/yr over ${financials.length} years — ${revCagr > 0.15 ? "fast growth" : revCagr > 0.05 ? "steady growth" : revCagr > 0 ? "slow growth" : "shrinking"}.`,
      tone: revCagr > 0.05 ? "good" : "bad",
    });
  }

  const epsCagr = cagr(first.eps, last.eps, span);
  if (epsCagr != null) {
    const pct = (epsCagr * 100).toFixed(1);
    notes.push({
      icon: epsCagr >= 0 ? "💎" : "⚠️",
      text: `Earnings per share compounding ${epsCagr >= 0 ? "+" : ""}${pct}%/yr.`,
      tone: epsCagr >= 0 ? "good" : "bad",
    });
  }

  const margins = withRev
    .map((r) => (r.netIncome != null && r.revenue > 0 ? { year: r.year, m: r.netIncome / r.revenue } : null))
    .filter(Boolean);
  if (margins.length >= 2) {
    const firstM = margins[0].m;
    const lastM = margins[margins.length - 1].m;
    const deltaPts = (lastM - firstM) * 100;
    const label = Math.abs(deltaPts) < 2 ? "stable" : deltaPts > 0 ? "expanding" : "contracting";
    notes.push({
      icon: deltaPts > 2 ? "📊" : deltaPts < -2 ? "📉" : "➖",
      text: `Net margin ${label}: ${(firstM * 100).toFixed(1)}% → ${(lastM * 100).toFixed(1)}% (${deltaPts >= 0 ? "+" : ""}${deltaPts.toFixed(1)} pts). ${label === "expanding" ? "Pricing power or cost control improving." : label === "contracting" ? "Costs or competition squeezing profit per $ of sales." : ""}`,
      tone: deltaPts >= -2 ? "good" : "bad",
    });
  }

  if (first.totalDebt != null && last.totalDebt != null && Number.isFinite(first.totalDebt) && Number.isFinite(last.totalDebt)) {
    const debtDelta = last.totalDebt / first.totalDebt - 1;
    const revDelta = first.revenue != null && last.revenue != null && first.revenue > 0 ? last.revenue / first.revenue - 1 : null;
    const debtGrowsFaster = revDelta != null && debtDelta > revDelta + 0.05;
    notes.push({
      icon: debtDelta > 0.3 ? "⚠️" : debtGrowsFaster ? "⚖️" : "🛡️",
      text: `Total debt ${debtDelta >= 0 ? "up" : "down"} ${Math.abs(debtDelta * 100).toFixed(0)}% over ${span} yrs${revDelta != null ? ` vs revenue ${revDelta >= 0 ? "+" : ""}${(revDelta * 100).toFixed(0)}%` : ""}${debtGrowsFaster ? " — debt rising faster than revenue, watch leverage" : debtDelta > 0.3 ? " — notable debt build-up" : ""}.`,
      tone: debtGrowsFaster || debtDelta > 0.3 ? "bad" : "good",
    });
  }

  if (last.operatingCashFlow != null && last.operatingCashFlow > 0 && last.netIncome != null && last.netIncome > 0 && Number.isFinite(last.operatingCashFlow) && Number.isFinite(last.netIncome)) {
    const conversion = last.operatingCashFlow / last.netIncome;
    notes.push({
      icon: conversion >= 0.8 ? "💵" : "⚠️",
      text: `Cash conversion ${(conversion * 100).toFixed(0)}% — ${conversion >= 0.8 ? "most profit turns into real cash" : "a chunk of profit isn't hitting the bank account"}.`,
      tone: conversion >= 0.8 ? "good" : "bad",
    });
  }

  const good = notes.filter((n) => n.tone === "good").length;
  const bad = notes.filter((n) => n.tone === "bad").length;
  const overall = bad === 0 ? "📈 Improving" : good > bad ? "⚖️ Mixed" : "📉 Deteriorating";
  notes.unshift({ icon: overall.split(" ")[0], text: `**Overall financial trajectory: ${overall.split(" ").slice(1).join(" ")}.**`, tone: bad === 0 ? "good" : good > bad ? "neutral" : "bad" });
  return notes;
}

export function deepDiveEmbeds(dd) {
  const p = dd.profile;
  const o = dd.ownership;
  const e = dd.earnings;
  const embeds = [];

  embeds.push(
    new EmbedBuilder()
      .setColor(0x6366f1)
      .setTitle(`🔬 Deep Dive · ${dd.symbol}`)
      .setDescription(
        [
          p.summary ? `${p.summary.slice(0, 900)}…` : "No business summary available.",
          "",
          `**Sector:** ${p.sector} · **Industry:** ${p.industry}`,
          p.employees ? `**Employees:** ${p.employees.toLocaleString()}` : null,
          p.website ? `**Website:** ${p.website}` : null,
        ].filter(Boolean).join("\n").slice(0, 2048)
      )
  );

  embeds.push(
    new EmbedBuilder()
      .setColor(0x0ea5e9)
      .setTitle("📜 Annual Financials (5 years)")
      .setDescription(financialTable(dd.financials).join("\n"))
      .setFooter({ text: "Source: Yahoo fundamentals time series · currency = reporting currency (USD)" })
  );

  embeds.push(
    new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setTitle("🧠 Financial Insights & Trends")
      .setDescription(
        financialInsights(dd.financials)
          .map((n) => `${n.icon} ${n.text}`)
          .join("\n")
          .slice(0, 1024)
      )
      .setFooter({ text: "Auto-computed from the 5-year numbers above — revenue compounding, margin & debt trends, cash conversion." })
  );

  const lastGrowth = (() => {
    const f = dd.financials;
    if (f.length < 2) return null;
    const a = f[f.length - 2].revenue;
    const b = f[f.length - 1].revenue;
    return a != null && b != null && a !== 0 ? b / a - 1 : null;
  })();
  const lastNetMargin = dd.financials.at(-1)?.revenue
    ? dd.financials.at(-1).netIncome / dd.financials.at(-1).revenue
    : null;

  embeds.push(
    new EmbedBuilder()
      .setColor(0x10b981)
      .setTitle("📈 Growth & Earnings Momentum")
      .addFields(
        { name: "Last annual revenue growth", value: lastGrowth != null ? fmtPct(lastGrowth) : "—", inline: true },
        { name: "Latest net margin", value: lastNetMargin != null ? fmtPct(lastNetMargin) : "—", inline: true },
        { name: "Last reported quarter", value: e.lastQuarter ?? "—", inline: true },
        { name: "Actual EPS", value: e.lastActual != null ? fmt(e.lastActual) : "—", inline: true },
        { name: "vs estimate", value: e.lastEstimate != null ? fmt(e.lastEstimate) : "—", inline: true },
        { name: "Surprise", value: e.lastSurprise != null ? fmtPct(e.lastSurprise) : "—", inline: true },
        { name: "Next qtr EPS est.", value: e.curEstimate != null ? fmt(e.curEstimate) : "—", inline: true },
        { name: "Est. growth", value: e.curGrowth != null ? fmtPct(e.curGrowth) : "—", inline: true },
        { name: "Revenue est. growth", value: e.curRevGrowth != null ? fmtPct(e.curRevGrowth) : "—", inline: true },
        { name: "Analyst coverage", value: e.curAnalysts != null ? `${e.curAnalysts} analysts` : "—", inline: true }
      )
  );

  const rec = dd.analysts;
  const totalRec = rec.strongBuy + rec.buy + rec.hold + rec.sell + rec.strongSell || 0;
  const bull = rec.strongBuy + rec.buy;
  embeds.push(
    new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle("🏛️ Ownership & Governance")
      .addFields(
        { name: "Insiders hold", value: o.insidersPct != null ? fmtPct(o.insidersPct) : "—", inline: true },
        { name: "Institutions hold", value: o.institutionsPct != null ? fmtPct(o.institutionsPct) : "—", inline: true },
        { name: "Institution count", value: o.institutionsCount != null ? o.institutionsCount.toLocaleString() : "—", inline: true },
        { name: "Recent insider moves", value: `${o.insiderBuys} buys / ${o.insiderSells} sells`, inline: true },
        { name: "Governance risk", value: p.risk != null ? String(p.risk) : "—", inline: true },
        { name: "Analyst stance", value: totalRec ? `${bull}/${totalRec} buy-rated (${rec.strongBuy}SB · ${rec.buy}B · ${rec.hold}H · ${rec.sell + rec.strongSell}S)` : "—", inline: true }
      )
      .setDescription(
        o.recentInsiders.length
          ? o.recentInsiders.map((t) => `• ${t.date ?? "—"} ${t.name ?? "—"} (${t.relation ?? "—"}): ${t.text ?? ""}${t.value ? ` · ${fmtBig(t.value)}` : ""}`).join("\n").slice(0, 1024)
          : undefined
      )
  );

  embeds.push(
    new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setTitle("🏢 Recent SEC Filings")
      .setDescription(
        dd.filings.length
          ? dd.filings.map((f) => `• **${f.date ?? "—"}** \`${f.type ?? ""}\` ${f.title ?? ""}${f.url ? ` — ${f.url}` : ""}`).join("\n").slice(0, 1024)
          : "No recent 10-K / 10-Q / 8-K filings found."
      )
  );

  return embeds;
}
