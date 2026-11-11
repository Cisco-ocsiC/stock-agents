// stock_agents/agent1_screener.js — finds top candidates from universe
'use strict';
const { getPrices, computeIndicators } = require('./data_fetcher');

const UNIVERSE = [
  // Australian ASX (top liquified)
  'CBA.AX', 'BHP.AX', 'RIO.AX', 'WES.AX', 'NAB.AX', 'ANZ.AX', 'WOW.AX',
  'TLS.AX', 'FMG.AX', 'MQG.AX', 'TPG.AX', 'STO.AX', 'WDS.AX', 'QBE.AX',
  'COL.AX', 'ABS.AX', 'SCG.AX', 'CPU.AX', 'XRO.AX', 'S32.AX',
  // US mega-cap tech & leaders
  'AAPL', 'MSFT', 'NVDA', 'AMZN', 'META', 'GOOGL', 'AVGO', 'AMD', 'NFLX', 'LLY',
  'JPM', 'V', 'MA', 'UNH', 'JNJ', 'PG', 'HD', 'DIS', 'KO', 'PEP'
];

async function screen() {
  const results = [];
  for (const sym of UNIVERSE) {
    try {
      const { meta, prices } = await getPrices(sym);
      if (!prices || prices.length < 60) continue;
      const ind = computeIndicators(prices);
      if (!ind.ma200 || !ind.ma50) continue;

      // ── Scoring: tighter thresholds so only genuinely strong candidates score high ──
      let score = 0;
      const notes = [];

      // Momentum: price > MA50 > MA200 — strict (20 pts)
      if (ind.currentPrice > ind.ma50 && ind.ma50 > ind.ma200) { score += 20; notes.push('golden_alignment'); }
      else if (ind.currentPrice > ind.ma200) { score += 6; notes.push('above_ma200_only'); }

      // RSI zone (18 pts)
      if (ind.rsi !== null) {
        if (ind.rsi >= 45 && ind.rsi <= 65) { score += 18; notes.push('rsi_ideal'); }
        else if (ind.rsi >= 35 && ind.rsi < 45) { score += 10; notes.push('rsi_moderate'); }
        else if (ind.rsi > 75) { score += 2; notes.push('rsi_overbought_warn'); }
        else if (ind.rsi < 30) { score += 6; notes.push('rsi_oversold'); }
      }

      // Distance from MA200 — closer is better (trend healthy) (16 pts)
      if (ind.priceVsMa200 !== null) {
        const pvs200 = parseFloat(ind.priceVsMa200);
        if (pvs200 > 15) { score += 8; notes.push('far_above_ma200'); }
        else if (pvs200 > 5) { score += 16; notes.push('healthy_ma200_gap'); }
        else if (pvs200 > -5) { score += 10; notes.push('near_ma200'); }
        else { score -= 2; notes.push('below_ma200'); }
      }

      // 3-month return (18 pts)
      if (ind.ret3m !== null) {
        const r3 = parseFloat(ind.ret3m);
        if (r3 > 12) { score += 18; notes.push('strong_3m_return'); }
        else if (r3 > 6) { score += 14; notes.push('good_3m_return'); }
        else if (r3 > 0) { score += 6; notes.push('moderate_3m_return'); }
        else { score -= 4; notes.push('neg_3m_return'); }
      }

      // 6-month vs 3-month acceleration check (14 pts)
      if (ind.ret6m && ind.ret3m && parseFloat(ind.ret6m) > parseFloat(ind.ret3m)) {
        score += 14; notes.push('return_acceleration');
      } else if (ind.ret6m && parseFloat(ind.ret6m) > 5) {
        score += 7; notes.push('solid_6m_return');
      }

      // Volume healthy (10 pts)
      if (ind.lastVol > ind.avgVol20d * 0.9) { score += 10; notes.push('liquid'); }
      else if (ind.lastVol > ind.avgVol20d * 0.6) { score += 4; notes.push('thin_volume'); }

      // Volatility (14 pts) — ideal range 20-35%, not too quiet or crazy
      if (ind.volatility20d) {
        const vol = parseFloat(ind.volatility20d);
        if (vol >= 20 && vol <= 35) { score += 14; notes.push('ideal_volatility'); }
        else if (vol < 20) { score += 8; notes.push('low_volatility'); }
        else { score += 2; notes.push('high_volatility_warn'); }
      }

      results.push({ symbol: sym, name: meta.shortName || sym, sector: meta.exchangeShortName || 'Unknown', price: ind.currentPrice, score, indicators: ind, notes });
    } catch (e) { console.error(`  [ERR] ${sym}: ${e.message}`); }
  }
  // Sort by score descending, take top 5
  results.sort((a, b) => b.score - a.score);
  const top5 = results.slice(0, 5).map(r => ({
    symbol: r.symbol, name: r.name, sector: r.sector, price: r.price,
    score: r.score, rationale: r.notes.join(', '),
    ind: r.indicators
  }));
  return { candidates: top5 };
}

module.exports = { screen };
if (require.main === module) {
  (async () => { console.log(JSON.stringify(await screen(), null, 2)); })();
}
