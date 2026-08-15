export const trendStrategy = {
  id: "trend",
  name: "Trend Follower",
  description:
    "Follows established trends and rides continuations. Never catches falling knives and never shorts volatile pumps.",
  weights: {
    trend: 0.25,
    momentum: 0.2,
    volatility: 0.1,
    volume: 0.1,
    value: 0.2,
    quality: 0.15,
  },
  guards: {
    noKnifeCatch: {
      enabled: true,
      rule: "No BUY/STRONG BUY while price is below the 200-day EMA (long-term trend broken).",
      check: ({ price, ema200 }) => ema200 != null && price < ema200,
    },
    noPumpShort: {
      enabled: true,
      rule: "No SELL/STRONG SELL while extended above the 50-day EMA with RSI > 70 (don't short a pump).",
      check: ({ price, ema50, rsi }) => rsi != null && rsi > 70 && ema50 != null && price > ema50,
    },
    noOverpay: {
      enabled: true,
      premium: "EXPENSIVE",
      rule: "No BUY/STRONG BUY when valuation is at an extreme premium (EXPENSIVE). Flip premium to RICH to also block moderate premiums.",
      check: ({ valueGrade, premium = "EXPENSIVE" }) => {
        const thresholds = { RICH: ["RICH", "EXPENSIVE"], EXPENSIVE: ["EXPENSIVE"] };
        return thresholds[premium]?.includes(valueGrade) ?? false;
      },
    },
  },
};

export function strategyGuardNotes(strategy) {
  return Object.entries(strategy.guards ?? {})
    .filter(([, g]) => g.enabled)
    .map(([id, g]) => ({ id, rule: g.rule }));
}
