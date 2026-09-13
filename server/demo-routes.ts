import type { Express } from "express";
import { storage } from "./storage";
import { db } from "./db";
import bcrypt from "bcrypt";
import { z } from "zod";
import { insertStockTransactionSchema, updateUserSchema } from "@shared/schema";

const DEMO_PASSWORD = "demo2026";
const DEMO_USERNAME = "demo";

const DEMO_USERS = [
  { username: "test1", fullName: "김테스트", phone: "01011112222", bank: "국민은행", accountNumber: "123456789012", accountHolder: "김테스트", birthDate: "1990-01-15" },
  { username: "test2", fullName: "이데모", phone: "01033334444", bank: "신한은행", accountNumber: "987654321098", accountHolder: "이데모", birthDate: "1988-07-22" },
  { username: "test3", fullName: "박샘플", phone: "01055556666", bank: "우리은행", accountNumber: "555666777888", accountHolder: "박샘플", birthDate: "1995-03-10" },
];

let demoUserIds: string[] = [];

async function getDemoUserIds(): Promise<string[]> {
  if (demoUserIds.length > 0) return demoUserIds;
  const ids: string[] = [];
  for (const u of DEMO_USERS) {
    const user = await storage.getUserByUsername(u.username);
    if (user) ids.push(user.id);
  }
  demoUserIds = ids;
  return ids;
}

const requireDemoAdmin = (req: any, res: any, next: any) => {
  if (!(req.session as any).isDemoAdmin) {
    return res.status(401).json({ message: "데모 관리자 로그인이 필요합니다" });
  }
  next();
};

