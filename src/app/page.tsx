'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { AIConfig, Candle, Order, OrderSide, OrderType, Position, ProductType, TickerInfo } from '../types/trading';
import { POPULAR_TICKERS, generateHistoricalCandles, CrisisScenario } from '../lib/marketData';
import { checkPendingOrders, getPortfolioSummary, INITIAL_TRADING_STATE, placeOrder, TradingState } from '../lib/tradingEngine';
import { OptionLeg, StrategyPayoffResult } from '../lib/optionsEngine';
import { generateLevel2DOM, getReplaySpeedIntervalMs, sliceCandlesForReplay } from '../lib/replayEngine';
import { Header } from '../components/Header';
import { OrderTicket } from '../components/OrderTicket';
import { PortfolioDrawer } from '../components/PortfolioDrawer';
import { BYOKModal } from '../components/BYOKModal';
import { StrategyBuilderModal } from '../components/StrategyBuilderModal';
import { CrisisSimulatorModal } from '../components/CrisisSimulatorModal';
import { OptionChainModal } from '../components/OptionChainModal';
import { WebhookBotModal } from '../components/WebhookBotModal';
import { AnalyticsModal } from '../components/AnalyticsModal';
import { MarketBreadthModal } from '../components/MarketBreadthModal';
import { TradebookImportModal } from '../components/TradebookImportModal';
import { StockScreenerModal } from '../components/StockScreenerModal';
import { LeagueLeaderboardModal } from '../components/LeagueLeaderboardModal';
import { ProofOfAlphaModal } from '../components/ProofOfAlphaModal';
import { QuantWarRoomModal } from '../components/QuantWarRoomModal';
import { TradeCopierModal } from '../components/TradeCopierModal';
import { GreeksHedgerModal } from '../components/GreeksHedgerModal';
import { VolatilityOptimizerModal } from '../components/VolatilityOptimizerModal';
import { MicrostructureModal } from '../components/MicrostructureModal';
import { RoutingAlgorithm } from '../types/quantDesk';
import { ProofOfAlphaCertificate } from '../lib/proofEngine';
import { ReplayControlBar } from '../components/ReplayControlBar';
import { MarketDepthDOM } from '../components/MarketDepthDOM';
import { UserProfile } from '../types/user';
import { getCurrentUser, getUserTradingStateKey, DEMO_ACCOUNTS, sanitizeUserProfile, logoutUser } from '../lib/authService';
import { AuthModal } from '../components/AuthModal';
import { UserProfileModal } from '../components/UserProfileModal';
import { LandingPage } from '../components/LandingPage';

const ChartTerminal = dynamic(
  () => import('../components/ChartTerminal').then((mod) => mod.ChartTerminal),
  { ssr: false }
);

