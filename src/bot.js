import { Client, GatewayIntentBits, ChannelType } from "discord.js";
import { Store } from "./store.js";
import { researchTicker, refreshBenchmark } from "./research.js";
import { startAutoEvaluation } from "./autoeval.js";
import { researchEmbeds, performanceEmbed, screenTable } from "./report.js";
import { lookup } from "./market.js";
import { backtestTicker, backtestSummary } from "./backtest.js";
import { simulate, simSummary } from "./sim.js";
import { buildDeepDive, deepDiveEmbeds } from "./deepdive.js";
import { listStrategies } from "./strategies/index.js";

const store = new Store();
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const { DISCORD_TOKEN } = process.env;

const COMMANDS = [
  {
    name: "analyze",
    description: "Run full equity research on a ticker and log a signal",
    options: [
      { name: "ticker", type: 3, required: true, description: "e.g. MSFT, NVDA, AAPL" },
    ],
  },
  {
    name: "watch",
    description: "Add a ticker to your watchlist",
    options: [
      { name: "ticker", type: 3, required: true, description: "e.g. MSFT" },
    ],
  },
  {
    name: "unwatch",
    description: "Remove a ticker from your watchlist",
    options: [
      { name: "ticker", type: 3, required: true, description: "e.g. MSFT" },
    ],
  },
  {
    name: "watchlist",
    description: "List everything on your watchlist",
  },
  {
    name: "scan",
    description: "Research every ticker on your watchlist and post a report",
  },
  {
    name: "screen",
    description: "Rank a list of tickers by score and margin of safety",
    options: [
      { name: "tickers", type: 3, required: true, description: "Space or comma separated, e.g. NVDA XOM JPM" },
    ],
  },
  {
    name: "backtest",
    description: "Engine validation — re-run signals over past price data",
    options: [
      { name: "ticker", type: 3, required: true, description: "e.g. MSFT" },
    ],
  },
  {
    name: "performance",
    description: "Show your track record — win rate and returns on every signal",
  },
  {
    name: "sim",
    description: "Portfolio simulation — $10k through the watchlist's backtest signals",
    options: [
      { name: "sizing", type: 5, required: false, description: "Use suggested position sizes (volatility-capped) instead of fixed 20%" },
    ],
  },
  {
    name: "setchannel",
    description: "Set which channel scan reports get posted to",
    options: [
      { name: "channel", type: 7, required: true, description: "The channel for scan reports" },
    ],
  },
  {
    name: "strategies",
    description: "List the strategy pool — which strategy runs each report",
  },
  {
    name: "deepdive",
    description: "Full equity research — financials, earnings, ownership, filings",
    options: [
      { name: "ticker", type: 3, required: true, description: "e.g. JPM" },
    ],
  },
  {
    name: "status",
    description: "Show bot status, watchlist size and track-record counts",
  },
  {
    name: "trade",
    description: "PERSONAL — short-horizon analysis (≤7-day, options-friendly). Logged separately from public research",
    options: [
      { name: "ticker", type: 3, required: true, description: "e.g. NVDA, SPY" },
    ],
  },
  {
    name: "mytrades",
    description: "PERSONAL — your short-horizon track record, separate from public research",
  },
  {
    name: "help",
    description: "List every command and what it does",
  },
];

client.once("clientReady", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  for (const g of [...client.guilds.cache.values()]) {
    try {
      await g.commands.set(COMMANDS);
    } catch (e) {
      console.error(`register commands in ${g.name}: ${e.message}`);
    }
  }
  console.log(`Registered ${COMMANDS.length} commands`);
  startAutoEvaluation({ client, store });
  console.log("Auto-evaluation job scheduled (every 6h)");
});

function reply(interaction, content, extra = {}) {
  return interaction.reply(typeof content === "object" ? { ...content, ...extra } : { content, ...extra });
}

