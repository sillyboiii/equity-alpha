const METRICS = [
  { key: "forwardPE", label: "P/E (fwd)", lowerIsBetter: true },
  { key: "trailingPE", label: "P/E (trail)", lowerIsBetter: true },
  { key: "priceToBook", label: "P/B", lowerIsBetter: true },
  { key: "pegRatio", label: "PEG", lowerIsBetter: true },
  { key: "enterpriseToEbitda", label: "EV/EBITDA", lowerIsBetter: true },
];

function median(values) {
  const v = values.filter((x) => Number.isFinite(x) && x > 0);
  if (v.length === 0) return null;
  v.sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

export function peerComp(quote = {}, peerQuotes = []) {
  const peers = peerQuotes.filter((p) => p.symbol?.toUpperCase() !== quote.symbol?.toUpperCase());
  if (peers.length < 2) {
    return { metrics: [], verdict: null, peerCount: peers.length };
  }

  const metrics = METRICS.map(({ key, label, lowerIsBetter }) => {
    const ours = quote[key];
    if (ours == null || !Number.isFinite(ours) || ours <= 0) return null;
    const peerMedian = median(peers.map((p) => p[key]));
    if (peerMedian == null) return null;
    const diffPct = ours / peerMedian - 1;
    const tolerance = 0.15;
    const tone = lowerIsBetter
      ? diffPct <= -tolerance ? "cheap" : diffPct >= tolerance ? "expensive" : "fair"
      : diffPct >= tolerance ? "cheap" : diffPct <= -tolerance ? "expensive" : "fair";
    return { label, ours, peerMedian, diffPct, tone, lowerIsBetter };
  }).filter(Boolean);

  if (metrics.length === 0) {
    return { metrics: [], verdict: null, peerCount: peers.length };
  }

  const expensive = metrics.filter((m) => m.tone === "expensive").length;
  const cheap = metrics.filter((m) => m.tone === "cheap").length;
  const verdict =
    expensive >= 2 ? "EXPENSIVE vs peers" : cheap >= 2 ? "CHEAP vs peers" : "in line with peers";
  const tone = expensive >= 2 ? "bad" : cheap >= 2 ? "good" : "neutral";

  return { metrics, verdict, tone, peerCount: peers.length };
}
