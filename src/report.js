import { EmbedBuilder } from "discord.js";
import { VERDICT_COLORS } from "./analysis.js";

const fmt = (n, digits = 2) => (n == null || !Number.isFinite(n) ? "—" : n.toFixed(digits));
const fmtPct = (v) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`);
const fmtPrice = (v) => (v == null || !Number.isFinite(v) ? "—" : v >= 1000 ? `$${v.toFixed(0)}` : `$${v.toFixed(2)}`);
const fmtBig = (n) =>
  n == null ? "—" : n >= 1e12 ? `$${(n / 1e12).toFixed(2)}T` : n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(0)}M` : `$${n.toFixed(0)}`;

const VERDICT_EMOJI = {
  "STRONG BUY": "🟢",
  BUY: "🟢",
  HOLD: "⚪",
  SELL: "🔴",
  "STRONG SELL": "🔴",
};

function bullet(note) {
  return `• ${note.replace(/\*\*/g, "").trim()}`;
}

function summaryEmbed({ symbol, name, quote, analysis }) {
  const { verdict, score, indicators, grades, volatilityRisk, thesis, direction, strategy, guards } = analysis;
  const emoji = VERDICT_EMOJI[verdict] ?? "⚪";
  const dirEmoji = direction === "LONG" ? "📈" : direction === "SHORT" ? "📉" : "➖";
  const rec = quote.recommendationKey
    ? `${quote.recommendationKey.toUpperCase()} ${fmt(quote.recommendationMean, 2)} (${quote.numberOfAnalystOpinions ?? "—"} analysts)`
    : "—";
  const qualityIcon = grades?.quality === "STRONG" ? "🏛️" : grades?.quality === "POOR" ? "⚠️" : "🏛️";
  const valueIcon = grades?.value === "CHEAP" ? "💰" : grades?.value === "EXPENSIVE" ? "💸" : "💰";
  const volEmoji = volatilityRisk === "HIGH" ? "🚨" : volatilityRisk === "ELEVATED" ? "⚡" : volatilityRisk === "TOO FLAT" ? "🪫" : volatilityRisk === "TRADEABLE" ? "✅" : "—";

  const eb = new EmbedBuilder()
    .setColor(VERDICT_COLORS[verdict] ?? 0x8a8f98)
    .setTitle(`${name ? `${name} — ` : ""}${symbol.toUpperCase()} · ${emoji} ${verdict}`)
    .addFields(
      { name: "Score", value: `**${fmt(score)}** / +1.00`, inline: true },
      { name: "Direction", value: `${dirEmoji} ${direction ?? "—"}`, inline: true },
      { name: "Price", value: fmtPrice(indicators.price), inline: true },
      { name: "Market cap", value: fmtBig(quote.marketCap), inline: true },
      { name: "52w range", value: `${fmtPrice(quote.fiftyTwoWeekLow)} – ${fmtPrice(quote.fiftyTwoWeekHigh)}`, inline: true },
      { name: "Analyst consensus", value: rec, inline: true },
      { name: "Beta", value: quote.beta != null ? fmt(quote.beta) : "—", inline: true },
      { name: `${valueIcon} Valuation`, value: grades?.value ?? "—", inline: true },
      { name: `${qualityIcon} Quality`, value: grades?.quality ?? "—", inline: true },
      { name: `${volEmoji} Volatility`, value: volatilityRisk ?? "—", inline: true },
      { name: "Suggested size", value: analysis.suggestedSize ? `${analysis.suggestedSize}% of portfolio` : "—", inline: true }
    );
  if (thesis) {
    eb.setDescription(thesis);
  }
  if (guards?.length) {
    eb.setFooter({
      text: `Strategy: ${strategy?.name ?? "Trend Follower"} · Guarded: ${guards.map((g) => g.id.replace(/([A-Z])/g, " $1").toLowerCase().replace("no ", "no-")).join(", ")}`,
    });
  } else if (strategy) {
    eb.setFooter({ text: `Strategy: ${strategy.name}` });
  }
  return eb;
}

