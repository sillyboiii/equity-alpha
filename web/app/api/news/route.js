import { NextResponse } from "next/server";
import { getNews } from "../../../src/market.js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    const items = await getNews();
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: e?.message ?? "Failed to fetch news" }, { status: 502 });
  }
}
