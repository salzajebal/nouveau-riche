import assert from "node:assert/strict";
import test from "node:test";
import type { StockTransaction } from "@shared/schema";
import {
  areTransferReservationsFulfillable,
  calculateHoldingLots,
  calculateTransferableHoldingLots,
} from "./holding-lots";

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

test("출고 선택 목록은 같은 종목과 카테고리의 입고 건을 합치지 않는다", () => {
  const lots = calculateHoldingLots([
    transaction("lot-1", "in", 5_000, 9_000, "2026-09-13T01:00:00Z", "공모주"),
    transaction("lot-2", "in", 2_000, 7_500, "2026-09-13T02:00:00Z", "공모주"),
  ]);

  const transferableLots = calculateTransferableHoldingLots(lots, []);

  assert.deepEqual(
    transferableLots.map(({ id, qty, pricePerShare }) => ({ id, qty, pricePerShare })),
    [
      { id: "lot-1", qty: 5_000, pricePerShare: 9_000 },
      { id: "lot-2", qty: 2_000, pricePerShare: 7_500 },
    ],
  );
});

test("대기 중 출고 수량은 같은 카테고리의 오래된 입고 건부터 예약한다", () => {
  const lots = calculateHoldingLots([
    transaction("ipo-old", "in", 1_000, 2_000, "2026-09-13T01:00:00Z", "공모주"),
    transaction("so-lot", "in", 1_000, 1_000, "2026-09-13T02:00:00Z", "S.O"),
    transaction("ipo-new", "in", 1_000, 2_500, "2026-09-13T03:00:00Z", "공모주"),
  ]);

  const transferableLots = calculateTransferableHoldingLots(lots, [{
    stockName: "키도산업",
    category: "공모주",
    sourceLotId: null,
    quantity: 1_200,
    status: "pending",
    createdAt: new Date("2026-09-13T04:00:00Z"),
  }]);

  assert.deepEqual(
    transferableLots.map(({ id, qty, category }) => ({ id, qty, category })),
    [
      { id: "so-lot", qty: 1_000, category: "S.O" },
      { id: "ipo-new", qty: 800, category: "공모주" },
    ],
  );
});

test("선택한 매입단가의 입고 건에서만 출고 수량을 차감한다", () => {
  const lots = calculateHoldingLots([
    transaction("lot-9000", "in", 5_000, 9_000, "2026-09-13T01:00:00Z", "일반"),
    transaction("lot-7500", "in", 2_000, 7_500, "2026-09-13T02:00:00Z", "일반"),
    transaction(
      "targeted-out",
      "out",
      500,
      7_500,
      "2026-09-13T03:00:00Z",
      "일반",
      "입고건출고신청#request-1#lot-7500",
    ),
  ]);

  assert.deepEqual(
    lots.map(({ id, qty, pricePerShare }) => ({ id, qty, pricePerShare })),
    [
      { id: "lot-9000", qty: 5_000, pricePerShare: 9_000 },
      { id: "lot-7500", qty: 1_500, pricePerShare: 7_500 },
    ],
  );
});

test("대기 중인 출고 신청도 선택한 입고 건에만 예약한다", () => {
  const lots = calculateHoldingLots([
    transaction("lot-9000", "in", 5_000, 9_000, "2026-09-13T01:00:00Z", "일반"),
    transaction("lot-7500", "in", 2_000, 7_500, "2026-09-13T02:00:00Z", "일반"),
  ]);

  const transferableLots = calculateTransferableHoldingLots(lots, [{
    stockName: "키도산업",
    category: "일반",
    sourceLotId: "lot-7500",
    quantity: 600,
    status: "pending",
    createdAt: new Date("2026-09-13T03:00:00Z"),
  }]);

  assert.deepEqual(
    transferableLots.map(({ id, qty }) => ({ id, qty })),
    [
      { id: "lot-9000", qty: 5_000 },
      { id: "lot-7500", qty: 1_400 },
    ],
  );
});

test("일반 매도도 예약되지 않은 입고 건을 지정해 차감할 수 있다", () => {
  const lots = calculateHoldingLots([
    transaction("reserved-lot", "in", 1_000, 9_000, "2026-09-13T01:00:00Z", "일반"),
    transaction("free-lot", "in", 1_000, 7_500, "2026-09-13T02:00:00Z", "일반"),
    transaction(
      "sell-free-lot",
      "out",
      600,
      8_000,
      "2026-09-13T03:00:00Z",
      "일반",
      "입고건차감#free-lot#확정매도",
    ),
  ]);

  assert.deepEqual(
    lots.map(({ id, qty }) => ({ id, qty })),
    [
      { id: "reserved-lot", qty: 1_000 },
      { id: "free-lot", qty: 400 },
    ],
  );
});

test("기존 카테고리 신청을 먼저 승인해도 다른 신청이 지정한 입고 건은 보존한다", () => {
  const initialLots = calculateHoldingLots([
    transaction("reserved-lot", "in", 100, 9_000, "2026-09-13T01:00:00Z", "일반"),
    transaction("legacy-lot", "in", 100, 7_500, "2026-09-13T02:00:00Z", "일반"),
  ]);
  const availableForLegacyApproval = calculateTransferableHoldingLots(initialLots, [{
    stockName: "키도산업",
    category: "일반",
    sourceLotId: "reserved-lot",
    quantity: 100,
    status: "pending",
    createdAt: new Date("2026-09-13T03:00:00Z"),
  }]);

  assert.deepEqual(
    availableForLegacyApproval.map(({ id, qty }) => ({ id, qty })),
    [{ id: "legacy-lot", qty: 100 }],
  );

  const afterLegacyApproval = calculateHoldingLots([
    transaction("reserved-lot", "in", 100, 9_000, "2026-09-13T01:00:00Z", "일반"),
    transaction("legacy-lot", "in", 100, 7_500, "2026-09-13T02:00:00Z", "일반"),
    transaction(
      "legacy-approved",
      "out",
      100,
      7_500,
      "2026-09-13T04:00:00Z",
      "일반",
      "입고건출고신청#legacy-request#legacy-lot",
    ),
  ]);

  assert.deepEqual(
    afterLegacyApproval.map(({ id, qty }) => ({ id, qty })),
    [{ id: "reserved-lot", qty: 100 }],
  );
});

test("거부된 신청을 다시 대기로 바꿀 때 같은 입고 건의 중복 예약을 감지한다", () => {
  const lots = calculateHoldingLots([
    transaction("only-lot", "in", 100, 9_000, "2026-09-13T01:00:00Z", "일반"),
  ]);
  const activeRequests = [
    {
      stockName: "키도산업",
      category: "일반",
      sourceLotId: "only-lot",
      quantity: 100,
      status: "pending",
      createdAt: new Date("2026-09-13T02:00:00Z"),
    },
    {
      stockName: "키도산업",
      category: "일반",
      sourceLotId: "only-lot",
      quantity: 100,
      status: "held",
      createdAt: new Date("2026-09-13T03:00:00Z"),
    },
  ];

  assert.equal(areTransferReservationsFulfillable(lots, activeRequests), false);
});