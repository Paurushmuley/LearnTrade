import { OrderSide, ProductType, StatutoryCharges } from '../types/trading';

/**
 * Indian Statutory & Exchange Charges Engine
 * Complies with SEBI, NSE, and Ministry of Finance mandates.
 */
export function calculateStatutoryCharges(
  side: OrderSide,
  product: ProductType,
  price: number,
  quantity: number
): StatutoryCharges {
  const turnover = price * quantity;
  if (turnover <= 0) {
    return {
      brokerage: 0,
      stt: 0,
      exchangeCharges: 0,
      sebiCharges: 0,
      stampDuty: 0,
      gst: 0,
      totalCharges: 0,
      breakevenPerShare: 0,
    };
  }

  // 1. Brokerage: Flat ₹20 or 0.03% (whichever is lower) for Intraday (MIS), ₹0 for CNC equity delivery (or flat ₹20)
  // Standard discount broker model (Zerodha/Groww)
  let brokerage = 0;
  if (product === 'MIS') {
    brokerage = Math.min(20, turnover * 0.0003);
  } else {
    // Delivery: ₹0 brokerage or nominal ₹20
    brokerage = Math.min(20, turnover * 0.0003);
  }

  // 2. STT (Securities Transaction Tax)
  // Delivery (CNC): 0.1% on both Buy and Sell
  // Intraday (MIS): 0.025% on Sell only (0% on Buy)
  let stt = 0;
  if (product === 'CNC') {
    stt = turnover * 0.001; // 0.1%
  } else {
    // Intraday
    stt = side === 'SELL' ? turnover * 0.00025 : 0; // 0.025% on sell
  }

  // 3. Exchange Turnover Charges (NSE Equity): 0.00297%
  const exchangeCharges = turnover * 0.0000297;

  // 4. SEBI Turnover Charges: ₹10 per crore (0.0001%)
  const sebiCharges = turnover * 0.000001;

  // 5. Stamp Duty:
  // Delivery (CNC): 0.015% on BUY only
  // Intraday (MIS): 0.003% on BUY only
  let stampDuty = 0;
  if (side === 'BUY') {
    stampDuty = product === 'CNC' ? turnover * 0.00015 : turnover * 0.00003;
  }

  // 6. GST: 18% on (Brokerage + Exchange Charges + SEBI Charges)
  const gst = (brokerage + exchangeCharges + sebiCharges) * 0.18;

  const totalCharges = brokerage + stt + exchangeCharges + sebiCharges + stampDuty + gst;
  const breakevenPerShare = quantity > 0 ? totalCharges / quantity : 0;

  return {
    brokerage: Number(brokerage.toFixed(2)),
    stt: Number(stt.toFixed(2)),
    exchangeCharges: Number(exchangeCharges.toFixed(2)),
    sebiCharges: Number(sebiCharges.toFixed(2)),
    stampDuty: Number(stampDuty.toFixed(2)),
    gst: Number(gst.toFixed(2)),
    totalCharges: Number(totalCharges.toFixed(2)),
    breakevenPerShare: Number(breakevenPerShare.toFixed(2)),
  };
}

/**
 * Calculates full round-trip (Buy + Sell) estimated statutory charges and breakeven target
 */
export function calculateRoundTripEstimate(
  product: ProductType,
  entryPrice: number,
  quantity: number,
  targetExitPrice: number = entryPrice
): {
  buyCharges: StatutoryCharges;
  sellCharges: StatutoryCharges;
  totalRoundTripCharges: number;
  breakevenPoints: number;
  breakevenPrice: number;
} {
  const buyCharges = calculateStatutoryCharges('BUY', product, entryPrice, quantity);
  const sellCharges = calculateStatutoryCharges('SELL', product, targetExitPrice, quantity);
  const totalRoundTripCharges = Number((buyCharges.totalCharges + sellCharges.totalCharges).toFixed(2));
  const breakevenPoints = Number((totalRoundTripCharges / quantity).toFixed(2));
  const breakevenPrice = Number((entryPrice + breakevenPoints).toFixed(2));

  return {
    buyCharges,
    sellCharges,
    totalRoundTripCharges,
    breakevenPoints,
    breakevenPrice,
  };
}

/**
 * Calculates statutory taxes with object parameter interface
 */
export function calculateStatutoryTaxes(params: {
  symbol?: string;
  side: OrderSide;
  product?: ProductType;
  assetType?: string;
  quantity: number;
  price: number;
  lotSize?: number;
}): StatutoryCharges & { totalStatutoryCharges: number } {
  const charges = calculateStatutoryCharges(params.side, params.product || 'MIS', params.price, params.quantity);
  return {
    ...charges,
    totalStatutoryCharges: charges.totalCharges,
  };
}

