import { NextResponse } from "next/server";
import { researchTicker } from "../../../src/research.js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req) {
  const ticker = new URL(req.url).searchParams.get("ticker")?.trim().toUpperCase();
  if (!ticker || !/^[A-Z0-9.\-]{1,10}$/.test(ticker)) {
    return NextResponse.json({ error: "Provide a valid ticker, e.g. ?ticker=NVDA" }, { status: 400 });
  }
  try {
    const res = await researchTicker(ticker);
    return NextResponse.json(res);
  } catch (e) {
    return NextResponse.json({ error: e.message || "Research failed" }, { status: 502 });
  }
}
