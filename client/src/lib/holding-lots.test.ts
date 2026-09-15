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
  category = "일반",
  memo: string | null = null,
): StockTransaction {
  return {
    id,
    userId: "user-1",
    type,
    category,
    stockName: "키도산업",
    quantity,
    pricePerShare,
    memo,
    transferRequestId: null,
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

test("출고는 같은 종목이어도 선택한 카테고리의 입고분에서만 차감한다", () => {
  const lots = calculateHoldingLots([
    transaction("ipo-lot", "in", 1_000, 2_000, "2026-09-13T01:00:00Z", "공모주"),
    transaction("so-lot", "in", 1_000, 1_000, "2026-09-13T02:00:00Z", "S.O"),
    transaction("so-out", "out", 300, 0, "2026-09-13T03:00:00Z", "S.O", "카테고리출고신청#request-1"),
  ]);

  assert.deepEqual(
    lots.map(({ id, qty, category }) => ({ id, qty, category })),
    [
      { id: "ipo-lot", qty: 1_000, category: "공모주" },
      { id: "so-lot", qty: 700, category: "S.O" },
    ],
  );
});

test("같은 카테고리 안에서는 오래된 입고분부터 차감한다", () => {
  const lots = calculateHoldingLots([
    transaction("so-old", "in", 500, 1_000, "2026-09-13T01:00:00Z", "S.O"),
    transaction("so-new", "in", 500, 1_500, "2026-09-13T02:00:00Z", "S.O"),
    transaction("so-out", "out", 700, 0, "2026-09-13T03:00:00Z", "S.O", "카테고리출고신청#request-2"),
  ]);

  assert.deepEqual(
    lots.map(({ id, qty, pricePerShare }) => ({ id, qty, pricePerShare })),
    [{ id: "so-new", qty: 300, pricePerShare: 1_500 }],
  );
});

test("과거 카테고리 없는 출고 신청은 기존처럼 종목 전체에서 차감한다", () => {
  const lots = calculateHoldingLots([
    transaction("ipo-lot", "in", 500, 2_000, "2026-09-13T01:00:00Z", "공모주"),
    transaction("so-lot", "in", 500, 1_000, "2026-09-13T02:00:00Z", "S.O"),
    transaction("legacy-out", "out", 700, 0, "2026-09-13T03:00:00Z", "일반", "출고신청#legacy"),
  ]);

  assert.deepEqual(
    lots.map(({ id, qty, category }) => ({ id, qty, category })),
    [{ id: "so-lot", qty: 300, category: "S.O" }],
  );
});

test("확정매도 등 카테고리 선택을 지원하지 않는 출고는 종목 전체에서 차감한다", () => {
  const lots = calculateHoldingLots([
    transaction("ipo-lot", "in", 500, 2_000, "2026-09-13T01:00:00Z", "공모주"),
    transaction("so-lot", "in", 500, 1_000, "2026-09-13T02:00:00Z", "S.O"),
    transaction("sell-out", "out", 700, 0, "2026-09-13T03:00:00Z", "공모주", "확정매도"),
  ]);

  assert.deepEqual(
    lots.map(({ id, qty, category }) => ({ id, qty, category })),
    [{ id: "so-lot", qty: 300, category: "S.O" }],
  );
});