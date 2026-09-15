import type { StockTransaction, TransferRequest } from "./schema";

export type HoldingLot = {
  id: string;
  name: string;
  qty: number;
  originalQty: number;
  pricePerShare: number;
  category: string;
  createdAt: Date | string;
};

type PendingTransferRequest = Pick<
  TransferRequest,
  "stockName" | "category" | "sourceLotId" | "quantity" | "status" | "createdAt"
>;

const isIncoming = (type: string) => type === "in" || type === "입고";
const isOutgoing = (type: string) =>
  type === "out" ||
  type === "출고" ||
  type === "내 계좌로 옮기기" ||
  type === "주식이전";

function isCategoryScopedTransfer(transaction: StockTransaction): boolean {
  return transaction.memo?.startsWith("카테고리출고신청#") === true ||
    transaction.memo?.startsWith("입고건출고신청#") === true;
}

function getTargetSourceLotId(transaction: StockTransaction): string | null {
  const transferMatch = transaction.memo?.match(/^입고건출고신청#[^#]+#([^#]+)$/);
  if (transferMatch?.[1]) return transferMatch[1];
  const deductionMatch = transaction.memo?.match(/^입고건차감#([^#]+)(?:#|$)/);
  return deductionMatch?.[1] || null;
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
    const targetSourceLotId = getTargetSourceLotId(transaction);
    let remainingToDeduct = transaction.quantity;
    for (const lot of lots) {
      if (remainingToDeduct <= 0) break;
      if (lot.name !== transaction.stockName || lot.qty <= 0) continue;
      if (targetSourceLotId && lot.id !== targetSourceLotId) continue;
      if (!targetSourceLotId && categoryScoped && lot.category !== transaction.category) continue;

      const deducted = Math.min(lot.qty, remainingToDeduct);
      lot.qty -= deducted;
      remainingToDeduct -= deducted;
    }
  }

  return lots.filter((lot) => lot.qty > 0);
}

export function calculateTransferableHoldingLots(
  holdingLots: HoldingLot[],
  transferRequests: PendingTransferRequest[],
): HoldingLot[] {
  const availableLots = holdingLots.map((lot) => ({ ...lot }));
  const pendingRequests = transferRequests
    .map((request, index) => ({ request, index }))
    .filter(({ request }) => ["pending", "출고대기중", "held"].includes(request.status))
    .sort((a, b) => {
      const aTime = new Date(a.request.createdAt).getTime();
      const bTime = new Date(b.request.createdAt).getTime();
      return aTime === bTime ? a.index - b.index : aTime - bTime;
    });

  for (const { request } of pendingRequests) {
    let remainingToReserve = request.quantity;
    for (const lot of availableLots) {
      if (remainingToReserve <= 0) break;
      if (lot.name !== request.stockName || lot.qty <= 0) continue;
      if (request.sourceLotId && lot.id !== request.sourceLotId) continue;
      if (request.category && lot.category !== request.category) continue;

      const reserved = Math.min(lot.qty, remainingToReserve);
      lot.qty -= reserved;
      remainingToReserve -= reserved;
    }
  }

  return availableLots.filter((lot) => lot.qty > 0);
}

export function areTransferReservationsFulfillable(
  holdingLots: HoldingLot[],
  transferRequests: PendingTransferRequest[],
): boolean {
  const activeRequests = transferRequests.filter((request) =>
    ["pending", "출고대기중", "held"].includes(request.status)
  );
  const quantityBefore = holdingLots.reduce((sum, lot) => sum + lot.qty, 0);
  const quantityAfter = calculateTransferableHoldingLots(holdingLots, activeRequests)
    .reduce((sum, lot) => sum + lot.qty, 0);
  const requestedQuantity = activeRequests.reduce((sum, request) => sum + request.quantity, 0);
  return quantityBefore - quantityAfter === requestedQuantity;
}