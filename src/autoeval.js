import { performanceEmbed } from "./report.js";

const SCOPES = [
  { scope: "public", label: "research signals", horizon: null },
  { scope: "personal", label: "personal (≤7-day) signals", horizon: null },
];

export function evaluateDue(store) {
  return SCOPES.map((s) => {
    const due = store.dueForEvaluation(s.scope);
    if (due.length) store.markEvaluated(due.map((d) => d.id), s.scope);
    return { scope: s.scope, due, performance: store.performance(s.scope) };
  });
}

export function startAutoEvaluation({ client, store, intervalMs = 6 * 3600_000 }) {
  const run = async () => {
    try {
      const results = evaluateDue(store);
      const withDue = results.filter((r) => r.due.length);
      if (!withDue.length) return;
      const channel = store.channelId
        ? await client.channels.fetch(store.channelId).catch(() => null)
        : null;
      if (!channel || typeof channel.send !== "function") return;
      const arrow = (v) => (v >= 0 ? "+" : "") + (v * 100).toFixed(1) + "%";
      for (const { scope, due, performance: p } of withDue) {
        const label = scope === "personal" ? "personal (≤7-day)" : "research";
        console.log(`[autoeval] ${due.length} ${label} signal(s) hit their ${p.horizonDays}-day horizon`);
        const lines = due.map(
          (d) =>
            `**${d.ticker}** ${d.verdict}: ${arrow(d.ret)}` +
            (d.spxRet != null ? ` · SPX ${arrow(d.spxRet)} · alpha ${arrow(d.alpha)}` : "") +
            (d.correct ? " ✅" : " ❌")
        );
        await channel.send({
          content: `📅 **Auto-eval — ${due.length} ${label} signal${due.length > 1 ? "s" : ""} hit their ${p.horizonDays}-day horizon**\n${lines.join("\n")}`,
        });
        await channel.send({ embeds: [performanceEmbed(p)] });
      }
    } catch (e) {
      console.error("auto-eval failed:", e.message);
    }
  };
  const first = setTimeout(run, 15_000);
  const every = setInterval(run, intervalMs);
  return () => {
    clearTimeout(first);
    clearInterval(every);
  };
}
