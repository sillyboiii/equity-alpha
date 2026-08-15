import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const DB_FILE = join(DATA_DIR, "equity.db");
const BENCHMARK = "^GSPC";

export class Store {
  constructor(file = DB_FILE) {
    mkdirSync(dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this._init();
  }

  _init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
      CREATE TABLE IF NOT EXISTS watchlist (
        ticker TEXT PRIMARY KEY,
        name TEXT,
        added_at TEXT
      );
      CREATE TABLE IF NOT EXISTS price_history (
        ticker TEXT,
        date TEXT,
        open REAL, high REAL, low REAL, close REAL, volume INTEGER,
        PRIMARY KEY (ticker, date)
      );
      CREATE TABLE IF NOT EXISTS signals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker TEXT,
        name TEXT,
        verdict TEXT,
        score REAL,
        price REAL,
        signaled_at TEXT,
        evaluated INTEGER NOT NULL DEFAULT 0,
        evaluated_at TEXT
      );
      CREATE TABLE IF NOT EXISTS personal_signals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker TEXT,
        name TEXT,
        verdict TEXT,
        score REAL,
        price REAL,
        signaled_at TEXT,
        evaluated INTEGER NOT NULL DEFAULT 0,
        evaluated_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_prices ON price_history (ticker, date);
      CREATE INDEX IF NOT EXISTS idx_signals ON signals (signaled_at);
      CREATE INDEX IF NOT EXISTS idx_personal_signals ON personal_signals (signaled_at);
    `);
    const cols = this.db.prepare("PRAGMA table_info(signals)").all().map((c) => c.name);
    if (!cols.includes("evaluated")) this.db.exec("ALTER TABLE signals ADD COLUMN evaluated INTEGER NOT NULL DEFAULT 0");
    if (!cols.includes("evaluated_at")) this.db.exec("ALTER TABLE signals ADD COLUMN evaluated_at TEXT");
  }

  close() {
    this.db.close();
  }

  getSetting(key, fallback = null) {
    const row = this.db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
    return row ? row.value : fallback;
  }

  setSetting(key, value) {
    this.db
      .prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .run(key, String(value));
  }

  get channelId() {
    return this.getSetting("channelId");
  }
  setChannelId(id) {
    this.setSetting("channelId", id);
  }

  get horizonDays() {
    return parseInt(this.getSetting("horizonDays", "30"), 10) || 30;
  }
  setHorizonDays(d) {
    this.setSetting("horizonDays", String(d));
  }

  get personalHorizonDays() {
    return parseInt(this.getSetting("personalHorizonDays", "7"), 10) || 7;
  }
  setPersonalHorizonDays(d) {
    this.setSetting("personalHorizonDays", String(d));
  }

  _signalTable(scope) {
    return scope === "personal" ? "personal_signals" : "signals";
  }

  _horizonDays(scope) {
    return scope === "personal" ? this.personalHorizonDays : this.horizonDays;
  }

  addToWatchlist(ticker, name) {
    this.db
      .prepare("INSERT INTO watchlist (ticker, name, added_at) VALUES (?, ?, ?) ON CONFLICT(ticker) DO UPDATE SET name = excluded.name")
      .run(ticker.toUpperCase(), name || null, new Date().toISOString());
  }

  removeFromWatchlist(ticker) {
    const res = this.db.prepare("DELETE FROM watchlist WHERE ticker = ?").run(ticker.toUpperCase());
    return res.changes > 0;
  }

  get watchlist() {
    return this.db
      .prepare("SELECT ticker, name, added_at FROM watchlist ORDER BY added_at ASC")
      .all();
  }

  isWatched(ticker) {
    return !!this.db.prepare("SELECT 1 FROM watchlist WHERE ticker = ?").get(ticker.toUpperCase());
  }

  savePrices(ticker, candles) {
    const insert = this.db.prepare(`
      INSERT INTO price_history (ticker, date, open, high, low, close, volume)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(ticker, date) DO UPDATE SET
        open = excluded.open, high = excluded.high, low = excluded.low,
        close = excluded.close, volume = excluded.volume
    `);
    this.db.exec("BEGIN");
    try {
      for (const c of candles) {
        insert.run(ticker.toUpperCase(), c.date, c.open, c.high, c.low, c.close, c.volume ?? 0);
      }
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }

  getPrices(ticker, limit = 260) {
    return this.db
      .prepare("SELECT date, open, high, low, close, volume FROM price_history WHERE ticker = ? ORDER BY date DESC LIMIT ?")
      .all(ticker.toUpperCase(), limit)
      .reverse();
  }

  getLastPrice(ticker) {
    const row = this.db
      .prepare("SELECT close FROM price_history WHERE ticker = ? ORDER BY date DESC LIMIT 1")
      .get(ticker.toUpperCase());
    return row?.close ?? null;
  }

  logSignal({ ticker, name, verdict, score, price, signaledAt }, scope = "public") {
    const res = this.db
      .prepare(`INSERT INTO ${this._signalTable(scope)} (ticker, name, verdict, score, price, signaled_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(ticker.toUpperCase(), name || null, verdict, score, price, signaledAt ?? new Date().toISOString());
    return res.lastInsertRowid;
  }

