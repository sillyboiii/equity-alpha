import { NextResponse } from "next/server";
import { getHistory, SPX } from "../../../src/market.js";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const cache = new Map();

export async function GET(req) {
  const since = new URL(req.url).searchParams.get("since");
  if (!since || !/^\d{4}-\d{2}-\d{2}/.test(since)) {
    return NextResponse.json({ error: "Provide ?since=YYYY-MM-DD" }, { status: 400 });
  }
  const days = Math.ceil((Date.now() - new Date(since).getTime()) / 86400000) + 10;

  if (cache.has(since) && Date.now() - cache.get(since).at < 60 * 60_000) {
    return NextResponse.json(cache.get(since).data);
  }

  try {
    const bars = await getHistory(SPX, { days });
    const base = bars.find((b) => b.date >= since);
    const last = bars[bars.length - 1];
    if (!base || !last) {
      return NextResponse.json({ error: "No S&P data for that window" }, { status: 400 });
    }
    const data = {
      since,
      startPrice: base.close,
      endPrice: last.close,
      startDate: base.date,
      endDate: last.date,
      ret: last.close / base.close - 1,
    };
    cache.set(since, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e?.message ?? "Failed to fetch S&P" }, { status: 500 });
  }
}
