'use client';

import React, { useEffect, useState } from 'react';
import { AIConfig, Candle, Order, OrderSide, OrderType, Position, ProductType, TickerInfo } from '../types/trading';
import { POPULAR_TICKERS, generateHistoricalCandles, CrisisScenario } from '../lib/marketData';
import { checkPendingOrders, getPortfolioSummary, INITIAL_TRADING_STATE, placeOrder, TradingState } from '../lib/tradingEngine';
import { OptionLeg, StrategyPayoffResult } from '../lib/optionsEngine';
import { Header } from '../components/Header';
import { ChartTerminal } from '../components/ChartTerminal';
import { OrderTicket } from '../components/OrderTicket';
import { PortfolioDrawer } from '../components/PortfolioDrawer';
import { BYOKModal } from '../components/BYOKModal';
import { StrategyBuilderModal } from '../components/StrategyBuilderModal';
import { CrisisSimulatorModal } from '../components/CrisisSimulatorModal';
import { OptionChainModal } from '../components/OptionChainModal';

export default function TradingTerminalPage() {
  const [tradingState, setTradingState] = useState<TradingState>(INITIAL_TRADING_STATE);
  const [selectedTicker, setSelectedTicker] = useState<TickerInfo>(POPULAR_TICKERS[0]);
  const [timeframe, setTimeframe] = useState<string>('5m');
  const [candles, setCandles] = useState<Candle[]>([]);

  // Modals state
  const [isBYOKOpen, setIsBYOKOpen] = useState(false);
  const [isStrategyOpen, setIsStrategyOpen] = useState(false);
  const [isCrisisOpen, setIsCrisisOpen] = useState(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);

  // BYOK Configuration from localStorage
  const [aiConfig, setAIConfig] = useState<AIConfig>({
    provider: 'gemini',
    geminiKey: '',
    openaiKey: '',
    ollamaUrl: 'http://localhost:11434',
  });

  // Load persisted state & AI keys on mount
  useEffect(() => {
    try {
      const savedConfig = localStorage.getItem('tradecraft_byok_config');
      if (savedConfig) {
        setAIConfig(JSON.parse(savedConfig));
      }
      const savedState = localStorage.getItem('tradecraft_trading_state');
      if (savedState) {
        setTradingState(JSON.parse(savedState));
      }
    } catch {
      // fallback to initial
    }
  }, []);

  // Persist trading state
  useEffect(() => {
    try {
      localStorage.setItem('tradecraft_trading_state', JSON.stringify(tradingState));
    } catch {
      // ignore quota
    }
  }, [tradingState]);

  // Generate initial candles whenever selected ticker or timeframe changes
  useEffect(() => {
    const initialCandles = generateHistoricalCandles(selectedTicker.currentPrice, timeframe, 80);
    setCandles(initialCandles);
  }, [selectedTicker.symbol, timeframe]);

  // Live Real-Time Market Tick Simulation (Every 1.8 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      setCandles((prevCandles) => {
        if (!prevCandles || prevCandles.length === 0) return prevCandles;

        const lastCandle = { ...prevCandles[prevCandles.length - 1] };
        const tickDrift = (Math.random() - 0.495) * (lastCandle.close * 0.0006);
        const newClose = Number((lastCandle.close + tickDrift).toFixed(2));
        const newHigh = Number(Math.max(lastCandle.high, newClose).toFixed(2));
        const newLow = Number(Math.min(lastCandle.low, newClose).toFixed(2));
        const newVolume = (lastCandle.volume || 1000) + Math.floor(Math.random() * 250);

        lastCandle.close = newClose;
        lastCandle.high = newHigh;
        lastCandle.low = newLow;
        lastCandle.volume = newVolume;

        // Update selected ticker price
        setSelectedTicker((prev) => ({
          ...prev,
          currentPrice: newClose,
          change: Number((newClose - prev.previousClose).toFixed(2)),
          changePercent: Number((((newClose - prev.previousClose) / prev.previousClose) * 100).toFixed(2)),
        }));

        // Check if any pending limit or stop-loss orders trigger at this price
        setTradingState((prevState) => {
          return checkPendingOrders(prevState, { [selectedTicker.symbol]: newClose });
        });

        return [...prevCandles.slice(0, prevCandles.length - 1), lastCandle];
      });
    }, 1800);

    return () => clearInterval(interval);
  }, [selectedTicker.symbol]);

  // Order Placement
  const handlePlaceOrder = (params: {
    symbol: string;
    side: OrderSide;
    type: OrderType;
    product: ProductType;
    quantity: number;
    price?: number;
    triggerPrice?: number;
  }) => {
    const res = placeOrder(tradingState, {
      ...params,
      currentMarketPrice: selectedTicker.currentPrice,
    });

    if (res.error) {
      return { success: false, error: res.error };
    }

    setTradingState(res.newState);
    return { success: true };
  };

  // Square Off Position
  const handleSquareOff = (symbol: string, product: ProductType) => {
    const position = tradingState.positions.find((p) => p.symbol === symbol && p.product === product);
    if (!position) return;

    const side: OrderSide = position.quantity > 0 ? 'SELL' : 'BUY';
    const quantity = Math.abs(position.quantity);

    handlePlaceOrder({
      symbol,
      side,
      type: 'MARKET',
      product,
      quantity,
    });
  };

  // Reset Account Sandbox
  const handleResetAccount = () => {
    if (window.confirm('Reset virtual capital to ₹10,00,000 and clear order history?')) {
      setTradingState(INITIAL_TRADING_STATE);
      localStorage.removeItem('tradecraft_trading_state');
    }
  };

  // Save BYOK Config
  const handleSaveConfig = (newConfig: AIConfig) => {
    setAIConfig(newConfig);
    localStorage.setItem('tradecraft_byok_config', JSON.stringify(newConfig));
  };

  // Load Historical Crisis Scenario
  const handleLoadScenario = (scenario: CrisisScenario) => {
    const matchedTicker = POPULAR_TICKERS.find((t) => t.symbol === scenario.symbol) || selectedTicker;
    setSelectedTicker(matchedTicker);
    setCandles(scenario.candles);
  };

  // Execute Multi-Leg Options Strategy
  const handleExecuteOptionsStrategy = (legs: OptionLeg[], payoff: StrategyPayoffResult) => {
    if (legs.length === 0) return;

    let updatedCash = tradingState.availableCash - payoff.totalStatutoryTaxes;
    let updatedPositions = [...tradingState.positions];
    let newOrders: Order[] = [];

    const lotSize = selectedTicker.symbol === 'BANKNIFTY' ? 15 : 25;

    legs.forEach((leg) => {
      const optionSymbol = `${selectedTicker.symbol} ${leg.strike} ${leg.optionType}`;
      const signedQty = leg.side === 'BUY' ? leg.quantity * lotSize : -leg.quantity * lotSize;
      const legInvested = leg.premium * Math.abs(signedQty);

      if (leg.side === 'BUY') {
        updatedCash -= legInvested;
      } else {
        updatedCash += legInvested;
      }

      const newOrder: Order = {
        id: 'OPT-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
        symbol: optionSymbol,
        side: leg.side,
        type: 'MARKET',
        product: 'MIS',
        quantity: Math.abs(signedQty),
        executedPrice: leg.premium,
        status: 'FILLED',
        placedAt: new Date().toISOString(),
        executedAt: new Date().toISOString(),
        charges: {
          brokerage: 20,
          stt: leg.side === 'SELL' ? legInvested * 0.001 : 0,
          exchangeCharges: legInvested * 0.0005,
          sebiCharges: legInvested * 0.000001,
          stampDuty: leg.side === 'BUY' ? legInvested * 0.00003 : 0,
          gst: 3.6,
          totalCharges: Number((20 + (leg.side === 'SELL' ? legInvested * 0.001 : 0) + 3.6).toFixed(2)),
          breakevenPerShare: 0,
        },
      };

      newOrders.push(newOrder);

      updatedPositions.push({
        symbol: optionSymbol,
        product: 'MIS',
        quantity: signedQty,
        averagePrice: leg.premium,
        currentPrice: leg.premium,
        investedAmount: legInvested,
        unrealizedPnL: 0,
        unrealizedPnLPercent: 0,
        realizedPnL: 0,
        totalChargesPaid: newOrder.charges.totalCharges,
        netPnL: -newOrder.charges.totalCharges,
      });
    });

    setTradingState((prev) => ({
      ...prev,
      availableCash: Number(updatedCash.toFixed(2)),
      positions: updatedPositions,
      orders: [...newOrders, ...prev.orders],
    }));

    setIsOptionsOpen(false);
  };

  const marketPrices = { [selectedTicker.symbol]: selectedTicker.currentPrice };
  const portfolioSummary = getPortfolioSummary(tradingState, marketPrices);

  return (
    <div className="flex flex-col min-h-screen bg-[#0B0E14] text-slate-100">
      {/* Universal Header with Live Financial Bar */}
      <Header
        portfolio={portfolioSummary}
        aiConfig={aiConfig}
        onOpenOptions={() => setIsOptionsOpen(true)}
        onOpenBYOK={() => setIsBYOKOpen(true)}
        onOpenStrategy={() => setIsStrategyOpen(true)}
        onOpenCrisis={() => setIsCrisisOpen(true)}
        onResetAccount={handleResetAccount}
      />

      {/* Main Terminal Workspace */}
      <main className="flex-1 p-3 grid grid-cols-1 lg:grid-cols-12 gap-3 max-w-[1800px] w-full mx-auto">
        {/* Left Column (8 cols on desktop): Chart + Portfolio Drawer */}
        <div className="lg:col-span-8 xl:col-span-9 flex flex-col gap-3 min-h-[750px]">
          {/* Chart Terminal */}
          <div className="flex-1 min-h-[460px]">
            <ChartTerminal
              selectedTicker={selectedTicker}
              candles={candles}
              timeframe={timeframe}
              positions={tradingState.positions}
              onSelectTicker={(t) => setSelectedTicker(t)}
              onSelectTimeframe={(tf) => setTimeframe(tf)}
            />
          </div>

          {/* Portfolio & Order Drawer with AI Trade Journal */}
          <div>
            <PortfolioDrawer
              positions={tradingState.positions}
              orders={tradingState.orders}
              tradeAudits={tradingState.tradeAudits}
              aiConfig={aiConfig}
              onSquareOff={handleSquareOff}
            />
          </div>
        </div>

        {/* Right Column (4 cols on desktop): Order Ticket & Pre-Trade Taxes */}
        <div className="lg:col-span-4 xl:col-span-3">
          <OrderTicket
            ticker={selectedTicker}
            availableCash={tradingState.availableCash}
            onPlaceOrder={handlePlaceOrder}
          />
        </div>
      </main>

      {/* Modals */}
      <BYOKModal
        isOpen={isBYOKOpen}
        onClose={() => setIsBYOKOpen(false)}
        config={aiConfig}
        onSaveConfig={handleSaveConfig}
      />

      <StrategyBuilderModal
        isOpen={isStrategyOpen}
        onClose={() => setIsStrategyOpen(false)}
        candles={candles}
        symbol={selectedTicker.symbol}
      />

      <CrisisSimulatorModal
        isOpen={isCrisisOpen}
        onClose={() => setIsCrisisOpen(false)}
        onLoadScenario={handleLoadScenario}
      />

      <OptionChainModal
        isOpen={isOptionsOpen}
        onClose={() => setIsOptionsOpen(false)}
        spotPrice={selectedTicker.currentPrice}
        symbol={selectedTicker.symbol}
        aiConfig={aiConfig}
        onExecuteStrategy={handleExecuteOptionsStrategy}
      />
    </div>
  );
}
