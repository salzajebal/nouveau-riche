import { db } from "./db";
import { users, transferRequests, stockTransactions, unionCodes, ipoStocks } from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";
import { log } from "./index";
import bcrypt from "bcrypt";

export async function repairWrongPurchasePrices() {
  try {
    // 출고 거래 가격(매도가)으로 totalCost를 차감하던 버그로 인해 잘못 저장된 매입단가를
    // 모든 유저에 대해 올바른 비례차감 알고리즘으로 재계산하여 수정합니다.
    const allRequests = await db.select().from(transferRequests);
    const isInType = (t: string) => t === "in" || t === "입고";
    const isOutType = (t: string) => t === "out" || t === "출고" || t === "내 계좌로 옮기기";
    let fixed = 0;
    for (const tr of allRequests) {
      const txs = await db.select().from(stockTransactions)
        .where(eq(stockTransactions.userId, tr.userId));
      // 해당 출고신청 시점까지의 거래만 사용
      const relevant = txs
        .filter(tx => new Date(tx.createdAt) <= new Date(tr.createdAt) && tx.stockName === tr.stockName)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      const h = { qty: 0, totalCost: 0 };
      for (const tx of relevant) {
        if (isInType(tx.type)) {
          h.qty += tx.quantity;
          h.totalCost += tx.quantity * tx.pricePerShare;
        } else if (isOutType(tx.type)) {
          if (h.qty > 0) {
            const avg = h.totalCost / h.qty;
            h.qty -= tx.quantity;
            h.totalCost = h.qty <= 0 ? 0 : h.qty * avg;
            if (h.qty < 0) h.qty = 0;
          }
        }
      }
      const correctAvg = h.qty > 0 ? Math.round(h.totalCost / h.qty) : tr.purchasePrice;
      const correctProfitRate = correctAvg > 0
        ? (((tr.currentPrice - correctAvg) / correctAvg) * 100).toFixed(2)
        : "0";
      const priceChanged = correctAvg !== tr.purchasePrice && correctAvg > 0;
      const rateChanged = correctProfitRate !== tr.profitRate;
      if (priceChanged || rateChanged) {
        const update: Record<string, unknown> = { profitRate: correctProfitRate };
        if (priceChanged) update.purchasePrice = correctAvg;
        await db.update(transferRequests)
          .set(update)
          .where(eq(transferRequests.id, tr.id));
        fixed++;
      }
    }
    if (fixed > 0) log(`repairWrongPurchasePrices: ${fixed}건 매입단가/수익률 수정 완료`);
  } catch (error) {
    log("repairWrongPurchasePrices error: " + String(error));
  }
}

export async function repairApprovedTransfers() {
  try {
    const approved = await db.select().from(transferRequests).where(eq(transferRequests.status, "approved"));
    let created = 0;
    for (const tr of approved) {
      const [existing] = await db.select().from(stockTransactions).where(
        and(
          eq(stockTransactions.userId, tr.userId),
          eq(stockTransactions.type, "out"),
          eq(stockTransactions.stockName, tr.stockName),
          eq(stockTransactions.memo, `출고신청#${tr.id}`)
        )
      );
      if (!existing) {
        await db.insert(stockTransactions).values({
          userId: tr.userId,
          type: "out",
          category: "일반",
          stockName: tr.stockName,
          quantity: tr.quantity,
          pricePerShare: tr.currentPrice || tr.purchasePrice || 0,
          memo: `출고신청#${tr.id}`,
          createdAt: tr.approvedAt || tr.createdAt,
        });
        created++;
      }
    }
    if (created > 0) log(`Repaired ${created} approved transfer(s): out transactions created`);
  } catch (error) {
    log("repairApprovedTransfers error: " + String(error));
  }
}


export async function seedDatabase() {
  try {
    // session 테이블이 없으면 자동 생성
    await db.execute(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
      ) WITH (OIDS=FALSE)
    `);
    await db.execute(`CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire")`);

    const [existingAdmin] = await db.select().from(users).where(eq(users.username, "admin"));
    if (!existingAdmin) {
      const initialAdminPassword = process.env.ADMIN_INITIAL_PASSWORD;
      if (process.env.NODE_ENV === "production" && !initialAdminPassword) {
        throw new Error("초기 관리자 생성을 위해 ADMIN_INITIAL_PASSWORD가 필요합니다.");
      }
      const hashedPassword = await bcrypt.hash(initialAdminPassword || "admin123", 10);
      await db.insert(users).values({
        username: "admin",
        password: hashedPassword,
        fullName: "관리자",
        accountNumber: "000-0000-0000",
        accountHolder: "관리자",
        bank: "KB국민은행",
        isAdmin: true,
      });
      log("Admin account created");
    }

    // 조합코드 기본값 생성
    const defaultCodes = [
      { code: "0304", label: "1차 조합" },
      { code: "231108", label: "2차 조합" },
    ];
    for (const { code, label } of defaultCodes) {
      const [existing] = await db.select().from(unionCodes).where(eq(unionCodes.code, code));
      if (!existing) {
        await db.insert(unionCodes).values({ code, label, isActive: true });
        log(`Union code created: ${code}`);
      }
    }

    // 브릴스 IPO 종목은 한 번만 등록합니다.
    const [brils] = await db.select().from(ipoStocks).where(eq(ipoStocks.stockName, "브릴스"));
    if (!brils) {
      await db.insert(ipoStocks).values({
        stockName: "브릴스",
        startDate: "2026-09-08",
        endDate: "2026-09-09",
        brokers: "미정",
        priceMin: 19500,
        priceMax: 19500,
        competitionRate: null,
        status: "active",
        subscriptionStatus: "청약예정",
      });
      log("IPO stock created: 브릴스");
    }
  } catch (error) {
    log("Seed error: " + String(error));
    if (process.env.NODE_ENV === "production") throw error;
  }
}