  getSignals({ limit = 200 } = {}, scope = "public") {
    return this.db
      .prepare(`SELECT * FROM ${this._signalTable(scope)} ORDER BY signaled_at DESC LIMIT ?`)
      .all(limit)
      .reverse();
  }

  recentSignal(ticker, days = 7, scope = "public") {
    const since = new Date(Date.now() - days * 86400_000).toISOString();
    return !!this.db
      .prepare(`SELECT 1 FROM ${this._signalTable(scope)} WHERE ticker = ? AND signaled_at >= ? LIMIT 1`)
      .get(ticker.toUpperCase(), since);
  }

  _findBar(ticker, targetDate) {
    return this.db
      .prepare("SELECT close, date FROM price_history WHERE ticker = ? AND date >= ? ORDER BY date ASC LIMIT 1")
      .get(ticker.toUpperCase(), targetDate);
  }

  _evaluateSignal(s, scope = "public") {
    const horizon = this._horizonDays(scope);
    const signaled = new Date(s.signaled_at);
    const exit = new Date(signaled);
    exit.setDate(exit.getDate() + horizon);
    const targetExit = exit.toISOString().slice(0, 10);
    const bar = this._findBar(s.ticker, targetExit);
    if (!bar) return null;
    const entry = s.price ?? this._findBar(s.ticker, signaled.toISOString().slice(0, 10))?.close;
    if (!entry) return null;
    const ret = bar.close / entry - 1;
    const isBuy = s.verdict === "BUY" || s.verdict === "STRONG BUY";
    const correct = isBuy ? ret > 0 : ret < 0;
    const spxEntryBar = this._findBar(BENCHMARK, signaled.toISOString().slice(0, 10));
    const spxExitBar = this._findBar(BENCHMARK, targetExit);
    let spxRet = null;
    if (spxEntryBar && spxExitBar) spxRet = spxExitBar.close / spxEntryBar.close - 1;
    return { ...s, horizon, targetExit, barDate: bar.date, ret, correct, isBuy, spxRet, alpha: spxRet != null ? ret - spxRet : null };
  }

  dueForEvaluation(scope = "public") {
    const today = new Date().toISOString().slice(0, 10);
    return this.getSignals({ limit: 500 }, scope)
      .filter((s) => s.verdict !== "HOLD" && !s.evaluated)
      .map((s) => this._evaluateSignal(s, scope))
      .filter((e) => e != null && e.targetExit <= today);
  }

