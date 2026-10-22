import React, { useEffect, useState } from 'react';
import { useCryptoStore } from './store/useCryptoStore';
import { fetch24hTickers, fetchFundingRates, fetchExchangeInfo, fetchKlines } from './services/binanceApi';
import { binanceWs } from './services/binanceWs';
import { fetchFearAndGreed, fetchCryptoNews, checkHighImpactNews } from './services/sentimentApi';
import { detectMarketRegime } from './utils/marketRegime';
import { sendTradingNotification } from './services/paperTradingEngine';
import { scannerEngine } from './services/scannerEngine';
import { Header } from './components/common/Header';
import { BottomNav } from './components/common/BottomNav';
import { HomeView } from './components/home/HomeView';
import { ScannerView } from './components/scanner/ScannerView';
import { ActiveTradesView } from './components/active/ActiveTradesView';
import { ExpertView } from './components/expert/ExpertView';
import { SettingsView } from './components/settings/SettingsView';
import { CoinDetailModal } from './components/detail/CoinDetailModal';
import { RiskCalculatorModal } from './components/risk/RiskCalculatorModal';
import { CreateAlertModal } from './components/alerts/CreateAlertModal';

export default function App() {
  const {
    activeTab,
    isDetailModalOpen,
    setDetailModalOpen,
    setTickers,
    setFundingRates,
    setFearAndGreed,
    setWsConnected,
    updateMarkPrices,
    setMarketRegime,
    setNewsPaused,
    paperTrades,
    tickers,
    soundEnabled,
  } = useCryptoStore();

  // Modal states for Risk Calc and Create Alert
  const [riskCalcConfig, setRiskCalcConfig] = useState<{
    isOpen: boolean;
    symbol: string;
    entry: number;
    sl: number;
  }>({
    isOpen: false,
    symbol: 'BTCUSDT',
    entry: 88000,
    sl: 86500,
  });

  const [alertModalConfig, setAlertModalConfig] = useState<{
    isOpen: boolean;
    symbol: string;
    price: number;
  }>({
    isOpen: false,
    symbol: 'BTCUSDT',
    price: 88000,
  });

  // App initialization & live polling
  useEffect(() => {
    let isMounted = true;

    // 0. Enforce Trading Lab: Start 100% clean with $1,000 per strategy and 0 trades
    const cleanCheckKey = 'crypto_clean_trading_lab_v10_applied';
    if (typeof window !== 'undefined' && !window.localStorage.getItem(cleanCheckKey)) {
      useCryptoStore.getState().clearAllUserData();
      window.localStorage.setItem(cleanCheckKey, 'true');
    }

    // 1. Initial REST fetch
    async function loadInitialData() {
      fetchExchangeInfo().catch(() => {});
      const [allTickers, funding, fng, btcKlines, newsList] = await Promise.all([
        fetch24hTickers(),
        fetchFundingRates(),
        fetchFearAndGreed(),
        fetchKlines('BTCUSDT', '1h', 250).catch(() => []),
        fetchCryptoNews().catch(() => []),
      ]);

      if (!isMounted) return;
      if (allTickers && allTickers.length > 0) setTickers(allTickers);
      if (funding) setFundingRates(funding);
      if (fng) setFearAndGreed(fng);

      // Check Market Regime from BTC 1h
      if (btcKlines && btcKlines.length > 0) {
        const regime = detectMarketRegime(btcKlines, btcKlines[btcKlines.length - 1].close);
        setMarketRegime(regime);
      }

      // News pause completely disabled per user request
      setNewsPaused(false, '');

      // Start continuous background auto-scanner across all Binance Futures pairs (>= 3M vol)
      scannerEngine.startBackgroundScanner();
    }

    loadInitialData();

    // 2. Periodic REST Polling every 5 seconds for tickers
    const pollInterval = setInterval(async () => {
      try {
        const newTickers = await fetch24hTickers();
        if (isMounted && newTickers && newTickers.length > 0) {
          setTickers(newTickers);
        }
      } catch (e) {
        // ignore polling error
      }
    }, 5000);

    // 3. Periodic Market Regime check every 60 seconds
    const regimeNewsInterval = setInterval(async () => {
      try {
        const [btcKlines] = await Promise.all([
          fetchKlines('BTCUSDT', '1h', 250).catch(() => []),
        ]);

        if (isMounted && btcKlines && btcKlines.length > 0) {
          const btcPrice = btcKlines[btcKlines.length - 1].close;
          const regime = detectMarketRegime(btcKlines, btcPrice);
          setMarketRegime(regime);
        }
      } catch (e) {
        // ignore
      }
    }, 60000);

    // 4. Invalidation of expired pending paper trades across all portfolios (after 3 candles on the referenced timeframe)
    const pendingExpirationInterval = setInterval(() => {
      if (!isMounted) return;
      useCryptoStore.getState().checkAndExpirePendingTrades();
    }, 30000);

    // 5. Dedicated 1-second tick recalculation for all active open positions
    const openTradesInterval = setInterval(() => {
      if (!isMounted) return;
      const state = useCryptoStore.getState();
      const openSymbols = new Set<string>();
      Object.values(state.portfolios).forEach((p) => {
        p.trades.forEach((t) => {
          if (t.status === 'OPEN' || t.status === 'PENDING') {
            openSymbols.add(t.symbol);
          }
        });
      });

      if (openSymbols.size > 0) {
        const priceMap: Record<string, number> = {};
        openSymbols.forEach((sym) => {
          if (state.tickers[sym]?.lastPrice) {
            priceMap[sym] = state.tickers[sym].lastPrice;
          }
        });
        if (Object.keys(priceMap).length > 0) {
          state.processPaperTradesTick(priceMap);
        }
      }
    }, 1000);

    // 6. WebSocket markPrice stream (!markPrice@arr@1s) for real-time tick updates & price alerts
    const unsubMark = binanceWs.subscribeMarkPrices((priceMap) => {
      if (isMounted) {
        updateMarkPrices(priceMap);
      }
    });

    // 7. WebSocket connection status subscription
    const unsubStatus = binanceWs.subscribeStatus((connected) => {
      if (isMounted) {
        setWsConnected(connected);
      }
    });

    // 8. Visibility Change: Pause WebSocket during background tab to save battery and bandwidth
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page hidden, reduce background churn
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      clearInterval(regimeNewsInterval);
      clearInterval(pendingExpirationInterval);
      clearInterval(openTradesInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      unsubMark();
      unsubStatus();
      scannerEngine.stopBackgroundScanner();
      binanceWs.destroy();
    };
  }, []);

  const handleOpenRiskWithData = (symbol: string, entry: number, sl: number) => {
    setRiskCalcConfig({
      isOpen: true,
      symbol,
      entry,
      sl,
    });
  };

  const handleOpenAlertWithData = (symbol: string, price: number) => {
    setAlertModalConfig({
      isOpen: true,
      symbol,
      price,
    });
  };

  return (
    <div className="min-h-screen bg-[#0b0e14] text-slate-100 flex flex-col font-['Cairo',sans-serif]">
      {/* Top Header with live status and install button */}
      <Header />

      {/* Main Content Area based on Tab */}
      <main className="flex-1 w-full overflow-y-auto">
        {activeTab === 'home' && <HomeView />}
        {activeTab === 'scanner' && <ScannerView scannerId={1} />}
        {activeTab === 'scanner2' && <ScannerView scannerId={2} />}
        {(activeTab === 'active' || activeTab === 'performance') && <ActiveTradesView />}
        {(activeTab === 'expert' || activeTab === 'journal') && <ExpertView />}
        {activeTab === 'settings' && <SettingsView />}
      </main>

      {/* Bottom Navigation */}
      <BottomNav />

      {/* Coin Detail Modal */}
      {isDetailModalOpen && (
        <CoinDetailModal
          onClose={() => setDetailModalOpen(false)}
          onOpenRiskCalcWithData={handleOpenRiskWithData}
          onOpenAlertModal={handleOpenAlertWithData}
        />
      )}

      {/* Risk Calculator Modal */}
      {riskCalcConfig.isOpen && (
        <RiskCalculatorModal
          initialSymbol={riskCalcConfig.symbol}
          initialEntry={riskCalcConfig.entry}
          initialSl={riskCalcConfig.sl}
          onClose={() => setRiskCalcConfig((prev) => ({ ...prev, isOpen: false }))}
        />
      )}

      {/* Price Alert Creation Modal */}
      {alertModalConfig.isOpen && (
        <CreateAlertModal
          initialSymbol={alertModalConfig.symbol}
          initialPrice={alertModalConfig.price}
          onClose={() => setAlertModalConfig((prev) => ({ ...prev, isOpen: false }))}
        />
      )}
    </div>
  );
}
