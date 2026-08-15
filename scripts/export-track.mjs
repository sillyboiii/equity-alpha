import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Store } from "../src/store.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, "..", "web", "app", "track.json");

const store = new Store();
const compact = (perf) => ({
  ...perf,
  scored: (perf.scored ?? []).slice(-60).map((s) => ({
    ticker: s.ticker,
    name: s.name,
    verdict: s.verdict,
    signaled_at: s.signaled_at,
    exitDate: s.exitDate,
    ret: s.ret,
    correct: s.correct,
    isBuy: s.isBuy,
    spxRet: s.spxRet,
    alpha: s.alpha,
  })),
});

const data = {
  generatedAt: new Date().toISOString(),
  research: compact(store.performance("public")),
  personal: compact(store.performance("personal")),
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(data, null, 2));
store.close();
console.log(`wrote ${outPath}`);
console.log(`research: ${data.research.scoredSignals} scored / personal: ${data.personal.scoredSignals} scored`);
