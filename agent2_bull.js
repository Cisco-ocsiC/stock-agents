// stock_agents/agent2_bull.js — builds bull case
'use strict';
const { getPrices, computeIndicators } = require('./data_fetcher');

async function analyze(symbol) {
  const { meta, prices } = await getPrices(symbol);
  const ind = computeIndicators(prices);

  const points = [];
  let confidence = 0.5;

  // Technical bullish signals
  if (ind.currentPrice > ind.ma50 && ind.ma50 > ind.ma200) {
    points.push('Price > MA50 > MA200 (golden alignment)');
    confidence += 0.1;
  }
  if (ind.rsi && ind.rsi >= 50 && ind.rsi <= 70) {
    points.push(`RSI=${ind.rsi.toFixed(1)} (bullish momentum zone)`);
    confidence += 0.05;
  }
  if (ind.macd.histogram && ind.macd.histogram > 0) {
    points.push('MACD histogram positive (momentum up)');
    confidence += 0.05;
  }
  if (ind.ret3m && parseFloat(ind.ret3m) > 10) {
    points.push(`3-month return +${ind.ret3m}% (strong trend)`);
    confidence += 0.1;
  }
  if (ind.priceVsMa200 && parseFloat(ind.priceVsMa200) > 10) {
    points.push(`+${ind.priceVsMa200}% vs MA200 (far above long-term avg)`);
    confidence += 0.05;
  }
  if (ind.low52w && ind.currentPrice > ind.high52w * 0.9) {
    points.push(`Near 52-week high (${(ind.currentPrice / ind.high52w * 100).toFixed(0)}%)`);
    confidence += 0.05;
  }
  if (ind.lastVol > ind.avgVol20d * 1.2) {
    points.push('Volume surge (>120% of 20d avg)');
    confidence += 0.05;
  }
  if (ind.changePct && parseFloat(ind.changePct) > 2) {
    points.push(`Strong daily close (+${ind.changePct}%)`);
    confidence += 0.03;
  }

  const thesis = `${symbol} shows strong technical momentum with ${points.length} bullish signals identified.`;

  return {
    symbol,
    perspective: 'bull',
    thesis,
    keyPoints: points,
    metrics: {
      currentPrice: ind.currentPrice,
      rsi: ind.rsi,
      macdHistogram: ind.macd.histogram,
      priceVsMA50: ind.priceVsMa50,
      priceVsMA200: ind.priceVsMa200,
      ret3m: ind.ret3m,
      ret1y: ind.ret1y,
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
