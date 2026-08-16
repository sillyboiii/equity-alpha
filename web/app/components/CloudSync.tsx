"use client";

import { useEffect, useRef } from "react";
import { pullKey, pushKey } from "./cloud";
import { loadWatchlist, saveWatchlist } from "./watchlistStore";
import { useAuth } from "./AuthProvider";

export default function CloudSync() {
  const { user } = useAuth();
  const lastPush = useRef<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      const wl = await pullKey(user.id, "watchlist");
      if (alive && wl && Array.isArray(wl.value)) {
        const local = loadWatchlist();
        const merged = [...new Set([...local, ...(wl.value as string[])])].slice(0, 20);
        if (merged.length !== local.length) saveWatchlist(merged);
      }
      const bk = await pullKey(user.id, "book");
      if (alive && bk && bk.value) {
        const localRaw = localStorage.getItem("qntl:book") ?? "";
        const local = localRaw ? (JSON.parse(localRaw) as { snapshots?: unknown[] }) : null;
        const cloud = bk.value as { snapshots?: unknown[] };
        const localCount = local?.snapshots?.length ?? 0;
        const cloudCount = cloud?.snapshots?.length ?? 0;
        if (cloudCount >= localCount) {
          localStorage.setItem("qntl:book", JSON.stringify(cloud));
          window.dispatchEvent(new Event("qntl:book"));
        }
      }
      for (const key of ["gate", "journal"] as const) {
        const lkey = key === "gate" ? "qntl:gate" : "qntl:journal";
        const ck = await pullKey(user.id, key);
        if (alive && ck && Array.isArray(ck.value)) {
          const local = JSON.parse(localStorage.getItem(lkey) ?? "[]") as unknown[];
          const cloud = ck.value as unknown[];
          if (cloud.length >= local.length) {
            localStorage.setItem(lkey, JSON.stringify(cloud));
            window.dispatchEvent(new Event(lkey));
          }
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const onWatchlist = () => {
      const list = loadWatchlist().join(",");
      if (lastPush.current.watchlist === list) return;
      lastPush.current.watchlist = list;
      pushKey(user.id, "watchlist", loadWatchlist());
    };
    const onBook = () => {
      const raw = localStorage.getItem("qntl:book") ?? "";
      if (lastPush.current.book === raw) return;
      lastPush.current.book = raw;
      let value: unknown = null;
      try {
        value = JSON.parse(raw);
      } catch {
        return;
      }
      pushKey(user.id, "book", value);
    };
    const onGate = () => {
      const raw = localStorage.getItem("qntl:gate") ?? "";
      if (lastPush.current.gate === raw) return;
      lastPush.current.gate = raw;
      let value: unknown = null;
      try {
        value = JSON.parse(raw);
      } catch {
        return;
      }
      pushKey(user.id, "gate", value);
    };
    const onJournal = () => {
      const raw = localStorage.getItem("qntl:journal") ?? "";
      if (lastPush.current.journal === raw) return;
      lastPush.current.journal = raw;
      let value: unknown = null;
      try {
        value = JSON.parse(raw);
      } catch {
        return;
      }
      pushKey(user.id, "journal", value);
    };
    window.addEventListener("qntl:watchlist", onWatchlist);
    window.addEventListener("qntl:book", onBook);
    window.addEventListener("qntl:gate", onGate);
    window.addEventListener("qntl:journal", onJournal);
    return () => {
      window.removeEventListener("qntl:watchlist", onWatchlist);
      window.removeEventListener("qntl:book", onBook);
      window.removeEventListener("qntl:gate", onGate);
      window.removeEventListener("qntl:journal", onJournal);
    };
  }, [user?.id]);

  return null;
}
