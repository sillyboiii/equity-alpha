"use client";

export type GateEntry = {
  ts: string;
  symbol: string;
  name: string;
  size: number;
  score: number;
  verdict: string;
  passed: boolean;
  guards: string[];
  thesis: string;
  traded: boolean;
};

export type JournalEntry = {
  id: string;
  symbol: string;
  name: string;
  side: "BUY" | "SELL";
  size: number;
  price: number | null;
  ts: string;
  thesis: string;
  rule: string;
  verdict: string;
  scored: {
    ret: number;
    spxRet: number | null;
    alpha: number | null;
    at: string;
  } | null;
};

export const GATE_KEY = "qntl:gate";
export const JOURNAL_KEY = "qntl:journal";

export function loadGate(): GateEntry[] {
  try {
    const raw = localStorage.getItem(GATE_KEY);
    if (!raw) return [];
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function saveGate(entries: GateEntry[]) {
  localStorage.setItem(GATE_KEY, JSON.stringify(entries));
  window.dispatchEvent(new Event("qntl:gate"));
}

export function loadJournal(): JournalEntry[] {
  try {
    const raw = localStorage.getItem(JOURNAL_KEY);
    if (!raw) return [];
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function saveJournal(entries: JournalEntry[]) {
  localStorage.setItem(JOURNAL_KEY, JSON.stringify(entries));
  window.dispatchEvent(new Event("qntl:journal"));
}
