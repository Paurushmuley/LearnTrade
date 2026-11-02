'use client';

import React, { useState } from 'react';
import { OrderSide, OrderType, ProductType, TickerInfo } from '../types/trading';
import { calculateRoundTripEstimate, calculateStatutoryCharges } from '../lib/taxEngine';
import { calculateRequiredMargin } from '../lib/tradingEngine';
import { AlertCircle, ArrowDown, ArrowUp, Calculator, Check, Info, ShieldCheck } from 'lucide-react';

interface OrderTicketProps {
  ticker: TickerInfo;
  availableCash: number;
  onPlaceOrder: (params: {
    symbol: string;
    side: OrderSide;
    type: OrderType;
    product: ProductType;
    quantity: number;
    price?: number;
    triggerPrice?: number;
  }) => { success: boolean; error?: string };
}

export const OrderTicket: React.FC<OrderTicketProps> = ({
  ticker,
  availableCash,
  onPlaceOrder,
}) => {
  const [side, setSide] = useState<OrderSide>('BUY');
  const [product, setProduct] = useState<ProductType>('MIS');
  const [type, setType] = useState<OrderType>('MARKET');
  const [quantity, setQuantity] = useState<number>(ticker.lotSize || 50);
  const [limitPrice, setLimitPrice] = useState<number>(ticker.currentPrice);
  const [triggerPrice, setTriggerPrice] = useState<number>(ticker.currentPrice * 0.98);
  const [stopLoss, setStopLoss] = useState<number>(Number((ticker.currentPrice * 0.99).toFixed(1)));
  const [target, setTarget] = useState<number>(Number((ticker.currentPrice * 1.02).toFixed(1)));
  const [feedback, setFeedback] = useState<{ message: string; isError: boolean } | null>(null);

  const effectivePrice = type === 'MARKET' ? ticker.currentPrice : limitPrice;
  const orderCharges = calculateStatutoryCharges(side, product, effectivePrice, quantity);
  const roundTrip = calculateRoundTripEstimate(product, effectivePrice, quantity, target);
  const requiredMargin = calculateRequiredMargin(product, effectivePrice, quantity);
  const hasSufficientMargin = availableCash >= requiredMargin + orderCharges.totalCharges;

  // Risk / Reward Ratio
  const riskPerShare = Math.abs(effectivePrice - stopLoss);
  const rewardPerShare = Math.abs(target - effectivePrice);
  const riskRewardRatio = riskPerShare > 0 ? (rewardPerShare / riskPerShare).toFixed(2) : '1.0';

  const handleExecute = () => {
    const res = onPlaceOrder({
      symbol: ticker.symbol,
      side,
      type,
      product,
      quantity,
      price: type === 'LIMIT' ? limitPrice : undefined,
      triggerPrice: (type === 'SL' || type === 'SL_M') ? triggerPrice : undefined,
    });

    if (res.success) {
      setFeedback({ message: `Order executed successfully: ${side} ${quantity} ${ticker.symbol}`, isError: false });
    } else {
      setFeedback({ message: res.error || 'Failed to place order', isError: true });
    }

    setTimeout(() => setFeedback(null), 4000);
  };

  return (
    <div className="flex flex-col bg-[#0F141F] border border-slate-800 rounded-xl p-4 shadow-xl text-xs h-full justify-between">
      <div>
        {/* Buy / Sell Tabs */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-900 rounded-lg mb-3">
          <button
            onClick={() => setSide('BUY')}
            className={`py-2 rounded-md font-bold flex items-center justify-center gap-1.5 transition ${
              side === 'BUY'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowUp className="h-4 w-4" />
            BUY
          </button>
          <button
            onClick={() => setSide('SELL')}
            className={`py-2 rounded-md font-bold flex items-center justify-center gap-1.5 transition ${
              side === 'SELL'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-900/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowDown className="h-4 w-4" />
            SELL
          </button>
        </div>

        {/* Product Type (MIS vs CNC) */}
        <div className="flex items-center justify-between mb-3 bg-slate-900/70 p-1.5 rounded-lg border border-slate-800">
          <span className="text-slate-400 font-medium pl-1">Product</span>
          <div className="flex gap-1">
            <button
              onClick={() => setProduct('MIS')}
              className={`px-3 py-1 rounded text-[11px] font-semibold transition ${
                product === 'MIS' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Intraday (MIS 5x)
            </button>
            <button
              onClick={() => setProduct('CNC')}
              className={`px-3 py-1 rounded text-[11px] font-semibold transition ${
                product === 'CNC' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Delivery (CNC 1x)
            </button>
          </div>
        </div>

        {/* Order Type Buttons */}
        <div className="grid grid-cols-4 gap-1.5 mb-3">
          {(['MARKET', 'LIMIT', 'SL', 'SL_M'] as OrderType[]).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`py-1 rounded text-[10px] font-semibold border transition ${
                type === t
                  ? 'bg-slate-800 border-blue-500 text-blue-400'
                  : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              {t === 'SL_M' ? 'SL-M' : t}
            </button>
          ))}
        </div>

        {/* Inputs: Quantity & Price */}
        <div className="space-y-2.5 mb-3">
          <div>
            <div className="flex justify-between text-slate-400 mb-1">
              <span>Quantity (Lot: {ticker.lotSize})</span>
              <span className="text-slate-500">Value: ₹{(effectivePrice * quantity).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-medium focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={() => setQuantity(ticker.lotSize)}
                className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-[10px] text-slate-300 font-mono"
              >
                1L
              </button>
              <button
                onClick={() => setQuantity(ticker.lotSize * 2)}
                className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-[10px] text-slate-300 font-mono"
              >
                2L
              </button>
            </div>
          </div>

          {type === 'LIMIT' && (
            <div>
              <span className="text-slate-400 block mb-1">Limit Price (₹)</span>
              <input
                type="number"
                step="0.05"
                value={limitPrice}
                onChange={(e) => setLimitPrice(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-medium focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          {(type === 'SL' || type === 'SL_M') && (
            <div>
              <span className="text-slate-400 block mb-1">Trigger Price (₹)</span>
              <input
                type="number"
                step="0.05"
                value={triggerPrice}
                onChange={(e) => setTriggerPrice(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-medium focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          {/* Stop Loss & Target for Risk Calculation */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
            <div>
              <span className="text-slate-400 block text-[10px] mb-1">Stop Loss (₹)</span>
              <input
                type="number"
                step="0.1"
                value={stopLoss}
                onChange={(e) => setStopLoss(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-100 text-[11px] focus:outline-none focus:border-rose-500"
              />
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] mb-1">Target (₹)</span>
              <input
                type="number"
                step="0.1"
                value={target}
                onChange={(e) => setTarget(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-100 text-[11px] focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
          <div className="flex justify-between items-center text-[10px] text-slate-400 px-1">
            <span>Risk/Reward: <strong className="text-blue-400">1 : {riskRewardRatio}</strong></span>
            <span>Est. Max Loss: <strong className="text-rose-400">₹{(riskPerShare * quantity).toFixed(1)}</strong></span>
          </div>
        </div>

        {/* Realistic Indian Statutory Charges Breakdown Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 mb-3 space-y-1 font-mono text-[11px]">
          <div className="flex items-center justify-between text-slate-300 font-sans font-bold border-b border-slate-800 pb-1 mb-1.5">
            <span className="flex items-center gap-1">
              <Calculator className="h-3.5 w-3.5 text-amber-400" />
              Statutory Tax Breakdown
            </span>
            <span className="text-amber-400">₹{orderCharges.totalCharges}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Brokerage:</span>
            <span>₹{orderCharges.brokerage}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>STT / CTT:</span>
            <span>₹{orderCharges.stt}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Exchange + SEBI:</span>
            <span>₹{(orderCharges.exchangeCharges + orderCharges.sebiCharges).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>GST (18%) + Stamp:</span>
            <span>₹{(orderCharges.gst + orderCharges.stampDuty).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-200 border-t border-slate-800/80 pt-1 mt-1 font-semibold">
            <span>Breakeven Per Share:</span>
            <span className="text-emerald-400">+₹{roundTrip.breakevenPoints} pts</span>
          </div>
        </div>
      </div>

      {/* Execution Action Footer */}
      <div>
        <div className="flex items-center justify-between text-[11px] mb-2 px-1">
          <span className="text-slate-400">Margin Required:</span>
          <span className={`font-bold ${hasSufficientMargin ? 'text-slate-100' : 'text-rose-400'}`}>
            ₹{Math.ceil(requiredMargin + orderCharges.totalCharges).toLocaleString('en-IN')}
          </span>
        </div>

        {feedback && (
          <div className={`p-2 rounded-lg text-xs mb-2 flex items-center gap-1.5 ${
            feedback.isError ? 'bg-rose-950/60 text-rose-300 border border-rose-800' : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800'
          }`}>
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{feedback.message}</span>
          </div>
        )}

        <button
          onClick={handleExecute}
          disabled={!hasSufficientMargin}
          className={`w-full py-2.5 rounded-xl font-bold text-sm tracking-wide transition shadow-lg flex items-center justify-center gap-2 ${
            !hasSufficientMargin
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              : side === 'BUY'
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30'
              : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/30'
          }`}
        >
          {side === 'BUY' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
          PLACE {side} ORDER
        </button>
      </div>
    </div>
  );
};
