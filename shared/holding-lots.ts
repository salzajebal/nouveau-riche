import type { StockTransaction } from "./schema";

export type HoldingLot = {
  id: string;
  name: string;
  qty: number;
  originalQty: number;
  pricePerShare: number;
  category: string;
  createdAt: Date | string;
};

const isIncoming = (type: string) => type === "in" || type === "입고";
const isOutgoing = (type: string) =>
  type === "out" ||
  type === "출고" ||
  type === "내 계좌로 옮기기" ||
  type === "주식이전";

function isCategoryScopedTransfer(transaction: StockTransaction): boolean {
  return transaction.memo?.startsWith("카테고리출고신청#") === true;
}

export function calculateHoldingLots(transactions: StockTransaction[]): HoldingLot[] {
  const ordered = transactions
    .map((transaction, index) => ({ transaction, index }))
    .sort((a, b) => {
      const aTime = new Date(a.transaction.createdAt).getTime();
      const bTime = new Date(b.transaction.createdAt).getTime();
      return aTime === bTime ? a.index - b.index : aTime - bTime;
    });

  const lots: HoldingLot[] = [];

  for (const { transaction } of ordered) {
    if (isIncoming(transaction.type)) {
      lots.push({
        id: transaction.id,
        name: transaction.stockName,
        qty: transaction.quantity,
        originalQty: transaction.quantity,
        pricePerShare: transaction.pricePerShare,
        category: transaction.category,
        createdAt: transaction.createdAt,
      });
      continue;
    }

    if (!isOutgoing(transaction.type)) continue;

    const categoryScoped = isCategoryScopedTransfer(transaction);
    let remainingToDeduct = transaction.quantity;
    for (const lot of lots) {
      if (remainingToDeduct <= 0) break;
      if (lot.name !== transaction.stockName || lot.qty <= 0) continue;
      if (categoryScoped && lot.category !== transaction.category) continue;

      const deducted = Math.min(lot.qty, remainingToDeduct);
      lot.qty -= deducted;
      remainingToDeduct -= deducted;
    }
  }

  return lots.filter((lot) => lot.qty > 0);
}