function fairValueEmbed({ quote, analysis }) {
  const { fairValue } = analysis;
  const fv = fairValue ?? {};
  const upside = fv.marginOfSafety != null ? fmtPct(fv.marginOfSafety) : "—";
  const color = fv.marginOfSafety != null ? (fv.marginOfSafety >= 0 ? 0x00a35a : 0xe05e5e) : 0x8a8f98;

  const eb = new EmbedBuilder()
    .setColor(color)
    .setTitle("💰 Fair Value & Valuation")
    .addFields(
      { name: fv.dcfMethod === "eps" ? "DCF fair value (EPS-based)" : "DCF fair value", value: fmtPrice(fv.dcf), inline: true },
      { name: "Analyst target", value: fmtPrice(fv.analyst), inline: true },
      { name: "Blended fair value", value: fmtPrice(fv.blended), inline: true },
      { name: "Margin of safety", value: upside, inline: true },
      { name: "P/E (trailing)", value: quote.trailingPE != null ? fmt(quote.trailingPE) : "—", inline: true },
      { name: "P/E (forward)", value: quote.forwardPE != null ? fmt(quote.forwardPE) : "—", inline: true },
      { name: "PEG", value: quote.pegRatio != null ? fmt(quote.pegRatio, 2) : "—", inline: true },
      { name: "P/B", value: quote.priceToBook != null ? fmt(quote.priceToBook, 2) : "—", inline: true },
      { name: "EV/EBITDA", value: quote.enterpriseToEbitda != null ? fmt(quote.enterpriseToEbitda, 1) : "—", inline: true },
      { name: "P/S", value: quote.priceToSalesTrailing12Months != null ? fmt(quote.priceToSalesTrailing12Months, 2) : "—", inline: true }
    );

  if (analysis.components.value?.note) {
    eb.setDescription(analysis.components.value.note.split(" · ").slice(0, 5).map(bullet).join("\n").slice(0, 1024));
  }
  if (fv.dcf == null && fv.analyst == null) {
    eb.setFooter({ text: "DCF and analyst targets unavailable — multiples shown only" });
  }
  return eb;
}

function qualityEmbed({ quote, analysis }) {
  const q = quote;
  const fcfPerNi =
    q.freeCashflow != null && q.netIncomeToCommon != null && q.netIncomeToCommon > 0
      ? (q.freeCashflow / q.netIncomeToCommon).toFixed(2)
      : "—";

  const eb = new EmbedBuilder()
    .setColor(0x8b5cf6)
    .setTitle("🏛️ Quality & Profitability")
    .addFields(
      { name: "ROE", value: q.returnOnEquity != null ? fmtPct(q.returnOnEquity) : "—", inline: true },
      { name: "ROA", value: q.returnOnAssets != null ? fmtPct(q.returnOnAssets) : "—", inline: true },
      { name: "Gross margin", value: q.grossMargins != null ? fmtPct(q.grossMargins) : "—", inline: true },
      { name: "Operating margin", value: q.operatingMargins != null ? fmtPct(q.operatingMargins) : "—", inline: true },
      { name: "Net margin", value: q.profitMargins != null ? fmtPct(q.profitMargins) : "—", inline: true },
      { name: "Revenue growth", value: q.revenueGrowth != null ? fmtPct(q.revenueGrowth) : "—", inline: true },
      { name: "Earnings growth", value: q.earningsGrowth != null ? fmtPct(q.earningsGrowth) : "—", inline: true },
      { name: "Debt/equity", value: q.debtToEquity != null ? `${fmt(q.debtToEquity)}%` : "—", inline: true },
      { name: "Current ratio", value: q.currentRatio != null ? fmt(q.currentRatio, 2) : "—", inline: true },
      { name: "FCF / earnings", value: fcfPerNi, inline: true },
      { name: "Free cash flow", value: fmtBig(q.freeCashflow), inline: true },
      { name: "Dividend yield", value: q.dividendYield != null ? fmtPct(q.dividendYield) : "—", inline: true }
    );

  if (analysis.components.quality?.note) {
    eb.setDescription(analysis.components.quality.note.split(" · ").slice(0, 5).map(bullet).join("\n").slice(0, 1024));
  }
  return eb;
}

