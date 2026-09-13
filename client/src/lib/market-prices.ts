import { apiRequest } from "./queryClient";

const priceCache = new Map<string, { currentPrice: number; changePercent: number; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000;

export async function fetchStockPrices(stockNames: string[]): Promise<Record<string, { currentPrice: number; changePercent: number }>> {
  if (stockNames.length === 0) return {};

  const uncached: string[] = [];
  const results: Record<string, { currentPrice: number; changePercent: number }> = {};

  for (const name of stockNames) {
    const cached = priceCache.get(name);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      results[name] = { currentPrice: cached.currentPrice, changePercent: cached.changePercent };
    } else {
      uncached.push(name);
    }
  }

  if (uncached.length > 0) {
    try {
      const resp = await apiRequest("POST", "/api/stocks/prices", { stockNames: uncached });
      const data = await resp.json();
      for (const [name, info] of Object.entries(data)) {
        const priceInfo = info as { currentPrice: number; changePercent: number };
        results[name] = priceInfo;
        priceCache.set(name, { ...priceInfo, timestamp: Date.now() });
      }
    } catch {
      // fallback silently
    }
  }

  return results;
}

export function getCurrentMarketPrice(stockName: string, purchasePrice: number): { currentPrice: number; changePercent: number } {
  const cached = priceCache.get(stockName);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return { currentPrice: cached.currentPrice, changePercent: cached.changePercent };
  }
  return { currentPrice: purchasePrice, changePercent: 0 };
}
