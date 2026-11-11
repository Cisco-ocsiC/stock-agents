// stock_agents/agent5_synthesis.js — combines all analyses into verdict
'use strict';

function synthesize(screenResult, bull, bear, sentiment) {
  const { symbol, price } = screenResult;

  // ── Weighted scoring ─────────────────────────────────────────────
  // Screen score → normalized 0-1 (screen max ~100)
  const screenNorm = Math.min(screenResult.score / 100, 1);

  // Bull conviction × confidence
  const bullScore = parseFloat(bull.confidence) * (bull.keyPoints.length / 8);

  // Bear conviction × confidence (inverted — more bear points = worse)
  const bearScore = parseFloat(bear.confidence) * (bear.keyPoints.filter(p =>
    p.includes('below') || p.includes('negative') || p.includes('risk') || p.includes('drop') || p.includes('weak')
  ).length / 5);

  // Sentiment score (-1 to 1 → 0 to 1)
  const sentScore = (parseFloat(sentiment.score) + 1) / 2;

  // Alignment: do bull and bear agree on key factors?
  const bearishPointsInBull = bull.keyPoints.filter(bp =>
    bear.keyPoints.some(bb => bp.includes(bb.split('(')[0].trim().slice(0, 10)))
  ).length;
  const alignmentScore = 1 - bearishPointsInBull / Math.max(bull.keyPoints.length, 1);

  // ── Composite score ──────────────────────────────────────────────
  // Weights: screen 20%, bull 25%, bear (inverted) 25%, sentiment 15%, alignment 15%
  const composite =
    screenNorm * 0.20 +
    Math.min(bullScore, 1) * 0.25 +
    (1 - Math.min(bearScore, 1)) * 0.25 +
    sentScore * 0.15 +
    alignmentScore * 0.15;

  // ── Recommendation ───────────────────────────────────────────────
  let recommendation = 'hold';
  if (composite >= 0.65) recommendation = 'buy';
  else if (composite >= 0.55) recommendation = 'accumulate';
  else if (composite < 0.35) recommendation = 'sell';
  else if (composite < 0.45) recommendation = 'underweight';

  // ── Target prices (risk-managed) ────────────────────────────────
  const rawVol = parseFloat(screenResult.ind?.volatility20d || 30);
  const vol20d = isNaN(rawVol) ? 30 : rawVol;
  const atrProxy = price * (vol20d / 100) / Math.sqrt(252);
  const high52w = screenResult.ind?.high52w || price * 1.1;
  const low52w = screenResult.ind?.low52w || price * 0.9;
  const distToHigh = ((price / Math.max(high52w, 0.01)) - 1) * 100;
  const distFromLow = ((price / Math.max(low52w, 0.01)) - 1) * 100;
  // Take conservative of distance-to-high vs distance-from-low
  const riskMargin = Math.min(Math.abs(distToHigh), distFromLow, 30) / 100;
  const tp1Pct = Math.max(0.04, Math.min(0.12, riskMargin + 0.03));
  const tp2Pct = tp1Pct + (tp1Pct * 0.7);
  const slPct = Math.max(0.04, Math.min(0.12, atrProxy / price));
  const entryPrice = price;
  const tp1 = +(entryPrice * (1 + tp1Pct)).toFixed(2);
  const tp2 = +(entryPrice * (1 + tp2Pct)).toFixed(2);
  const sl = +(entryPrice * (1 - slPct)).toFixed(2);
  const rrRatio = sl < entryPrice ? ((tp2 - entryPrice) / (entryPrice - sl)).toFixed(2) : 'N/A';

  return {
    symbol,
    recommendation,
    compositeScore: composite.toFixed(3),
    entryPrice,
    tp1,
    tp2,
    sl,
    riskRewardRatio: rrRatio,
    timeHorizon: '1-3 months',
    weightBreakdown: {
      screen: screenNorm.toFixed(3),
      bull: Math.min(bullScore, 1).toFixed(3),
      bear: Math.min(bearScore, 1).toFixed(3),
      sentiment: sentScore.toFixed(3),
      alignment: alignmentScore.toFixed(3)
    },
    summary: {
      bullCase: bull.thesis,
      bearCase: bear.thesis,
      sentimentSummary: `News sentiment: ${sentiment.overall} (${sentiment.score}/1), ${sentiment.articleCount} articles analyzed`
    },
    keyRisks: bear.keyPoints.slice(0, 5),
    catalysts: bull.keyPoints.slice(0, 5),
    confidence: composite.toFixed(2),
    agentOutputs: { screen: screenResult, bull, bear, sentiment }
  };
}

module.exports = { synthesize };
if (require.main === module) {
  const input = JSON.parse(require('fs').readFileSync(process.argv[2], 'utf8'));
  console.log(JSON.stringify(synthesize(input.screen, input.bull, input.bear, input.sentiment), null, 2));
}