function technicalsEmbed({ quote, analysis }) {
  const { indicators, components } = analysis;
  const swing = analysis.strategy?.timeframe === "swing";
  const fastWin = swing ? analysis.strategy.indicators?.fast : null;
  const slowWin = swing ? analysis.strategy.indicators?.slow : null;
  const ema50vs200 = indicators.ema50 != null && indicators.ema200 != null
    ? indicators.ema50 > indicators.ema200 ? "golden alignment" : "death alignment"
    : "—";
  const fastRow = swing && fastWin != null && slowWin != null
    ? [
        { name: `EMA ${fastWin}`, value: indicators.emaFast != null ? fmtPrice(indicators.emaFast) : "—", inline: true },
        { name: `EMA ${slowWin}`, value: indicators.emaSlow != null ? fmtPrice(indicators.emaSlow) : "—", inline: true },
        { name: "EMA fast vs slow", value: indicators.emaFast != null && indicators.emaSlow != null ? (indicators.emaFast > indicators.emaSlow ? "golden" : "death") : "—", inline: true },
      ]
    : [];

  const eb = new EmbedBuilder()
    .setColor(0x3b82f6)
    .setTitle(`📈 Technicals ${swing ? "· Short-horizon (swing)" : ""}`)
    .addFields(
      { name: "RSI (14)", value: indicators.rsi != null ? fmt(indicators.rsi, 1) : "—", inline: true },
      { name: "EMA 50", value: indicators.ema50 != null ? fmtPrice(indicators.ema50) : "—", inline: true },
      { name: "EMA 200", value: indicators.ema200 != null ? fmtPrice(indicators.ema200) : "—", inline: true },
      { name: "EMA 50 vs 200", value: ema50vs200, inline: true },
      { name: "ATR", value: indicators.atrPct != null ? `${fmt(indicators.atrPct)}%/day` : "—", inline: true },
      { name: "MACD hist", value: indicators.macdHistogram != null ? fmt(indicators.macdHistogram, 2) : "—", inline: true },
      ...fastRow
    );

  const notes = [
    components.trend?.note,
    components.momentum?.note,
    components.volume?.note,
    components.volatility?.note,
  ]
    .filter(Boolean)
    .slice(0, 5);
  if (notes.length) {
    eb.setDescription(notes.map(bullet).join("\n").slice(0, 1024));
  }
  return eb;
}

export function screenTable(results) {
  const rows = results
    .filter((r) => r.ok)
    .map((r) => {
      const mos = r.analysis.fairValue?.marginOfSafety;
      return {
        symbol: r.symbol,
        name: r.quote.longName ?? r.symbol,
        score: r.analysis.score,
        verdict: r.analysis.verdict,
        mos: mos != null ? `${mos >= 0 ? "+" : ""}${(mos * 100).toFixed(0)}%` : "—",
      };
    })
    .sort((a, b) => b.score - a.score);

  const header = `${"#".padEnd(4)}${"VERDICT".padEnd(12)}${"TICKER".padEnd(7)}${"SCORE".padEnd(7)}MOS     NAME`;
  const lines = rows.map((r, i) =>
    `${String(i + 1).padEnd(4)}${r.verdict.padEnd(12)}${r.symbol.padEnd(7)}${r.score.toFixed(2).padEnd(7)}${r.mos.padEnd(7)}${r.name.slice(0, 24)}`
  );
  const failed = results.filter((r) => !r.ok);
  const failLine = failed.length ? `\n\n⚠️ Failed: ${failed.map((f) => f.ticker).join(", ")}` : "";
  return `**Screen (${rows.length} candidates):**\n\n\`\`\`\n${header}\n${lines.join("\n")}\`\`\`${failLine}`;
}

function scenarioEmbed({ analysis }) {
  const s = analysis.scenarios;
  if (!s) return null;
  const fmtTarget = (v) => (v != null ? fmtPrice(v) : "—");
  const fmtUp = (v) => (v != null ? `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%` : "—");
  const color = s.bull != null && s.bear != null && s.bull >= s.base && s.base >= s.bear ? 0xf59e0b : 0x8a8f98;
  return new EmbedBuilder()
    .setColor(color)
    .setTitle("🎯 Scenario Valuation · Bull / Base / Bear")
    .addFields(
      { name: "🟢 Bull case", value: `${fmtTarget(s.bull)} (${fmtUp(s.upside.bull)})`, inline: true },
      { name: "⚪ Base case", value: `${fmtTarget(s.base)} (${fmtUp(s.upside.base)})`, inline: true },
      { name: "🔴 Bear case", value: `${fmtTarget(s.bear)} (${fmtUp(s.upside.bear)})`, inline: true }
    )
    .setDescription(`**Current price:** ${fmtPrice(s.price)}`)
    .setFooter({ text: "Each scenario blends our DCF run with optimistic/pessimistic inputs + analyst high/low targets." });
}

