// stock_agents/agent3_bear.js — builds bear case
'use strict';
const { getPrices, computeIndicators } = require('./data_fetcher');

async function analyze(symbol) {
  const { meta, prices } = await getPrices(symbol);
  const ind = computeIndicators(prices);

  const points = [];
  let confidence = 0.5;

  // Technical bearish signals
  if (ind.currentPrice < ind.ma50) {
    points.push('Price below MA50 (short-term downtrend)');
    confidence += 0.1;
  }
  if (ind.rsi && ind.rsi < 40) {
    points.push(`RSI=${ind.rsi.toFixed(1)} (weak momentum, bearish territory)`);
    confidence += 0.1;
  }
  if (ind.rsi && ind.rsi > 75) {
    points.push(`RSI=${ind.rsi.toFixed(1)} (overbought, reversal risk)`);
    confidence += 0.08;
  }
  if (ind.macd.histogram && ind.macd.histogram < 0) {
    points.push('MACD histogram negative (momentum declining)');
    confidence += 0.08;
  }
  if (ind.ret3m && parseFloat(ind.ret3m) < -5) {
    points.push(`3-month return ${ind.ret3m}% (negative trend)`);
    confidence += 0.1;
  }
  if (ind.ret1w && parseFloat(ind.ret1w) < -3) {
    points.push(`1-week return ${ind.ret1w}% (recent weakness)`);
    confidence += 0.05;
  }
  if (ind.priceVsMa200 && parseFloat(ind.priceVsMa200) < -10) {
    points.push(`${ind.priceVsMa200}% below MA200 (significant discount but falling knife?)`);
    confidence += 0.05;
  }
  if (ind.volatility20d && parseFloat(ind.volatility20d) > 50) {
    points.push(`High volatility (${ind.volatility20d}%) — elevated risk`);
    confidence += 0.05;
  }
  if (ind.lastVol < ind.avgVol20d * 0.5) {
    points.push('Volume drought (<50% of 20d avg) — lack of interest');
    confidence += 0.05;
  }
  if (ind.changePct && parseFloat(ind.changePct) < -3) {
    points.push(`Sharp daily drop (${ind.changePct}%)`);
    confidence += 0.05;
  }
  // Check for recent lower highs
  const recentHighs = prices.slice(-20).map(p => p.high);
  const recentLows = prices.slice(-20).map(p => p.low);
  if (recentHighs.length >= 5) {
    const last3HighAvg = recentHighs.slice(-3).reduce((a, b) => a + b, 0) / 3;
    const prev3HighAvg = recentHighs.slice(-6, -3).reduce((a, b) => a + b, 0) / 3;
    if (last3HighAvg < prev3HighAvg) points.push('Lower highs forming (downtrend)');
  }
  if (points.length === 0) points.push('No clear bearish technical signal detected');

  const thesis = `${symbol} has ${points.filter(p => p.includes('risk') || p.includes('below') || p.includes('negative') || p.includes('drop') || p.includes('weak') || p.includes('drought') || p.includes('lower')).length} potential warning signs.`;

  return {
    symbol,
    perspective: 'bear',
    thesis,
    keyPoints: points,
    metrics: {
      currentPrice: ind.currentPrice,
      rsi: ind.rsi,
      macdHistogram: ind.macd.histogram,
      priceVsMA200: ind.priceVsMa200,
      ret3m: ind.ret3m,
      ret1w: ind.ret1w,
      volatility20d: ind.volatility20d
    },
    confidence: Math.min(confidence, 1.0).toFixed(2),
    sources: ['Yahoo Finance chart API']
  };
}

module.exports = { analyze };
if (require.main === module) {
  const sym = process.argv[2] || 'AAPL';
  (async () => { console.log(JSON.stringify(await analyze(sym), null, 2)); })();
}
