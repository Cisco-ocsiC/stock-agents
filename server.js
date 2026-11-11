// stock_agents/server.js — HTTP API wrapping the 5-agent pipeline
'use strict';
const express = require('express');
const path = require('path');
const { screen } = require('./agent1_screener');
const { analyze: bullAnalyze } = require('./agent2_bull');
const { analyze: bearAnalyze } = require('./agent3_bear');
const { analyze: sentimentAnalyze } = require('./agent4_sentiment');
const { synthesize } = require('./agent5_synthesis');
const fs = require('fs');

const app = express();
// Allow any origin — adjust if you want it restricted later
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── In-memory cache (results stay valid ~10 min) ────────────────
const resultsCache = new Map();

async function getOrRunAnalysis(symbol) {
  const key = symbol.toUpperCase();
  if (resultsCache.has(key) && Date.now() - resultsCache.get(key).ts < 600000) {
    return resultsCache.get(key).data;
  }
  // Run full pipeline
  const screenResult = await screen();
  const candidate = screenResult.candidates.find(c => c.symbol === key);
  if (!candidate) {
    // If not in screened top-5, still run analysts on it directly — grab price fresh
    const { computeIndicators } = require('./data_fetcher');
    const { meta, prices } = await require('./data_fetcher').getPrices(key);
    const ind = meta ? computeIndicators(prices) : null;
    const [bull, bear, sentiment] = await Promise.all([
      bullAnalyze(key), bearAnalyze(key), sentimentAnalyze(key)
    ]);
    const fallback = { symbol: key, name: meta?.shortName || key, price: ind?.currentPrice, score: 70, indicators: ind };
    const verdict = synthesize(fallback, bull, bear, sentiment);
    verdict.ticker = key;
    const result = { verdict, ticker: key, sourced: false, note: `${key} not in top-5 screened candidates; analyzed directly.` };
    resultsCache.set(key, { ts: Date.now(), data: result });
    return result;
  }
  const [bull, bear, sentiment] = await Promise.all([
    bullAnalyze(key), bearAnalyze(key), sentimentAnalyze(key)
  ]);
  const verdict = synthesize(candidate, bull, bear, sentiment);
  verdict.ticker = key;
  const result = { verdict, ticker: key, sourced: true, note: '' };
  resultsCache.set(key, { ts: Date.now(), data: result });
  return result;
}

// GET /api/screenshot → health
app.get('/api/ping', (req, res) => res.json({ ok: true, uptime: process.uptime().toFixed(0) + 's' }));

// POST /api/analyze?symbol=AAPL
app.post('/api/analyze', async (req, res) => {
  const sym = (req.body.symbol || '').toUpperCase().trim();
  if (!sym) return res.status(400).json({ error: 'Provide "symbol" e.g. {"symbol":"AAPL"}' });
  try {
    const result = await getOrRunAnalysis(sym);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/screen → top candidates only (no deep analysis)
app.get('/api/screen', async (req, res) => {
  try {
    const r = await screen();
    res.json(r);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/results/latest → last saved file
app.get('/api/results/latest', (req, res) => {
  const f = path.join(__dirname, 'output', 'analysis_results.json');
  if (!fs.existsSync(f)) return res.json({ exists: false });
  try {
    const d = JSON.parse(fs.readFileSync(f, 'utf8'));
    res.json({ exists: true, generatedAt: d.generatedAt, count: d.results.length, results: d.results });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET / → redirect to static frontend if present
app.get('/', (req, res) => {
  const index = path.join(__dirname, 'public', 'index.html');
  fs.existsSync(index) ? res.sendFile(index) : res.json({ msg: 'Stock Agents API running' });
});

const PORT = process.env.PORT || 8766;
app.listen(PORT, () => console.log(`Stock Agents API listening on http://localhost:${PORT}`));