  markEvaluated(ids, scope = "public") {
    if (!ids.length) return 0;
    const stmt = this.db.prepare(`UPDATE ${this._signalTable(scope)} SET evaluated = 1, evaluated_at = ? WHERE id = ?`);
    const now = new Date().toISOString();
    this.db.exec("BEGIN");
    try {
      for (const id of ids) stmt.run(now, id);
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
    return ids.length;
  }

  performance(scope = "public") {
    const horizon = this._horizonDays(scope);
    const signals = this.getSignals({ limit: 500 }, scope);
    const scored = [];
    let wins = 0;
    let losses = 0;
    let longWins = 0;
    let longCount = 0;
    let shortWins = 0;
    let shortCount = 0;
    let incomplete = 0;
    let spxScored = 0;
    let spxSum = 0;
    let beatMarket = 0;
    for (const s of signals) {
      if (s.verdict === "HOLD") continue;
      const ev = this._evaluateSignal(s, scope);
      if (!ev) {
        incomplete++;
        continue;
      }
      if (ev.correct) wins++;
      else losses++;
      if (ev.isBuy) {
        longCount++;
        if (ev.correct) longWins++;
      } else {
        shortCount++;
        if (ev.correct) shortWins++;
      }
      if (ev.spxRet != null) {
        spxScored++;
        spxSum += ev.spxRet;
        if (ev.ret > ev.spxRet) beatMarket++;
      }
      scored.push({ ...s, exitDate: ev.barDate, ret: ev.ret, correct: ev.correct, isBuy: ev.isBuy, spxRet: ev.spxRet, alpha: ev.alpha });
    }
    const scoredSignals = scored.length;
    const winRate = scoredSignals ? wins / scoredSignals : null;
    const avgReturn = scoredSignals ? scored.reduce((s, x) => s + x.ret, 0) / scoredSignals : null;
    const tradeCount = wins + losses;
    const alphaSignals = scored.filter((x) => x.alpha != null);
    const netAlpha = alphaSignals.length
      ? alphaSignals.reduce((s, x) => s + x.alpha, 0) / alphaSignals.length
      : null;
    const spxAvgReturn = spxScored ? spxSum / spxScored : null;

    const byMonth = new Map();
    const byQuarter = new Map();
    const holdLong = [];
    const holdShort = [];
    for (const x of scored) {
      const m = x.exitDate.slice(0, 7);
      const q = `${x.exitDate.slice(0, 4)}Q${Math.floor((+x.exitDate.slice(5, 7) - 1) / 3) + 1}`;
      const bump = (map, key) => {
        const v = map.get(key) ?? { w: 0, l: 0 };
        if (x.correct) v.w++;
        else v.l++;
        map.set(key, v);
      };
      bump(byMonth, m);
      bump(byQuarter, q);
      const sigDate = new Date(x.signaled_at).toISOString().slice(0, 10);
      const days = (new Date(x.exitDate) - new Date(sigDate)) / 86_400_000;
      if (x.isBuy) holdLong.push(days);
      else holdShort.push(days);
    }
    const series = (map) =>
      [...map.entries()]
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([label, v]) => ({ label, wins: v.w, losses: v.l, winRate: v.w + v.l ? v.w / (v.w + v.l) : null }));

    let equity = 1;
    let peak = 1;
    let maxDrawdown = 0;
    const chrono = [...scored].sort((a, b) => (a.exitDate < b.exitDate ? -1 : 1));
    for (const x of chrono) {
      equity *= 1 + x.ret;
      peak = Math.max(peak, equity);
      maxDrawdown = Math.min(maxDrawdown, equity / peak - 1);
    }
    const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);

    return {
      horizonDays: horizon,
      totalSignals: signals.length,
      scoredSignals,
      tradeCount,
      incomplete,
      wins,
      losses,
      longWins,
      longCount,
      shortWins,
      shortCount,
      winRate,
      avgReturn,
      spxScored,
      spxAvgReturn,
      netAlpha,
      beatMarket,
      byMonth: series(byMonth),
      byQuarter: series(byQuarter),
      maxDrawdown: Math.abs(maxDrawdown),
      avgHoldingDays: { long: avg(holdLong), short: avg(holdShort) },
      scored,
    };
  }
}
