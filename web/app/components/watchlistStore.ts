"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "qntl:watchlist";
const EVENT = "qntl:watchlist";

export function loadWatchlist(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function saveWatchlist(list: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...new Set(list)]));
    window.dispatchEvent(new Event(EVENT));
  } catch {}
}

export function useWatchlist() {
  const [list, setList] = useState<string[]>([]);

  useEffect(() => {
    setList(loadWatchlist());
    const sync = () => setList(loadWatchlist());
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);

  const add = useCallback((s: string) => saveWatchlist([...loadWatchlist(), s.toUpperCase()]), []);
  const remove = useCallback((s: string) => saveWatchlist(loadWatchlist().filter((x) => x !== s.toUpperCase())), []);
  const toggle = useCallback((s: string) => {
    const sym = s.toUpperCase();
    const list = loadWatchlist();
    if (list.includes(sym)) saveWatchlist(list.filter((x) => x !== sym));
    else saveWatchlist([...list, sym]);
  }, []);

  return { list, add, remove, toggle };
}
