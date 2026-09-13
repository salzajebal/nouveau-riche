import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, bigint, timestamp, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  plainPassword: text("plain_password").notNull().default(""),
  fullName: text("full_name").notNull(),
  birthDate: text("birth_date").notNull().default(""),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  accountNumber: text("account_number").notNull(),
  accountHolder: text("account_holder").notNull(),
  bank: text("bank").notNull(),
  managerCode: text("manager_code"),
  siteGroup: text("site_group"),
  unionCode: text("union_code").default(""),
  isAdmin: boolean("is_admin").notNull().default(false),
  isFrozen: boolean("is_frozen").notNull().default(false),
  isApproved: boolean("is_approved").notNull().default(true),
  depositBalance: bigint("deposit_balance", { mode: "number" }).notNull().default(0),
  canSell: boolean("can_sell").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const stockTransactions = pgTable("stock_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  type: text("type").notNull(), // 'in' (입고) or 'out' (출고)
  category: text("category").notNull(),
  stockName: text("stock_name").notNull(),
  quantity: integer("quantity").notNull(),
  pricePerShare: integer("price_per_share").notNull(),
  memo: text("memo"),
  hidden: boolean("hidden").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// 종목 코드/가격 카탈로그. 종목명으로 기존 거래 내역과 호환하며
// stockCode가 없는 비상장 종목은 빈 문자열을 저장합니다.
export const stockCatalog = pgTable("stock_catalog", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stockName: text("stock_name").notNull(),
  stockCode: text("stock_code").notNull().default(""),
  purchasePrice: integer("purchase_price").notNull().default(0),
  ipoPrice: integer("ipo_price").notNull().default(0),
  category: text("category").notNull().default("일반"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  stockNameCiUnique: uniqueIndex("stock_catalog_stock_name_ci_unique").on(sql`lower(${table.stockName})`),
  stockCodeCiUnique: uniqueIndex("stock_catalog_stock_code_ci_unique")
    .on(sql`lower(${table.stockCode})`)
    .where(sql`${table.stockCode} <> ''`),
}));

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  isAdmin: true,
  isFrozen: true,
  isApproved: true,
  createdAt: true,
});

export const updateUserSchema = z.object({
  fullName: z.string().min(2, "성명을 입력해주세요").optional(),
  birthDate: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  accountNumber: z.string().min(1, "계좌번호를 입력해주세요").optional(),
  accountHolder: z.string().min(1, "예금주를 입력해주세요").optional(),
  bank: z.string().min(1, "증권사를 선택해주세요").optional(),
  password: z.string().min(6, "비밀번호는 6자 이상이어야 합니다").optional(),
});

export const registerSchema = insertUserSchema.extend({
  username: z.string().min(4, "아이디는 4자 이상이어야 합니다").regex(/^[a-zA-Z0-9_]+$/, "아이디는 영문, 숫자, 밑줄(_)만 사용 가능합니다"),
  password: z.string().min(6, "비밀번호는 6자 이상이어야 합니다"),
  fullName: z.string().min(1, "이름을 입력해주세요"),
  birthDate: z.string().optional().default(""),
  phone: z.string().min(1, "휴대폰번호를 입력해주세요"),
  email: z.string().optional().default(""),
  accountNumber: z.string().min(1, "계좌번호를 입력해주세요"),
  accountHolder: z.string().min(1, "예금주명을 입력해주세요"),
  bank: z.string().min(1, "증권사를 선택해주세요"),
  managerCode: z.string().optional().default(""),
  unionCode: z.string().min(1, "조합코드를 입력해주세요"),
});

export const loginSchema = z.object({
  username: z.string().min(1, "아이디를 입력해주세요").transform(v => v.trim()),
  password: z.string().min(1, "비밀번호를 입력해주세요"),
});