function watchlistEmbed(list) {
  const lines = list.map((w, i) => {
    const lastPrice = store.getLastPrice(w.ticker);
    const price = lastPrice != null ? `\$${Number(lastPrice).toFixed(2)}` : "no price yet";
    return `**${i + 1}.** ${w.ticker.toUpperCase()}${w.name ? ` — ${w.name.slice(0, 40)}` : ""}\n   ${price} · added ${w.added_at.slice(0, 10)}`;
  });
  return `**Watchlist (${list.length}):**\n\n${lines.join("\n") || "Empty — use /watch <ticker>"}`;
}

function helpEmbed() {
  const fields = COMMANDS.map((c) => ({
    name: `/${c.name}`,
    value: c.description,
    inline: true,
  }));
  return {
    color: 0x00d26a,
    title: "Equity Alpha · Commands",
    description: "Research the market, build a watchlist, and let the bot prove its calls.",
    fields,
    footer: { text: "Tip: start with /watch, then /scan. Check /performance for the track record." },
  };
}

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName } = interaction;

  try {
    if (commandName === "analyze") {
      const ticker = interaction.options.getString("ticker");
      await interaction.deferReply();
      try {
        const res = await researchTicker(ticker);
        store.savePrices(res.symbol, res.candles);
        await refreshBenchmark(store);
        const dup = store.recentSignal(res.symbol, 7);
        let content;
        if (dup) {
          content = `Report posted — **${res.symbol}** was already analyzed within the last 7 days, so no duplicate signal was logged.`;
        } else {
          const signalId = store.logSignal({
            ticker: res.symbol,
            name: res.name,
            verdict: res.analysis.verdict,
            score: res.analysis.score,
            price: res.quote.price ?? res.analysis.indicators.price,
          });
          content = `Signal logged (id ${signalId}). Run \`/performance\` to see the track record.`;
        }
        await interaction.editReply({
          embeds: researchEmbeds({ symbol: res.symbol, name: res.name, quote: res.quote, analysis: res.analysis, comps: res.comps }),
          content,
        });
      } catch (e) {
        console.error(`analyze failed for ${ticker.toUpperCase()}:`, e.message);
        await interaction.editReply(`Couldn't analyze **${ticker.toUpperCase()}** — ${e.message}`);
      }
      return;
    }

    if (commandName === "watch") {
      const ticker = interaction.options.getString("ticker");
      try {
        const meta = await lookup(ticker);
        store.addToWatchlist(meta.symbol, meta.name);
        return reply(interaction, `✅ Watching **${meta.symbol}**${meta.name ? ` (${meta.name})` : ""}. Run \`/scan\` to research it.`);
      } catch (e) {
        return reply(interaction, `Couldn't find **${ticker.toUpperCase()}** — ${e.message}`);
      }
    }

    if (commandName === "unwatch") {
      const ticker = interaction.options.getString("ticker");
      const removed = store.removeFromWatchlist(ticker);
      return reply(interaction, removed ? `Removed **${ticker.toUpperCase()}** from the watchlist.` : `**${ticker.toUpperCase()}** wasn't on the watchlist.`);
    }

    if (commandName === "watchlist") {
      const list = store.watchlist.map((w) => ({ ...w }));
      return reply(interaction, watchlistEmbed(list));
    }

    if (commandName === "scan") {
      const list = store.watchlist;
      if (!list.length) return reply(interaction, "Watchlist is empty — add tickers with `/watch <ticker>` first.");
      await interaction.deferReply();
      await refreshBenchmark(store);
      const results = [];
      let logged = 0;
      for (const w of list) {
        try {
          const res = await researchTicker(w.ticker);
          store.savePrices(res.symbol, res.candles);
          if (!store.recentSignal(res.symbol, 7)) {
            store.logSignal({
              ticker: res.symbol,
              name: res.name,
              verdict: res.analysis.verdict,
              score: res.analysis.score,
              price: res.quote.price ?? res.analysis.indicators.price,
            });
            logged++;
          }
          results.push({ ok: true, ...res });
        } catch (e) {
          results.push({ ok: false, ticker: w.ticker, error: e.message });
        }
      }
      const channel = store.channelId ? await client.channels.fetch(store.channelId).catch(() => null) : null;
      const failed = results.filter((r) => !r.ok);
      for (const r of results) {
        if (!r.ok) continue;
        const target = channel ?? interaction.channel;
        await target.send({ embeds: researchEmbeds({ symbol: r.symbol, name: r.name, quote: r.quote, analysis: r.analysis, comps: r.comps }) });
      }
      const line = failed.length
        ? `⚠️ ${failed.length}/${results.length} failed: ${failed.map((f) => f.ticker).join(", ")}`
        : `✅ All ${results.length} reports posted.`;
      await interaction.editReply(`Scan complete. ${line} (${logged} new signal${logged === 1 ? "" : "s"} logged)`);
      return;
    }

    if (commandName === "screen") {
      const raw = interaction.options.getString("tickers");
      const tickers = [...new Set(raw.split(/[\s,]+/).filter(Boolean))].slice(0, 15);
      if (!tickers.length) return reply(interaction, "Give me some tickers — e.g. `/screen NVDA XOM JPM`.");
      await interaction.deferReply();
      const results = [];
      for (const t of tickers) {
        try {
          const res = await researchTicker(t);
          results.push({ ok: true, ...res });
        } catch (e) {
          results.push({ ok: false, ticker: t.toUpperCase(), error: e.message });
        }
      }
      await interaction.editReply(screenTable(results));
      return;
    }

    if (commandName === "backtest") {
      const ticker = interaction.options.getString("ticker");
      await interaction.deferReply();
      try {
        const bt = await backtestTicker(ticker);
        const lines = backtestSummary(bt).split("\n").map((l) => `• ${l}`);
        await interaction.editReply({
          embeds: [{
            color: 0x8b5cf6,
            title: `🕰️ Engine backtest · ${bt.symbol}`,
            description: lines.join("\n"),
            footer: { text: "Technical signals only — fundamentals can't be backtested. Validation, not financial advice." },
          }],
        });
      } catch (e) {
        await interaction.editReply(`Backtest failed for **${ticker.toUpperCase()}** — ${e.message}`);
      }
      return;
    }

    if (commandName === "performance") {
      const p = store.performance();
      return reply(interaction, { embeds: [performanceEmbed(p)] });
    }

    if (commandName === "sim") {
      await interaction.deferReply();
      try {
        const watchlist = store.watchlist;
        const tickers = watchlist.length ? watchlist.map((w) => w.ticker) : ["SPY", "QQQ", "NVDA", "MSFT", "AAPL"];
        const sizing = interaction.options.getBoolean("sizing") ?? false;
        const mode = sizing ? "suggested position sizes (volatility-capped)" : "20% per position";
        await interaction.editReply(`Running portfolio simulation on **${tickers.length}** watchlist tickers — $10k start, ${mode}, max 5 concurrent, 60-day horizon. This takes ~20s...`);
        const sim = await simulate({ tickers, sizing });
        const lines = simSummary(sim).split("\n").map((l) => `• ${l}`);
        await interaction.editReply({
          embeds: [{
            color: 0x10b981,
            title: "💵 Portfolio simulation",
            description: lines.join("\n"),
            footer: { text: "Validation on real historical data — not financial advice. Fundamentals (incl. noOverpay) not backtestable, so live results include the premium filter." },
          }],
        });
      } catch (e) {
        await interaction.editReply(`Simulation failed — ${e.message}`);
      }
      return;
    }

    if (commandName === "setchannel") {
      const channel = interaction.options.getChannel("channel");
      if (!channel || (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement)) {
        return reply(interaction, "Pick a text channel.", { ephemeral: true });
      }
      store.setChannelId(channel.id);
      return reply(interaction, `Scan reports will post in <#${channel.id}>.`, { ephemeral: true });
    }

    if (commandName === "strategies") {
      const fields = listStrategies().map((s) => ({
        name: `🧭 ${s.name} (${s.id})`,
        value: `${s.description}\nGuards: ${Object.entries(s.guards ?? {})
          .filter(([, g]) => g.enabled)
          .map(([id]) => id.replace(/([A-Z])/g, " $1").toLowerCase())
          .join(", ") || "none"}`,
      }));
      return reply(interaction, {
        embeds: [{
          color: 0x8b5cf6,
          title: "🧠 Strategy Pool",
          description: "Every report runs through one strategy. More strategies get added here as the foundation proves out.",
          fields,
          footer: { text: "Trend Follower is the active strategy · future: mean reversion, breakout, momentum engines" },
        }],
      });
    }

    if (commandName === "deepdive") {
      const ticker = interaction.options.getString("ticker");
      await interaction.deferReply();
      try {
        const dd = await buildDeepDive(ticker);
        await interaction.editReply({ embeds: deepDiveEmbeds(dd) });
      } catch (e) {
        await interaction.editReply(`Deep dive failed for **${ticker.toUpperCase()}** — ${e.message}`);
      }
      return;
    }

    if (commandName === "trade") {
      const ticker = interaction.options.getString("ticker");
      await interaction.deferReply();
      try {
        const res = await researchTicker(ticker, { strategy: "swing" });
        store.savePrices(res.symbol, res.candles);
        await refreshBenchmark(store);
        const dup = store.recentSignal(res.symbol, 7, "personal");
        let content;
        if (dup) {
          content = `Report posted — **${res.symbol}** was already traded within the last 7 days, so no duplicate personal signal was logged.`;
        } else {
          const signalId = store.logSignal({
            ticker: res.symbol,
            name: res.name,
            verdict: res.analysis.verdict,
            score: res.analysis.score,
            price: res.quote.price ?? res.analysis.indicators.price,
          }, "personal");
          content = `Personal signal logged (id ${signalId}). Run \`/mytrades\` for your ≤7-day track record.`;
        }
        await interaction.editReply({
          embeds: researchEmbeds({ symbol: res.symbol, name: res.name, quote: res.quote, analysis: res.analysis, comps: res.comps }),
          content,
        });
      } catch (e) {
        console.error(`trade failed for ${ticker.toUpperCase()}:`, e.message);
        await interaction.editReply(`Couldn't analyze **${ticker.toUpperCase()}** — ${e.message}`);
      }
      return;
    }

    if (commandName === "mytrades") {
      await interaction.deferReply();
      const p = store.performance("personal");
      return interaction.editReply({ embeds: [performanceEmbed(p)] });
    }

    if (commandName === "status") {
      const p = store.performance();
      const my = store.performance("personal");
      return reply(interaction, {
        embeds: [
          {
            color: 0x00d26a,
            title: "Equity Alpha · Status",
            fields: [
              { name: "Watchlist", value: `${store.watchlist.length} ticker(s)`, inline: true },
              { name: "Signals logged", value: `${p.totalSignals}`, inline: true },
              { name: "Win rate", value: p.winRate != null ? `${(p.winRate * 100).toFixed(1)}%` : "—", inline: true },
              { name: "Horizon", value: `${p.horizonDays} days`, inline: true },
              { name: "Channel", value: store.channelId ? `<#${store.channelId}>` : "not set", inline: true },
              { name: "Personal trades", value: `${my.totalSignals} (win ${my.winRate != null ? (my.winRate * 100).toFixed(1) + "%" : "—"})`, inline: true },
              { name: "Personal horizon", value: `${my.horizonDays} days`, inline: true },
            ],
          },
        ],
      });
    }

    if (commandName === "help") {
      return reply(interaction, { embeds: [helpEmbed()] });
    }
  } catch (e) {
    console.error(`command ${commandName} error:`, e);
    if (!interaction.replied && !interaction.deferred) {
      return interaction.reply({ content: `Something broke: ${e.message}`, ephemeral: true });
    }
    try {
      await interaction.editReply(`Something broke: ${e.message}`);
    } catch {}
  }
});

client.login(DISCORD_TOKEN).catch((e) => {
  console.error("Login failed — check DISCORD_TOKEN in .env");
  console.error(e.message);
  process.exit(1);
});
