import { trendStrategy } from "./trend.js";
import { swingStrategy } from "./swing.js";

export const STRATEGIES = {
  [trendStrategy.id]: trendStrategy,
  [swingStrategy.id]: swingStrategy,
};

export function getStrategy(id) {
  return STRATEGIES[id] ?? trendStrategy;
}

export function listStrategies() {
  return Object.values(STRATEGIES);
}