export default function TradingTerminalPage() {
  const [tradingState, setTradingState] = useState<TradingState>(INITIAL_TRADING_STATE);
  const [selectedTicker, setSelectedTicker] = useState<TickerInfo>(POPULAR_TICKERS[0]);
  const [timeframe, setTimeframe] = useState<string>('5m');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [fullCandleBuffer, setFullCandleBuffer] = useState<Candle[]>([]);

  // Replay State
  const [isReplayActive, setIsReplayActive] = useState(false);
  const [isReplayPlaying, setIsReplayPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState<1 | 2 | 5 | 10>(1);
  const [replayIndex, setReplayIndex] = useState(30);

  // Modals state
  const [isBYOKOpen, setIsBYOKOpen] = useState(false);
  const [isStrategyOpen, setIsStrategyOpen] = useState(false);
  const [isCrisisOpen, setIsCrisisOpen] = useState(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [isWebhookBotOpen, setIsWebhookBotOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [isBreadthOpen, setIsBreadthOpen] = useState(false);
  const [isTradebookOpen, setIsTradebookOpen] = useState(false);
  const [isScreenerOpen, setIsScreenerOpen] = useState(false);
  const [isLeaguesOpen, setIsLeaguesOpen] = useState(false);
  const [isQuantDeskOpen, setIsQuantDeskOpen] = useState(false);
  const [isCopierOpen, setIsCopierOpen] = useState(false);
  const [isGreeksHedgerOpen, setIsGreeksHedgerOpen] = useState(false);
  const [isVolOptimizerOpen, setIsVolOptimizerOpen] = useState(false);
  const [isMicrostructureOpen, setIsMicrostructureOpen] = useState(false);
  const [isProofOpen, setIsProofOpen] = useState(false);
  const [selectedProofCertificate, setSelectedProofCertificate] = useState<ProofOfAlphaCertificate | null>(null);

  // User Account & View State
  const [currentUser, setCurrentUser] = useState<UserProfile>(sanitizeUserProfile(DEMO_ACCOUNTS[0]));
  const [currentView, setCurrentView] = useState<'terminal' | 'landing'>('landing');
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authInitialTab, setAuthInitialTab] = useState<'SIGN_IN' | 'REGISTER' | 'FORGOT_PASSWORD'>('SIGN_IN');
  const [isProfileOpen, setIsProfileOpen] = useState(false);

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
      const user = getCurrentUser();
      setCurrentUser(user);
      const userStateKey = getUserTradingStateKey(user.id);
      const savedUserState = localStorage.getItem(userStateKey);
      if (savedUserState) {
        setTradingState(JSON.parse(savedUserState));
      } else {
        const savedState = localStorage.getItem('tradecraft_trading_state');
        if (savedState) {
          setTradingState(JSON.parse(savedState));
        } else {
          setTradingState({
            ...INITIAL_TRADING_STATE,
            startingCapital: user.startingCapital,
            availableCash: user.startingCapital,
          });
        }
      }

      const savedConfig = localStorage.getItem('tradecraft_byok_config');
      if (savedConfig) {
        setAIConfig(JSON.parse(savedConfig));
      }
    } catch {
      // fallback to initial
    }
  }, []);

  // Persist trading state
  useEffect(() => {
    try {
      localStorage.setItem('tradecraft_trading_state', JSON.stringify(tradingState));
      if (currentUser?.id) {
        localStorage.setItem(getUserTradingStateKey(currentUser.id), JSON.stringify(tradingState));
      }
    } catch {
      // ignore quota
    }
  }, [tradingState, currentUser]);

  // Generate initial candles whenever selected ticker or timeframe changes
  useEffect(() => {
    const initialCandles = generateHistoricalCandles(selectedTicker.currentPrice, timeframe, 80);
    setFullCandleBuffer(initialCandles);
    setCandles(initialCandles);
    setReplayIndex(Math.floor(initialCandles.length * 0.5));
    setIsReplayActive(false);
    setIsReplayPlaying(false);
  }, [selectedTicker.symbol, timeframe]);

  // Live Real-Time Market Tick Simulation (Only active when NOT in Replay mode)
  useEffect(() => {
    if (isReplayActive) return;

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
  }, [selectedTicker.symbol, isReplayActive]);

  // Automated Replay Playhead Runner
  useEffect(() => {
    if (!isReplayActive || !isReplayPlaying) return;

    const intervalMs = getReplaySpeedIntervalMs(replaySpeed);
    const interval = setInterval(() => {
      setReplayIndex((prevIndex) => {
        if (prevIndex >= fullCandleBuffer.length - 1) {
          setIsReplayPlaying(false);
          return prevIndex;
        }

        const nextIndex = prevIndex + 1;
        const currentSlice = sliceCandlesForReplay(fullCandleBuffer, nextIndex);
        setCandles(currentSlice);

        const currentCandle = fullCandleBuffer[nextIndex];
        if (currentCandle) {
          setSelectedTicker((prev) => ({
            ...prev,
            currentPrice: currentCandle.close,
            change: Number((currentCandle.close - prev.previousClose).toFixed(2)),
            changePercent: Number((((currentCandle.close - prev.previousClose) / prev.previousClose) * 100).toFixed(2)),
          }));

          setTradingState((prevState) => {
            return checkPendingOrders(prevState, { [selectedTicker.symbol]: currentCandle.close });
          });
        }

        return nextIndex;
      });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isReplayActive, isReplayPlaying, replaySpeed, fullCandleBuffer, selectedTicker.symbol]);

  // Manual Step 1 Bar Forward
  const handleStepForward = () => {
    if (replayIndex < fullCandleBuffer.length - 1) {
      const nextIndex = replayIndex + 1;
      setReplayIndex(nextIndex);
      const currentSlice = sliceCandlesForReplay(fullCandleBuffer, nextIndex);
      setCandles(currentSlice);

      const currentCandle = fullCandleBuffer[nextIndex];
      if (currentCandle) {
        setSelectedTicker((prev) => ({
          ...prev,
          currentPrice: currentCandle.close,
        }));
      }
    }
  };

  // Rewind Replay
  const handleRewindToStart = () => {
    const startIndex = Math.max(5, Math.floor(fullCandleBuffer.length * 0.25));
    setReplayIndex(startIndex);
    setCandles(sliceCandlesForReplay(fullCandleBuffer, startIndex));
    setIsReplayPlaying(false);
  };

  // Toggle Replay Mode
  const handleToggleReplay = () => {
    if (!isReplayActive) {
      setIsReplayActive(true);
      const startIndex = Math.floor(fullCandleBuffer.length * 0.4);
      setReplayIndex(startIndex);
      setCandles(sliceCandlesForReplay(fullCandleBuffer, startIndex));
      setIsReplayPlaying(false);
    } else {
      setIsReplayActive(false);
      setIsReplayPlaying(false);
      setCandles(fullCandleBuffer);
    }
  };

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
    const targetCapital = currentUser?.startingCapital || 1000000;
    if (window.confirm(`Reset virtual capital for ${currentUser.name} to ₹${targetCapital.toLocaleString('en-IN')} and clear order history?`)) {
      const freshState: TradingState = {
        ...INITIAL_TRADING_STATE,
        startingCapital: targetCapital,
        availableCash: targetCapital,
      };
      setTradingState(freshState);
      localStorage.setItem('tradecraft_trading_state', JSON.stringify(freshState));
      if (currentUser?.id) {
        localStorage.setItem(getUserTradingStateKey(currentUser.id), JSON.stringify(freshState));
      }
    }
  };

  // Switch Active User Profile & load their specific portfolio
  const handleSwitchUser = (newUser: UserProfile) => {
    setCurrentUser(newUser);
    try {
      const userKey = getUserTradingStateKey(newUser.id);
      const savedUserPortfolio = localStorage.getItem(userKey);
      if (savedUserPortfolio) {
        setTradingState(JSON.parse(savedUserPortfolio));
      } else {
        const freshState: TradingState = {
          ...INITIAL_TRADING_STATE,
          startingCapital: newUser.startingCapital,
          availableCash: newUser.startingCapital,
        };
        setTradingState(freshState);
        localStorage.setItem(userKey, JSON.stringify(freshState));
      }
    } catch (e) {
      console.error('Error switching user:', e);
    }
  };

  // Log Out User
  const handleLogout = () => {
    logoutUser();
    const defaultDemo = sanitizeUserProfile(DEMO_ACCOUNTS[0]);
    handleSwitchUser(defaultDemo);
    setCurrentView('landing');
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
      {currentView === 'landing' ? (
        <LandingPage
          currentUser={currentUser}
          onLaunchTerminal={() => setCurrentView('terminal')}
          onOpenAuth={(tab) => {
            setAuthInitialTab(tab || 'SIGN_IN');
            setIsAuthOpen(true);
          }}
          onOpenProfile={() => setIsProfileOpen(true)}
          onSelectDemoUser={(demoUser) => handleSwitchUser(demoUser)}
        />
      ) : (
        <>
          {/* Universal Header with Live Financial Bar */}
          <Header
            portfolio={portfolioSummary}
            aiConfig={aiConfig}
            currentUser={currentUser}
            isReplayActive={isReplayActive}
            onToggleReplay={handleToggleReplay}
            onOpenOptions={() => setIsOptionsOpen(true)}
            onOpenWebhookBot={() => setIsWebhookBotOpen(true)}
            onOpenAnalytics={() => setIsAnalyticsOpen(true)}
            onOpenBreadth={() => setIsBreadthOpen(true)}
            onOpenTradebook={() => setIsTradebookOpen(true)}
            onOpenScreener={() => setIsScreenerOpen(true)}
            onOpenLeagues={() => setIsLeaguesOpen(true)}
            onOpenQuantDesk={() => setIsQuantDeskOpen(true)}
            onOpenCopier={() => setIsCopierOpen(true)}
            onOpenGreeksHedger={() => setIsGreeksHedgerOpen(true)}
            onOpenVolOptimizer={() => setIsVolOptimizerOpen(true)}
            onOpenMicrostructure={() => setIsMicrostructureOpen(true)}
            onOpenBYOK={() => setIsBYOKOpen(true)}
            onOpenStrategy={() => setIsStrategyOpen(true)}
            onOpenCrisis={() => setIsCrisisOpen(true)}
            onResetAccount={handleResetAccount}
            onOpenProfile={() => setIsProfileOpen(true)}
            onOpenLanding={() => setCurrentView('landing')}
          />

          {/* Main Terminal Workspace */}
          <main className="flex-1 p-3 grid grid-cols-1 lg:grid-cols-12 gap-3 max-w-[1800px] w-full mx-auto">
            {/* Left Column (8 cols on desktop): Replay Controls + Chart + Portfolio Drawer */}
            <div className="lg:col-span-8 xl:col-span-9 flex flex-col gap-3 min-h-[750px]">
              {/* Floating/Docked Replay Control Toolbar */}
          {isReplayActive && (
            <ReplayControlBar
              isPlaying={isReplayPlaying}
              speed={replaySpeed}
              currentIndex={replayIndex}
              totalCandles={fullCandleBuffer.length}
              onTogglePlay={() => setIsReplayPlaying(!isReplayPlaying)}
              onStepForward={handleStepForward}
              onRewindToStart={handleRewindToStart}
              onChangeSpeed={(s) => setReplaySpeed(s)}
              onScrub={(idx) => {
                setReplayIndex(idx);
                setCandles(sliceCandlesForReplay(fullCandleBuffer, idx));
                const c = fullCandleBuffer[idx];
                if (c) setSelectedTicker((prev) => ({ ...prev, currentPrice: c.close }));
              }}
              onExitReplay={() => {
                setIsReplayActive(false);
                setIsReplayPlaying(false);
                setCandles(fullCandleBuffer);
              }}
            />
          )}

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

        {/* Right Column (4 cols on desktop): Level-2 DOM Ladder & Order Ticket */}
        <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-3">
          <MarketDepthDOM
            orderBook={generateLevel2DOM(selectedTicker.currentPrice)}
            symbol={selectedTicker.symbol}
            onQuickOrder={(side, price) => {
              handlePlaceOrder({
                symbol: selectedTicker.symbol,
                side,
                type: 'LIMIT',
                product: 'MIS',
                quantity: selectedTicker.lotSize,
                price,
              });
            }}
          />

          <OrderTicket
            ticker={selectedTicker}
            availableCash={tradingState.availableCash}
            onPlaceOrder={handlePlaceOrder}
          />
        </div>
      </main>
        </>
      )}

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

      <WebhookBotModal
        isOpen={isWebhookBotOpen}
        onClose={() => setIsWebhookBotOpen(false)}
        onOrderExecutedFromWebhook={() => {
          // Trigger local state recheck
          const savedState = localStorage.getItem('tradecraft_trading_state');
          if (savedState) {
            setTradingState(JSON.parse(savedState));
          }
        }}
      />

      <AnalyticsModal
        isOpen={isAnalyticsOpen}
        onClose={() => setIsAnalyticsOpen(false)}
        tradeAudits={tradingState.tradeAudits}
        aiConfig={aiConfig}
        startingCapital={tradingState.startingCapital}
      />

      <MarketBreadthModal
        isOpen={isBreadthOpen}
        onClose={() => setIsBreadthOpen(false)}
        aiConfig={aiConfig}
      />

      <TradebookImportModal
        isOpen={isTradebookOpen}
        onClose={() => setIsTradebookOpen(false)}
        aiConfig={aiConfig}
        onOpenByok={() => {
          setIsTradebookOpen(false);
          setIsBYOKOpen(true);
        }}
      />

      <StockScreenerModal
        isOpen={isScreenerOpen}
        onClose={() => setIsScreenerOpen(false)}
        aiConfig={aiConfig}
        onSelectStock={(ticker) => {
          setSelectedTicker(ticker);
          const newCandles = generateHistoricalCandles(ticker.currentPrice, '5m', 70);
          setCandles(newCandles);
          setFullCandleBuffer(newCandles);
        }}
      />

      <LeagueLeaderboardModal
        isOpen={isLeaguesOpen}
        onClose={() => setIsLeaguesOpen(false)}
        currentUser={currentUser}
        onInspectProof={(cert) => {
          setSelectedProofCertificate(cert);
          setIsProofOpen(true);
        }}
      />

      <ProofOfAlphaModal
        isOpen={isProofOpen}
        onClose={() => setIsProofOpen(false)}
        certificate={selectedProofCertificate}
      />

      {/* Autonomous AI Quant Desk War Room Modal */}
      <QuantWarRoomModal
        isOpen={isQuantDeskOpen}
        onClose={() => setIsQuantDeskOpen(false)}
        selectedTicker={selectedTicker}
        candles={candles}
        portfolioEquity={portfolioSummary.availableCash + portfolioSummary.usedMargin}
        currentDrawdownPct={
          portfolioSummary.netPnL < 0
            ? Math.abs((portfolioSummary.netPnL / Math.max(1, portfolioSummary.startingCapital)) * 100)
            : 0
        }
        onExecuteApprovedTrade={(trade) => {
          const result = placeOrder(tradingState, {
            symbol: trade.symbol,
            side: trade.side,
            type: 'MARKET',
            product: 'MIS',
            quantity: trade.quantity,
            currentMarketPrice: trade.price,
          });
          if (result.newState) {
            setTradingState(result.newState);
          }
        }}
        onSelectStock={(ticker) => {
          setSelectedTicker(ticker);
          const newCandles = generateHistoricalCandles(ticker.currentPrice, '5m', 70);
          setCandles(newCandles);
          setFullCandleBuffer(newCandles);
        }}
      />

      {/* Institutional Trade Copier & Cross-Account Multi-Broker Modal */}
      <TradeCopierModal
        isOpen={isCopierOpen}
        onClose={() => setIsCopierOpen(false)}
        masterEquity={portfolioSummary.availableCash + portfolioSummary.usedMargin}
        selectedTicker={selectedTicker}
      />

      {/* Real-Time Options Greeks Hedger & Delta-Gamma Autobalancer Modal */}
      <GreeksHedgerModal
        isOpen={isGreeksHedgerOpen}
        onClose={() => setIsGreeksHedgerOpen(false)}
        currentSpotPrice={selectedTicker.currentPrice}
      />

      {/* Options Strategy Payoff Optimizer & Volatility Surface Calibrator Modal */}
      <VolatilityOptimizerModal
        isOpen={isVolOptimizerOpen}
        onClose={() => setIsVolOptimizerOpen(false)}
        currentSpotPrice={selectedTicker.currentPrice}
      />

      {/* Level-3 Order Book Analytics, Iceberg Detector & Dark Pool Tracker Modal */}
      <MicrostructureModal
        isOpen={isMicrostructureOpen}
        onClose={() => setIsMicrostructureOpen(false)}
        selectedTicker={selectedTicker}
        onExecuteTrade={(sym, side, price, qty) => {
          const result = placeOrder(tradingState, {
            symbol: sym,
            side,
            type: 'MARKET',
            product: 'MIS',
            quantity: qty,
            currentMarketPrice: price,
          });
          if (result.newState) {
            setTradingState(result.newState);
          }
        }}
      />

      {/* User Account & Authentication Modals */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={(user) => {
          handleSwitchUser(user);
          setCurrentView('terminal');
        }}
        initialTab={authInitialTab}
      />

      <UserProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        currentUser={currentUser}
        onUserUpdated={(updatedUser) => handleSwitchUser(updatedUser)}
        onLogout={handleLogout}
        onOpenAuth={() => {
          setAuthInitialTab('SIGN_IN');
          setIsAuthOpen(true);
        }}
      />
    </div>
  );
}
