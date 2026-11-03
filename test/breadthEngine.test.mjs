import test from 'node:test';
import assert from 'node:assert/strict';

function calculateMarketBreadth(advances = 32, declines = 16, unchanged = 2) {
  const total = Math.max(1, advances + declines + unchanged);
  const ratio = declines > 0 ? Number((advances / declines).toFixed(2)) : advances;
  let sentiment = 'NEUTRAL';
  if (ratio >= 2.5) sentiment = 'EXTREME_BULLISH';
  else if (ratio >= 1.3) sentiment = 'BULLISH';
  else if (ratio <= 0.4) sentiment = 'EXTREME_BEARISH';
  else if (ratio <= 0.75) sentiment = 'BEARISH';

  return {
    advances,
    declines,
    unchanged,
    ratio,
    sentiment,
    advancePercent: Number(((advances / total) * 100).toFixed(1)),
    declinePercent: Number(((declines / total) * 100).toFixed(1)),
    unchangedPercent: Number(((unchanged / total) * 100).toFixed(1)),
  };
}

function getSectoralHeatmap() {
  return [
    { sectorName: 'Banking & Financials', indexSymbol: 'NIFTY BANK', changePercent: 1.15 },
    { sectorName: 'Information Technology', indexSymbol: 'NIFTY IT', changePercent: 1.48 },
    { sectorName: 'Automobile', indexSymbol: 'NIFTY AUTO', changePercent: 0.72 },
    { sectorName: 'Metals & Mining', indexSymbol: 'NIFTY METAL', changePercent: -0.65 },
    { sectorName: 'Fast Moving Consumer Goods', indexSymbol: 'NIFTY FMCG', changePercent: 0.20 },
    { sectorName: 'Pharmaceuticals & Healthcare', indexSymbol: 'NIFTY PHARMA', changePercent: -0.42 },
    { sectorName: 'Real Estate & Infrastructure', indexSymbol: 'NIFTY REALTY', changePercent: 2.10 },
  ];
}

test('Market Breadth Engine - Advance/Decline Ratio & Sentiment Classifications', () => {
  // 35 advances to 10 declines -> ratio = 3.5 -> EXTREME_BULLISH
  const bullish = calculateMarketBreadth(35, 10, 5);
  assert.equal(bullish.ratio, 3.50);
  assert.equal(bullish.sentiment, 'EXTREME_BULLISH');
  assert.equal(bullish.advancePercent, 70.0);
  assert.equal(bullish.declinePercent, 20.0);

  // 10 advances to 30 declines -> ratio = 0.33 -> EXTREME_BEARISH
  const bearish = calculateMarketBreadth(10, 30, 10);
  assert.equal(bearish.ratio, 0.33);
  assert.equal(bearish.sentiment, 'EXTREME_BEARISH');

  // Zero declines edge case
  const zeroDeclines = calculateMarketBreadth(50, 0, 0);
  assert.equal(zeroDeclines.ratio, 50);
  assert.equal(zeroDeclines.sentiment, 'EXTREME_BULLISH');
});

test('Sectoral Heatmap Model - 7 Major Sectors Integrity', () => {
  const sectors = getSectoralHeatmap();
  assert.equal(sectors.length, 7);
  assert.ok(sectors.some(s => s.indexSymbol === 'NIFTY BANK'));
  assert.ok(sectors.some(s => s.indexSymbol === 'NIFTY IT'));
  assert.ok(sectors.some(s => s.indexSymbol === 'NIFTY REALTY'));
});
