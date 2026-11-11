// stock_agents/agent4_sentiment.js — news/social sentiment
'use strict';
const { getNews } = require('./data_fetcher');

async function analyze(symbol) {
  const newsData = await getNews(symbol, 30);
  const articles = newsData.articles;

  const scores = [];
  for (const a of articles) {
    const text = (a.title + ' ' + a.source).toLowerCase();
    const bullWords = ['upgrade', 'bullish', 'buy', 'surge', 'rally', 'beat', 'growth', 'record', 'high', 'win', 'gain', 'strong', 'profit', 'boost', 'momentum'];
    const bearWords = ['downgrade', 'bearish', 'sell', 'crash', 'drop', 'miss', 'loss', 'risk', 'warn', 'layoff', 'fine', 'sue', 'fraud', 'danger', 'threat', 'decline', 'warning'];
    const bCount = bullWords.filter(w => text.includes(w)).length;
    const baCount = bearWords.filter(w => text.includes(w)).length;
    scores.push(Math.max(-1, Math.min(1, (bCount - baCount) / Math.max(bCount + baCount, 1))));
  }

  const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  let overall = 'neutral';
  if (avgScore > 0.15) overall = 'bullish';
  else if (avgScore < -0.15) overall = 'bearish';

  return {
    symbol,
    overall,
    score: avgScore.toFixed(3),
    articleCount: articles.length,
    articles: articles.map(a => ({ title: a.title.slice(0, 80), source: a.source, date: a.pubDate })),
    sentimentBreakdown: { positive: scores.filter(s => s > 0).length, neutral: scores.filter(s => s === 0).length, negative: scores.filter(s => s < 0).length }
  };
}

module.exports = { analyze };
if (require.main === module) {
  const sym = process.argv[2] || 'AAPL';
  (async () => { console.log(JSON.stringify(await analyze(sym), null, 2)); })();
}
