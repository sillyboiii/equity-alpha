"use client";

type CardProps = {
  symbol: string;
  name: string;
  price: number | null;
  dayChangePct: number | null;
  verdict: string;
  score: number;
  thesis: string;
  guards: string[];
  suggestedSize: number | null;
  exchange?: string;
  currency?: string;
};

const W = 1200;
const H = 630;
const INK = "#1c1b18";
const PAPER = "#f4f1e9";
const SOFT = "#8a8578";
const FAINT = "#b9b3a4";
const GOOD = "#0e6b4a";
const BAD = "#b5533f";

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines - 1) {
        let rest = words.slice(words.indexOf(w)).join(" ");
        while (ctx.measureText(`${line} …`).width > maxWidth && line.length > 0) line = line.slice(0, -1);
        lines.push(`${line}${line ? " …" : rest.slice(0, 60)}`);
        return lines;
      }
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, maxLines);
}

function chip(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, bg: string) {
  const padX = 18;
  const h = 40;
  const w = ctx.measureText(text).width + padX * 2;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + padX, y + h / 2 + 1);
  return x + w + 14;
}

export async function makeShareCard(props: CardProps): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W * 2;
  canvas.height = H * 2;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(2, 2);
  ctx.imageSmoothingQuality = "high";

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  const sans = `"Inter", -apple-system, "Segoe UI", sans-serif`;

  // top bar
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = INK;
  ctx.font = `700 42px ${sans}`;
  ctx.fillText("QNTL", 64, 56);
  ctx.font = `400 30px ${sans}`;
  ctx.fillStyle = SOFT;
  ctx.fillText("trend-first research", 64 + ctx.measureText("QNTL").width + 20, 56);
  ctx.textAlign = "right";
  ctx.font = `500 24px ${sans}`;
  ctx.fillStyle = FAINT;
  ctx.fillText("informational · not financial advice", W - 64, 56);

  ctx.strokeStyle = "rgba(28,27,24,0.15)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(64, 96);
  ctx.lineTo(W - 64, 96);
  ctx.stroke();

  // verdict badge (right)
  const good = props.verdict === "BUY" || props.verdict === "STRONG BUY";
  const bad = props.verdict === "SELL" || props.verdict === "STRONG SELL";
  const color = good ? GOOD : bad ? BAD : SOFT;
  const bg = good ? "rgba(14,107,74,0.12)" : bad ? "rgba(181,83,63,0.12)" : "rgba(138,133,120,0.14)";
  ctx.font = `700 40px ${sans}`;
  const bw = ctx.measureText(props.verdict).width + 64;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(W - 64 - bw, 148, bw, 84, 42);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.fillText(props.verdict, W - 64 - bw / 2, 190);

  ctx.font = `600 26px ${sans}`;
  ctx.fillStyle = SOFT;
  ctx.fillText("conviction", W - 64 - bw / 2, 252);
  ctx.font = `700 34px ${sans}`;
  ctx.fillStyle = color;
  ctx.fillText(`${props.score >= 0 ? "+" : ""}${props.score.toFixed(2)}`, W - 64 - bw / 2, 292);

  // ticker (left)
  ctx.textAlign = "left";
  ctx.fillStyle = INK;
  ctx.font = `700 132px ${sans}`;
  ctx.fillText(props.symbol, 64, 238);

  ctx.font = `500 34px ${sans}`;
  ctx.fillStyle = SOFT;
  ctx.fillText(props.name ?? "", 64, 296);

  // price
  ctx.font = `700 60px ${sans}`;
  ctx.fillStyle = INK;
  ctx.fillText(
    props.price != null ? (props.price >= 100 ? props.price.toFixed(0) : props.price.toFixed(2)) : "·",
    64,
    376,
  );
  if (props.dayChangePct != null) {
    const up = props.dayChangePct >= 0;
    ctx.fillStyle = up ? GOOD : BAD;
    ctx.font = `600 40px ${sans}`;
    ctx.fillText(`${up ? "+" : ""}${props.dayChangePct.toFixed(2)}%`, 64, 376 + 52);
  }

  // thesis
  ctx.font = `400 30px ${sans}`;
  ctx.fillStyle = INK;
  const lines = wrap(ctx, props.thesis || "", W - 128 - (W - 64 - bw - 64), 3);
  let ty = 452;
  ctx.fillStyle = SOFT;
  for (const l of lines) {
    ctx.fillText(l, 64, ty);
    ty += 44;
  }

  // bottom guards
  ctx.font = `500 24px ${sans}`;
  let gx = 64;
  const gy = 560;
  for (const g of props.guards.slice(0, 3)) {
    gx = chip(ctx, g, gx, gy, BAD, "rgba(181,83,63,0.12)");
  }
  if (props.suggestedSize != null && props.suggestedSize > 0) {
    gx = chip(ctx, `size ${props.suggestedSize}%`, gx, gy, INK, "rgba(28,27,24,0.08)");
  }
  ctx.textAlign = "right";
  ctx.fillStyle = FAINT;
  ctx.fillText("The trend is your friend. The knife is not.", W - 64, 560 + 20);

  return await new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
}

export default function ShareButton({ card }: { card: CardProps }) {
  async function download() {
    const blob = await makeShareCard(card);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `QNTL-${card.symbol}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  return (
    <button
      onClick={download}
      className="flex w-full items-center justify-center gap-1.5 rounded-full border border-hairline px-4 py-2 text-xs font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
        <path d="M12 3v11M8 10l4 4 4-4M4 17v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
      </svg>
      Share call
    </button>
  );
}
