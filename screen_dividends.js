// stock_agents/screen_dividends.js — screens for weekly/cash-flow stocks vs growth screener
'use strict';
const { getPrices } = require('./data_fetcher');

const CASH_FLOW_UNIVERSE = [
  // ASX high-yield / dividend payers
  'BHP.AX', 'CBA.AX', 'WES.AX', 'RIO.AX', 'FMG.AX', 'NAB.AX', 'ANZ.AX', 'WBC.AX',
  'WDS.AX', 'COL.AX', 'STO.AX', 'QBE.AX', 'TLS.AX', 'TCL.AX', 'S32.AX', 'MTS.AX',
  // US dividend champions
  'JNJ', 'PG', 'KO', 'PEP', 'VZ', 'T', 'MO', 'PM', 'IBM', 'AVGO',
  'ABBV', 'LLY', 'MCD', 'TXN', 'MMM', 'CAT', 'UPS', 'XOM', 'CVX', 'UNH'
];

async function screenDividends() {
  const results = [];
  for (const sym of CASH_FLOW_UNIVERSE) {
    try {
      const { meta, prices } = await getPrices(sym);
      if (!prices || prices.length < 60) continue;
      const price = prices[prices.length - 1].close;

      // Heuristic dividend estimates from publicly available patterns
      // A real system would need an API like Alpha Vantage or Finnhub
      let estimatedAnnualDividend = null;
      let yield_ = null;
      const name = (meta.shortName || sym).toUpperCase();

      // Rough known yields (approximate for demo — update with real data later)
      const KNOWN_YIELDS = {
        'VZ': 0.065, 'T': 0.06, 'MO': 0.045, 'PM': 0.042,
        'BHP.AX': 0.055, 'CBA.AX': 0.040, 'WBC.AX': 0.058, 'ANZ.AX': 0.06, 'NAB.AX': 0.055,
        'TLS.AX': 0.04, 'WDS.AX': 0.03, 'COL.AX': 0.035,
        'KO': 0.030, 'PEP': 0.028, 'JNJ': 0.032, 'PG': 0.025,
        'XOM': 0.035, 'CVX': 0.042, 'IBM': 0.038, 'AVGO': 0.015
      };
      yield_ = KNOWN_YIELDS[sym] || null;
      if (yield_) estimatedAnnualDividend = +(price * yield_).toFixed(2);
      else estimatedAnnualDividend = 'unknown';

      // Weekly income potential
      const weeklyPotential = estimatedAnnualDividend !== 'unknown' && typeof estimatedAnnualDividend === 'number'
        ? (estimatedAnnualDividend / 52).toFixed(2) : 'unknown';

      // Momentum check (is the trend healthy?)
      const ma50 = prices.slice(-50).reduce((a, b) => a + b.close, 0) / 50;
      const ma200 = prices.slice(-200).reduce((a, b) => a + b.close, 0) / 200;
      const aboveMA = price > ma50 && ma50 > ma200;
      const distFromHigh = ((price / Math.max(...prices.slice(-52).map(p => p.high))) - 1).toFixed(2);

      results.push({
        symbol: sym,
        name: name.slice(0, 28),
        price,
        yield_,
        annualDividend: estimatedAnnualDividend,
        weeklyIncome: weeklyPotential,
        pricePerShare: price.toFixed(2),
        aboveTrend: aboveMA ? 'YES' : 'NO',
        distFromHighPct: distFromHigh
      });
    } catch (e) { /* skip */ }
  }

  // Sort by weekly income descending
  results.sort((a, b) => {
    if (typeof a.weeklyIncome === 'number' && typeof b.weeklyIncome === 'number') return b.weeklyIncome - a.weeklyIncome;
    return 0;
  });
  return { results, cashNeededForTarget: (() => {
    // Portfolio allocation math:
    // Target $300/wk = $15,600/yr. At 3.5% avg yield → need $445,714 invested.
    // For $2,500 cap at 3.5% yield → ~$0.88/wk actual passive income.
    const targetWeekly = 300;
    const avgYield = 0.035;
    const capitalNeeded = (targetWeekly * 52) / avgYield;
    return {
      targetWeekly,
      avgYieldPercent: `${(avgYield * 100).toFixed(1)}%`,
      capitalNeededMonthly: `$${(capitalNeeded / 12).toFixed(0)}/mo`,
      capitalNeededTotal: `$${Math.round(capitalNeeded).toLocaleString()}`,
      currentWeeklyWith2500: `$${((2500 * avgYield) / 52).toFixed(2)}`
    };
  })() };
}

module.exports = { screenDividends };
if (require.main === module) {
  (async () => { console.log(JSON.stringify(await screenDividends(), null, 2)); })();
}