export function registerDemoRoutes(app: Express) {
  app.post("/api/demo-admin/login", async (req: any, res: any) => {
    const { username, password } = req.body || {};
    if (username === DEMO_USERNAME && password === DEMO_PASSWORD) {
      (req.session as any).isDemoAdmin = true;
      return res.json({ ok: true });
    }
    return res.status(401).json({ message: "데모 계정 정보가 올바르지 않습니다" });
  });

  app.post("/api/demo-admin/logout", async (req: any, res: any) => {
    (req.session as any).isDemoAdmin = false;
    req.session.save(() => {
      res.json({ ok: true });
    });
  });

  app.get("/api/demo-admin/auth-check", async (req: any, res: any) => {
    if (!(req.session as any).isDemoAdmin) {
      return res.status(401).json({ message: "로그인이 필요합니다" });
    }
    return res.json({ user: { isAdmin: true, fullName: "데모 관리자", username: "demo", id: "demo" } });
  });

  app.get("/api/demo-admin/seed", async (_req: any, res: any) => {
    try {
      demoUserIds = [];
      const createdUserIds: string[] = [];

      for (const u of DEMO_USERS) {
        let user = await storage.getUserByUsername(u.username);
        if (!user) {
          const hashed = await bcrypt.hash("demo1234!", 10);
          user = await storage.createUser({
            username: u.username,
            password: hashed,
            plainPassword: "demo1234!",
            fullName: u.fullName,
            phone: u.phone,
            bank: u.bank,
            accountNumber: u.accountNumber,
            accountHolder: u.accountHolder,
            birthDate: u.birthDate,
            email: "",
          });
          await storage.approveUser(user.id);
        }
        createdUserIds.push(user.id);
      }

      demoUserIds = createdUserIds;
      const [id1, id2, id3] = createdUserIds;
      const now = new Date();
      const d = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86400000).toISOString();

      const existingTx = await storage.getAllTransactions();
      const demoTxIds = existingTx.filter((t) => createdUserIds.includes(t.userId)).map((t) => t.id);
      for (const txId of demoTxIds) await storage.deleteTransaction(txId);

      const existingTr = await storage.getAllTransferRequests();
      const demoTrIds = existingTr.filter((t) => createdUserIds.includes(t.userId)).map((t) => t.id);
      for (const trId of demoTrIds) await storage.adminDeleteTransferRequest(trId);

      const txData = [
        { userId: id1, type: "입고", category: "공모주", stockName: "두나무", quantity: 500, pricePerShare: 250000, memo: "공모주 배정", createdAt: d(30) },
        { userId: id1, type: "입고", category: "일반", stockName: "토스", quantity: 300, pricePerShare: 180000, memo: "", createdAt: d(20) },
        { userId: id1, type: "입고", category: "일반", stockName: "컬리", quantity: 200, pricePerShare: 35000, memo: "", createdAt: d(15) },
        { userId: id1, type: "출고", category: "일반", stockName: "컬리", quantity: 100, pricePerShare: 38000, memo: "일부 출고", createdAt: d(5) },
        { userId: id2, type: "입고", category: "공모주", stockName: "야놀자", quantity: 400, pricePerShare: 150000, memo: "", createdAt: d(25) },
        { userId: id2, type: "입고", category: "일반", stockName: "당근", quantity: 600, pricePerShare: 95000, memo: "", createdAt: d(10) },
        { userId: id3, type: "입고", category: "스팩", stockName: "케이뱅크", quantity: 1000, pricePerShare: 12000, memo: "", createdAt: d(40) },
        { userId: id3, type: "입고", category: "일반", stockName: "무신사", quantity: 250, pricePerShare: 320000, memo: "", createdAt: d(22) },
        { userId: id3, type: "입고", category: "공모주", stockName: "두나무", quantity: 200, pricePerShare: 260000, memo: "", createdAt: d(18) },
        { userId: id3, type: "출고", category: "일반", stockName: "케이뱅크", quantity: 200, pricePerShare: 15000, memo: "", createdAt: d(8) },
        { userId: id3, type: "출고", category: "스팩", stockName: "케이뱅크", quantity: 100, pricePerShare: 14000, memo: "", createdAt: d(3) },
      ];

      for (const tx of txData) {
        const created = await storage.createTransaction({
          userId: tx.userId, type: tx.type, category: tx.category, stockName: tx.stockName,
          quantity: tx.quantity, pricePerShare: tx.pricePerShare, memo: tx.memo,
        });
        await storage.updateTransaction(created.id, { createdAt: new Date(tx.createdAt) });
      }

      const trData = [
        { userId: id1, stockName: "두나무", quantity: 100, purchasePrice: 250000, currentPrice: 298000, totalAmount: 29800000, profitRate: "19.20", status: "pending", accountName: "김테스트", accountNumber: "123456789012", brokerName: "국민은행", requestType: "출고신청" },
        { userId: id2, stockName: "야놀자", quantity: 50, purchasePrice: 150000, currentPrice: 165000, totalAmount: 8250000, profitRate: "10.00", status: "approved", accountName: "이데모", accountNumber: "987654321098", brokerName: "신한은행", requestType: "출고신청" },
        { userId: id2, stockName: "당근", quantity: 200, purchasePrice: 95000, currentPrice: 91000, totalAmount: 18200000, profitRate: "-4.21", status: "held", accountName: "이데모", accountNumber: "987654321098", brokerName: "신한은행", requestType: "출고신청" },
        { userId: id3, stockName: "무신사", quantity: 80, purchasePrice: 320000, currentPrice: 340000, totalAmount: 27200000, profitRate: "6.25", status: "rejected", accountName: "박샘플", accountNumber: "555666777888", brokerName: "우리은행", requestType: "출고신청" },
        { userId: id3, stockName: "두나무", quantity: 60, purchasePrice: 260000, currentPrice: 298000, totalAmount: 17880000, profitRate: "14.62", status: "pending", accountName: "박샘플", accountNumber: "555666777888", brokerName: "우리은행", requestType: "출고신청" },
      ];

      for (const tr of trData) {
        const created = await storage.createTransferRequest({
          userId: tr.userId, stockName: tr.stockName, quantity: tr.quantity,
          purchasePrice: tr.purchasePrice, currentPrice: tr.currentPrice,
          totalAmount: tr.totalAmount, profitRate: tr.profitRate,
          accountName: tr.accountName, accountNumber: tr.accountNumber,
          brokerName: tr.brokerName, requestType: tr.requestType,
        });
        if (tr.status !== "pending") {
          await storage.updateTransferRequestStatus(created.id, tr.status);
        }
      }

      return res.json({ message: "데모 데이터 초기화 완료", users: DEMO_USERS.map((u) => u.username) });
    } catch (e: any) {
      return res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/demo-admin/users", requireDemoAdmin, async (_req: any, res: any) => {
    const ids = await getDemoUserIds();
    const allUsers = await storage.getAllUsers();
    const demo = allUsers.filter((u) => ids.includes(u.id)).map((u) => ({ ...u, password: undefined }));
    return res.json(demo);
  });

  app.get("/api/demo-admin/users/pending", requireDemoAdmin, async (_req: any, res: any) => {
    return res.json([]);
  });

  app.post("/api/demo-admin/users/:id/approve", requireDemoAdmin, async (req: any, res: any) => {
    const ids = await getDemoUserIds();
    if (!ids.includes(req.params.id)) return res.status(403).json({ message: "데모 계정만 처리 가능합니다" });
    const user = await storage.approveUser(req.params.id);
    return res.json({ ...user, password: undefined });
  });

  app.post("/api/demo-admin/users/:id/reject", requireDemoAdmin, async (req: any, res: any) => {
    return res.json({ message: "데모에서는 가입 거절을 지원하지 않습니다" });
  });

  app.post("/api/demo-admin/users/:id/hold", requireDemoAdmin, async (req: any, res: any) => {
    const ids = await getDemoUserIds();
    if (!ids.includes(req.params.id)) return res.status(403).json({ message: "데모 계정만 처리 가능합니다" });
    const user = await storage.updateUser(req.params.id, { isFrozen: true });
    return res.json({ message: "보류 처리 완료" });
  });

  app.get("/api/demo-admin/users/:id", requireDemoAdmin, async (req: any, res: any) => {
    const ids = await getDemoUserIds();
    if (!ids.includes(req.params.id)) return res.status(403).json({ message: "접근 권한 없음" });
    const user = await storage.getUser(req.params.id);
    if (!user) return res.status(404).json({ message: "사용자를 찾을 수 없습니다" });
    return res.json({ ...user, password: undefined });
  });

  app.put("/api/demo-admin/users/:id", requireDemoAdmin, async (req: any, res: any) => {
    try {
      const ids = await getDemoUserIds();
      if (!ids.includes(req.params.id)) return res.status(403).json({ message: "데모 계정만 수정 가능합니다" });
      const data = updateUserSchema.parse(req.body);
      const updateData: any = { ...data };
      if (data.password) {
        updateData.plainPassword = data.password;
        updateData.password = await bcrypt.hash(data.password, 10);
      } else {
        delete updateData.password;
      }
      const user = await storage.updateUser(req.params.id, updateData);
      if (!user) return res.status(404).json({ message: "사용자를 찾을 수 없습니다" });
      return res.json({ ...user, password: undefined });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors[0].message });
      return res.status(500).json({ message: "수정에 실패했습니다" });
    }
  });

  app.patch("/api/demo-admin/users/:id/freeze", requireDemoAdmin, async (req: any, res: any) => {
    const ids = await getDemoUserIds();
    if (!ids.includes(req.params.id)) return res.status(403).json({ message: "데모 계정만 처리 가능합니다" });
    const { isFrozen } = req.body;
    const user = await storage.updateUser(req.params.id, { isFrozen: !!isFrozen });
    return res.json({ ...user, password: undefined });
  });

  app.patch("/api/demo-admin/users/:id/manager-code", requireDemoAdmin, async (req: any, res: any) => {
    const ids = await getDemoUserIds();
    if (!ids.includes(req.params.id)) return res.status(403).json({ message: "데모 계정만 처리 가능합니다" });
    const { managerCode } = req.body;
    const code = typeof managerCode === "string" && managerCode.trim() !== "" ? managerCode.trim() : null;
    const user = await storage.updateUserManagerCode(req.params.id, code);
    return res.json({ ...user, password: undefined });
  });

  app.patch("/api/demo-admin/users/:id/site-group", requireDemoAdmin, async (req: any, res: any) => {
    const ids = await getDemoUserIds();
    if (!ids.includes(req.params.id)) return res.status(403).json({ message: "데모 계정만 처리 가능합니다" });
    const { siteGroup } = req.body;
    const val = typeof siteGroup === "string" && siteGroup.trim() !== "" ? siteGroup.trim() : null;
    const user = await storage.updateUserSiteGroup(req.params.id, val);
    return res.json({ ...user, password: undefined });
  });

  app.delete("/api/demo-admin/users/:id", requireDemoAdmin, async (req: any, res: any) => {
    const ids = await getDemoUserIds();
    if (!ids.includes(req.params.id)) return res.status(403).json({ message: "데모 계정만 삭제 가능합니다" });
    await storage.deleteUser(req.params.id);
    demoUserIds = demoUserIds.filter((id) => id !== req.params.id);
    return res.json({ message: "회원 삭제 완료" });
  });

  app.get("/api/demo-admin/transactions", requireDemoAdmin, async (_req: any, res: any) => {
    const ids = await getDemoUserIds();
    const all = await storage.getAllTransactions();
    return res.json(all.filter((t) => ids.includes(t.userId)));
  });

  app.post("/api/demo-admin/transactions", requireDemoAdmin, async (req: any, res: any) => {
    try {
      const ids = await getDemoUserIds();
      const { createdAt: customDate, ...rest } = req.body;
      const data = insertStockTransactionSchema.parse(rest);
      if (!ids.includes(data.userId)) return res.status(403).json({ message: "데모 계정에만 입고/출고 가능합니다" });
      let transaction = await storage.createTransaction(data);
      if (customDate) {
        const updated = await storage.updateTransaction(transaction.id, { createdAt: new Date(customDate) });
        if (updated) transaction = updated;
      }
      return res.json(transaction);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors[0].message });
      return res.status(500).json({ message: "서버 오류가 발생했습니다" });
    }
  });

  app.put("/api/demo-admin/transactions/:id", requireDemoAdmin, async (req: any, res: any) => {
    try {
      const { quantity, pricePerShare, memo, category, createdAt } = req.body;
      const updateData: any = {};
      if (quantity !== undefined) updateData.quantity = parseInt(quantity);
      if (pricePerShare !== undefined) updateData.pricePerShare = parseInt(pricePerShare);
      if (memo !== undefined) updateData.memo = memo;
      if (category !== undefined) updateData.category = category;
      if (createdAt !== undefined) updateData.createdAt = new Date(createdAt);
      const tx = await storage.updateTransaction(req.params.id, updateData);
      if (!tx) return res.status(404).json({ message: "거래를 찾을 수 없습니다" });
      return res.json(tx);
    } catch {
      return res.status(500).json({ message: "거래 수정에 실패했습니다" });
    }
  });

  app.delete("/api/demo-admin/transactions/:id", requireDemoAdmin, async (req: any, res: any) => {
    try {
      await storage.deleteTransaction(req.params.id);
      return res.json({ message: "삭제 완료" });
    } catch {
      return res.status(500).json({ message: "삭제 실패" });
    }
  });

  app.get("/api/demo-admin/transfer-requests", requireDemoAdmin, async (_req: any, res: any) => {
    const ids = await getDemoUserIds();
    const all = await storage.getAllTransferRequests();
    return res.json(all.filter((t) => ids.includes(t.userId)));
  });

  app.patch("/api/demo-admin/transfer-requests/:id", requireDemoAdmin, async (req: any, res: any) => {
    try {
      const { status, adminMemo } = req.body;
      if (!["pending", "approved", "rejected", "held"].includes(status)) {
        return res.status(400).json({ message: "유효하지 않은 상태입니다" });
      }
      const updated = await storage.updateTransferRequestStatus(req.params.id, status, adminMemo);
      if (!updated) return res.status(404).json({ message: "신청을 찾을 수 없습니다" });
      return res.json(updated);
    } catch {
      return res.status(500).json({ message: "상태 변경에 실패했습니다" });
    }
  });

  app.delete("/api/demo-admin/transfer-requests/:id", requireDemoAdmin, async (req: any, res: any) => {
    try {
      await storage.adminDeleteTransferRequest(req.params.id);
      return res.json({ success: true });
    } catch {
      return res.status(500).json({ message: "삭제에 실패했습니다" });
    }
  });

  app.get("/api/demo-admin/ipo-stocks", requireDemoAdmin, async (_req: any, res: any) => {
    const stocks = await storage.getAllIpoStocks();
    return res.json(stocks);
  });

  app.post("/api/demo-admin/ipo-stocks", requireDemoAdmin, async (req: any, res: any) => {
    try {
      const { stockName, startDate, endDate, brokers, priceMin, priceMax, competitionRate, status, subscriptionStatus } = req.body;
      if (!stockName || !startDate || !endDate || !brokers || priceMin == null || priceMax == null) {
        return res.status(400).json({ message: "필수 항목을 모두 입력해주세요" });
      }
      const stock = await storage.createIpoStock({
        stockName, startDate, endDate, brokers,
        priceMin: parseInt(priceMin), priceMax: parseInt(priceMax),
        competitionRate: competitionRate || null,
        status: status || "active",
        subscriptionStatus: subscriptionStatus || "청약예정",
      });
      return res.json(stock);
    } catch {
      return res.status(500).json({ message: "종목 추가에 실패했습니다" });
    }
  });

  app.patch("/api/demo-admin/ipo-stocks/:id", requireDemoAdmin, async (req: any, res: any) => {
    try {
      const data = { ...req.body };
      if (data.priceMin != null) data.priceMin = parseInt(data.priceMin);
      if (data.priceMax != null) data.priceMax = parseInt(data.priceMax);
      const updated = await storage.updateIpoStock(req.params.id, data);
      if (!updated) return res.status(404).json({ message: "종목을 찾을 수 없습니다" });
      return res.json(updated);
    } catch {
      return res.status(500).json({ message: "종목 수정에 실패했습니다" });
    }
  });

  app.delete("/api/demo-admin/ipo-stocks/:id", requireDemoAdmin, async (req: any, res: any) => {
    try {
      await storage.deleteIpoStock(req.params.id);
      return res.json({ message: "삭제 완료" });
    } catch {
      return res.status(500).json({ message: "종목 삭제에 실패했습니다" });
    }
  });

  app.get("/api/demo-admin/domain-groups", requireDemoAdmin, async (_req: any, res: any) => {
    return res.json([]);
  });

  app.get("/api/demo-admin/domain-fallbacks", requireDemoAdmin, async (_req: any, res: any) => {
    return res.json([]);
  });

  app.post("/api/demo-admin/domain-fallbacks", requireDemoAdmin, async (_req: any, res: any) => {
    return res.status(403).json({ message: "데모에서는 도메인 관리를 지원하지 않습니다" });
  });

  app.patch("/api/demo-admin/domain-fallbacks/reorder", requireDemoAdmin, async (_req: any, res: any) => {
    return res.json({ message: "ok" });
  });

  app.patch("/api/demo-admin/domain-fallbacks/:id", requireDemoAdmin, async (_req: any, res: any) => {
    return res.status(403).json({ message: "데모에서는 도메인 관리를 지원하지 않습니다" });
  });

  app.delete("/api/demo-admin/domain-fallbacks/:id", requireDemoAdmin, async (_req: any, res: any) => {
    return res.status(403).json({ message: "데모에서는 도메인 관리를 지원하지 않습니다" });
  });

  app.put("/api/demo-admin/domain-groups/:domain", requireDemoAdmin, async (_req: any, res: any) => {
    return res.status(403).json({ message: "데모에서는 도메인 관리를 지원하지 않습니다" });
  });

  app.delete("/api/demo-admin/domain-groups/:domain", requireDemoAdmin, async (_req: any, res: any) => {
    return res.status(403).json({ message: "데모에서는 도메인 관리를 지원하지 않습니다" });
  });

  app.get("/api/demo-admin/blocked-ips", requireDemoAdmin, async (_req: any, res: any) => {
    return res.json([]);
  });

  app.post("/api/demo-admin/blocked-ips", requireDemoAdmin, async (_req: any, res: any) => {
    return res.status(403).json({ message: "데모에서는 IP 차단을 지원하지 않습니다" });
  });

  app.delete("/api/demo-admin/blocked-ips/:id", requireDemoAdmin, async (_req: any, res: any) => {
    return res.status(403).json({ message: "데모에서는 IP 차단을 지원하지 않습니다" });
  });

  app.get("/api/demo-admin/login-logs", requireDemoAdmin, async (_req: any, res: any) => {
    return res.json([]);
  });

  app.get("/api/demo-admin/login-logs/:userId", requireDemoAdmin, async (_req: any, res: any) => {
    return res.json([]);
  });
}