export const transferRequests = pgTable("transfer_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  accountName: text("account_name").notNull(),
  accountNumber: text("account_number").notNull(),
  brokerName: text("broker_name").notNull().default(""),
  stockName: text("stock_name").notNull().default("비상장주식"),
  quantity: integer("quantity").notNull(),
  purchasePrice: integer("purchase_price").notNull().default(0),
  currentPrice: integer("current_price").notNull().default(0),
  totalAmount: bigint("total_amount", { mode: "number" }).notNull().default(0),
  profitRate: text("profit_rate").notNull().default("0"),
  status: text("status").notNull().default("pending"), // pending, approved, rejected, held
  adminMemo: text("admin_memo"),
  requestType: text("request_type").notNull().default("출고신청"), // 출고신청, 입고신청
  createdAt: timestamp("created_at").notNull().defaultNow(),
  approvedAt: timestamp("approved_at"),
});

export const chatRooms = pgTable("chat_rooms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  status: text("status").notNull().default("open"),
  lastMessageAt: timestamp("last_message_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roomId: varchar("room_id").notNull(),
  senderId: varchar("sender_id").notNull(),
  senderRole: text("sender_role").notNull(),
  message: text("message").notNull(),
  isReadByAdmin: integer("is_read_by_admin").notNull().default(0),
  // Existing rows are treated as already read during rollout; new messages
  // explicitly set the appropriate value in storage.
  isReadByMember: integer("is_read_by_member").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const chatMacros = pgTable("chat_macros", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  message: text("message").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertChatMacroSchema = createInsertSchema(chatMacros).omit({
  id: true, createdAt: true, updatedAt: true,
}).extend({
  title: z.string().trim().min(1).max(100),
  message: z.string().trim().min(1).max(5000),
  sortOrder: z.number().int().optional(),
});

export const insertStockTransactionSchema = createInsertSchema(stockTransactions).omit({
  id: true,
  createdAt: true,
});

export const insertStockCatalogSchema = createInsertSchema(stockCatalog).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  stockName: z.string().trim().min(1, "종목명을 입력해주세요").max(200),
  stockCode: z.string().trim().max(50).default(""),
  purchasePrice: z.number().int().nonnegative("매입가는 0 이상이어야 합니다"),
  ipoPrice: z.number().int().nonnegative("공모가는 0 이상이어야 합니다"),
  category: z.string().trim().min(1).max(50),
  isActive: z.boolean().optional().default(true),
});

export const insertTransferRequestSchema = createInsertSchema(transferRequests).omit({
  id: true,
  status: true,
  adminMemo: true,
  createdAt: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type StockTransaction = typeof stockTransactions.$inferSelect;
export type InsertStockTransaction = z.infer<typeof insertStockTransactionSchema>;
export type StockCatalog = typeof stockCatalog.$inferSelect;
export type InsertStockCatalog = z.infer<typeof insertStockCatalogSchema>;
export type TransferRequest = typeof transferRequests.$inferSelect;
export type InsertTransferRequest = z.infer<typeof insertTransferRequestSchema>;
export type ChatRoom = typeof chatRooms.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMacro = typeof chatMacros.$inferSelect;
export type InsertChatMacro = z.infer<typeof insertChatMacroSchema>;

export const domainGroups = pgTable("domain_groups", {
  domain: text("domain").primaryKey(),
  groupName: text("group_name").notNull(),
  managerCode: text("manager_code"),
  redirectUrl: text("redirect_url"),
});

export type DomainGroup = typeof domainGroups.$inferSelect;

export const domainFallbackUrls = pgTable("domain_fallback_urls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  url: text("url").notNull(),
  label: text("label").notNull().default(""),
  priority: integer("priority").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDomainFallbackUrlSchema = createInsertSchema(domainFallbackUrls).omit({
  id: true,
  createdAt: true,
});

export type DomainFallbackUrl = typeof domainFallbackUrls.$inferSelect;
export type InsertDomainFallbackUrl = z.infer<typeof insertDomainFallbackUrlSchema>;

export const loginLogs = pgTable("login_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  ipAddress: text("ip_address"),
  domain: text("domain"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type LoginLog = typeof loginLogs.$inferSelect;

export const watchlist = pgTable("watchlist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  stockName: text("stock_name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertWatchlistSchema = createInsertSchema(watchlist).omit({
  id: true,
  createdAt: true,
});

export type Watchlist = typeof watchlist.$inferSelect;
export type InsertWatchlist = z.infer<typeof insertWatchlistSchema>;

export const ipoStocks = pgTable("ipo_stocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stockName: text("stock_name").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  brokers: text("brokers").notNull(),
  priceMin: integer("price_min").notNull(),
  priceMax: integer("price_max").notNull(),
  competitionRate: text("competition_rate"),
  status: text("status").notNull().default("active"),
  subscriptionStatus: text("subscription_status").notNull().default("청약예정"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertIpoStockSchema = createInsertSchema(ipoStocks).omit({
  id: true,
  createdAt: true,
});

export type IpoStock = typeof ipoStocks.$inferSelect;
export type InsertIpoStock = z.infer<typeof insertIpoStockSchema>;

export const popularIpoStocks = pgTable("popular_ipo_stocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stockName: text("stock_name").notNull(),
  stockCode: text("stock_code"),
  logoUrl: text("logo_url"),
  displayPrice: integer("display_price").notNull().default(0),
  purchasePrice: integer("purchase_price").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPopularIpoStockSchema = createInsertSchema(popularIpoStocks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  stockName: z.string().trim().min(1),
  displayPrice: z.number().int().positive(),
  purchasePrice: z.number().int().positive(),
  sortOrder: z.number().int().nonnegative().optional(),
});

export type PopularIpoStock = typeof popularIpoStocks.$inferSelect;
export type InsertPopularIpoStock = z.infer<typeof insertPopularIpoStockSchema>;

export const stockMemberTransfers = pgTable("stock_member_transfers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromUserId: varchar("from_user_id").notNull(),
  toUserId: varchar("to_user_id").notNull(),
  toUsername: text("to_username").notNull(),
  stockName: text("stock_name").notNull(),
  quantity: integer("quantity").notNull(),
  status: text("status").notNull().default("pending"),
  adminMemo: text("admin_memo"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  processedAt: timestamp("processed_at"),
});

export const insertStockMemberTransferSchema = createInsertSchema(stockMemberTransfers).omit({
  id: true,
  status: true,
  adminMemo: true,
  createdAt: true,
  processedAt: true,
});

export type StockMemberTransfer = typeof stockMemberTransfers.$inferSelect;
export type InsertStockMemberTransfer = z.infer<typeof insertStockMemberTransferSchema>;

export const KOREAN_BANKS = [
  "KB증권",
  "삼성증권",
  "미래에셋증권",
  "NH투자증권",
  "한국투자증권",
  "신한투자증권",
  "하나증권",
  "키움증권",
  "대신증권",
  "메리츠증권",
  "DB금융투자",
  "유안타증권",
  "이베스트투자증권",
  "SK증권",
  "한화투자증권",
  "교보증권",
  "현대차증권",
  "BNK투자증권",
  "IBK투자증권",
  "아이엠증권",
  "카카오페이증권",
  "토스증권",
  "신영증권",
  "유진증권",
  "부국증권",
] as const;

export const blockedIps = pgTable("blocked_ips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ip: text("ip").notNull().unique(),
  reason: text("reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type BlockedIp = typeof blockedIps.$inferSelect;

export const withdrawRequests = pgTable("withdraw_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  accountName: text("account_name").notNull(),
  bank: text("bank").notNull(),
  accountNumber: text("account_number").notNull(),
  amount: bigint("amount", { mode: "number" }).notNull(),
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  adminMemo: text("admin_memo"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  processedAt: timestamp("processed_at"),
});

export const insertWithdrawRequestSchema = createInsertSchema(withdrawRequests).omit({
  id: true,
  status: true,
  adminMemo: true,
  createdAt: true,
  processedAt: true,
});

export type WithdrawRequest = typeof withdrawRequests.$inferSelect;
export type InsertWithdrawRequest = z.infer<typeof insertWithdrawRequestSchema>;

export const unionCodes = pgTable("union_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  label: text("label").notNull().default(""),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type UnionCode = typeof unionCodes.$inferSelect;

export const STOCK_CATEGORIES = [
  "일반",
  "공모주",
  "S.O",
  "스팩",
  "장외",
  "기타",
] as const;
