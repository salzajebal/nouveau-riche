import assert from "node:assert/strict";
import test from "node:test";
import type { StockTransaction } from "@shared/schema";
import { calculateHoldingLots } from "./holding-lots";

function transaction(
  id: string,
  type: string,
  quantity: number,
  pricePerShare: number,
  createdAt: string,
): StockTransaction {
  return {
    id,
    userId: "user-1",
    type,
    category: "일반",
    stockName: "키도산업",
    quantity,
    pricePerShare,
    memo: null,
    hidden: false,
    createdAt: new Date(createdAt),
  };
}

test("같은 종목의 입고 건을 매입단가별로 합치지 않는다", () => {
  const lots = calculateHoldingLots([
    transaction("lot-1", "in", 5_000, 9_000, "2026-09-13T01:00:00Z"),
    transaction("lot-2", "in", 1_000, 7_000, "2026-09-13T02:00:00Z"),
  ]);

  assert.deepEqual(
    lots.map(({ id, qty, pricePerShare }) => ({ id, qty, pricePerShare })),
    [
      { id: "lot-1", qty: 5_000, pricePerShare: 9_000 },
      { id: "lot-2", qty: 1_000, pricePerShare: 7_000 },
    ],
  );
});

test("출고 수량은 오래된 입고 건부터 차감한다", () => {
  const lots = calculateHoldingLots([
    transaction("lot-1", "in", 5_000, 9_000, "2026-09-13T01:00:00Z"),
    transaction("lot-2", "in", 1_000, 7_000, "2026-09-13T02:00:00Z"),
    transaction("out-1", "out", 5_200, 0, "2026-09-13T03:00:00Z"),
  ]);

  assert.deepEqual(
    lots.map(({ id, qty, pricePerShare }) => ({ id, qty, pricePerShare })),
    [{ id: "lot-2", qty: 800, pricePerShare: 7_000 }],
  );
});