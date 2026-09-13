import { type User, type InsertUser, type StockTransaction, type InsertStockTransaction, type TransferRequest, type InsertTransferRequest, type ChatRoom, type ChatMessage, type InsertChatMessage, type ChatMacro, type InsertChatMacro, type IpoStock, type InsertIpoStock, type PopularIpoStock, type InsertPopularIpoStock, type StockCatalog, type InsertStockCatalog, type Watchlist, type DomainGroup, type LoginLog, type DomainFallbackUrl, type InsertDomainFallbackUrl, type BlockedIp, type StockMemberTransfer, type InsertStockMemberTransfer, type UnionCode, type WithdrawRequest, type InsertWithdrawRequest, users, stockTransactions, stockCatalog, transferRequests, chatRooms, chatMessages, chatMacros, ipoStocks, popularIpoStocks, watchlist, domainGroups, loginLogs, domainFallbackUrls, blockedIps, stockMemberTransfers, unionCodes, withdrawRequests } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql, asc, inArray } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByPhone(phone: string, siteGroup?: string | null): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  getPendingUsers(): Promise<User[]>;
  approveUser(id: string): Promise<User | undefined>;
  updateUser(id: string, data: Partial<Pick<User, "fullName" | "accountNumber" | "accountHolder" | "bank" | "password" | "isFrozen" | "unionCode">>): Promise<User | undefined>;
  updateUserManagerCode(id: string, managerCode: string | null): Promise<User | undefined>;
  updateUserUnionCode(id: string, unionCode: string | null): Promise<User | undefined>;
  updateUserSiteGroup(id: string, siteGroup: string | null): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;
  adminDeleteTransferRequest(id: string): Promise<void>;
  getAllBlockedIps(): Promise<BlockedIp[]>;
  addBlockedIp(ip: string, reason?: string): Promise<BlockedIp>;
  removeBlockedIp(id: string): Promise<void>;
  isIpBlocked(ip: string): Promise<boolean>;
  getAllDomainGroups(): Promise<DomainGroup[]>;
  upsertDomainGroup(domain: string, groupName: string, managerCode?: string | null): Promise<DomainGroup>;
  getDomainGroup(domain: string): Promise<DomainGroup | undefined>;
  deleteDomainGroup(domain: string): Promise<void>;
  getTransaction(id: string): Promise<StockTransaction | undefined>;
  getTransactionsByUserId(userId: string): Promise<StockTransaction[]>;
  getAllTransactions(): Promise<StockTransaction[]>;
  createTransaction(tx: InsertStockTransaction): Promise<StockTransaction>;
  updateTransaction(id: string, data: Partial<Pick<StockTransaction, "quantity" | "pricePerShare" | "memo" | "category" | "createdAt">>): Promise<StockTransaction | undefined>;
  toggleTransactionHidden(id: string): Promise<StockTransaction | undefined>;
  deleteTransaction(id: string): Promise<void>;
  getAllStockCatalog(): Promise<StockCatalog[]>;
  getActiveStockCatalog(): Promise<StockCatalog[]>;
  createStockCatalog(data: InsertStockCatalog): Promise<StockCatalog>;
  updateStockCatalog(id: string, data: Partial<InsertStockCatalog>): Promise<StockCatalog | undefined>;
  deleteStockCatalog(id: string): Promise<void>;
  createTransferRequest(data: InsertTransferRequest): Promise<TransferRequest>;
  getTransferRequest(id: string): Promise<TransferRequest | undefined>;
  getTransferRequestsByUserId(userId: string): Promise<TransferRequest[]>;
  getAllTransferRequests(): Promise<TransferRequest[]>;
  updateTransferRequestStatus(id: string, status: string, adminMemo?: string): Promise<TransferRequest | undefined>;
  updateTransferRequestDate(id: string, createdAt: Date): Promise<TransferRequest | undefined>;
  updateTransferRequestPurchasePrice(id: string, purchasePrice: number): Promise<TransferRequest | undefined>;
  getOrCreateChatRoom(userId: string): Promise<ChatRoom>;
  getChatRoomsByUserId(userId: string): Promise<ChatRoom[]>;
  getAllChatRooms(): Promise<ChatRoom[]>;
  getChatMessages(roomId: string): Promise<ChatMessage[]>;
  getChatMessage(id: string): Promise<ChatMessage | undefined>;
  createChatMessage(data: InsertChatMessage): Promise<ChatMessage>;
  updateChatRoomLastMessage(roomId: string): Promise<void>;
  getUnreadCountByRoom(roomId: string): Promise<number>;
  getTotalUnreadCountForAdmin(): Promise<number>;
  markMessagesAsReadByAdmin(roomId: string): Promise<void>;
  markMessagesAsReadByMember(roomId: string, messageIds: string[]): Promise<ChatMessage[]>;
  recallAdminChatMessage(id: string): Promise<ChatMessage | undefined>;
  getChatMacros(): Promise<ChatMacro[]>;
  createChatMacro(data: InsertChatMacro): Promise<ChatMacro>;
  updateChatMacro(id: string, data: Partial<InsertChatMacro>): Promise<ChatMacro | undefined>;
  deleteChatMacro(id: string): Promise<void>;
  getAllIpoStocks(): Promise<IpoStock[]>;
  getActiveIpoStocks(): Promise<IpoStock[]>;
  createIpoStock(data: InsertIpoStock): Promise<IpoStock>;
  updateIpoStock(id: string, data: Partial<InsertIpoStock>): Promise<IpoStock | undefined>;
  deleteIpoStock(id: string): Promise<void>;
  getAllPopularIpoStocks(): Promise<PopularIpoStock[]>;
  getActivePopularIpoStocks(): Promise<PopularIpoStock[]>;
  createPopularIpoStock(data: InsertPopularIpoStock): Promise<PopularIpoStock>;
  updatePopularIpoStock(id: string, data: Partial<InsertPopularIpoStock>): Promise<PopularIpoStock | undefined>;
  deletePopularIpoStock(id: string): Promise<void>;
  reorderPopularIpoStocks(ids: string[]): Promise<void>;
  getWatchlist(userId: string): Promise<Watchlist[]>;
  addToWatchlist(userId: string, stockName: string): Promise<Watchlist>;
  removeFromWatchlist(userId: string, stockName: string): Promise<void>;
  isInWatchlist(userId: string, stockName: string): Promise<boolean>;
  createLoginLog(data: { userId: string; ipAddress?: string; domain?: string; userAgent?: string }): Promise<LoginLog>;
  getLoginLogsByUserId(userId: string): Promise<LoginLog[]>;
  getAllLoginLogs(): Promise<LoginLog[]>;
  getAllFallbackUrls(): Promise<DomainFallbackUrl[]>;
  getActiveFallbackUrls(): Promise<DomainFallbackUrl[]>;
  createFallbackUrl(data: InsertDomainFallbackUrl): Promise<DomainFallbackUrl>;
  updateFallbackUrl(id: string, data: Partial<Pick<DomainFallbackUrl, "url" | "label" | "priority" | "isActive">>): Promise<DomainFallbackUrl | undefined>;
  deleteFallbackUrl(id: string): Promise<void>;
  reorderFallbackUrls(ids: string[]): Promise<void>;
  createStockMemberTransfer(data: InsertStockMemberTransfer): Promise<StockMemberTransfer>;
  getStockMemberTransfersByFromUserId(userId: string): Promise<StockMemberTransfer[]>;
  getAllStockMemberTransfers(): Promise<StockMemberTransfer[]>;
  updateStockMemberTransferStatus(id: string, status: string, adminMemo?: string): Promise<StockMemberTransfer | undefined>;
  getAllUnionCodes(): Promise<UnionCode[]>;
  getActiveUnionCodes(): Promise<UnionCode[]>;
  createUnionCode(code: string, label: string): Promise<UnionCode>;
  updateUnionCode(id: string, data: Partial<Pick<UnionCode, "code" | "label" | "isActive">>): Promise<UnionCode | undefined>;
  deleteUnionCode(id: string): Promise<void>;
  // 예수금
  addDepositBalance(userId: string, amount: number): Promise<User | undefined>;
  setDepositBalance(userId: string, amount: number): Promise<User | undefined>;
  updateUserCanSell(userId: string, canSell: boolean): Promise<User | undefined>;
  resetAllCanSell(): Promise<number>;
  // 출금신청
  createWithdrawRequest(data: InsertWithdrawRequest): Promise<WithdrawRequest>;
  getWithdrawRequestsByUserId(userId: string): Promise<WithdrawRequest[]>;
  getAllWithdrawRequests(): Promise<WithdrawRequest[]>;
  updateWithdrawRequestStatus(id: string, status: string, adminMemo?: string): Promise<WithdrawRequest | undefined>;
  deleteWithdrawRequest(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const trimmed = username.trim();
    const [user] = await db.select().from(users).where(
      sql`TRIM(${users.username}) = ${trimmed}`
    );
    return user;
  }

  async getUserByPhone(phone: string, siteGroup?: string | null): Promise<User | undefined> {
    if (siteGroup) {
      const [user] = await db.select().from(users).where(
        and(eq(users.phone, phone), eq(users.siteGroup, siteGroup))
      );
      return user;
    }
    const [user] = await db.select().from(users).where(eq(users.phone, phone));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async getPendingUsers(): Promise<User[]> {
    return db.select().from(users).where(and(eq(users.isApproved, false), eq(users.isAdmin, false), eq(users.isFrozen, false))).orderBy(desc(users.createdAt));
  }

  async approveUser(id: string): Promise<User | undefined> {
    const [user] = await db.update(users).set({ isApproved: true }).where(eq(users.id, id)).returning();
    return user;
  }

  async getTransaction(id: string): Promise<StockTransaction | undefined> {
    const [tx] = await db.select().from(stockTransactions).where(eq(stockTransactions.id, id));
    return tx;
  }

  async getTransactionsByUserId(userId: string): Promise<StockTransaction[]> {
    return db.select().from(stockTransactions).where(eq(stockTransactions.userId, userId)).orderBy(asc(stockTransactions.createdAt));
  }

  async getAllTransactions(): Promise<StockTransaction[]> {
    return db.select().from(stockTransactions).orderBy(desc(stockTransactions.createdAt));
  }

  async createTransaction(tx: InsertStockTransaction): Promise<StockTransaction> {
    const [transaction] = await db.insert(stockTransactions).values(tx).returning();
    return transaction;
  }

  async updateUser(id: string, data: Partial<Pick<User, "fullName" | "accountNumber" | "accountHolder" | "bank" | "password" | "isFrozen" | "unionCode">>): Promise<User | undefined> {
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return user;
  }

  async updateUserManagerCode(id: string, managerCode: string | null): Promise<User | undefined> {
    const [user] = await db.update(users).set({ managerCode: managerCode || null }).where(eq(users.id, id)).returning();
    return user;
  }

  async updateUserUnionCode(id: string, unionCode: string | null): Promise<User | undefined> {
    const [user] = await db.update(users).set({ unionCode: unionCode || null }).where(eq(users.id, id)).returning();
    return user;
  }

  async updateUserSiteGroup(id: string, siteGroup: string | null): Promise<User | undefined> {
    const [user] = await db.update(users).set({ siteGroup: siteGroup || null }).where(eq(users.id, id)).returning();
    return user;
  }

  async getAllDomainGroups(): Promise<DomainGroup[]> {
    return db.select().from(domainGroups).orderBy(domainGroups.domain);
  }

  async upsertDomainGroup(domain: string, groupName: string, managerCode?: string | null, redirectUrl?: string | null): Promise<DomainGroup> {
    const [result] = await db.insert(domainGroups)
      .values({ domain, groupName, managerCode: managerCode ?? null, redirectUrl: redirectUrl ?? null })
      .onConflictDoUpdate({ target: domainGroups.domain, set: { groupName, managerCode: managerCode ?? null, redirectUrl: redirectUrl ?? null } })
      .returning();
    return result;
  }

  async getDomainGroup(domain: string): Promise<DomainGroup | undefined> {
    const [result] = await db.select().from(domainGroups).where(eq(domainGroups.domain, domain));
    return result;
  }

  async deleteDomainGroup(domain: string): Promise<void> {
    await db.delete(domainGroups).where(eq(domainGroups.domain, domain));
  }

  async deleteUser(id: string): Promise<void> {
    // 연관 데이터 전체 삭제 후 회원 삭제 (순서 중요)
    await db.delete(loginLogs).where(eq(loginLogs.userId, id));
    await db.delete(watchlist).where(eq(watchlist.userId, id));
    await db.delete(transferRequests).where(eq(transferRequests.userId, id));
    await db.delete(stockMemberTransfers).where(eq(stockMemberTransfers.fromUserId, id));
    await db.delete(stockMemberTransfers).where(eq(stockMemberTransfers.toUserId, id));
    // 채팅방에 속한 메시지 먼저 삭제
    const rooms = await db.select().from(chatRooms).where(eq(chatRooms.userId, id));
    for (const room of rooms) {
      await db.delete(chatMessages).where(eq(chatMessages.roomId, room.id));
    }
    await db.delete(chatRooms).where(eq(chatRooms.userId, id));
    await db.delete(stockTransactions).where(eq(stockTransactions.userId, id));
    await db.delete(users).where(eq(users.id, id));
  }

  async updateTransaction(id: string, data: Partial<Pick<StockTransaction, "quantity" | "pricePerShare" | "memo" | "category" | "createdAt">>): Promise<StockTransaction | undefined> {
    const [tx] = await db.update(stockTransactions).set(data).where(eq(stockTransactions.id, id)).returning();
    return tx;
  }

  async toggleTransactionHidden(id: string): Promise<StockTransaction | undefined> {
    const [current] = await db.select().from(stockTransactions).where(eq(stockTransactions.id, id));
    if (!current) return undefined;
    const [tx] = await db.update(stockTransactions).set({ hidden: !current.hidden }).where(eq(stockTransactions.id, id)).returning();
    return tx;
  }

  async deleteTransaction(id: string): Promise<void> {
    await db.delete(stockTransactions).where(eq(stockTransactions.id, id));
  }

  async getAllStockCatalog(): Promise<StockCatalog[]> {
    return db.select().from(stockCatalog).orderBy(asc(stockCatalog.stockName));
  }

  async getActiveStockCatalog(): Promise<StockCatalog[]> {
    return db.select().from(stockCatalog)
      .where(eq(stockCatalog.isActive, true))
      .orderBy(asc(stockCatalog.stockName));
  }

  async createStockCatalog(data: InsertStockCatalog): Promise<StockCatalog> {
    const [stock] = await db.insert(stockCatalog).values(data).returning();
    return stock;
  }

  async updateStockCatalog(id: string, data: Partial<InsertStockCatalog>): Promise<StockCatalog | undefined> {
    const [stock] = await db.update(stockCatalog)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(stockCatalog.id, id))
      .returning();
    return stock;
  }

  async deleteStockCatalog(id: string): Promise<void> {
    await db.delete(stockCatalog).where(eq(stockCatalog.id, id));
  }

  async createTransferRequest(data: InsertTransferRequest): Promise<TransferRequest> {
    const [req] = await db.insert(transferRequests).values(data).returning();
    return req;
  }

  async getPendingTransferRequestsByUserId(userId: string): Promise<TransferRequest[]> {
    return db.select().from(transferRequests)
      .where(and(
        eq(transferRequests.userId, userId),
        inArray(transferRequests.status, ["pending", "출고대기중", "held"])
      ));
  }

  async deleteTransferRequest(id: string, userId: string): Promise<boolean> {
    const [deleted] = await db.delete(transferRequests)
      .where(and(eq(transferRequests.id, id), eq(transferRequests.userId, userId)))
      .returning();
    return !!deleted;
  }

  async adminDeleteTransferRequest(id: string): Promise<void> {
    await db.delete(transferRequests).where(eq(transferRequests.id, id));
  }

  async getAllBlockedIps(): Promise<BlockedIp[]> {
    return db.select().from(blockedIps).orderBy(desc(blockedIps.createdAt));
  }

  async addBlockedIp(ip: string, reason?: string): Promise<BlockedIp> {
    const [item] = await db.insert(blockedIps).values({ ip, reason: reason || null }).returning();
    return item;
  }

  async removeBlockedIp(id: string): Promise<void> {
    await db.delete(blockedIps).where(eq(blockedIps.id, id));
  }

  async isIpBlocked(ip: string): Promise<boolean> {
    const [item] = await db.select().from(blockedIps).where(eq(blockedIps.ip, ip));
    return !!item;
  }

  async getTransferRequestsByUserId(userId: string): Promise<TransferRequest[]> {
    return db.select().from(transferRequests).where(eq(transferRequests.userId, userId)).orderBy(desc(transferRequests.createdAt));
  }

  async getTransferRequest(id: string): Promise<TransferRequest | undefined> {
    const [req] = await db.select().from(transferRequests).where(eq(transferRequests.id, id));
    return req;
  }

  async getAllTransferRequests(): Promise<TransferRequest[]> {
    return db.select().from(transferRequests).orderBy(desc(transferRequests.createdAt));
  }

  async updateTransferRequestStatus(id: string, status: string, adminMemo?: string): Promise<TransferRequest | undefined> {
    const updateData: any = { status };
    if (adminMemo !== undefined) updateData.adminMemo = adminMemo;
    if (status === "approved" || status === "rejected" || status === "held" || status === "출고대기중") {
      updateData.approvedAt = new Date();
    }
    const [req] = await db.update(transferRequests).set(updateData).where(eq(transferRequests.id, id)).returning();
    return req;
  }

  async updateTransferRequestDate(id: string, createdAt: Date): Promise<TransferRequest | undefined> {
    const [req] = await db.update(transferRequests).set({ createdAt }).where(eq(transferRequests.id, id)).returning();
    return req;
  }

  async updateTransferRequestPurchasePrice(id: string, purchasePrice: number): Promise<TransferRequest | undefined> {
    const [req] = await db.update(transferRequests).set({ purchasePrice }).where(eq(transferRequests.id, id)).returning();
    return req;
  }

  async getOrCreateChatRoom(userId: string): Promise<ChatRoom> {
    const [existing] = await db.select().from(chatRooms)
      .where(and(eq(chatRooms.userId, userId), eq(chatRooms.status, "open")));
    if (existing) return existing;
    const [room] = await db.insert(chatRooms).values({ userId }).returning();
    return room;
  }

  async getChatRoomsByUserId(userId: string): Promise<ChatRoom[]> {
    return db.select().from(chatRooms).where(eq(chatRooms.userId, userId)).orderBy(desc(chatRooms.lastMessageAt));
  }

  async getAllChatRooms(): Promise<ChatRoom[]> {
    return db.select().from(chatRooms).orderBy(desc(chatRooms.lastMessageAt));
  }

  async getChatMessages(roomId: string): Promise<ChatMessage[]> {
    return db.select().from(chatMessages).where(eq(chatMessages.roomId, roomId)).orderBy(chatMessages.createdAt);
  }

  async getChatMessage(id: string): Promise<ChatMessage | undefined> {
    const [message] = await db.select().from(chatMessages).where(eq(chatMessages.id, id));
    return message;
  }

  async createChatMessage(data: InsertChatMessage): Promise<ChatMessage> {
    const [msg] = await db.insert(chatMessages).values({
      ...data,
      isReadByMember: data.senderRole === "admin" ? 0 : 1,
    }).returning();
    return msg;
  }

  async updateChatRoomLastMessage(roomId: string): Promise<void> {
    await db.update(chatRooms).set({ lastMessageAt: new Date() }).where(eq(chatRooms.id, roomId));
  }

  async getUnreadCountByRoom(roomId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` })
      .from(chatMessages)
      .where(and(eq(chatMessages.roomId, roomId), eq(chatMessages.senderRole, "user"), eq(chatMessages.isReadByAdmin, 0)));
    return result[0]?.count ?? 0;
  }

  async getTotalUnreadCountForAdmin(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` })
      .from(chatMessages)
      .where(and(eq(chatMessages.senderRole, "user"), eq(chatMessages.isReadByAdmin, 0)));
    return result[0]?.count ?? 0;
  }

  async markMessagesAsReadByAdmin(roomId: string): Promise<void> {
    await db.update(chatMessages)
      .set({ isReadByAdmin: 1 })
      .where(and(eq(chatMessages.roomId, roomId), eq(chatMessages.senderRole, "user"), eq(chatMessages.isReadByAdmin, 0)));
  }

  async markMessagesAsReadByMember(roomId: string, messageIds: string[]): Promise<ChatMessage[]> {
    if (messageIds.length === 0) return [];
    return db.update(chatMessages).set({ isReadByMember: 1 })
      .where(and(
        eq(chatMessages.roomId, roomId),
        eq(chatMessages.senderRole, "admin"),
        eq(chatMessages.isReadByMember, 0),
        inArray(chatMessages.id, messageIds),
      ))
      .returning();
  }

  async recallAdminChatMessage(id: string): Promise<ChatMessage | undefined> {
    const [deleted] = await db.delete(chatMessages).where(and(
      eq(chatMessages.id, id), eq(chatMessages.senderRole, "admin"), eq(chatMessages.isReadByMember, 0),
    )).returning();
    return deleted;
  }

  async getChatMacros(): Promise<ChatMacro[]> {
    return db.select().from(chatMacros).orderBy(asc(chatMacros.sortOrder), asc(chatMacros.createdAt));
  }

  async createChatMacro(data: InsertChatMacro): Promise<ChatMacro> {
    const [macro] = await db.insert(chatMacros).values(data).returning();
    return macro;
  }

  async updateChatMacro(id: string, data: Partial<InsertChatMacro>): Promise<ChatMacro | undefined> {
    const [macro] = await db.update(chatMacros).set({ ...data, updatedAt: new Date() }).where(eq(chatMacros.id, id)).returning();
    return macro;
  }

  async deleteChatMacro(id: string): Promise<void> {
    await db.delete(chatMacros).where(eq(chatMacros.id, id));
  }

  async getAllIpoStocks(): Promise<IpoStock[]> {
    return db.select().from(ipoStocks).orderBy(desc(ipoStocks.createdAt));
  }

  async getActiveIpoStocks(): Promise<IpoStock[]> {
    return db.select().from(ipoStocks).where(eq(ipoStocks.status, "active")).orderBy(desc(ipoStocks.createdAt));
  }

  async createIpoStock(data: InsertIpoStock): Promise<IpoStock> {
    const [stock] = await db.insert(ipoStocks).values(data).returning();
    return stock;
  }

  async updateIpoStock(id: string, data: Partial<InsertIpoStock>): Promise<IpoStock | undefined> {
    const [stock] = await db.update(ipoStocks).set(data).where(eq(ipoStocks.id, id)).returning();
    return stock;
  }

  async deleteIpoStock(id: string): Promise<void> {
    await db.delete(ipoStocks).where(eq(ipoStocks.id, id));
  }

  async getAllPopularIpoStocks(): Promise<PopularIpoStock[]> {
    return db.select().from(popularIpoStocks)
      .orderBy(asc(popularIpoStocks.sortOrder), asc(popularIpoStocks.createdAt));
  }

  async getActivePopularIpoStocks(): Promise<PopularIpoStock[]> {
    return db.select().from(popularIpoStocks)
      .where(eq(popularIpoStocks.isActive, true))
      .orderBy(asc(popularIpoStocks.sortOrder), asc(popularIpoStocks.createdAt));
  }

  async createPopularIpoStock(data: InsertPopularIpoStock): Promise<PopularIpoStock> {
    const [stock] = await db.insert(popularIpoStocks).values(data).returning();
    return stock;
  }

  async updatePopularIpoStock(id: string, data: Partial<InsertPopularIpoStock>): Promise<PopularIpoStock | undefined> {
    const [stock] = await db.update(popularIpoStocks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(popularIpoStocks.id, id))
      .returning();
    return stock;
  }

  async deletePopularIpoStock(id: string): Promise<void> {
    await db.delete(popularIpoStocks).where(eq(popularIpoStocks.id, id));
  }

  async reorderPopularIpoStocks(ids: string[]): Promise<void> {
    for (let i = 0; i < ids.length; i++) {
      await db.update(popularIpoStocks)
        .set({ sortOrder: i + 1, updatedAt: new Date() })
        .where(eq(popularIpoStocks.id, ids[i]));
    }
  }

  async getWatchlist(userId: string): Promise<Watchlist[]> {
    return db.select().from(watchlist).where(eq(watchlist.userId, userId)).orderBy(desc(watchlist.createdAt));
  }

  async addToWatchlist(userId: string, stockName: string): Promise<Watchlist> {
    const [item] = await db.insert(watchlist).values({ userId, stockName }).returning();
    return item;
  }

  async removeFromWatchlist(userId: string, stockName: string): Promise<void> {
    await db.delete(watchlist).where(and(eq(watchlist.userId, userId), eq(watchlist.stockName, stockName)));
  }

  async isInWatchlist(userId: string, stockName: string): Promise<boolean> {
    const [item] = await db.select().from(watchlist).where(and(eq(watchlist.userId, userId), eq(watchlist.stockName, stockName)));
    return !!item;
  }

  async createLoginLog(data: { userId: string; ipAddress?: string; domain?: string; userAgent?: string }): Promise<LoginLog> {
    const [log] = await db.insert(loginLogs).values(data).returning();
    return log;
  }

  async getLoginLogsByUserId(userId: string): Promise<LoginLog[]> {
    return db.select().from(loginLogs).where(eq(loginLogs.userId, userId)).orderBy(desc(loginLogs.createdAt)).limit(50);
  }

  async getAllLoginLogs(): Promise<LoginLog[]> {
    return db.select().from(loginLogs).orderBy(desc(loginLogs.createdAt));
  }

  async getAllFallbackUrls(): Promise<DomainFallbackUrl[]> {
    return db.select().from(domainFallbackUrls).orderBy(asc(domainFallbackUrls.priority), asc(domainFallbackUrls.createdAt));
  }

  async getActiveFallbackUrls(): Promise<DomainFallbackUrl[]> {
    return db.select().from(domainFallbackUrls)
      .where(eq(domainFallbackUrls.isActive, true))
      .orderBy(asc(domainFallbackUrls.priority), asc(domainFallbackUrls.createdAt));
  }

  async createFallbackUrl(data: InsertDomainFallbackUrl): Promise<DomainFallbackUrl> {
    const [item] = await db.insert(domainFallbackUrls).values(data).returning();
    return item;
  }

  async updateFallbackUrl(id: string, data: Partial<Pick<DomainFallbackUrl, "url" | "label" | "priority" | "isActive">>): Promise<DomainFallbackUrl | undefined> {
    const [item] = await db.update(domainFallbackUrls).set(data).where(eq(domainFallbackUrls.id, id)).returning();
    return item;
  }

  async deleteFallbackUrl(id: string): Promise<void> {
    await db.delete(domainFallbackUrls).where(eq(domainFallbackUrls.id, id));
  }

  async reorderFallbackUrls(ids: string[]): Promise<void> {
    for (let i = 0; i < ids.length; i++) {
      await db.update(domainFallbackUrls).set({ priority: i + 1 }).where(eq(domainFallbackUrls.id, ids[i]));
    }
  }

  async createStockMemberTransfer(data: InsertStockMemberTransfer): Promise<StockMemberTransfer> {
    const [item] = await db.insert(stockMemberTransfers).values(data).returning();
    return item;
  }

  async getStockMemberTransfersByFromUserId(userId: string): Promise<StockMemberTransfer[]> {
    return db.select().from(stockMemberTransfers)
      .where(eq(stockMemberTransfers.fromUserId, userId))
      .orderBy(desc(stockMemberTransfers.createdAt));
  }

  async getAllStockMemberTransfers(): Promise<StockMemberTransfer[]> {
    return db.select().from(stockMemberTransfers).orderBy(desc(stockMemberTransfers.createdAt));
  }

  async updateStockMemberTransferStatus(id: string, status: string, adminMemo?: string): Promise<StockMemberTransfer | undefined> {
    const updateData: any = { status };
    if (adminMemo !== undefined) updateData.adminMemo = adminMemo;
    if (status === "approved" || status === "rejected") {
      updateData.processedAt = new Date();
    }
    const [item] = await db.update(stockMemberTransfers).set(updateData).where(eq(stockMemberTransfers.id, id)).returning();
    return item;
  }

  async getAllUnionCodes(): Promise<UnionCode[]> {
    return db.select().from(unionCodes).orderBy(asc(unionCodes.createdAt));
  }

  async getActiveUnionCodes(): Promise<UnionCode[]> {
    return db.select().from(unionCodes).where(eq(unionCodes.isActive, true)).orderBy(asc(unionCodes.createdAt));
  }

  async createUnionCode(code: string, label: string): Promise<UnionCode> {
    const [item] = await db.insert(unionCodes).values({ code, label }).returning();
    return item;
  }

  async updateUnionCode(id: string, data: Partial<Pick<UnionCode, "code" | "label" | "isActive">>): Promise<UnionCode | undefined> {
    const [item] = await db.update(unionCodes).set(data).where(eq(unionCodes.id, id)).returning();
    return item;
  }

  async deleteUnionCode(id: string): Promise<void> {
    await db.delete(unionCodes).where(eq(unionCodes.id, id));
  }

  async addDepositBalance(userId: string, amount: number): Promise<User | undefined> {
    const [user] = await db.update(users)
      .set({ depositBalance: sql`deposit_balance + ${amount}` })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async setDepositBalance(userId: string, amount: number): Promise<User | undefined> {
    const [user] = await db.update(users)
      .set({ depositBalance: amount })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateUserCanSell(userId: string, canSell: boolean): Promise<User | undefined> {
    const [user] = await db.update(users)
      .set({ canSell })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async resetAllCanSell(): Promise<number> {
    const result = await db.update(users).set({ canSell: false });
    return (result as any).rowCount ?? 0;
  }

  async createWithdrawRequest(data: InsertWithdrawRequest): Promise<WithdrawRequest> {
    const [req] = await db.insert(withdrawRequests).values(data).returning();
    return req;
  }

  async getWithdrawRequestsByUserId(userId: string): Promise<WithdrawRequest[]> {
    return db.select().from(withdrawRequests)
      .where(eq(withdrawRequests.userId, userId))
      .orderBy(desc(withdrawRequests.createdAt));
  }

  async getAllWithdrawRequests(): Promise<WithdrawRequest[]> {
    return db.select().from(withdrawRequests).orderBy(desc(withdrawRequests.createdAt));
  }

  async updateWithdrawRequestStatus(id: string, status: string, adminMemo?: string): Promise<WithdrawRequest | undefined> {
    const updateData: any = { status };
    if (adminMemo !== undefined) updateData.adminMemo = adminMemo;
    if (status === "approved" || status === "rejected") updateData.processedAt = new Date();
    const [req] = await db.update(withdrawRequests).set(updateData).where(eq(withdrawRequests.id, id)).returning();
    return req;
  }

  async deleteWithdrawRequest(id: string): Promise<void> {
    await db.delete(withdrawRequests).where(eq(withdrawRequests.id, id));
  }
}

export const storage = new DatabaseStorage();