function compsEmbed({ quote, comps }) {
  if (!comps || !comps.metrics?.length) return null;
  const color = comps.tone === "bad" ? 0xe05e5e : comps.tone === "good" ? 0x00a35a : 0xf59e0b;
  const emoji = comps.tone === "bad" ? "🔴" : comps.tone === "good" ? "🟢" : "🟡";
  const badge = (tone) => (tone === "cheap" ? "🟢" : tone === "expensive" ? "🔴" : "🟡");

  const fields = comps.metrics.slice(0, 5).map((m) => {
    const diff = `${m.diffPct >= 0 ? "+" : ""}${(m.diffPct * 100).toFixed(0)}% vs peers`;
    return {
      name: `${badge(m.tone)} ${m.label}`,
      value: `ours ${fmt(m.ours, 2)} · peers ${fmt(m.peerMedian, 2)} · ${diff}`,
      inline: true,
    };
  });

  const eb = new EmbedBuilder()
    .setColor(color)
    .setTitle(`👥 Peer & Sector Comps · ${emoji} ${comps.verdict}`)
    .addFields(fields)
    .setDescription(
      `${quote.longName ?? quote.symbol} vs ${comps.peerCount} peers — higher-than-peer multiples mean you pay more for the same growth.`
    );
  if (quote.sector || quote.industry) {
    eb.setFooter({ text: [quote.sector, quote.industry].filter(Boolean).join(" · ") });
  }
  return eb;
}

export function researchEmbeds({ symbol, name, quote, analysis, comps }) {
  const embeds = [
    summaryEmbed({ symbol, name, quote, analysis }),
    fairValueEmbed({ quote, analysis }),
    qualityEmbed({ quote, analysis }),
    technicalsEmbed({ quote, analysis }),
  ];
  const sc = scenarioEmbed({ analysis });
  if (sc) embeds.push(sc);
  const cp = compsEmbed({ quote, comps });
  if (cp) embeds.push(cp);
  return embeds;
}

export function performanceEmbed(p) {
  const winRate = p.winRate != null ? fmtPct(p.winRate) : "—";
  const avgRet = p.avgReturn != null ? fmtPct(p.avgReturn) : "—";
  const longWR = p.longCount ? fmtPct(p.longWins / p.longCount) : "—";
  const shortWR = p.shortCount ? fmtPct(p.shortWins / p.shortCount) : "—";
  const spxAvg = p.spxAvgReturn != null ? fmtPct(p.spxAvgReturn) : "—";
  const netAlpha = p.netAlpha != null ? fmtPct(p.netAlpha) : "—";
  const maxDD = p.tradeCount && p.maxDrawdown != null ? fmtPct(p.maxDrawdown) : "—";
  const holdLong = p.avgHoldingDays?.long != null ? `${Math.round(p.avgHoldingDays.long)}d` : "—";
  const holdShort = p.avgHoldingDays?.short != null ? `${Math.round(p.avgHoldingDays.short)}d` : "—";
  const color = p.netAlpha != null ? (p.netAlpha >= 0 ? 0x00d26a : 0xe05e5e) : 0x00d26a;

  const row = (r) => {
    const wr = r.winRate != null ? `${Math.round(r.winRate * 100)}%` : "—";
    const emoji = r.winRate != null ? (r.winRate >= 0.5 ? "🟢" : r.winRate >= 0.35 ? "🟡" : "🔴") : "⚪";
    return `${emoji} **${r.label}** · ${r.wins}W/${r.losses}L · ${wr}`;
  };
  const months = (p.byMonth ?? []).slice(-6).map(row).join("\n");
  const quarters = (p.byQuarter ?? []).map(row).join("\n");
  const table = [months && `**Win rate by month**\n${months}`, quarters && `**By quarter**\n${quarters}`].filter(Boolean).join("\n\n").slice(0, 1024);

  return new EmbedBuilder()
    .setColor(color)
    .setTitle("📊 Track Record")
    .setDescription(table || null)
    .addFields(
      { name: "Signals logged", value: `${p.totalSignals}`, inline: true },
      { name: "Scored", value: `${p.tradeCount}`, inline: true },
      { name: "Pending", value: `${p.incomplete}`, inline: true },
      { name: "Wins", value: `${p.wins}`, inline: true },
      { name: "Losses", value: `${p.losses}`, inline: true },
      { name: "Win rate", value: winRate, inline: true },
      { name: "Avg return", value: avgRet, inline: true },
      { name: "LONG win rate", value: longWR, inline: true },
      { name: "SHORT win rate", value: shortWR, inline: true },
      { name: "Horizon", value: `${p.horizonDays} days`, inline: true },
      { name: "SPX avg (same window)", value: spxAvg, inline: true },
      { name: "Net alpha vs SPX", value: netAlpha, inline: true },
      { name: "Beat S&P 500", value: p.spxScored ? `${p.beatMarket}/${p.spxScored}` : "—", inline: true },
      { name: "Max drawdown", value: maxDD, inline: true },
      { name: "Avg hold (long)", value: holdLong, inline: true },
      { name: "Avg hold (short)", value: holdShort, inline: true }
    )
    .setFooter({ text: "BUY/SELL signals evaluated vs subsequent price and the S&P 500 over the same window · HOLD excluded" });
}
