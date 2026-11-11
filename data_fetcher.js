// stock_agents/data_fetcher.js — shared data layer for all 5 agents
'use strict';
const https = require('https');
const { parseStringPromise } = require('xml2js');

// ─── HTTP helper ────────────────────────────────────────────────────
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 15000
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error(`timeout: ${url}`)); });
  });
}

// ─── Yahoo Finance: price history (1y daily OHLCV) ─────────────────
async function getPrices(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1y&interval=1d`;
  const { body } = await fetchUrl(url);
  const j = JSON.parse(body);
  const r = j.chart.result[0];
  const ts = r.timestamp;
  const oc = r.indicators.quote[0];
  const meta = r.meta;
  const prices = [];
  for (let i = 0; i < ts.length; i++) {
    prices.push({
      date: new Date(ts[i] * 1000).toISOString().slice(0, 10),
      open: oc.open[i], high: oc.high[i], low: oc.low[i], close: oc.close[i], volume: oc.volume[i]
    });
  }
  return { symbol, meta, prices };
}

// ─── Technical indicators ───────────────────────────────────────────
function sma(closes, period) {
  const out = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { out.push(null); continue; }
    let s = 0;
    for (let k = i - period + 1; k <= i; k++) s += closes[k];
    out.push(s / period);
  }
  return out;
}

function rsi(closes, period = 14) {
  const deltas = closes.map((c, i) => i === 0 ? 0 : c - closes[i - 1]);
  const out = []; let ag = 0, al = 0;
  for (let i = 0; i < deltas.length; i++) {
    if (i < period) { out.push(null); continue; }
    if (i === period) { ag = deltas.slice(1, period + 1).filter(d => d > 0).reduce((a, b) => a + b, 0) / period; al = deltas.slice(1, period + 1).filter(d => d < 0).reduce((a, b) => a + Math.abs(b), 0) / period; }
    else {
      const d = deltas[i];
      ag = (ag * (period - 1) + (d > 0 ? d : 0)) / period;
      al = (al * (period - 1) + (d < 0 ? Math.abs(d) : 0)) / period;
    }
    if (al === 0) { out.push(100); } else { const rs = ag / al; out.push(100 - 100 / (1 + rs)); }
  }
  return out;
}

function macd(closes) {
  const ema12 = [], ema26 = [], signal = [], histogram = [];
  for (let i = 0; i < closes.length; i++) {
    const m12 = i === 0 ? closes[0] : ema12[i - 1] + 2 / 13 * (closes[i] - ema12[i - 1]);
    ema12.push(m12);
    const m26 = i === 0 ? closes[0] : ema26[i - 1] + 2 / 27 * (closes[i] - ema26[i - 1]);
    ema26.push(m26);
    if (i >= 8) {
      const prev = i === 9 ? (ema12[8] - ema26[8]) : histogram.length === 0 ? null : histogram[histogram.length - 1];
      // signal line (EMA9 of MACD)
      const macdLine = m12 - m26;
      if (signal.length === 0) signal.push(macdLine); else signal.push(signal[signal.length - 1] + 2 / 10 * (macdLine - signal[signal.length - 1]));
      histogram.push(prev === null ? null : macdLine - signal[signal.length - 1]);
    } else { signal.push(null); histogram.push(null); }
  }
  return { ema12: ema12[ema12.length - 1], ema26: ema26[ema26.length - 1], macdLine: ema12[ema12.length - 1] - ema26[ema26.length - 1], signal: signal[signal.length - 1], histogram: histogram[histogram.length - 1] };
}

function computeIndicators(prices) {
  const closes = prices.map(p => p.close);
  const vol = prices.map(p => p.volume);
  const ma5 = sma(closes, 5), ma20 = sma(closes, 20), ma50 = sma(closes, 50), ma200 = sma(closes, 200);
  const latest = closes.length - 1;
  return {
    currentPrice: closes[latest],
    prevClose: closes[latest - 1],
    changePct: ((closes[latest] - closes[latest - 1]) / closes[latest - 1] * 100).toFixed(2),
    ret1w: latest >= 5 ? ((closes[latest] - closes[latest - 5]) / closes[latest - 5] * 100).toFixed(2) : null,
    ret1m: latest >= 20 ? ((closes[latest] - closes[latest - 20]) / closes[latest - 20] * 100).toFixed(2) : null,
    ret3m: latest >= 60 ? ((closes[latest] - closes[latest - 60]) / closes[latest - 60] * 100).toFixed(2) : null,
    ret6m: latest >= 120 ? ((closes[latest] - closes[latest - 120]) / closes[latest - 120] * 100).toFixed(2) : null,
    ret1y: latest >= 250 ? ((closes[latest] - closes[latest - 250]) / closes[latest - 250] * 100).toFixed(2) : null,
    ma5: ma5[latest], ma20: ma20[latest], ma50: ma50[latest], ma200: ma200[latest],
    priceVsMa5: ma5[latest] ? ((closes[latest] / ma5[latest] - 1) * 100).toFixed(2) : null,
    priceVsMa20: ma20[latest] ? ((closes[latest] / ma20[latest] - 1) * 100).toFixed(2) : null,
    priceVsMa50: ma50[latest] ? ((closes[latest] / ma50[latest] - 1) * 100).toFixed(2) : null,
    priceVsMa200: ma200[latest] ? ((closes[latest] / ma200[latest] - 1) * 100).toFixed(2) : null,
    rsi: rsi(closes)[latest],
    macd: macd(closes),
    avgVol20d: vol.slice(-20).reduce((a, b) => a + b, 0) / 20,
    lastVol: vol[latest],
    high52w: Math.max(...closes.slice(-250)),
    low52w: Math.min(...closes.slice(-250)),
    volatility20d: (() => {
      const r = []; for (let i = closes.length - 20; i < closes.length; i++) if (closes[i - 1]) r.push(Math.log(closes[i] / closes[i - 1]));
      const mean = r.reduce((a, b) => a + b, 0) / r.length;
      const std = Math.sqrt(r.reduce((a, b) => a + (b - mean) ** 2, 0) / r.length);
      return (std * Math.sqrt(252) * 100).toFixed(2);
    })()
  };
}

// ─── Google News RSS ────────────────────────────────────────────────
async function getNews(symbol, days = 30) {
  const url = `https://news.google.com/rss/search?q=ticker:${symbol}+stock&hl=en-US&gl=US&ceid=US:en`;
  const { body } = await fetchUrl(url);
  const parsed = await parseStringPromise(body);
  const items = parsed.rss.channel[0].item || [];
  const articles = items.slice(0, 20).map(it => ({
    title: it.title?.[0] || '',
    link: it.link?.[0] || '',
    source: it.source?.[0]?.['$']?.value || it.source?.[0] || '',
    pubDate: it.pubDate?.[0] || ''
  }));
  // Simple sentiment heuristic based on title keywords
  const bullWords = ['upgrade', 'bullish', 'buy', 'surge', 'rally', 'beat', 'growth', 'record', 'high', 'win', 'gain', 'strong'];
  const bearWords = ['downgrade', 'bearish', 'sell', 'crash', 'drop', 'miss', 'loss', 'risk', 'warn', 'layoff', 'fine', 'sue', 'fraud', 'danger'];
  let score = 0, count = 0;
  for (const a of articles) {
    const text = (a.title + ' ' + a.source).toLowerCase();
    const bCount = bullWords.filter(w => text.includes(w)).length;
    const baCount = bearWords.filter(w => text.includes(w)).length;
    if (bCount > 0 || baCount > 0) { score += (bCount - baCount); count++; }
  }
  const netScore = count > 0 ? (score / count).toFixed(2) : '0.00';
  return { articles, netScore, totalArticles: articles.length };
}

module.exports = { getPrices, getNews, computeIndicators, sma, rsi, macd };
