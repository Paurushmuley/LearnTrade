'use client';

import React, { useEffect, useRef } from 'react';
import { Candle, Position, TickerInfo } from '../types/trading';
import { createChart, ColorType, IChartApi, ISeriesApi } from 'lightweight-charts';
import { POPULAR_TICKERS } from '../lib/marketData';
import { ChevronDown, Clock, Eye, Layers } from 'lucide-react';

interface ChartTerminalProps {
  selectedTicker: TickerInfo;
  candles: Candle[];
  timeframe: string;
  positions: Position[];
  onSelectTicker: (ticker: TickerInfo) => void;
  onSelectTimeframe: (tf: string) => void;
}

export const ChartTerminal: React.FC<ChartTerminalProps> = ({
  selectedTicker,
  candles,
  timeframe,
  positions,
  onSelectTicker,
  onSelectTimeframe,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  const activePosition = positions.find(p => p.symbol === selectedTicker.symbol);
  const timeframes = ['1m', '5m', '15m', '1H', '1D'];

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Initialize Lightweight Chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0B0E14' },
        textColor: '#94A3B8',
        fontSize: 12,
      },
      grid: {
        vertLines: { color: 'rgba(30, 41, 59, 0.4)' },
        horzLines: { color: 'rgba(30, 41, 59, 0.4)' },
      },
      crosshair: {
        vertLine: { color: '#38BDF8', width: 1, style: 2 },
        horzLine: { color: '#38BDF8', width: 1, style: 2 },
      },
      rightPriceScale: {
        borderColor: '#1E293B',
        scaleMargins: { top: 0.1, bottom: 0.15 },
      },
      timeScale: {
        borderColor: '#1E293B',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#10B981',
      downColor: '#EF4444',
      borderUpColor: '#10B981',
      borderDownColor: '#EF4444',
      wickUpColor: '#10B981',
      wickDownColor: '#EF4444',
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Update candlestick series data
  useEffect(() => {
    if (!seriesRef.current || candles.length === 0) return;

    const formattedData = candles.map(c => ({
      time: c.time as any,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    seriesRef.current.setData(formattedData);
  }, [candles]);

  const latestCandle = candles[candles.length - 1];

  return (
    <div className="flex flex-col h-full bg-[#0B0E14] border border-slate-800 rounded-xl overflow-hidden shadow-xl">
      {/* Chart Top Control Bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800 bg-[#0F141F]/80 px-3 py-2 gap-2 text-xs">
        {/* Ticker Selector Dropdown */}
        <div className="flex items-center gap-3">
          <div className="relative group">
            <select
              value={selectedTicker.symbol}
              onChange={(e) => {
                const found = POPULAR_TICKERS.find(t => t.symbol === e.target.value);
                if (found) onSelectTicker(found);
              }}
              className="bg-slate-900 border border-slate-700 text-slate-100 font-bold text-sm rounded-lg px-2.5 py-1.5 pr-8 appearance-none focus:outline-none focus:border-blue-500 cursor-pointer shadow-inner"
            >
              {POPULAR_TICKERS.map(t => (
                <option key={t.symbol} value={t.symbol}>
                  {t.symbol} — {t.name}
                </option>
              ))}
            </select>
            <ChevronDown className="h-4 w-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Quick Sector & Price details */}
          <div className="hidden sm:flex items-center gap-3 pl-2 border-l border-slate-800">
            <div>
              <span className="text-slate-400 text-[10px] block">LTP</span>
              <span className="font-bold text-slate-100 text-sm">
                ₹{selectedTicker.currentPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block">24h Chg</span>
              <span className={`font-semibold text-xs ${selectedTicker.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {selectedTicker.change >= 0 ? '+' : ''}{selectedTicker.change.toFixed(2)} ({selectedTicker.changePercent.toFixed(2)}%)
              </span>
            </div>
            <div className="hidden md:block">
              <span className="text-slate-400 text-[10px] block">Day Range</span>
              <span className="text-slate-300 text-xs">
                ₹{selectedTicker.dayLow} - ₹{selectedTicker.dayHigh}
              </span>
            </div>
          </div>
        </div>

        {/* Timeframe Buttons */}
        <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 p-0.5 rounded-lg">
          {timeframes.map(tf => (
            <button
              key={tf}
              onClick={() => onSelectTimeframe(tf)}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                timeframe === tf
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Active Position Overlay Notice */}
      {activePosition && (
        <div className="bg-blue-950/40 border-b border-blue-900/60 px-3 py-1 flex items-center justify-between text-[11px]">
          <span className="text-blue-300 flex items-center gap-1.5 font-medium">
            <span className="h-2 w-2 rounded-full bg-blue-400 animate-ping" />
            Open Position: {activePosition.quantity > 0 ? 'LONG' : 'SHORT'} {Math.abs(activePosition.quantity)} Qty @ Avg ₹{activePosition.averagePrice}
          </span>
          <span className={`font-bold ${activePosition.unrealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            Live P&L: {activePosition.unrealizedPnL >= 0 ? '+' : ''}₹{activePosition.unrealizedPnL.toFixed(2)}
          </span>
        </div>
      )}

      {/* Main Lightweight Chart Canvas Container */}
      <div className="flex-1 w-full min-h-[380px] relative" ref={chartContainerRef}>
        {/* Real-time Watermark */}
        <div className="absolute left-4 bottom-4 pointer-events-none opacity-20 text-slate-400 text-xs font-mono">
          TRADECRAFT AI • CANDLE TICK FEED • {selectedTicker.symbol}
        </div>
      </div>
    </div>
  );
};
