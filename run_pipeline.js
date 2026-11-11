// stock_agents/run_pipeline.js — orchestrates the 5-agent pipeline
'use strict';
const fs = require('fs');
const path = require('path');
const { screen } = require('./agent1_screener');
const { analyze: bullAnalyze } = require('./agent2_bull');
const { analyze: bearAnalyze } = require('./agent3_bear');
const { analyze: sentimentAnalyze } = require('./agent4_sentiment');
const { synthesize } = require('./agent5_synthesis');

async function runPipeline(tickerOverride) {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     5-Agent Stock Analysis Pipeline                      ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // Phase 1: Agent 1 — Screen
  console.log('📊 [Agent 1] Screening universe...\n');
  const screenResult = await screen();
  console.log(`   Found ${screenResult.candidates.length} candidates\n`);
  for (const c of screenResult.candidates) {
    console.log(`   ${c.symbol.padEnd(6)} ${c.name.slice(0, 25).padEnd(25)} Score: ${String(c.score).padStart(3)}  ${c.rationale}`);
  }
  console.log('');

  // Phase 2: Agents 2-4 in parallel for each candidate
  console.log('📈 [Agents 2-4] Running bull/bear/sentiment analysis...\n');
  const results = [];

  for (const candidate of screenResult.candidates) {
    const sym = tickerOverride || candidate.symbol;
    if (tickerOverride && sym !== candidate.symbol) continue;  // skip non-target candidates
    console.log(`   Analyzing ${sym}...`);

    const [bull, bear, sentiment] = await Promise.all([
      bullAnalyze(sym),
      bearAnalyze(sym),
      sentimentAnalyze(sym)
    ]);

    // Phase 3: Agent 5 — Synthesis
    const verdict = synthesize(candidate, bull, bear, sentiment);
    verdict.ticker = sym;

    results.push(verdict);

    console.log(`   ✓ ${sym}: ${verdict.recommendation.toUpperCase()} (score: ${verdict.compositeScore})`);
  }

  // Final output
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║                     FINAL VERDICTS                       ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  for (const r of results) {
    console.log(`━━━ ${r.symbol} (${r.agentOutputs.screen.name}) ━━━`);
    console.log(`   Recommendation : ${r.recommendation.toUpperCase()}`);
    console.log(`   Score          : ${r.compositeScore}`);
    console.log(`   Entry Price    : $${r.entryPrice.toFixed(2)}`);
    console.log(`   TP1            : $${r.tp1.toFixed(2)} (+${((r.tp1/r.entryPrice-1)*100).toFixed(1)}%)`);
    console.log(`   TP2            : $${r.tp2.toFixed(2)} (+${((r.tp2/r.entryPrice-1)*100).toFixed(1)}%)`);
    console.log(`   Stop Loss      : $${r.sl.toFixed(2)} (-${((1-r.sl/r.entryPrice)*100).toFixed(1)}%)`);
    console.log(`   Risk/Reward    : ${r.riskRewardRatio}`);
    console.log(`   Confidence     : ${r.confidence}`);
    console.log(`   Bull Case      : ${r.summary.bullCase}`);
    console.log(`   Bear Case      : ${r.summary.bearCase}`);
    console.log(`   Key Risks      : ${r.keyRisks.slice(0, 3).join(' | ')}`);
    console.log('');
  }

  // Save full JSON
  const outPath = path.join(__dirname, 'output', 'analysis_results.json');
  fs.mkdirSync(path.join(__dirname, 'output'), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
  console.log(`📁 Full results saved to: ${outPath}`);

  return results;
}

// Parse CLI args
const tickerOverride = process.argv[2];
runPipeline(tickerOverride).catch(err => {
  console.error('Pipeline failed:', err.message);
  process.exit(1);
});
