'use client';

import React from 'react';
import { Level2OrderBook } from '../lib/replayEngine';
import { ArrowDown, ArrowUp, BarChart2, Layers } from 'lucide-react';

interface MarketDepthDOMProps {
  orderBook: Level2OrderBook;
  symbol: string;
  onQuickOrder: (side: 'BUY' | 'SELL', price: number) => void;
}

export const MarketDepthDOM: React.FC<MarketDepthDOMProps> = ({
  orderBook,
  symbol,
  onQuickOrder,
}) => {
  const isBullishImbalance = orderBook.imbalancePercent >= 0;

  return (
    <div className="bg-[#0F141F] border border-slate-800 rounded-xl p-3 shadow-xl text-xs space-y-2.5">
      {/* Header with Spread & Imbalance */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-1.5">
          <BarChart2 className="h-4 w-4 text-blue-400" />
          <span className="font-bold text-slate-100">Level-2 Market Depth (DOM)</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span className="text-slate-400">Spread:</span>
          <span className="font-bold text-slate-200">₹{orderBook.spread}</span>
        </div>
      </div>

      {/* Bid-Ask Imbalance Gauge Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] font-mono text-slate-400">
          <span className="text-emerald-400 flex items-center gap-1">
            <ArrowUp className="h-3 w-3" /> Buyers: {(orderBook.totalBidQty).toLocaleString('en-IN')}
          </span>
          <span className="font-bold text-slate-200">
            Imbalance: <strong className={isBullishImbalance ? 'text-emerald-400' : 'text-rose-400'}>
              {isBullishImbalance ? '+' : ''}{orderBook.imbalancePercent}%
            </strong>
          </span>
          <span className="text-rose-400 flex items-center gap-1">
            Sellers: {(orderBook.totalAskQty).toLocaleString('en-IN')} <ArrowDown className="h-3 w-3" />
          </span>
        </div>
        <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden flex">
          <div
            className="bg-emerald-500 h-full transition-all duration-300"
            style={{ width: `${Math.max(5, Math.min(95, 50 + orderBook.imbalancePercent / 2))}%` }}
          />
          <div
            className="bg-rose-500 h-full transition-all duration-300 flex-1"
          />
        </div>
      </div>

      {/* 5-Level Depth Matrix */}
      <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
        {/* BIDS COLUMN (BUYERS) */}
        <div className="space-y-1">
          <div className="grid grid-cols-3 text-slate-500 text-[10px] px-1 font-sans">
            <span>Orders</span>
            <span className="text-right">Qty</span>
            <span className="text-right font-bold text-emerald-400">Bid (₹)</span>
          </div>
          {orderBook.bids.map((rung, i) => (
            <div
              key={i}
              onClick={() => onQuickOrder('BUY', rung.price)}
              className="relative p-1 rounded bg-slate-900/60 hover:bg-emerald-950/40 cursor-pointer transition border border-transparent hover:border-emerald-800/60 overflow-hidden"
              title="Click to place Limit Buy at this bid"
            >
              {/* Depth Volume Bar Background */}
              <div
                className="absolute left-0 top-0 bottom-0 bg-emerald-500/15 pointer-events-none transition-all duration-300"
                style={{ width: `${rung.percent}%` }}
              />
              <div className="relative grid grid-cols-3 z-10">
                <span className="text-slate-500 text-[10px]">{rung.orders}</span>
                <span className="text-right text-slate-300">{rung.quantity.toLocaleString('en-IN')}</span>
                <span className="text-right font-bold text-emerald-400">₹{rung.price}</span>
              </div>
            </div>
          ))}
        </div>

        {/* ASKS COLUMN (SELLERS) */}
        <div className="space-y-1">
          <div className="grid grid-cols-3 text-slate-500 text-[10px] px-1 font-sans">
            <span className="font-bold text-rose-400">Ask (₹)</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Orders</span>
          </div>
          {orderBook.asks.map((rung, i) => (
            <div
              key={i}
              onClick={() => onQuickOrder('SELL', rung.price)}
              className="relative p-1 rounded bg-slate-900/60 hover:bg-rose-950/40 cursor-pointer transition border border-transparent hover:border-rose-800/60 overflow-hidden"
              title="Click to place Limit Sell at this ask"
            >
              {/* Depth Volume Bar Background */}
              <div
                className="absolute right-0 top-0 bottom-0 bg-rose-500/15 pointer-events-none transition-all duration-300"
                style={{ width: `${rung.percent}%` }}
              />
              <div className="relative grid grid-cols-3 z-10">
                <span className="font-bold text-rose-400">₹{rung.price}</span>
                <span className="text-right text-slate-300">{rung.quantity.toLocaleString('en-IN')}</span>
                <span className="text-right text-slate-500 text-[10px]">{rung.orders}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-[10px] text-slate-500 text-center pt-0.5 border-t border-slate-800/60">
        Click any Bid or Ask row to route an instantaneous order to the matching engine.
      </div>
    </div>
  );
};
