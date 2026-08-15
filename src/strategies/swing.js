export const swingStrategy = {
  id: "swing",
  name: "Swing Momentum (≤7-day)",
  description:
    "Short-horizon momentum for quick directional trades — the personal, options-friendly variant of the research engine. Fast trend (9/21-day EMA), 5-day momentum, volatility-aware sizing. Valuation is downweighted and never vetoes (a ≤7-day move doesn't care about long-term premium); discipline comes from trend-following guards. PERSONAL tool, never public.",
  timeframe: "swing",
  indicators: { fast: 9, slow: 21, momentumDays: 5 },
  weights: {
    trend: 0.25,
    momentum: 0.35,
    volatility: 0.15,
    volume: 0.15,
    value: 0.05,
    quality: 0.05,
  },
  guards: {
    noKnifeCatch: {
      enabled: true,
      rule: "No BUY/STRONG BUY while price is below the 21-day EMA (short-term trend broken).",
      check: ({ price, emaSlow }) => emaSlow != null && price < emaSlow,
    },
    noPumpShort: {
      enabled: true,
      rule: "No SELL/STRONG SELL while extended above the 9-day EMA with RSI > 70 (don't short a pump).",
      check: ({ price, emaFast, rsi }) => rsi != null && rsi > 70 && emaFast != null && price > emaFast,
    },
  },
};
