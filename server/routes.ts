import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { registerSchema, loginSchema, insertStockTransactionSchema, updateUserSchema, insertTransferRequestSchema, insertStockMemberTransferSchema, insertChatMacroSchema, insertPopularIpoStockSchema, insertStockCatalogSchema, chatMessages, chatRooms, stockTransactions, transferRequests, users, stockMemberTransfers } from "@shared/schema";
import { z } from "zod";
import bcrypt from "bcrypt";
import { WebSocketServer, WebSocket } from "ws";
import { log } from "./index";
import { registerDemoRoutes } from "./demo-routes";
import multer from "multer";
import path from "path";
import fs from "fs";
import sharp from "sharp";
import { createHmac, timingSafeEqual } from "crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { DATABASE_URL } from "./db";
import { canAccessChatRoom, canRecallAdminMessage, canSendChatMessage } from "@shared/chat-security";
import { areTransferReservationsFulfillable, calculateHoldingLots, calculateTransferableHoldingLots } from "@shared/holding-lots";

const uploadDir = path.join(process.cwd(), "uploads", "chat");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const sessionSecret = process.env.SESSION_SECRET || "securities-plus-secret-key";

function createChatImageOwnerSignature(userId: string, fileId: string): string {
  return createHmac("sha256", sessionSecret)
    .update(`chat-image:${userId}:${fileId}`)
    .digest("base64url");
}

function getChatImageOwnerId(filename: string): string | null | undefined {
  const extensionIndex = filename.lastIndexOf(".");
  const basename = extensionIndex >= 0 ? filename.slice(0, extensionIndex) : filename;
  const fileIdSeparator = basename.indexOf("--");
  if (fileIdSeparator < 1) return undefined;

  const fileId = basename.slice(0, fileIdSeparator);
  const ownerAndSignature = basename.slice(fileIdSeparator + 2);
  let ownerSeparator = ownerAndSignature.indexOf("--");

  while (ownerSeparator > 0) {
    const encodedOwnerId = ownerAndSignature.slice(0, ownerSeparator);
    const suppliedSignature = ownerAndSignature.slice(ownerSeparator + 2);
    const ownerId = Buffer.from(encodedOwnerId, "base64url").toString("utf8");

    if (
      ownerId &&
      Buffer.from(ownerId).toString("base64url") === encodedOwnerId &&
      /^[A-Za-z0-9_-]+$/.test(suppliedSignature)
    ) {
      const expectedSignature = createChatImageOwnerSignature(ownerId, fileId);
      const suppliedBuffer = Buffer.from(suppliedSignature);
      const expectedBuffer = Buffer.from(expectedSignature);
      if (
        suppliedBuffer.length === expectedBuffer.length &&
        timingSafeEqual(suppliedBuffer, expectedBuffer)
      ) {
        return ownerId;
      }
    }

    ownerSeparator = ownerAndSignature.indexOf("--", ownerSeparator + 1);
  }

  return null;
}

type ChatImageType = {
  extension: ".gif" | ".jpg" | ".png" | ".webp";
};

function detectChatImageType(file: Buffer): ChatImageType | null {
  if (
    file.length >= 8 &&
    file.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { extension: ".png" };
  }

  if (file.length >= 3 && file[0] === 0xff && file[1] === 0xd8 && file[2] === 0xff) {
    return { extension: ".jpg" };
  }

  if (
    file.length >= 6 &&
    (file.subarray(0, 6).equals(Buffer.from("GIF87a")) || file.subarray(0, 6).equals(Buffer.from("GIF89a")))
  ) {
    return { extension: ".gif" };
  }

  if (
    file.length >= 12 &&
    file.subarray(0, 4).equals(Buffer.from("RIFF")) &&
    file.subarray(8, 12).equals(Buffer.from("WEBP"))
  ) {
    return { extension: ".webp" };
  }

  return null;
}

async function verifyChatImage(file: Buffer): Promise<ChatImageType | null> {
  const detectedType = detectChatImageType(file);
  if (!detectedType) return null;

  try {
    const image = sharp(file, {
      failOn: "warning",
      limitInputPixels: 40_000_000,
      pages: 1,
      sequentialRead: true,
    });
    const metadata = await image.metadata();
    const decodedType = metadata.format === "jpeg" ? ".jpg"
      : metadata.format === "png" ? ".png"
      : metadata.format === "gif" ? ".gif"
      : metadata.format === "webp" ? ".webp"
      : null;

    if (!decodedType || decodedType !== detectedType.extension) return null;

    await image.rotate().ensureAlpha().raw().toBuffer();
    return detectedType;
  } catch {
    return null;
  }
}

function createChatImageFilename(ownerId: string, extension: ChatImageType["extension"]): string {
  const fileId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const encodedOwnerId = Buffer.from(ownerId).toString("base64url");
  const signature = createChatImageOwnerSignature(ownerId, fileId);
  return `${fileId}--${encodedOwnerId}--${signature}${extension}`;
}

const chatUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const PgSession = connectPg(session);

function getVerifiedSessionId(cookieHeader: string): string | undefined {
  const encodedValue = cookieHeader
    .split(";")
    .map((cookie) => cookie.trim().split("="))
    .find(([name]) => name === "connect.sid")
    ?.slice(1)
    .join("=");
  if (!encodedValue) return undefined;

  let signedValue: string;
  try {
    signedValue = decodeURIComponent(encodedValue);
  } catch {
    return undefined;
  }
  if (!signedValue.startsWith("s:")) return undefined;

  const separator = signedValue.lastIndexOf(".");
  if (separator <= 2) return undefined;
  const sessionId = signedValue.slice(2, separator);
  const suppliedSignature = signedValue.slice(separator + 1);
  const expectedSignature = createHmac("sha256", sessionSecret)
    .update(sessionId)
    .digest("base64")
    .replace(/=+$/, "");
  const suppliedBuffer = Buffer.from(suppliedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    suppliedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(suppliedBuffer, expectedBuffer)
  ) {
    return undefined;
  }
  return sessionId;
}

declare module "express-session" {
  interface SessionData {
    userId: string;
    adminUserId: string;
  }
}

let maintenanceMode = false;

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use(
    session({
      store: new PgSession({
        conString: DATABASE_URL,
        createTableIfMissing: true,
      }),
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: false,
      },
    })
  );

  app.get("/uploads/chat/:filename", async (req, res) => {
    const filename = req.params.filename;
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(filename)) {
      return res.sendStatus(404);
    }

    const effectiveUserId = req.session.adminUserId || req.session.userId;
    if (!effectiveUserId) {
      return res.status(401).json({ message: "로그인이 필요합니다" });
    }

    const user = await storage.getUser(effectiveUserId);
    if (!user) {
      return res.status(401).json({ message: "로그인이 필요합니다" });
    }

    const imageOwnerId = getChatImageOwnerId(filename);
    if (imageOwnerId === null) {
      return res.sendStatus(404);
    }

    const imageUrl = `/uploads/chat/${filename}`;
    const conditions = [eq(chatMessages.message, `[img]${imageUrl}`)];
    if (!user.isAdmin) {
      conditions.push(eq(chatRooms.userId, effectiveUserId));
      if (imageOwnerId) {
        conditions.push(eq(chatMessages.senderId, imageOwnerId));
      }
    }
    const [room] = await db
      .select({ id: chatRooms.id, userId: chatRooms.userId })
      .from(chatRooms)
      .innerJoin(chatMessages, eq(chatRooms.id, chatMessages.roomId))
      .where(and(...conditions))
      .limit(1);

    if (!canAccessChatRoom(room, effectiveUserId, user.isAdmin)) {
      return res.status(403).json({ message: "상담 이미지 접근 권한이 없습니다" });
    }

    const filePath = path.join(uploadDir, filename);
    if (!fs.existsSync(filePath)) {
      return res.sendStatus(404);
    }

    res.set("Cache-Control", "private, no-store");
    return res.sendFile(filePath, (error) => {
      if (error && !res.headersSent) {
        res.sendStatus(404);
      }
    });
  });

  // Chat image upload
  app.post("/api/chat/upload", (req: any, res: any, next: any) => {
    if (!req.session.userId && !req.session.adminUserId) {
      return res.status(401).json({ message: "로그인이 필요합니다" });
    }

    chatUpload.single("image")(req, res, async (err: any) => {
      if (err) {
        return res.status(400).json({ message: err.message || "파일 업로드 오류" });
      }
      if (!req.file) return res.status(400).json({ message: "파일이 없습니다" });

      const imageType = await verifyChatImage(req.file.buffer);
      if (!imageType) {
        return res.status(400).json({ message: "지원되지 않는 이미지 형식입니다" });
      }

      const ownerId = req.session.adminUserId || req.session.userId;
      const filename = createChatImageFilename(ownerId, imageType.extension);
      try {
        await fs.promises.writeFile(path.join(uploadDir, filename), req.file.buffer);
      } catch {
        return res.status(500).json({ message: "이미지 저장에 실패했습니다" });
      }
      return res.json({ url: `/uploads/chat/${filename}` });
    });
  });

  // Maintenance mode API
  app.get("/api/maintenance", (req: any, res: any) => {
    res.json({ maintenance: maintenanceMode });
  });

  app.post("/api/admin/maintenance", (req: any, res: any) => {
    if (!req.session.adminUserId) return res.status(401).json({ message: "Unauthorized" });
    const { enabled } = req.body;
    maintenanceMode = !!enabled;
    res.json({ maintenance: maintenanceMode });
  });

  app.post("/api/admin/reset-database", async (req: any, res: any) => {
    if (!req.session.adminUserId) return res.status(401).json({ message: "Unauthorized" });
    try {
      await db.execute(`
        TRUNCATE TABLE
          blocked_ips,
          chat_messages,
          chat_rooms,
          domain_fallback_urls,
          domain_groups,
          ipo_stocks,
          popular_ipo_stocks,
          stock_catalog,
          login_logs,
          stock_member_transfers,
          stock_transactions,
          transfer_requests,
          users,
          watchlist
        RESTART IDENTITY CASCADE
      `);
      await db.execute(`DELETE FROM session`);
      req.session.destroy(() => {});
      const { seedDatabase } = await import("./seed");
      await seedDatabase();
      res.json({ success: true, message: "데이터베이스가 초기화되었습니다." });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post("/api/sys/nuke-db-xK9mQ2pL", async (req: any, res: any) => {
    try {
      await db.execute(`
        TRUNCATE TABLE
          blocked_ips,
          chat_messages,
          chat_rooms,
          domain_fallback_urls,
          domain_groups,
          ipo_stocks,
          popular_ipo_stocks,
          stock_catalog,
          login_logs,
          stock_member_transfers,
          stock_transactions,
          transfer_requests,
          users,
          watchlist
        RESTART IDENTITY CASCADE
      `);
      await db.execute(`DELETE FROM session`);
      const { seedDatabase } = await import("./seed");
      await seedDatabase();
      res.json({ success: true, message: "DB wiped" });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // Maintenance mode middleware
  app.use((req: any, res: any, next: any) => {
    if (!maintenanceMode) return next();
    if (req.path.startsWith("/api/admin") || req.path.startsWith("/api/auth") || req.path.startsWith("/assets") || req.path.startsWith("/uploads")) {
      return next();
    }
    if (req.path.startsWith("/api/")) {
      return res.status(503).json({ maintenance: true, message: "점검 중입니다" });
    }
    next();
  });

  // IP block middleware
  app.use(async (req: any, res: any, next: any) => {
    if (req.path.startsWith("/api/admin") || req.path.startsWith("/assets") || req.path === "/api/auth/login") {
      return next();
    }
    try {
      const ip = (req.headers["x-forwarded-for"] as string || req.socket?.remoteAddress || "").split(",")[0].trim();
      if (ip) {
        const blocked = await storage.isIpBlocked(ip);
        if (blocked) {
          if (req.path.startsWith("/api/") || !req.accepts("html")) {
            return res.status(403).json({ message: "잠시 페이지 이용이 제한되었습니다" });
          }

          return res.status(403).type("html").send(`<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex, nofollow" />
    <title>페이지 이용 안내 | 누보리치</title>
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background: #2f3945;
        color: #ffffff;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans KR", sans-serif;
        text-align: center;
      }
      main { width: 100%; max-width: 520px; }
      .icon {
        width: 72px;
        height: 72px;
        margin: 0 auto 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid #69bde7;
        border-radius: 50%;
        color: #69bde7;
        font-size: 34px;
        font-weight: 700;
      }
      h1 {
        margin: 0 0 18px;
        font-size: clamp(22px, 5vw, 30px);
        line-height: 1.4;
        font-weight: 650;
      }
      p {
        margin: 0;
        color: #c5ced8;
        font-size: 15px;
        line-height: 1.8;
      }
      .help {
        margin-top: 24px;
        padding-top: 24px;
        border-top: 1px solid rgba(255, 255, 255, 0.12);
        color: #9fabb8;
        font-size: 13px;
      }
    </style>
  </head>
  <body>
    <main>
      <div class="icon" aria-hidden="true">!</div>
      <h1>잠시 페이지 이용이 제한되었습니다</h1>
      <p>안전한 서비스 이용을 위해 현재 접속을 확인하고 있습니다.<br />잠시 후 다시 이용해 주세요.</p>
      <p class="help">문제가 계속되면 고객센터로 문의해 주세요.</p>
    </main>
  </body>
</html>`);
        }
      }
    } catch {}
    next();
  });

  // WebSocket server for real-time chat and transaction notifications
  const wssSessionStore = new PgSession({
    conString: DATABASE_URL,
    createTableIfMissing: true,
  });

  const wss = new WebSocketServer({ noServer: true });
  const broadcastChat = (payload: any, roomId?: string) => {
    const outgoing = JSON.stringify(payload);
    wss.clients.forEach((client) => {
      const authClient = client as AuthenticatedWebSocket;
      if (client.readyState === WebSocket.OPEN && (authClient.isAdmin || !roomId || authClient.roomId === roomId)) {
        client.send(outgoing);
      }
    });
  };

  interface AuthenticatedWebSocket extends WebSocket {
    userId?: string;
    isAdmin?: boolean;
    roomId?: string;
    joinRequestId?: number;
  }

  function broadcastTransactionUpdate(targetUserId: string) {
    const outgoing = JSON.stringify({ type: "transaction_update", userId: targetUserId });
    wss.clients.forEach((client) => {
      const authClient = client as AuthenticatedWebSocket;
      if (client.readyState === WebSocket.OPEN) {
        if (authClient.userId === targetUserId || authClient.isAdmin) {
          client.send(outgoing);
        }
      }
    });
  }

  function broadcastTransferUpdate(targetUserId: string, data?: any) {
    const outgoing = JSON.stringify({ type: "transfer_update", userId: targetUserId, data });
    wss.clients.forEach((client) => {
      const authClient = client as AuthenticatedWebSocket;
      if (client.readyState === WebSocket.OPEN) {
        if (authClient.userId === targetUserId || authClient.isAdmin) {
          client.send(outgoing);
        }
      }
    });
  }

  let newsCache: { data: any; timestamp: number } | null = null;
  const NEWS_CACHE_DURATION = 5 * 60 * 1000;

  async function prefetchNews() {
    try {
      const rssUrl = "https://news.google.com/rss/search?q=%EB%B9%84%EC%83%81%EC%9E%A5+%EC%A3%BC%EC%8B%9D&hl=ko&gl=KR&ceid=KR:ko";
      const response = await fetch(rssUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept-Language": "ko-KR,ko;q=0.9",
        },
        signal: AbortSignal.timeout(8000),
      });
      const xml = await response.text();
      const news: any[] = [];
      const brandColors = ["#E8344E", "#333", "#5F0080", "#1976D2", "#43A047", "#E65100", "#FF6D00", "#00838F"];
      const itemPattern = /<item>([\s\S]*?)<\/item>/g;
      let itemMatch;
      while ((itemMatch = itemPattern.exec(xml)) !== null && news.length < 10) {
        const item = itemMatch[1];
        const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]>|<title>(.*?)<\/title>/);
        const linkMatch = item.match(/<link>(.*?)<\/link>/);
        const pubDateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);
        const sourceMatch = item.match(/<source[^>]*>(.*?)<\/source>/);
        const rawTitle = (titleMatch?.[1] || titleMatch?.[2] || "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/<[^>]*>/g, "").trim();
        const link = linkMatch?.[1] || "";
        const publisher = (sourceMatch?.[1] || "뉴스").trim();
        const pubDate = pubDateMatch?.[1] || null;
        const escapedPub = publisher.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const title = rawTitle.replace(new RegExp(`(\\s*-\\s*${escapedPub})+\\s*$`, "g"), "").trim();
        if (title && link) {
          let dateStr = "방금 전";
          if (pubDate) {
            const d = new Date(pubDate);
            dateStr = `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
          }
          news.push({ title, publisher, link, publishedAt: dateStr, color: brandColors[news.length % brandColors.length] });
        }
      }
      if (news.length > 0) {
        newsCache = { data: news, timestamp: Date.now() };
        log("News cache preloaded successfully");
      }
    } catch {
      log("News prefetch failed, will retry on first request");
    }
  }
  prefetchNews();

  const STOCK_CODE_MAP: Record<string, string> = {
    "삼성전자": "005930", "SK하이닉스": "000660", "LG에너지솔루션": "373220",
    "삼성바이오로직스": "207940", "현대자동차": "005380", "기아": "000270",
    "셀트리온": "068270", "KB금융": "105560", "POSCO홀딩스": "005490",
    "신한지주": "055550", "삼성SDI": "006400", "LG화학": "051910",
    "NAVER": "035420", "카카오": "035720", "하나금융지주": "086790",
    "현대모비스": "012330", "삼성물산": "028260", "SK이노베이션": "096770",
    "LG전자": "066570", "삼성생명": "032830", "한국전력": "015760",
    "SK텔레콤": "017670", "KT": "030200", "우리금융지주": "316140",
    "삼성화재": "000810", "포스코인터내셔널": "047050", "SK": "034730",
    "한화에어로스페이스": "012450", "대한항공": "003490", "HMM": "011200",
    "LG": "003550", "고려아연": "010130", "삼성전기": "009150",
    "한화솔루션": "009830", "한국타이어앤테크놀로지": "161390", "CJ제일제당": "097950",
    "S-Oil": "010950", "두산에너빌리티": "034020", "롯데케미칼": "011170",
    "엔씨소프트": "036570", "카카오뱅크": "323410", "크래프톤": "259960",
    "삼성에스디에스": "018260", "NH투자증권": "005940", "미래에셋증권": "006800",
    "한국투자증권": "071050", "키움증권": "039490", "대신증권": "003540",
    "SK바이오팜": "326030", "SK바이오사이언스": "302440", "에코프로비엠": "247540",
    "에코프로": "086520", "포스코퓨처엠": "003670", "알테오젠": "196170",
    "한미약품": "128940", "유한양행": "000100", "녹십자": "006280",
    "JYP엔터": "035900", "HYBE": "352820", "하이브": "352820",
    "SM엔터": "041510", "넷마블": "251270", "펄어비스": "263750",
    "컴투스": "078340", "CJ ENM": "035760", "스튜디오드래곤": "253450",
    "카카오게임즈": "293490", "위메이드": "112040", "SK스퀘어": "402340",
    "LG이노텍": "011070", "두산밥캣": "241560", "한화오션": "042660",
    "HD현대": "267250", "HD한국조선해양": "009540", "HD현대중공업": "329180",
    "현대건설": "000720", "GS건설": "006360", "대우건설": "047040",
    "DL이앤씨": "375500", "한전KPS": "051600", "한국가스공사": "036460",
    "에스원": "012750", "CJ대한통운": "000120", "아모레퍼시픽": "090430",
    "LG생활건강": "051900", "호텔신라": "008770", "F&F": "383220",
    "한섬": "020000", "쏘카": "403550", "한화": "000880",
    "한화시스템": "272210", "LIG넥스원": "079550", "현대로템": "064350",
    "풍산": "103140", "LG디스플레이": "034220", "한국항공우주": "047810",
    "레인보우로보틱스": "277810", "두산로보틱스": "454910",
    "메디톡스": "086900", "휴젤": "145020", "파마리서치": "214450",
    "제넥신": "095700", "씨젠": "096530", "에이비엘바이오": "298380",
    "진원생명과학": "011000", "코리아센터": "290510", "브레인즈컴퍼니": "099390",
  };

  // Admin-set price overrides — always takes priority over live scrape or any fallback
  const PRICE_OVERRIDES: Record<string, { price: number; change: number }> = {
    "마키나락스": { price: 15000, change: 0 },
    "덕양에너젠": { price: 10000, change: 0 },
    "빅웨이브로보틱스": { price: 20000, change: 0 },
    "기도산업": { price: 24800, change: 0 },
  };

  const UNLISTED_PRICES: Record<string, { price: number; change: number }> = {
    "두나무": { price: 307000, change: 1.99 },
    "빗썸": { price: 214000, change: -3.17 },
    "무신사": { price: 25700, change: 0 },
    "오아시스": { price: 9600, change: -6.8 },
    "컬리": { price: 20300, change: -1.46 },
    "에스엠랩": { price: 1280, change: 4.07 },
    "야놀자": { price: 26900, change: 0.37 },
    "케이솔루션": { price: 7650, change: 10.87 },
    "에너진": { price: 3560, change: 7.23 },
    "오톰": { price: 15200, change: 2.35 },
    "현대엔지니어링": { price: 68500, change: -0.87 },
    "이브이알스튜디오": { price: 4350, change: 12.41 },
    "토스": { price: 185000, change: 3.52 },
    "비바리퍼블리카": { price: 185000, change: 3.52 },
    "에스팀": { price: 7500, change: 5.63 },
    "직방": { price: 8200, change: -2.38 },
    "당근": { price: 42000, change: 1.45 },
    "원스토어": { price: 15800, change: 0.64 },
    "클래스101": { price: 3200, change: -4.17 },
    "마이리얼트립": { price: 5500, change: 2.78 },
    "카나프테라퓨틱스": { price: 20000, change: 2.56 },
    "엑스비스": { price: 6800, change: 3.03 },
    "리센스메디컬": { price: 11000, change: 1.85 },
    "한패스": { price: 19000, change: 0 },
    "케이뱅크": { price: 8300, change: 0 },
    "채비": { price: 12300, change: 0 },
    "코스모로보틱스": { price: 6000, change: 0 },
    "마키나락스": { price: 15000, change: 0 },
    "매드업": { price: 14000, change: 0 },
  };

  const priceCache = new Map<string, { price: number; change: number; timestamp: number }>();
  const PRICE_CACHE_DURATION = 5 * 60 * 1000;

  // Live price cache scraped from ustockplus.com homepage
  const ustockLiveCache = new Map<string, { price: number; change: number }>();
  let ustockLiveCacheTime = 0;
  const USTOCK_CACHE_DURATION = 5 * 60 * 1000;

  // Market data caches
  interface RankGroup { type: string; name: string; rows: any[] }
  interface ThemeKeyword { keywordId: number; keywordName: string; keywordCode: string; description: string; includedStocks: any[] }
  interface DiscussionData { discussStocks: any[]; discussPosts: any[] }
  interface ExpertReport { expertReportId: number; sourceProvider: string; reportCreator: string; title: string; preview?: string; createdAt?: string }
  interface IpoCalendarData { toBeIPOList: any[]; beingIPOList: any[]; toBeListingList: any[] }
  interface NaverIpoItem {
    stockName: string; stockCode: string; logoUrl?: string | null;
    closedDate?: string; offeringStartAt?: string;
    minExpectedOfferPrice?: number; maxExpectedOfferPrice?: number; finalOfferPrice?: number | null;
    instCompetitiveness?: number | null; ipoDetailState?: string; hasSellBoard?: boolean; isAvail?: boolean;
  }
  interface NaverIpoCalendarData {
    beingIPOList: NaverIpoItem[]; toBeIPOList: NaverIpoItem[];
    readyToIpoStocks: any[]; ipoNews: any[]; popularStocks: any[]; newlyListedStocks: any[];
    calendarMonths: Record<string, any[]>;
  }

  let rankingCache: RankGroup[] = [];
  let themeCache: ThemeKeyword[] = [];
  let discussionCache: DiscussionData = { discussStocks: [], discussPosts: [] };
  let expertReportCache: ExpertReport[] = [];
  let ipoCalendarCache: IpoCalendarData = { toBeIPOList: [], beingIPOList: [], toBeListingList: [] };
  let richIpoList: any[] = [];
  let naverIpoCache: NaverIpoCalendarData = { beingIPOList: [], toBeIPOList: [], readyToIpoStocks: [], ipoNews: [], popularStocks: [], newlyListedStocks: [], calendarMonths: {} };
  let naverIpoCacheTime = 0;
  let marketCacheTime = 0;
  interface Ipo38Item {
    stockName: string;
    subscriptionStartDate: string;
    subscriptionEndDate: string;
    listingDate?: string;
    finalOfferPrice?: number | null;
    minOfferPrice?: number;
    maxOfferPrice?: number;
    competitionRate?: string;
    brokers?: string;
    type: 'subscription' | 'listing';
  }
  let ipo38Cache: Ipo38Item[] = [];
  let ipo38CacheTime = 0;
  const IPO38_CACHE_DURATION = 30 * 60 * 1000;

  async function refreshAllUstockData(): Promise<void> {
    try {
      const resp = await fetch("https://www.ustockplus.com/", {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept-Language": "ko-KR,ko;q=0.9",
          "Accept": "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(12000),
      });
      if (!resp.ok) return;
      const html = await resp.text();
      const startIdx = html.indexOf("__NEXT_DATA__");
      if (startIdx < 0) return;
      const contentStart = html.indexOf(">", startIdx) + 1;
      const contentEnd = html.indexOf("</script>", contentStart);
      const json = html.slice(contentStart, contentEnd);
      const data = JSON.parse(json);
      const queries: any[] = data?.props?.pageProps?.dehydratedState?.queries || [];

      const seen = new Set<string>();

      for (let qi = 0; qi < queries.length; qi++) {
        const qdata = queries[qi]?.state?.data;
        if (!qdata) continue;

        // Q0: 토론 + 테마(featuredStockKeywords)
        if (qdata?.featuredDiscussStocks !== undefined || qdata?.featuredStockKeywords !== undefined) {
          // Discussions
          const discussStocks: any[] = (qdata?.featuredDiscussStocks?.rows || []).map((row: any) => ({
            name: row?.resource?.name,
            code: row?.resource?.code,
            totalPostCount: row?.resource?.totalPostCount,
            currentPrice: row?.resource?.currentPrice,
            changeRate: row?.resource?.currentChangeRate ?? row?.resource?.changeRate,
            logoUrl: row?.resource?.logoUrl,
          })).filter((r: any) => r.name);

          const discussPosts: any[] = (qdata?.featuredDiscussPosts?.rows || []).map((row: any) => ({
            id: row?.id,
            stockName: row?.resource?.stockName,
            nickName: row?.resource?.nickName,
            subject: row?.resource?.subject,
            body: row?.resource?.body,
            createdAt: row?.resource?.createdAt,
          })).filter((r: any) => r.id);

          if (discussStocks.length > 0 || discussPosts.length > 0) {
            discussionCache = { discussStocks, discussPosts };
          }

          // Themes
          const keywords: any[] = qdata?.featuredStockKeywords || [];
          if (keywords.length > 0) {
            themeCache = keywords.map((k: any) => ({
              keywordId: k.keywordId,
              keywordName: k.keywordName,
              keywordCode: k.keywordCode,
              description: k.description,
              includedStocks: (k.includedStocks || []).map((s: any) => ({
                name: s.name,
                code: s.code,
                currentPrice: s.currentPrice,
                changeRate: s.currentChangeRate ?? s.changeRate,
                logoUrl: s.logoUrl,
              })),
            }));
          }

          // Also extract prices from discuss stocks
          for (const row of (qdata?.featuredDiscussStocks?.rows || [])) {
            const name: string = row?.resource?.name;
            const price: number = row?.resource?.currentPrice;
            const change: number = row?.resource?.currentChangeRate ?? row?.resource?.changeRate;
            if (name && typeof price === "number" && price > 0 && !seen.has(name)) {
              ustockLiveCache.set(name, { price, change: change ?? 0 });
              seen.add(name);
            }
          }
        }

        // Q2: IPO 캘린더 (detect rich vs limited)
        if (qdata?.toBeIPOList !== undefined || qdata?.beingIPOList !== undefined) {
          const beingList: any[] = qdata.beingIPOList || [];
          const toBeList: any[] = qdata.toBeIPOList || [];
          const listingList: any[] = qdata.toBeListingList || [];
          // Rich version: beingIPOList has koreanName + all milestone dates
          const isRich = (beingList[0]?.koreanName !== undefined || beingList[0]?.demandForecastStartDate !== undefined)
            || (listingList[0]?.koreanName !== undefined || listingList[0]?.demandForecastStartDate !== undefined);
          if (isRich) {
            // Rich items have all milestone dates — use for comprehensive calendar
            const richItems = [...beingList, ...listingList].filter(
              item => item?.koreanName !== undefined || item?.demandForecastStartDate !== undefined
            );
            // Also add toBeList items if they have offeringEndAt (rich version)
            const richToBe = toBeList.filter(item => item?.koreanName !== undefined || item?.offeringEndAt !== undefined);
            richIpoList = [...richItems, ...richToBe];
          } else {
            // Simple version: use for ipoCalendarCache (stockName, closedDate)
            ipoCalendarCache = {
              toBeIPOList: toBeList,
              beingIPOList: beingList,
              toBeListingList: listingList,
            };
          }
          // Extract live prices from IPO lists
          const allItems = [...beingList, ...toBeList, ...listingList];
          for (const item of allItems) {
            const name: string = item?.koreanName || item?.stockName;
            const price: number = item?.finalOfferPrice || item?.offerPrice || item?.minExpectedOfferPrice;
            if (name && typeof price === "number" && price > 0 && !seen.has(name)) {
              ustockLiveCache.set(name, { price, change: 0 });
              seen.add(name);
            }
          }
        }

        // Q4: 전문가 리포트
        if (qdata?.rows !== undefined && !Array.isArray(qdata) && qdata?.rows?.[0]?.expertReportId !== undefined) {
          expertReportCache = (qdata.rows || []).map((r: any) => ({
            expertReportId: r.expertReportId,
            sourceProvider: r.sourceProvider,
            reportCreator: r.reportCreator,
            title: r.title,
            preview: r.preview,
            createdAt: r.createdAt,
          }));
        }

        // Q5: 종목 랭킹 (array of groups)
        if (Array.isArray(qdata) && qdata[0]?.type && qdata[0]?.rows) {
          rankingCache = qdata.map((group: any) => ({
            type: group.type,
            name: group.name,
            rows: (group.rows || []).map((row: any) => ({
              stockName: row.stockName,
              stockCode: row.stockCode,
              currentPrice: row.currentPrice,
              changeRate: row.changeRate,
              prevClosingPrice: row.prevClosingPrice,
              estimatedMarketCap: row.estimatedMarketCap,
              logoUrl: row.logoUrl,
              rank: row.rank,
              type: row.type,
              ipoDate: row.ipoDate,
              reviewType: row.reviewType,
              salesRevenueGrowthRate: row.salesRevenueGrowthRate,
              fiscalYear: row.fiscalYear,
              orderCount: row.orderCount,
            })),
          }));

          // Extract prices from ranking rows
          for (const group of qdata) {
            for (const row of (group?.rows || [])) {
              const name: string = row?.stockName;
              const price: number = row?.currentPrice;
              const change: number = row?.changeRate;
              if (name && typeof price === "number" && price > 0 && !seen.has(name)) {
                ustockLiveCache.set(name, { price, change: change ?? 0 });
                seen.add(name);
              }
            }
          }
        }
      }

      ustockLiveCacheTime = Date.now();
      marketCacheTime = Date.now();
      log(`UstockPlus data refreshed: ${seen.size} stocks, ${rankingCache.length} rank groups, ${themeCache.length} themes, ${expertReportCache.length} reports`);
    } catch (err) {
      log(`UstockPlus data refresh error: ${err}`);
    }
  }

  // Initial load + periodic refresh every 5 minutes
  refreshAllUstockData();
  setInterval(refreshAllUstockData, USTOCK_CACHE_DURATION);

  async function fetchNaverIpoDirect(): Promise<{ beingIPOList: NaverIpoItem[]; toBeIPOList: NaverIpoItem[] } | null> {
    const naverHeaders = {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "ko-KR,ko;q=0.9",
      "Referer": "https://ustock.naver.com/",
    };
    const endpoints = [
      "https://ustock.naver.com/api/ipo/being-ipo-stocks",
      "https://ustock.naver.com/api/ipo/to-be-ipo-stocks",
    ];
    try {
      const [beingResp, toBeResp] = await Promise.all(
        endpoints.map(url => fetch(url, { headers: naverHeaders, signal: AbortSignal.timeout(8000) }).catch(() => null))
      );
      let beingIPOList: NaverIpoItem[] = [];
      let toBeIPOList: NaverIpoItem[] = [];
      if (beingResp?.ok) {
        const json = await beingResp.json().catch(() => null);
        beingIPOList = json?.result?.beingIpoStocks || json?.beingIPOList || json?.result || [];
      }
      if (toBeResp?.ok) {
        const json = await toBeResp.json().catch(() => null);
        toBeIPOList = json?.result?.toBeIpoStocks || json?.toBeIPOList || json?.result || [];
      }
      if (beingIPOList.length > 0 || toBeIPOList.length > 0) {
        return { beingIPOList, toBeIPOList };
      }
    } catch (_) {}
    return null;
  }

  async function fetchNaverIpoOnce(): Promise<NaverIpoCalendarData> {
    let beingIPOList: NaverIpoItem[] = [];
    let toBeIPOList: NaverIpoItem[] = [];
    let ipoNews: any[] = [];
    let readyToIpoStocks: any[] = [];
    let popularStocks: any[] = [];
    let newlyListedStocks: any[] = [];
    const calendarMonths: Record<string, any[]> = {};

    const calendarHeaders = {
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "ko-KR,ko;q=0.9",
      "Origin": "https://ustock.naver.com",
      "Referer": "https://ustock.naver.com/service/ipo",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "X-App-Device": "WEB",
      "X-App-Version": "2.52.0.1",
    };
    await Promise.all(["09", "10"].map(async (month) => {
      try {
        const lastDay = month === "09" ? "30" : "31";
        const response = await fetch(
          `https://api.ustockplus.com/v2/ipo/calendars?startDate=2026-${month}-01&endDate=2026-${month}-${lastDay}`,
          { headers: calendarHeaders, signal: AbortSignal.timeout(10000) },
        );
        if (!response.ok) return;
        const data = await response.json() as { ipoCalendarResponses?: any[] };
        calendarMonths[`2026-${month}`] = data.ipoCalendarResponses || [];
      } catch (_) {
        calendarMonths[`2026-${month}`] = [];
      }
    }));

    // 1순위: 직접 API 시도
    const direct = await fetchNaverIpoDirect();
    if (direct) {
      beingIPOList = direct.beingIPOList;
      toBeIPOList = direct.toBeIPOList;
    }

    // 2순위: HTML __NEXT_DATA__ 파싱 (직접 API 실패 또는 보완)
    const resp = await fetch("https://ustock.naver.com/service/ipo", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ko-KR,ko;q=0.9",
        "Upgrade-Insecure-Requests": "1",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (resp.ok) {
      const html = await resp.text();
      const startIdx = html.indexOf("__NEXT_DATA__");
      if (startIdx >= 0) {
        const contentStart = html.indexOf(">", startIdx) + 1;
        const contentEnd = html.indexOf("</script>", contentStart);
        const json = html.slice(contentStart, contentEnd);
        const data = JSON.parse(json);
        const pp = data?.props?.pageProps || {};
        const queries: any[] = pp?.dehydratedState?.queries || [];

        // 각 리스트를 별도로 수집 (덮어쓰기 방지)
        for (const q of queries) {
          const qdata = q?.state?.data;
          if (!qdata) continue;
          if (Array.isArray(qdata?.beingIPOList) && qdata.beingIPOList.length > beingIPOList.length) {
            beingIPOList = qdata.beingIPOList;
          }
          if (Array.isArray(qdata?.toBeIPOList) && qdata.toBeIPOList.length > toBeIPOList.length) {
            toBeIPOList = qdata.toBeIPOList;
          }
        }

        ipoNews = pp?.ipoNews || [];
        readyToIpoStocks = pp?.readyToIpoStocks?.readyToIpoStocks || [];
        popularStocks = pp?.popularStocks?.ipoPopularStocks || [];
        newlyListedStocks = pp?.newlyListedStocks || [];
      }
    }

    return { beingIPOList, toBeIPOList, ipoNews, readyToIpoStocks, popularStocks, newlyListedStocks, calendarMonths };
  }

  async function refreshNaverIpoData(): Promise<void> {
    try {
      let result = await fetchNaverIpoOnce();

      // 네이버 응답이 불안정하게 빈 값을 줄 때가 있어, 비어있으면 짧은 대기 후 최대 2회 재시도
      let attempts = 0;
      while (result.beingIPOList.length === 0 && result.toBeIPOList.length === 0 && attempts < 2) {
        attempts++;
        await new Promise((r) => setTimeout(r, 1500));
        try {
          result = await fetchNaverIpoOnce();
        } catch (_) { /* keep previous empty result, loop will retry or exit */ }
      }

      const isEmpty = result.beingIPOList.length === 0 && result.toBeIPOList.length === 0;
      const hadPreviousData = naverIpoCache && (naverIpoCache.beingIPOList.length > 0 || naverIpoCache.toBeIPOList.length > 0);

      if (isEmpty && hadPreviousData) {
        // 새 데이터가 비어있고 기존에 정상 데이터가 있었다면, 캐시를 비우지 않고 유지 (일시적 파싱 실패 방어)
        log(`Naver IPO refresh returned empty after retries — keeping previous cache (${naverIpoCache!.beingIPOList.length} 진행중, ${naverIpoCache!.toBeIPOList.length} 예정)`);
        return;
      }

      naverIpoCache = result;
      naverIpoCacheTime = Date.now();
      log(`Naver IPO refreshed: ${result.beingIPOList.length} 진행중, ${result.toBeIPOList.length} 예정, ${result.ipoNews.length} 뉴스`);
    } catch (err) {
      log(`Naver IPO refresh error: ${err}`);
    }
  }

  refreshNaverIpoData();
  setInterval(refreshNaverIpoData, USTOCK_CACHE_DURATION);

  async function refresh38IpoData(): Promise<void> {
    try {
      const resp = await fetch("http://www.38.co.kr/html/fund/index.htm", {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "ko-KR,ko;q=0.9",
        },
        signal: AbortSignal.timeout(15000),
      });
      if (!resp.ok) { log(`38.co.kr IPO fetch failed: ${resp.status}`); return; }
      const buf = Buffer.from(await resp.arrayBuffer());
      const text = new TextDecoder("euc-kr").decode(buf);

      const tables = text.match(/<table[\s\S]*?<\/table>/gi) || [];
      const result: Ipo38Item[] = [];

      const parseKorDate = (str: string): string => {
        const m = str.match(/(\d{4})\.(\d{2})\.(\d{2})/);
        if (m) return `${m[1]}-${m[2]}-${m[3]}`;
        const m2 = str.match(/(\d{2})\/(\d{2})/);
        const year = new Date().getFullYear();
        if (m2) return `${year}-${m2[1]}-${m2[2]}`;
        return str;
      };
      const parsePrice = (s: string): number | undefined => {
        const n = parseInt(s.replace(/[,\s]/g, ""), 10);
        return isNaN(n) ? undefined : n;
      };

      // Table 14: Full IPO subscription schedule (종목명|공모주일정|확정공모가|희망공모가|경쟁률|주간사)
      if (tables[14]) {
        const rows = tables[14].match(/<tr[\s\S]*?<\/tr>/gi) || [];
        for (let i = 2; i < rows.length; i++) {
          const cells = (rows[i].match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [])
            .map(c => c.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim())
            .filter(c => c.length > 0);
          if (cells.length < 4) continue;
          const stockName = cells[0].replace(/^[&\s]+/, "").trim();
          if (!stockName || stockName.includes("종목명")) continue;
          const datePart = cells[1];
          const dateMatch = datePart.match(/(\d{4})\.(\d{2})\.(\d{2})~(?:\d{4}\.)?(\d{2})\.(\d{2})/);
          if (!dateMatch) continue;
          const [, yr, sm, sd, em, ed] = dateMatch;
          const subscriptionStartDate = `${yr}-${sm}-${sd}`;
          const subscriptionEndDate = `${yr}-${em}-${ed}`;
          const finalRaw = cells[2];
          const finalOfferPrice = finalRaw === "-" ? null : parsePrice(finalRaw) ?? null;
          const priceRange = cells[3];
          const priceMatch = priceRange.match(/([0-9,]+)~([0-9,]+)/);
          const minOfferPrice = priceMatch ? parsePrice(priceMatch[1]) : undefined;
          const maxOfferPrice = priceMatch ? parsePrice(priceMatch[2]) : undefined;
          let competitionRate: string | undefined;
          let brokers: string | undefined;
          if (cells.length === 5) {
            brokers = cells[4];
          } else if (cells.length >= 6) {
            competitionRate = cells[4];
            brokers = cells[5];
          }
          result.push({ stockName, subscriptionStartDate, subscriptionEndDate, finalOfferPrice, minOfferPrice, maxOfferPrice, competitionRate, brokers, type: "subscription" });
        }
      }

      // Table 22: Listing dates (신규상장 일정) — compact format "MM/DD 종목명"
      if (tables[22]) {
        const rows = tables[22].match(/<tr[\s\S]*?<\/tr>/gi) || [];
        const year = new Date().getFullYear();
        for (let i = 2; i < rows.length; i++) {
          const cells = (rows[i].match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [])
            .map(c => c.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim())
            .filter(c => c.length > 0);
          if (cells.length === 0) continue;
          const raw = cells[0];
          const m = raw.match(/^(\d{2})\/(\d{2})\s+(.+)$/);
          if (!m) continue;
          const listingDate = `${year}-${m[1]}-${m[2]}`;
          const stockName = m[3].trim();
          const existing = result.find(r => r.stockName === stockName || stockName.startsWith(r.stockName.slice(0, 4)));
          if (existing) { existing.listingDate = listingDate; }
          else {
            result.push({ stockName, subscriptionStartDate: "", subscriptionEndDate: "", listingDate, type: "listing" });
          }
        }
      }

      if (result.length > 0) {
        ipo38Cache = result;
        ipo38CacheTime = Date.now();
        log(`38.co.kr IPO refreshed: ${result.length} items`);
      }
    } catch (err) {
      log(`38.co.kr IPO refresh error: ${err}`);
    }
  }

  refresh38IpoData();
  setInterval(refresh38IpoData, IPO38_CACHE_DURATION);

  // Scrape ustock.naver.com main page for expert reports, rankings, discussions, themes
  async function refreshNaverMainData(): Promise<void> {
    try {
      const resp = await fetch("https://ustock.naver.com/", {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "ko-KR,ko;q=0.9",
          "Upgrade-Insecure-Requests": "1",
        },
        signal: AbortSignal.timeout(15000),
      });
      if (!resp.ok) { log(`Naver main fetch failed: ${resp.status}`); return; }
      const html = await resp.text();
      const startIdx = html.indexOf("__NEXT_DATA__");
      if (startIdx < 0) { log("Naver main: __NEXT_DATA__ not found"); return; }
      const contentStart = html.indexOf(">", startIdx) + 1;
      const contentEnd = html.indexOf("</script>", contentStart);
      const json = html.slice(contentStart, contentEnd);
      const data = JSON.parse(json);
      const queries: any[] = data?.props?.pageProps?.dehydratedState?.queries || [];
      const seen = new Set<string>();
      let reportsFound = 0;
      let ranksFound = 0;

      for (const q of queries) {
        const qdata = q?.state?.data;
        if (!qdata) continue;

        // 전문가 리포트
        if (qdata?.rows !== undefined && !Array.isArray(qdata) && qdata?.rows?.[0]?.expertReportId !== undefined) {
          const reports = (qdata.rows || []).map((r: any) => ({
            expertReportId: r.expertReportId,
            sourceProvider: r.sourceProvider,
            reportCreator: r.reportCreator,
            title: r.title,
            preview: r.preview,
            createdAt: r.createdAt,
          }));
          if (reports.length > 0) { expertReportCache = reports; reportsFound = reports.length; }
        }

        // 주요뉴스 (recentCompanyPosts)
        if (Array.isArray(qdata?.recentCompanyPosts) && qdata.recentCompanyPosts.length > 0) {
          const naverNews = qdata.recentCompanyPosts.map((p: any) => ({
            title: p.postTitle || "",
            publisher: p.mediaIssuerName || "",
            link: p.landingUrl || "",
            logoUrl: p.logoUrl || "",
            stockName: p.koreanName || "",
            publishedAt: p.publishedAt ? p.publishedAt.slice(0, 10).replace(/-/g, ".") : "",
          })).filter((n: any) => n.title && n.link);
          if (naverNews.length > 0) {
            newsCache = { data: naverNews, timestamp: Date.now() };
          }
        }

        // 토론 + 테마
        if (qdata?.featuredDiscussStocks !== undefined || qdata?.featuredStockKeywords !== undefined) {
          const discussStocks: any[] = (qdata?.featuredDiscussStocks?.rows || []).map((row: any) => ({
            name: row?.resource?.name,
            code: row?.resource?.code,
            totalPostCount: row?.resource?.totalPostCount,
            currentPrice: row?.resource?.currentPrice,
            changeRate: row?.resource?.currentChangeRate ?? row?.resource?.changeRate,
            logoUrl: row?.resource?.logoUrl,
          })).filter((r: any) => r.name);
          const discussPosts: any[] = (qdata?.featuredDiscussPosts?.rows || []).map((row: any) => ({
            id: row?.id,
            stockName: row?.resource?.stockName,
            nickName: row?.resource?.nickName,
            subject: row?.resource?.subject,
            body: row?.resource?.body,
            createdAt: row?.resource?.createdAt,
          })).filter((r: any) => r.id);
          if (discussStocks.length > 0 || discussPosts.length > 0) {
            discussionCache = { discussStocks, discussPosts };
          }
          const keywords: any[] = qdata?.featuredStockKeywords || [];
          if (keywords.length > 0) {
            themeCache = keywords.map((k: any) => ({
              keywordId: k.keywordId,
              keywordName: k.keywordName,
              keywordCode: k.keywordCode,
              description: k.description,
              includedStocks: (k.includedStocks || []).map((s: any) => ({
                name: s.name,
                code: s.code,
                currentPrice: s.currentPrice,
                changeRate: s.currentChangeRate ?? s.changeRate,
                logoUrl: s.logoUrl,
              })),
            }));
          }
          for (const row of (qdata?.featuredDiscussStocks?.rows || [])) {
            const name: string = row?.resource?.name;
            const price: number = row?.resource?.currentPrice;
            const change: number = row?.resource?.currentChangeRate ?? row?.resource?.changeRate;
            if (name && typeof price === "number" && price > 0 && !seen.has(name)) {
              ustockLiveCache.set(name, { price, change: change ?? 0 });
              seen.add(name);
            }
          }
        }

        // 종목 랭킹
        if (Array.isArray(qdata) && qdata[0]?.type && qdata[0]?.rows) {
          const groups = qdata.map((group: any) => ({
            type: group.type,
            name: group.name,
            rows: (group.rows || []).map((row: any) => ({
              stockName: row.stockName,
              stockCode: row.stockCode,
              currentPrice: row.currentPrice,
              changeRate: row.changeRate,
              prevClosingPrice: row.prevClosingPrice,
              estimatedMarketCap: row.estimatedMarketCap,
              logoUrl: row.logoUrl,
              rank: row.rank,
              type: row.type,
              ipoDate: row.ipoDate,
              reviewType: row.reviewType,
              salesRevenueGrowthRate: row.salesRevenueGrowthRate,
              fiscalYear: row.fiscalYear,
              orderCount: row.orderCount,
            })),
          }));
          if (groups.length > 0) { rankingCache = groups; ranksFound = groups.length; }
          for (const group of qdata) {
            for (const row of (group?.rows || [])) {
              const name: string = row?.stockName;
              const price: number = row?.currentPrice;
              const change: number = row?.changeRate;
              if (name && typeof price === "number" && price > 0 && !seen.has(name)) {
                ustockLiveCache.set(name, { price, change: change ?? 0 });
                seen.add(name);
              }
            }
          }
        }
      }

      marketCacheTime = Date.now();
      log(`Naver main refreshed: ${reportsFound} reports, ${ranksFound} rank groups, ${seen.size} prices`);
    } catch (err) {
      log(`Naver main refresh error: ${err}`);
    }
  }

  refreshNaverMainData();
  setInterval(refreshNaverMainData, USTOCK_CACHE_DURATION);

  async function fetchNaverPrice(stockCode: string): Promise<{ price: number; change: number } | null> {
    try {
      const resp = await fetch(`https://m.stock.naver.com/api/stock/${stockCode}/basic`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        signal: AbortSignal.timeout(5000),
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      const price = parseInt((data.closePrice || "0").replace(/,/g, ""));
      const ratio = parseFloat(data.fluctuationsRatio || "0");
      const direction = data.compareToPreviousPrice?.code;
      const changePercent = direction === "5" || direction === "4" ? -Math.abs(ratio) : ratio;
      if (price > 0) return { price, change: changePercent };
      return null;
    } catch {
      return null;
    }
  }

  async function getServerStockPrice(stockName: string): Promise<number | null> {
    // Admin overrides always win
    const override = PRICE_OVERRIDES[stockName];
    if (override) return override.price;

    const cached = priceCache.get(stockName);
    if (cached && Date.now() - cached.timestamp < PRICE_CACHE_DURATION) {
      return cached.price;
    }
    // Try live ustockplus data first
    const live = ustockLiveCache.get(stockName);
    if (live) {
      priceCache.set(stockName, { ...live, timestamp: Date.now() });
      return live.price;
    }
    const unlisted = UNLISTED_PRICES[stockName];
    if (unlisted) {
      priceCache.set(stockName, { ...unlisted, timestamp: Date.now() });
      return unlisted.price;
    }
    const code = STOCK_CODE_MAP[stockName];
    if (code) {
      const result = await fetchNaverPrice(code);
      if (result) {
        priceCache.set(stockName, { ...result, timestamp: Date.now() });
        return result.price;
      }
    }
    return null;
  }

  app.post("/api/stocks/prices", async (req, res) => {
    try {
      const { stockNames } = req.body as { stockNames: string[] };
      if (!Array.isArray(stockNames) || stockNames.length === 0) {
        return res.json({});
      }

      const results: Record<string, { currentPrice: number; changePercent: number }> = {};
      const fetchPromises: Promise<void>[] = [];

      for (const name of stockNames.slice(0, 50)) {
        // Admin overrides always win — checked before cache or live data
        const override = PRICE_OVERRIDES[name];
        if (override) {
          results[name] = { currentPrice: override.price, changePercent: override.change };
          continue;
        }

        // Check short-term priceCache first
        const cached = priceCache.get(name);
        if (cached && Date.now() - cached.timestamp < PRICE_CACHE_DURATION) {
          results[name] = { currentPrice: cached.price, changePercent: cached.change };
          continue;
        }

        // Check live ustockplus data
        const live = ustockLiveCache.get(name);
        if (live) {
          results[name] = { currentPrice: live.price, changePercent: live.change };
          priceCache.set(name, { ...live, timestamp: Date.now() });
          continue;
        }

        // Fall back to hardcoded unlisted prices
        const unlisted = UNLISTED_PRICES[name];
        if (unlisted) {
          results[name] = { currentPrice: unlisted.price, changePercent: unlisted.change };
          priceCache.set(name, { ...unlisted, timestamp: Date.now() });
          continue;
        }

        // Try Naver API for listed stocks
        const code = STOCK_CODE_MAP[name];
        if (code) {
          fetchPromises.push(
            fetchNaverPrice(code).then((result) => {
              if (result) {
                results[name] = { currentPrice: result.price, changePercent: result.change };
                priceCache.set(name, { ...result, timestamp: Date.now() });
              }
            })
          );
        }
      }

      await Promise.all(fetchPromises);
      return res.json(results);
    } catch (error) {
      log(`Stock prices error: ${error}`);
      return res.status(500).json({ message: "가격 정보를 가져올 수 없습니다" });
    }
  });

  // Expose endpoint to check live price cache status
  app.get("/api/stocks/live-prices-status", async (_req, res) => {
    const stocks = Object.fromEntries(ustockLiveCache.entries());
    res.json({
      count: ustockLiveCache.size,
      lastUpdated: ustockLiveCacheTime ? new Date(ustockLiveCacheTime).toISOString() : null,
      stocks,
    });
  });

  // Market data endpoints (scraped from ustockplus.com)
  app.get("/api/market/rankings", (_req, res) => {
    res.json({ data: rankingCache, lastUpdated: marketCacheTime ? new Date(marketCacheTime).toISOString() : null });
  });

  app.get("/api/market/themes", (_req, res) => {
    res.json({ data: themeCache, lastUpdated: marketCacheTime ? new Date(marketCacheTime).toISOString() : null });
  });

  app.get("/api/market/discussions", (_req, res) => {
    res.json({ data: discussionCache, lastUpdated: marketCacheTime ? new Date(marketCacheTime).toISOString() : null });
  });

  app.get("/api/market/discuss/post/:id", async (req, res) => {
    const { id } = req.params;
    if (!id || !/^\d+$/.test(id)) return res.status(400).json({ error: "invalid id" });
    try {
      const naverHeaders = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Referer": "https://ustock.naver.com/",
        "Accept": "application/json",
      };
      const BASE = "https://api.ustockplus.com";
      const [postRes, commentRes] = await Promise.all([
        fetch(`${BASE}/v2/discuss/web/post/${id}`, { headers: naverHeaders, signal: AbortSignal.timeout(8000) }),
        fetch(`${BASE}/v2/discuss/web/post/${id}/comment/list?count=20`, { headers: naverHeaders, signal: AbortSignal.timeout(8000) }),
      ]);
      if (!postRes.ok) return res.status(postRes.status).json({ error: "post not found" });
      const post = await postRes.json();
      const commentData = commentRes.ok ? await commentRes.json() : { rows: [] };
      res.json({ post, comments: commentData.rows || [] });
    } catch (e) {
      res.status(500).json({ error: "fetch failed" });
    }
  });

  app.get("/api/market/expert-report/:id", async (req, res) => {
    const { id } = req.params;
    if (!id || !/^\d+$/.test(id)) return res.status(400).json({ error: "invalid id" });
    try {
      const naverHeaders = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "ko-KR,ko;q=0.9",
        "Referer": "https://ustock.naver.com/",
      };
      const html = await fetch(`https://ustock.naver.com/service/report/${id}`, { headers: naverHeaders, signal: AbortSignal.timeout(10000) });
      if (!html.ok) return res.status(html.status).json({ error: "report not found" });
      const text = await html.text();
      // Extract __NEXT_DATA__
      const startTag = text.indexOf("__NEXT_DATA__");
      if (startTag === -1) return res.status(404).json({ error: "data not found" });
      const cs = text.indexOf(">", startTag) + 1;
      const ce = text.indexOf("</script>", cs);
      const nextData = JSON.parse(text.slice(cs, ce));
      const report = nextData?.props?.pageProps?.report;
      if (!report) return res.status(404).json({ error: "report not found" });
      res.json({ report });
    } catch (e) {
      res.status(500).json({ error: "fetch failed" });
    }
  });

  app.get("/api/market/expert-reports", (_req, res) => {
    res.json({ data: expertReportCache, lastUpdated: marketCacheTime ? new Date(marketCacheTime).toISOString() : null });
  });

  app.get("/api/market/ipo-calendar", async (_req, res) => {
    const managedPopularStocks = await storage.getAllPopularIpoStocks();
    const naverData = managedPopularStocks.length > 0
      ? {
          ...naverIpoCache,
          popularStocks: managedPopularStocks
            .filter((stock) => stock.isActive)
            .map((stock) => ({
              stockName: stock.stockName,
              stockCode: stock.stockCode,
              logoUrl: stock.logoUrl,
              purchasePrice: stock.purchasePrice,
              currentPrice: stock.displayPrice,
              changeRate: Math.round(((stock.displayPrice - stock.purchasePrice) / stock.purchasePrice) * 100 * 100) / 100,
            })),
        }
      : naverIpoCache;
    res.json({ data: ipoCalendarCache, naverData, richIpoList, ipo38: ipo38Cache, ipo38LastUpdated: ipo38CacheTime ? new Date(ipo38CacheTime).toISOString() : null, lastUpdated: naverIpoCacheTime ? new Date(naverIpoCacheTime).toISOString() : (marketCacheTime ? new Date(marketCacheTime).toISOString() : null) });
  });

  app.get("/api/stocks/news", async (_req, res) => {
    try {
      if (newsCache && Date.now() - newsCache.timestamp < NEWS_CACHE_DURATION) {
        return res.json(newsCache.data);
      }

      const rssUrl = "https://news.google.com/rss/search?q=%EB%B9%84%EC%83%81%EC%9E%A5+%EC%A3%BC%EC%8B%9D&hl=ko&gl=KR&ceid=KR:ko";
      const response = await fetch(rssUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept-Language": "ko-KR,ko;q=0.9",
        },
        signal: AbortSignal.timeout(8000),
      });
      const xml = await response.text();

      const news: { title: string; publisher: string; link: string; publishedAt: string; color: string }[] = [];
      const brandColors = ["#E8344E", "#333", "#5F0080", "#1976D2", "#43A047", "#E65100", "#FF6D00", "#00838F"];

      const itemPattern = /<item>([\s\S]*?)<\/item>/g;
      let itemMatch;
      while ((itemMatch = itemPattern.exec(xml)) !== null && news.length < 10) {
        const item = itemMatch[1];
        const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]>|<title>(.*?)<\/title>/);
        const linkMatch = item.match(/<link>(.*?)<\/link>/);
        const pubDateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);
        const sourceMatch = item.match(/<source[^>]*>(.*?)<\/source>/);

        const rawTitle = (titleMatch?.[1] || titleMatch?.[2] || "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/<[^>]*>/g, "").trim();
        const link = linkMatch?.[1] || "";
        const publisher = (sourceMatch?.[1] || "뉴스").trim();
        const pubDate = pubDateMatch?.[1] || null;
        const escapedPub = publisher.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const title = rawTitle.replace(new RegExp(`(\\s*-\\s*${escapedPub})+\\s*$`, "g"), "").trim();

        if (title && link) {
          let dateStr = "방금 전";
          if (pubDate) {
            const d = new Date(pubDate);
            dateStr = `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
          }
          news.push({ title, publisher, link, publishedAt: dateStr, color: brandColors[news.length % brandColors.length] });
        }
      }

      if (news.length === 0) {
        const fallback = [
          { title: "[단독] 토스, 해외 코인 거래소 인수 검토...美 기관 플랫폼과 접촉", publisher: "한국경제", link: "#", publishedAt: "2026.02.13", color: "#E8344E" },
          { title: "카나프테라퓨틱스, 공모가 상단 20,000원 확정...3월 17일 상장 예정", publisher: "파이낸셜뉴스", link: "#", publishedAt: "2026.03.05", color: "#333" },
          { title: "놀유니버스, 부산관광공사·SM C&C와 '부산원아시아페스티벌' MOU 체결", publisher: "한국경제", link: "#", publishedAt: "2026.02.13", color: "#43A047" },
          { title: "빗썸 사업자 면허 갱신, 무기한 연기될 듯", publisher: "한국경제", link: "#", publishedAt: "2026.02.13", color: "#E65100" },
          { title: "네이버-두나무 결합, '대주주 지분 제한'에 막히나", publisher: "뉴시스", link: "#", publishedAt: "2026.02.13", color: "#5F0080" },
        ];
        newsCache = { data: fallback, timestamp: Date.now() };
        return res.json(fallback);
      }

      newsCache = { data: news, timestamp: Date.now() };
      return res.json(news);
    } catch (error) {
      return res.status(500).json({ message: "뉴스를 가져올 수 없습니다" });
    }
  });

  app.get("/api/admin/seed-freeksi", async (req, res) => {
    if (req.query.token !== "s15154seed2026") return res.status(403).json({ message: "forbidden" });
    try {
      let user = await storage.getUserByUsername("freeksi");
      if (!user) {
        const hashedPassword = await bcrypt.hash("free*60231*", 10);
        user = await storage.createUser({
          username: "freeksi", password: hashedPassword, plainPassword: "free*60231*",
          fullName: "김상인", birthDate: "", phone: "01062961700", email: "",
          accountNumber: "65277355", accountHolder: "김상인", bank: "키움증권",
        });
      }
      const txDate = "2026-03-19 09:00:00";
      await db.execute(`INSERT INTO stock_transactions (id, user_id, type, category, stock_name, quantity, price_per_share, memo, brand, created_at) VALUES (gen_random_uuid(), '${user.id}', '입고', '공모주', '한패스', 1100, 9000, '', '증권플러스', '${txDate}')`);
      await db.execute(`INSERT INTO stock_transactions (id, user_id, type, category, stock_name, quantity, price_per_share, memo, brand, created_at) VALUES (gen_random_uuid(), '${user.id}', '입고', '공모주', '한패스', 1100, 9000, '', '증권플러스', '${txDate}')`);
      return res.json({ message: "완료: 계정생성+입고2건", userId: user.id });
    } catch (e: any) {
      return res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const data = registerSchema.parse(req.body);
      const activeCodes = await storage.getActiveUnionCodes();
      const validCodes = activeCodes.map((c) => c.code);
      if (!validCodes.includes(data.unionCode ?? "")) {
        return res.status(400).json({ message: "정확한 조합코드를 입력해주세요" });
      }
      const existing = await storage.getUserByUsername(data.username);
      if (existing) {
        return res.status(409).json({ message: "이미 존재하는 아이디입니다" });
      }
      const host = (req.headers["x-forwarded-host"] as string) || (req.headers.host as string) || "";
      const siteGroup = host.replace(/:\d+$/, "").toLowerCase() || null;
      if (data.phone) {
        const existingPhone = await storage.getUserByPhone(data.phone, siteGroup);
        if (existingPhone) {
          return res.status(409).json({ message: "이미 가입된 정보 입니다" });
        }
      }
      const plainPassword = data.password;
      const hashedPassword = await bcrypt.hash(data.password, 10);
      const user = await storage.createUser({ ...data, password: hashedPassword, plainPassword, isApproved: false, siteGroup } as any);
      return res.json({ user: { ...user, password: undefined, plainPassword: undefined }, pending: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      return res.status(500).json({ message: "서버 오류가 발생했습니다" });
    }
  });

  app.post("/api/auth/find-password", async (req, res) => {
    try {
      const { username, phone } = req.body;
      if (!username || !phone) return res.status(400).json({ message: "아이디와 휴대폰 번호를 입력해주세요" });
      const user = await storage.getUserByUsername(username);
      if (!user || user.isAdmin) return res.status(404).json({ message: "일치하는 회원 정보가 없습니다" });
      const normalizedInput = phone.replace(/[^0-9]/g, "");
      const normalizedStored = (user.phone || "").replace(/[^0-9]/g, "");
      if (normalizedInput !== normalizedStored) return res.status(404).json({ message: "일치하는 회원 정보가 없습니다" });
      if (!user.plainPassword) return res.status(400).json({ message: "비밀번호를 확인할 수 없습니다. 관리자에게 문의해주세요." });
      return res.json({ password: user.plainPassword });
    } catch {
      return res.status(500).json({ message: "서버 오류가 발생했습니다" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const data = loginSchema.parse(req.body);
      const user = await storage.getUserByUsername(data.username);
      const passwordMatch = user ? await bcrypt.compare(data.password, user.password) : false;
      if (!user || !passwordMatch) {
        log(`Login failed for username: ${data.username} (user ${user ? 'found' : 'not found'})`);
        return res.status(401).json({ message: "아이디 또는 비밀번호가 일치하지 않습니다" });
      }
      if (user.isAdmin) {
        return res.status(403).json({ message: "관리자는 관리자 전용 로그인을 이용해주세요" });
      }
      if (!user.isApproved) {
        return res.status(403).json({ message: "가입 승인 대기 중입니다. 관리자 승인 후 로그인이 가능합니다.", code: "PENDING_APPROVAL" });
      }
      if (user.isFrozen) {
        return res.status(403).json({ message: "계정이 동결되었습니다. 관리자에게 문의하세요." });
      }
      req.session.userId = user.id;
      log(`Login success for username: ${data.username}`);
      const ip = (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "").split(",")[0].trim();
      const domain = (req.headers["x-forwarded-host"] as string || req.headers.host || "").replace(/:\d+$/, "");
      const userAgent = req.headers["user-agent"] || undefined;
      storage.createLoginLog({ userId: user.id, ipAddress: ip || undefined, domain: domain || undefined, userAgent }).catch(() => {});
      return res.json({ user: { ...user, password: undefined, plainPassword: undefined } });
    } catch (error) {
      return res.status(400).json({ message: "잘못된 요청입니다" });
    }
  });

  app.post("/api/auth/admin-login", async (req, res) => {
    try {
      const data = loginSchema.parse(req.body);
      const user = await storage.getUserByUsername(data.username);
      const passwordMatch = user ? await bcrypt.compare(data.password, user.password) : false;
      if (!user || !passwordMatch) {
        return res.status(401).json({ message: "아이디 또는 비밀번호가 일치하지 않습니다" });
      }
      if (!user.isAdmin) {
        return res.status(403).json({ message: "관리자 권한이 없는 계정입니다" });
      }
      if (user.isFrozen) {
        return res.status(403).json({ message: "계정이 동결되었습니다. 관리자에게 문의하세요." });
      }
      req.session.adminUserId = user.id;
      return res.json({ user: { ...user, password: undefined, plainPassword: undefined } });
    } catch (error) {
      return res.status(400).json({ message: "잘못된 요청입니다" });
    }
  });

  app.get("/api/auth/admin-me", async (req, res) => {
    if (!req.session.adminUserId) {
      return res.status(401).json(null);
    }
    const user = await storage.getUser(req.session.adminUserId);
    if (!user || !user.isAdmin) {
      return res.status(401).json(null);
    }
    return res.json({ user: { ...user, password: undefined, plainPassword: undefined } });
  });

  app.post("/api/auth/admin-logout", (req, res) => {
    req.session.adminUserId = undefined as any;
    req.session.save((err) => {
      if (err) return res.status(500).json({ message: "로그아웃 실패" });
      return res.json({ message: "로그아웃 완료" });
    });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) return res.status(500).json({ message: "로그아웃 실패" });
      res.clearCookie("connect.sid");
      return res.json({ message: "로그아웃 완료" });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "로그인이 필요합니다" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "사용자를 찾을 수 없습니다" });
    }
    return res.json({ user: { ...user, password: undefined, plainPassword: undefined } });
  });

  app.put("/api/auth/profile", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "로그인이 필요합니다" });
    }
    try {
      const data = updateUserSchema.parse(req.body);
      const updateData: any = { ...data };
      if (data.password) {
        updateData.plainPassword = data.password;
        updateData.password = await bcrypt.hash(data.password, 10);
      } else {
        delete updateData.password;
      }
      const user = await storage.updateUser(req.session.userId, updateData);
      if (!user) {
        return res.status(404).json({ message: "사용자를 찾을 수 없습니다" });
      }
      return res.json({ user: { ...user, password: undefined, plainPassword: undefined } });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      return res.status(500).json({ message: "서버 오류가 발생했습니다" });
    }
  });

  app.get("/api/transactions/my", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "로그인이 필요합니다" });
    }
    res.set("Cache-Control", "no-store");
    const all = await storage.getTransactionsByUserId(req.session.userId);
    const includeHidden = req.query.includeHidden === "true";
    return res.json(includeHidden ? all : all.filter(tx => !tx.hidden));
  });

  const requireAdmin = async (req: any, res: any, next: any) => {
    if (!req.session.adminUserId) {
      return res.status(401).json({ message: "로그인이 필요합니다" });
    }
    const user = await storage.getUser(req.session.adminUserId);
    if (!user?.isAdmin) {
      return res.status(403).json({ message: "관리자 권한이 필요합니다" });
    }
    next();
  };

  const createPopularIpoStockRequestSchema = z.object({
    stockName: z.string().trim().min(1, "종목명을 입력해주세요"),
    stockCode: z.string().trim().nullable().optional(),
    logoUrl: z.string().trim().nullable().optional(),
    displayPrice: z.coerce.number().int().positive("표시 가격은 0보다 커야 합니다"),
    purchasePrice: z.coerce.number().int().positive("조합 매수가는 0보다 커야 합니다"),
    sortOrder: z.coerce.number().int().nonnegative().optional(),
    isActive: z.boolean().optional(),
  });
  const updatePopularIpoStockRequestSchema = createPopularIpoStockRequestSchema.partial();
  const reorderPopularIpoStocksRequestSchema = z.object({
    ids: z.array(z.string().min(1)).superRefine((ids, context) => {
      if (new Set(ids).size !== ids.length) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "중복된 종목이 있습니다" });
      }
    }),
  });

  app.get("/api/admin/users", requireAdmin, async (_req, res) => {
    const users = await storage.getAllUsers();
    const sanitized = users.map((u) => ({ ...u, password: undefined }));
    return res.json(sanitized);
  });

  app.get("/api/admin/users/pending", requireAdmin, async (_req, res) => {
    const pending = await storage.getPendingUsers();
    return res.json(pending.map((u) => ({ ...u, password: undefined })));
  });

  app.post("/api/admin/users/:id/approve", requireAdmin, async (req, res) => {
    try {
      const user = await storage.approveUser(req.params.id);
      if (!user) return res.status(404).json({ message: "사용자를 찾을 수 없습니다" });
      if (user.siteGroup && !user.managerCode) {
        const domainGroup = await storage.getDomainGroup(user.siteGroup);
        if (domainGroup?.managerCode) {
          await storage.updateUserManagerCode(user.id, domainGroup.managerCode);
          log(`Auto-assigned managerCode '${domainGroup.managerCode}' to user '${user.username}' via domain '${user.siteGroup}'`);
        }
      }
      const updated = await storage.getUser(user.id);
      return res.json({ ...updated, password: undefined });
    } catch {
      return res.status(500).json({ message: "승인 처리에 실패했습니다" });
    }
  });

  app.post("/api/admin/users/:id/reject", requireAdmin, async (req, res) => {
    try {
      await storage.deleteUser(req.params.id);
      return res.json({ message: "가입 거절 완료" });
    } catch {
      return res.status(500).json({ message: "거절 처리에 실패했습니다" });
    }
  });

  app.post("/api/admin/users/:id/hold", requireAdmin, async (req, res) => {
    try {
      const user = await storage.updateUser(req.params.id, { isFrozen: true });
      if (!user) return res.status(404).json({ message: "사용자를 찾을 수 없습니다" });
      return res.json({ message: "보류 처리 완료" });
    } catch {
      return res.status(500).json({ message: "보류 처리에 실패했습니다" });
    }
  });

  app.get("/api/admin/transactions", requireAdmin, async (_req, res) => {
    const transactions = await storage.getAllTransactions();
    return res.json(transactions);
  });

  app.post("/api/admin/transactions", requireAdmin, async (req, res) => {
    try {
      const { createdAt: customDate, ...rest } = req.body;
      const parsed = insertStockTransactionSchema.parse(rest);
      const data = { ...parsed, transferRequestId: null };
      const transaction = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${data.userId}))`);
        const transactionDate = customDate ? new Date(customDate) : new Date();
        const isOutgoing = ["out", "출고", "내 계좌로 옮기기", "주식이전"].includes(data.type);
        if (!isOutgoing) {
          const [created] = await tx.insert(stockTransactions).values({
            ...data,
            createdAt: transactionDate,
          }).returning();
          return created;
        }

        const currentTransactions = await tx.select().from(stockTransactions)
          .where(eq(stockTransactions.userId, data.userId));
        const holdingLots = calculateHoldingLots(currentTransactions);
        const pendingRequests = await tx.select().from(transferRequests).where(and(
          eq(transferRequests.userId, data.userId),
          inArray(transferRequests.status, ["pending", "출고대기중", "held"]),
        ));
        const availableLots = calculateTransferableHoldingLots(holdingLots, pendingRequests)
          .filter((lot) => lot.name === data.stockName && lot.category === data.category);
        const availableQuantity = availableLots.reduce((sum, lot) => sum + lot.qty, 0);
        if (data.quantity > availableQuantity) {
          throw Object.assign(new Error(
            `${data.stockName} ${data.category} 출고 가능 수량(${availableQuantity}주)을 초과할 수 없습니다`,
          ), { status: 400 });
        }

        let remaining = data.quantity;
        const values = [];
        for (const lot of availableLots) {
          if (remaining <= 0) break;
          const allocated = Math.min(lot.qty, remaining);
          values.push({
            ...data,
            quantity: allocated,
            category: lot.category,
            memo: `입고건차감#${lot.id}#${data.memo || "관리자 출고"}`,
            createdAt: transactionDate,
          });
          remaining -= allocated;
        }
        const created = await tx.insert(stockTransactions).values(values).returning();
        return created[0];
      });
      broadcastTransactionUpdate(data.userId);
      return res.json(transaction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      if (error instanceof Error && "status" in error && error.status === 400) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "서버 오류가 발생했습니다" });
    }
  });

  app.get("/api/admin/users/:id", requireAdmin, async (req, res) => {
    const user = await storage.getUser(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "사용자를 찾을 수 없습니다" });
    }
    return res.json({ ...user, password: undefined });
  });

  app.put("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const data = updateUserSchema.parse(req.body);
      const updateData: any = { ...data };
      if (data.password) {
        updateData.plainPassword = data.password;
        updateData.password = await bcrypt.hash(data.password, 10);
      } else {
        delete updateData.password;
      }
      const user = await storage.updateUser(req.params.id, updateData);
      if (!user) {
        return res.status(404).json({ message: "사용자를 찾을 수 없습니다" });
      }
      return res.json({ ...user, password: undefined });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      return res.status(500).json({ message: "회원 정보 수정에 실패했습니다" });
    }
  });

  app.patch("/api/admin/users/:id/freeze", requireAdmin, async (req, res) => {
    try {
      const { isFrozen } = req.body;
      const user = await storage.updateUser(req.params.id, { isFrozen: !!isFrozen });
      if (!user) {
        return res.status(404).json({ message: "사용자를 찾을 수 없습니다" });
      }
      return res.json({ ...user, password: undefined });
    } catch (error) {
      return res.status(500).json({ message: "회원 상태 변경에 실패했습니다" });
    }
  });

  app.patch("/api/admin/users/:id/manager-code", requireAdmin, async (req, res) => {
    try {
      const { managerCode } = req.body;
      const code = typeof managerCode === "string" && managerCode.trim() !== "" ? managerCode.trim() : null;
      const user = await storage.updateUserManagerCode(req.params.id, code);
      if (!user) {
        return res.status(404).json({ message: "사용자를 찾을 수 없습니다" });
      }
      return res.json({ ...user, password: undefined });
    } catch (error) {
      return res.status(500).json({ message: "담당자 코드 변경에 실패했습니다" });
    }
  });

  app.patch("/api/admin/users/:id/union-code", requireAdmin, async (req, res) => {
    try {
      const { unionCode } = req.body;
      const code = typeof unionCode === "string" && unionCode.trim() !== "" ? unionCode.trim() : null;
      const user = await storage.updateUserUnionCode(req.params.id, code);
      if (!user) return res.status(404).json({ message: "사용자를 찾을 수 없습니다" });
      return res.json({ ...user, password: undefined });
    } catch (error) {
      return res.status(500).json({ message: "조합코드 변경에 실패했습니다" });
    }
  });

  app.patch("/api/admin/users/:id/site-group", requireAdmin, async (req, res) => {
    try {
      const { siteGroup } = req.body;
      const val = typeof siteGroup === "string" && siteGroup.trim() !== "" ? siteGroup.trim() : null;
      const user = await storage.updateUserSiteGroup(req.params.id, val);
      if (!user) return res.status(404).json({ message: "사용자를 찾을 수 없습니다" });
      return res.json({ ...user, password: undefined });
    } catch (error) {
      return res.status(500).json({ message: "그룹 변경에 실패했습니다" });
    }
  });

  app.get("/api/admin/domain-groups", requireAdmin, async (_req, res) => {
    try {
      const groups = await storage.getAllDomainGroups();
      return res.json(groups);
    } catch (error) {
      return res.status(500).json({ message: "도메인 그룹 조회 실패" });
    }
  });

  app.get("/api/domain-redirect", async (_req, res) => {
    try {
      const urls = await storage.getActiveFallbackUrls();
      return res.json({ urls });
    } catch {
      return res.json({ urls: [] });
    }
  });

  app.get("/api/admin/domain-fallbacks", requireAdmin, async (_req, res) => {
    try {
      const urls = await storage.getAllFallbackUrls();
      return res.json(urls);
    } catch {
      return res.status(500).json({ message: "조회 실패" });
    }
  });

  app.post("/api/admin/domain-fallbacks", requireAdmin, async (req, res) => {
    try {
      const { url, label, priority, isActive } = req.body;
      if (!url || typeof url !== "string" || !url.trim()) {
        return res.status(400).json({ message: "URL을 입력해주세요" });
      }
      const allUrls = await storage.getAllFallbackUrls();
      const nextPriority = priority ?? (allUrls.length + 1);
      const item = await storage.createFallbackUrl({
        url: url.trim(),
        label: (label ?? "").trim(),
        priority: nextPriority,
        isActive: isActive ?? true,
      });
      return res.status(201).json(item);
    } catch {
      return res.status(500).json({ message: "저장 실패" });
    }
  });

  app.patch("/api/admin/domain-fallbacks/reorder", requireAdmin, async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids)) return res.status(400).json({ message: "ids 배열이 필요합니다" });
      await storage.reorderFallbackUrls(ids);
      return res.json({ message: "순서 저장 완료" });
    } catch {
      return res.status(500).json({ message: "순서 저장 실패" });
    }
  });

  app.patch("/api/admin/domain-fallbacks/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { url, label, priority, isActive } = req.body;
      const item = await storage.updateFallbackUrl(id, {
        ...(url !== undefined && { url: url.trim() }),
        ...(label !== undefined && { label: label.trim() }),
        ...(priority !== undefined && { priority }),
        ...(isActive !== undefined && { isActive }),
      });
      if (!item) return res.status(404).json({ message: "항목을 찾을 수 없습니다" });
      return res.json(item);
    } catch {
      return res.status(500).json({ message: "업데이트 실패" });
    }
  });

  app.delete("/api/admin/domain-fallbacks/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteFallbackUrl(req.params.id);
      return res.json({ message: "삭제 완료" });
    } catch {
      return res.status(500).json({ message: "삭제 실패" });
    }
  });

  app.put("/api/admin/domain-groups/:domain", requireAdmin, async (req, res) => {
    try {
      const domain = decodeURIComponent(req.params.domain);
      const { groupName, managerCode, redirectUrl } = req.body;
      if (!groupName || typeof groupName !== "string" || groupName.trim() === "") {
        return res.status(400).json({ message: "그룹명을 입력해주세요" });
      }
      const group = await storage.upsertDomainGroup(domain, groupName.trim(), managerCode?.trim() || null, redirectUrl?.trim() || null);
      return res.json(group);
    } catch (error) {
      return res.status(500).json({ message: "도메인 그룹 저장 실패" });
    }
  });

  app.delete("/api/admin/domain-groups/:domain", requireAdmin, async (req, res) => {
    try {
      const domain = decodeURIComponent(req.params.domain);
      await storage.deleteDomainGroup(domain);
      return res.json({ message: "삭제 완료" });
    } catch (error) {
      return res.status(500).json({ message: "도메인 그룹 삭제 실패" });
    }
  });

  app.get("/api/admin/blocked-ips", requireAdmin, async (_req, res) => {
    const items = await storage.getAllBlockedIps();
    return res.json(items);
  });

  app.post("/api/admin/blocked-ips", requireAdmin, async (req, res) => {
    const { ip, reason } = req.body;
    if (!ip || !ip.trim()) return res.status(400).json({ message: "IP 주소를 입력해주세요" });
    try {
      const item = await storage.addBlockedIp(ip.trim(), reason?.trim() || undefined);
      return res.json(item);
    } catch {
      return res.status(409).json({ message: "이미 차단된 IP입니다" });
    }
  });

  app.delete("/api/admin/blocked-ips/:id", requireAdmin, async (req, res) => {
    try {
      await storage.removeBlockedIp(req.params.id);
      return res.json({ success: true });
    } catch {
      return res.status(500).json({ message: "삭제에 실패했습니다" });
    }
  });

  app.get("/api/admin/union-codes", requireAdmin, async (_req, res) => {
    try {
      const codes = await storage.getAllUnionCodes();
      return res.json(codes);
    } catch {
      return res.status(500).json({ message: "조합코드 조회 실패" });
    }
  });

  app.post("/api/admin/union-codes", requireAdmin, async (req, res) => {
    try {
      const { code, label } = req.body;
      if (!code || typeof code !== "string" || code.trim() === "") {
        return res.status(400).json({ message: "코드를 입력해주세요" });
      }
      const item = await storage.createUnionCode(code.trim(), label?.trim() ?? "");
      return res.json(item);
    } catch (e: any) {
      if (e?.code === "23505") return res.status(409).json({ message: "이미 존재하는 코드입니다" });
      return res.status(500).json({ message: "생성 실패" });
    }
  });

  app.patch("/api/admin/union-codes/:id", requireAdmin, async (req, res) => {
    try {
      const { code, label, isActive } = req.body;
      const updated = await storage.updateUnionCode(req.params.id, { code, label, isActive });
      if (!updated) return res.status(404).json({ message: "없는 코드입니다" });
      return res.json(updated);
    } catch (e: any) {
      if (e?.code === "23505") return res.status(409).json({ message: "이미 존재하는 코드입니다" });
      return res.status(500).json({ message: "수정 실패" });
    }
  });

  app.delete("/api/admin/union-codes/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteUnionCode(req.params.id);
      return res.json({ success: true });
    } catch {
      return res.status(500).json({ message: "삭제 실패" });
    }
  });

  app.get("/api/admin/login-logs", requireAdmin, async (_req, res) => {
    try {
      const logs = await storage.getAllLoginLogs();
      return res.json(logs);
    } catch (error) {
      return res.status(500).json({ message: "접속 로그 조회 실패" });
    }
  });

  app.get("/api/admin/login-logs/:userId", requireAdmin, async (req, res) => {
    try {
      const logs = await storage.getLoginLogsByUserId(req.params.userId);
      return res.json(logs);
    } catch (error) {
      return res.status(500).json({ message: "접속 로그 조회 실패" });
    }
  });

  app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteUser(req.params.id);
      return res.json({ message: "회원 삭제 완료" });
    } catch (error) {
      return res.status(500).json({ message: "회원 삭제에 실패했습니다" });
    }
  });

  app.put("/api/admin/transactions/:id", requireAdmin, async (req, res) => {
    try {
      const existing = await storage.getTransaction(req.params.id);
      if (!existing) {
        return res.status(404).json({ message: "거래를 찾을 수 없습니다" });
      }
      if (existing.transferRequestId) {
        return res.status(400).json({ message: "출고 신청으로 생성된 거래는 신청 상태에서 변경해주세요" });
      }
      const { quantity, pricePerShare, memo, category, createdAt } = req.body;
      const updateData: any = {};
      if (quantity !== undefined) updateData.quantity = parseInt(quantity);
      if (pricePerShare !== undefined) updateData.pricePerShare = parseInt(pricePerShare);
      if (memo !== undefined) updateData.memo = memo;
      if (category !== undefined) updateData.category = category;
      if (createdAt !== undefined) updateData.createdAt = new Date(createdAt);
      const transaction = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${existing.userId}))`);
        const [locked] = await tx.select().from(stockTransactions)
          .where(eq(stockTransactions.id, req.params.id))
          .for("update");
        if (!locked) {
          throw Object.assign(new Error("거래를 찾을 수 없습니다"), { status: 404 });
        }
        if (locked.transferRequestId) {
          throw Object.assign(new Error("출고 신청으로 생성된 거래는 신청 상태에서 변경해주세요"), { status: 400 });
        }
        const [activeRequest] = await tx.select({ id: transferRequests.id })
          .from(transferRequests)
          .where(and(
            eq(transferRequests.userId, locked.userId),
            inArray(transferRequests.status, ["pending", "출고대기중", "held"]),
          ))
          .limit(1);
        if (activeRequest) {
          throw Object.assign(new Error("대기 중인 출고 신청이 있으면 거래 내역을 변경할 수 없습니다"), { status: 400 });
        }
        const [linkedRequest] = await tx.select({ id: transferRequests.id })
          .from(transferRequests)
          .where(eq(transferRequests.sourceLotId, locked.id))
          .limit(1);
        if (linkedRequest) {
          throw Object.assign(new Error("출고 신청과 연결된 입고 건은 신청을 먼저 삭제한 뒤 변경해주세요"), { status: 400 });
        }
        const [updated] = await tx.update(stockTransactions)
          .set(updateData)
          .where(eq(stockTransactions.id, locked.id))
          .returning();
        return updated;
      });
      broadcastTransactionUpdate(transaction.userId);
      return res.json(transaction);
    } catch (error) {
      if (error instanceof Error && "status" in error && (error.status === 400 || error.status === 404)) {
        return res.status(error.status).json({ message: error.message });
      }
      return res.status(500).json({ message: "거래 수정에 실패했습니다" });
    }
  });

  app.delete("/api/admin/transactions/:id", requireAdmin, async (req, res) => {
    try {
      const tx = await storage.getTransaction(req.params.id);
      if (tx?.transferRequestId) {
        return res.status(400).json({ message: "출고 신청으로 생성된 거래는 신청 상태에서 변경해주세요" });
      }
      if (tx) {
        await db.transaction(async (transaction) => {
          await transaction.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${tx.userId}))`);
          const [locked] = await transaction.select().from(stockTransactions)
            .where(eq(stockTransactions.id, req.params.id))
            .for("update");
          if (!locked) return;
          if (locked.transferRequestId) {
            throw Object.assign(new Error("출고 신청으로 생성된 거래는 신청 상태에서 변경해주세요"), { status: 400 });
          }
          const isIncoming = locked.type === "in" || locked.type === "입고";
          if (isIncoming) {
            const [activeRequest] = await transaction.select({ id: transferRequests.id })
              .from(transferRequests)
              .where(and(
                eq(transferRequests.userId, locked.userId),
                inArray(transferRequests.status, ["pending", "출고대기중", "held"]),
              ))
              .limit(1);
            if (activeRequest) {
              throw Object.assign(new Error("대기 중인 출고 신청이 있으면 입고 내역을 삭제할 수 없습니다"), { status: 400 });
            }
          }
          const [linkedRequest] = await transaction.select({ id: transferRequests.id })
            .from(transferRequests)
            .where(eq(transferRequests.sourceLotId, locked.id))
            .limit(1);
          if (linkedRequest) {
            throw Object.assign(new Error("출고 신청과 연결된 입고 건은 신청을 먼저 삭제한 뒤 삭제해주세요"), { status: 400 });
          }
          await transaction.delete(stockTransactions).where(eq(stockTransactions.id, locked.id));
        });
        broadcastTransactionUpdate(tx.userId);
      }
      return res.json({ message: "삭제 완료" });
    } catch (error) {
      if (error instanceof Error && "status" in error && error.status === 400) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "삭제 실패" });
    }
  });

  app.patch("/api/admin/transactions/:id/hidden", requireAdmin, async (req, res) => {
    try {
      const existing = await storage.getTransaction(req.params.id);
      if (!existing) return res.status(404).json({ message: "내역을 찾을 수 없습니다" });
      const transaction = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${existing.userId}))`);
        const [locked] = await tx.select().from(stockTransactions)
          .where(eq(stockTransactions.id, existing.id))
          .for("update");
        if (!locked) {
          throw Object.assign(new Error("내역을 찾을 수 없습니다"), { status: 404 });
        }

        let linkedTransferRequest = Boolean(locked.transferRequestId);
        if (!linkedTransferRequest) {
          const legacyMatch = locked.memo?.match(/^(?:카테고리)?출고신청#(.+)$/);
          if (legacyMatch) {
            const [request] = await tx.select({ id: transferRequests.id })
              .from(transferRequests)
              .where(and(
                eq(transferRequests.id, legacyMatch[1]),
                eq(transferRequests.userId, locked.userId),
              ))
              .limit(1);
            linkedTransferRequest = Boolean(request);
          }
        }
        if (linkedTransferRequest && !locked.hidden) {
          throw Object.assign(new Error("출고 신청으로 생성된 거래는 숨길 수 없습니다"), { status: 400 });
        }

        const [updated] = await tx.update(stockTransactions)
          .set({ hidden: linkedTransferRequest ? false : !locked.hidden })
          .where(eq(stockTransactions.id, locked.id))
          .returning();
        return updated;
      });
      broadcastTransactionUpdate(transaction.userId);
      return res.json(transaction);
    } catch (error) {
      if (error instanceof Error && "status" in error && (error.status === 400 || error.status === 404)) {
        return res.status(error.status).json({ message: error.message });
      }
      return res.status(500).json({ message: "처리 실패" });
    }
  });

  app.post("/api/transfer-requests", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "로그인이 필요합니다" });
    }
    const sessionUserId = req.session.userId;
    try {
      const data = insertTransferRequestSchema.parse(req.body);
      const user = await storage.getUser(sessionUserId);
      if (!user) {
        return res.status(404).json({ message: "사용자를 찾을 수 없습니다" });
      }
      const requestedStock = (data.stockName || "").trim();
      if (!requestedStock) {
        return res.status(400).json({ message: "출고할 종목을 선택해주세요" });
      }
      const marketPrice = await getServerStockPrice(requestedStock);
      const transferRequest = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${sessionUserId}))`);

        const transactions = await tx.select().from(stockTransactions)
          .where(eq(stockTransactions.userId, sessionUserId));
        const holdingLots = calculateHoldingLots(transactions);
        const requestedSourceLotId = (data.sourceLotId || "").trim();
        let requestedCategory = (data.category || "").trim();
        const pendingRequests = await tx.select().from(transferRequests).where(and(
          eq(transferRequests.userId, sessionUserId),
          inArray(transferRequests.status, ["pending", "출고대기중", "held"]),
        ));
        let avgPurchasePrice = 0;

        if (requestedSourceLotId) {
          const sourceLot = holdingLots.find((lot) => lot.id === requestedSourceLotId);
          if (!sourceLot || sourceLot.name !== requestedStock) {
            throw Object.assign(new Error("선택한 입고 건을 보유 내역에서 찾을 수 없습니다"), { status: 400 });
          }
          if (requestedCategory && requestedCategory !== sourceLot.category) {
            throw Object.assign(new Error("선택한 입고 건의 카테고리가 일치하지 않습니다"), { status: 400 });
          }
          requestedCategory = sourceLot.category;
          const availableLot = calculateTransferableHoldingLots(holdingLots, pendingRequests)
            .find((lot) => lot.id === requestedSourceLotId);
          const available = availableLot?.qty || 0;
          if (data.quantity > available) {
            throw Object.assign(new Error(
              `${requestedStock} ${requestedCategory} ${sourceLot.pricePerShare.toLocaleString()}원 입고 건의 잔여 신청 가능 수량(${available}주)을 초과할 수 없습니다`,
            ), { status: 400 });
          }
          avgPurchasePrice = sourceLot.pricePerShare;
        } else {
          const holdingKey = (stockName: string, category: string) => `${stockName}\u0000${category}`;
          const holdingsMap = new Map<string, { stockName: string; category: string; qty: number }>();
          for (const lot of holdingLots) {
            const key = holdingKey(lot.name, lot.category);
            const holding = holdingsMap.get(key) || { stockName: lot.name, category: lot.category, qty: 0 };
            holding.qty += lot.qty;
            holdingsMap.set(key, holding);
          }
          const matchingHoldings = Array.from(holdingsMap.values()).filter((holding) => holding.stockName === requestedStock);
          if (!requestedCategory) {
            if (matchingHoldings.length === 1) {
              requestedCategory = matchingHoldings[0].category;
            } else {
              throw Object.assign(new Error(`${requestedStock}의 출고 카테고리를 선택해주세요`), { status: 400 });
            }
          }
          const selectedHolding = holdingsMap.get(holdingKey(requestedStock, requestedCategory));
          if (!selectedHolding?.qty) {
            throw Object.assign(new Error(`${requestedStock} ${requestedCategory} 보유 수량이 없습니다`), { status: 400 });
          }
          let categorizedPendingQty = 0;
          let legacyPendingQty = 0;
          for (const pendingRequest of pendingRequests) {
            if (pendingRequest.stockName !== requestedStock) continue;
            if (pendingRequest.category === requestedCategory) categorizedPendingQty += pendingRequest.quantity || 0;
            if (!pendingRequest.category) legacyPendingQty += pendingRequest.quantity || 0;
          }
          const alreadyPending = categorizedPendingQty + legacyPendingQty;
          const available = Math.max(0, selectedHolding.qty - alreadyPending);
          if (data.quantity > available) {
            throw Object.assign(new Error(
              `${requestedStock} ${requestedCategory} 잔여 신청 가능 수량(${available}주)을 초과할 수 없습니다. (보유 ${selectedHolding.qty}주 - 신청중 ${alreadyPending}주)`,
            ), { status: 400 });
          }
          const selectedLots = holdingLots.filter(
            (lot) => lot.name === requestedStock && lot.category === requestedCategory,
          );
          let pendingToSkip = alreadyPending;
          let quantityToPrice = data.quantity;
          let purchaseCost = 0;
          for (const lot of selectedLots) {
            const skipped = Math.min(lot.qty, pendingToSkip);
            pendingToSkip -= skipped;
            const lotAvailable = lot.qty - skipped;
            const pricedQuantity = Math.min(lotAvailable, quantityToPrice);
            purchaseCost += pricedQuantity * lot.pricePerShare;
            quantityToPrice -= pricedQuantity;
            if (quantityToPrice <= 0) break;
          }
          avgPurchasePrice = Math.round(purchaseCost / data.quantity);
        }
        const currentPrice = marketPrice || avgPurchasePrice;
        const totalAmount = currentPrice * data.quantity;
        const profitRate = avgPurchasePrice > 0
          ? (((currentPrice - avgPurchasePrice) / avgPurchasePrice) * 100).toFixed(2)
          : "0";

        const [created] = await tx.insert(transferRequests).values({
          ...data,
          userId: sessionUserId,
          brokerName: user.bank || "",
          stockName: requestedStock,
          category: requestedCategory,
          sourceLotId: requestedSourceLotId || null,
          purchasePrice: avgPurchasePrice,
          currentPrice,
          totalAmount,
          profitRate,
        }).returning();
        return created;
      });
      broadcastTransactionUpdate(sessionUserId);
      broadcastTransferUpdate(sessionUserId, { action: "new_request", request: transferRequest, userName: user.fullName });
      return res.json(transferRequest);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      if (error instanceof Error && "status" in error && error.status === 400) {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "출고 신청에 실패했습니다" });
    }
  });

  app.delete("/api/transfer-requests/:id", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "로그인이 필요합니다" });
    }
    const sessionUserId = req.session.userId;
    try {
      const { id } = req.params;
      await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${sessionUserId}))`);
        const [target] = await tx.select().from(transferRequests).where(and(
          eq(transferRequests.id, id),
          eq(transferRequests.userId, sessionUserId),
        )).for("update");
        if (!target) {
          throw Object.assign(new Error("신청 내역을 찾을 수 없습니다"), { status: 404 });
        }
        if (target.status !== "pending") {
          throw Object.assign(new Error("대기 중인 신청만 삭제할 수 있습니다"), { status: 400 });
        }
        await tx.delete(transferRequests).where(and(
          eq(transferRequests.id, id),
          eq(transferRequests.userId, sessionUserId),
        ));
      });
      return res.json({ success: true });
    } catch (error) {
      if (error instanceof Error && "status" in error && (error.status === 400 || error.status === 404)) {
        return res.status(error.status).json({ message: error.message });
      }
      return res.status(500).json({ message: "삭제에 실패했습니다" });
    }
  });

  app.get("/api/transfer-requests/my", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "로그인이 필요합니다" });
    }
    const requests = await storage.getTransferRequestsByUserId(req.session.userId);
    return res.json(requests);
  });

  app.get("/api/available-stocks", async (_req, res) => {
    const stocks = await storage.getActiveStockCatalog();
    // faceValue is retained for older clients; purchasePrice is the
    // administrator-controlled equivalent for catalog entries.
    return res.json(stocks.map((stock) => ({
      name: stock.stockName,
      faceValue: stock.purchasePrice > 0 ? stock.purchasePrice : null,
      stockName: stock.stockName,
      stockCode: stock.stockCode || null,
      purchasePrice: stock.purchasePrice,
      ipoPrice: stock.ipoPrice,
      category: stock.category,
      isActive: stock.isActive,
      createdAt: stock.createdAt,
      updatedAt: stock.updatedAt,
    })));
  });

  const stockCatalogRequestSchema = insertStockCatalogSchema.extend({
    purchasePrice: z.coerce.number().int().nonnegative("매입가는 0 이상이어야 합니다"),
    ipoPrice: z.coerce.number().int().nonnegative("공모가는 0 이상이어야 합니다"),
    stockCode: z.string().trim().max(50).regex(/^[A-Za-z0-9_-]*$/, "종목코드는 영문, 숫자, -, _만 사용할 수 있습니다").default(""),
    category: z.string().trim().min(1).max(50),
    isActive: z.boolean().optional().default(true),
  });
  const stockCatalogUpdateSchema = stockCatalogRequestSchema.partial();
  const stockInRequestSchema = z.object({
    stockName: z.string().trim().min(1, "종목명을 입력해주세요"),
    quantity: z.coerce.number().int().positive("수량을 올바르게 입력해주세요"),
  });
  const isUniqueViolation = (error: unknown) =>
    typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505";

  app.get(["/api/admin/stock-catalog", "/api/admin/stock-codes"], requireAdmin, async (_req, res) => {
    return res.json(await storage.getAllStockCatalog());
  });

  app.post(["/api/admin/stock-catalog", "/api/admin/stock-codes"], requireAdmin, async (req, res) => {
    try {
      const data = stockCatalogRequestSchema.parse(req.body);
      const existing = await storage.getAllStockCatalog();
      if (existing.some((stock) => stock.stockName.toLocaleLowerCase() === data.stockName.toLocaleLowerCase())) {
        return res.status(409).json({ message: "이미 등록된 종목명입니다" });
      }
      if (data.stockCode && existing.some((stock) => stock.stockCode.toLocaleLowerCase() === data.stockCode.toLocaleLowerCase())) {
        return res.status(409).json({ message: "이미 등록된 종목코드입니다" });
      }
      return res.status(201).json(await storage.createStockCatalog(data));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message || "입력값을 확인해주세요" });
      }
      if (isUniqueViolation(error)) {
        return res.status(409).json({ message: "이미 등록된 종목명 또는 종목코드입니다" });
      }
      return res.status(500).json({ message: "종목코드 추가에 실패했습니다" });
    }
  });

  app.patch(["/api/admin/stock-catalog/:id", "/api/admin/stock-codes/:id"], requireAdmin, async (req, res) => {
    try {
      const data = stockCatalogUpdateSchema.parse(req.body);
      const existing = await storage.getAllStockCatalog();
      if (data.stockName && existing.some((stock) => stock.id !== req.params.id && stock.stockName.toLocaleLowerCase() === data.stockName!.toLocaleLowerCase())) {
        return res.status(409).json({ message: "이미 등록된 종목명입니다" });
      }
      if (data.stockCode && existing.some((stock) => stock.id !== req.params.id && stock.stockCode.toLocaleLowerCase() === data.stockCode!.toLocaleLowerCase())) {
        return res.status(409).json({ message: "이미 등록된 종목코드입니다" });
      }
      const updated = await storage.updateStockCatalog(String(req.params.id), data);
      if (!updated) return res.status(404).json({ message: "종목코드를 찾을 수 없습니다" });
      return res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message || "입력값을 확인해주세요" });
      }
      if (isUniqueViolation(error)) {
        return res.status(409).json({ message: "이미 등록된 종목명 또는 종목코드입니다" });
      }
      return res.status(500).json({ message: "종목코드 수정에 실패했습니다" });
    }
  });

  app.delete(["/api/admin/stock-catalog/:id", "/api/admin/stock-codes/:id"], requireAdmin, async (req, res) => {
    try {
      const existing = await storage.getAllStockCatalog();
      if (!existing.some((stock) => stock.id === String(req.params.id))) {
        return res.status(404).json({ message: "종목코드를 찾을 수 없습니다" });
      }
      await storage.deleteStockCatalog(String(req.params.id));
      return res.json({ message: "삭제 완료" });
    } catch {
      return res.status(500).json({ message: "종목코드 삭제에 실패했습니다" });
    }
  });

  app.post("/api/transfer-requests/stock-in", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "로그인이 필요합니다" });
    try {
      const { stockName, quantity } = stockInRequestSchema.parse(req.body);
      const activeCatalog = await storage.getActiveStockCatalog();
      const catalogStock = activeCatalog.find((stock) => stock.stockName === stockName);
      if (!catalogStock) {
        return res.status(400).json({ message: "입고 가능한 종목이 아닙니다" });
      }
      const user = await storage.getUser(req.session.userId);
      if (!user) return res.status(404).json({ message: "사용자를 찾을 수 없습니다" });
      const transferRequest = await storage.createTransferRequest({
        userId: req.session.userId,
        stockName: catalogStock.stockName,
        quantity,
        accountName: user.accountHolder || user.fullName || "",
        accountNumber: user.accountNumber || "",
        brokerName: user.bank || "",
        purchasePrice: 0,
        currentPrice: 0,
        totalAmount: 0,
        profitRate: "0",
        requestType: "입고신청",
      });
      return res.status(201).json(transferRequest);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message || "입력값을 확인해주세요" });
      }
      return res.status(500).json({ message: "입고 신청에 실패했습니다" });
    }
  });

  app.post("/api/transactions/sell", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "로그인이 필요합니다" });
    }
    const sessionUserId = req.session.userId;
    try {
      const { stockName, quantity, pricePerShare } = req.body;
      if (!stockName || typeof stockName !== "string" || !stockName.trim()) {
        return res.status(400).json({ message: "종목명이 필요합니다" });
      }
      const qty = Number(quantity);
      if (!Number.isInteger(qty) || qty <= 0) {
        return res.status(400).json({ message: "수량을 올바르게 입력해주세요" });
      }
      const livePrice = await getServerStockPrice(stockName.trim());
      const price = livePrice ?? Number(pricePerShare);
      if (!price || price <= 0) {
        return res.status(400).json({ message: "매도가격이 필요합니다" });
      }

      // 확정매도 허용 여부 서버 검증
      const sellAmount = qty * Math.round(price);
      const soldTransaction = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${sessionUserId}))`);
        const [sellingUser] = await tx.select().from(users).where(eq(users.id, sessionUserId)).for("update");
        if (!sellingUser) {
          throw Object.assign(new Error("사용자 정보를 찾을 수 없습니다"), { status: 401 });
        }
        if (sellingUser.canSell === false) {
          throw Object.assign(new Error("확정매도 권한이 없습니다. 관리자에게 문의하세요."), { status: 403 });
        }

        const transactions = await tx.select().from(stockTransactions)
          .where(eq(stockTransactions.userId, sessionUserId));
        const lots = calculateHoldingLots(transactions);
        const pendingRequests = await tx.select().from(transferRequests).where(and(
          eq(transferRequests.userId, sessionUserId),
          eq(transferRequests.stockName, stockName.trim()),
          inArray(transferRequests.status, ["pending", "출고대기중", "held"]),
        ));
        const stockLots = calculateTransferableHoldingLots(lots, pendingRequests)
          .filter((lot) => lot.name === stockName.trim());
        const available = stockLots.reduce((sum, lot) => sum + lot.qty, 0);
        if (available <= 0) {
          throw Object.assign(new Error("출고 신청 수량을 제외한 매도 가능 보유 수량이 없습니다"), { status: 400 });
        }
        if (qty > available) {
          throw Object.assign(new Error(`출고 신청 수량을 제외한 매도 가능 수량(${available}주)을 초과할 수 없습니다`), { status: 400 });
        }

        let remaining = qty;
        const sellValues = [];
        for (const lot of stockLots) {
          if (remaining <= 0) break;
          const allocated = Math.min(lot.qty, remaining);
          sellValues.push({
            userId: sessionUserId,
            type: "out",
            category: lot.category,
            stockName: stockName.trim(),
            quantity: allocated,
            pricePerShare: Math.round(price),
            memo: `입고건차감#${lot.id}#확정매도`,
          });
          remaining -= allocated;
        }
        const created = await tx.insert(stockTransactions).values(sellValues).returning();
        await tx.update(users)
          .set({ depositBalance: sql`${users.depositBalance} + ${sellAmount}` })
          .where(eq(users.id, sessionUserId));
        return created[0];
      });

      return res.json({ ...soldTransaction, depositAdded: sellAmount });
    } catch (error) {
      if (error instanceof Error && "status" in error && [400, 401, 403].includes(error.status as number)) {
        return res.status(error.status as 400 | 401 | 403).json({ message: error.message });
      }
      return res.status(500).json({ message: "매도 처리에 실패했습니다" });
    }
  });

  // 출금신청 목록 (회원)
  app.get("/api/withdraw-requests/my", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "로그인이 필요합니다" });
    const list = await storage.getWithdrawRequestsByUserId(req.session.userId);
    res.json(list);
  });

  // 출금신청 제출 (회원)
  app.post("/api/withdraw-requests", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "로그인이 필요합니다" });
    try {
      const { accountName, bank, accountNumber, amount } = req.body;
      const amt = Number(amount);
      if (!accountName || !bank || !accountNumber || !amt || amt <= 0) {
        return res.status(400).json({ message: "모든 항목을 올바르게 입력해주세요" });
      }
      const user = await storage.getUser(req.session.userId);
      if (!user) return res.status(401).json({ message: "사용자 정보를 찾을 수 없습니다" });
      if (amt > user.depositBalance) {
        return res.status(400).json({ message: `출금 가능한 예수금(${user.depositBalance.toLocaleString()}원)을 초과합니다` });
      }
      const req2 = await storage.createWithdrawRequest({
        userId: req.session.userId,
        accountName,
        bank,
        accountNumber,
        amount: amt,
      });
      res.json(req2);
    } catch (e) {
      res.status(500).json({ message: "출금신청에 실패했습니다" });
    }
  });

  // 출금신청 취소 (회원, pending 상태만)
  app.delete("/api/withdraw-requests/:id", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "로그인이 필요합니다" });
    try {
      const list = await storage.getWithdrawRequestsByUserId(req.session.userId);
      const wr = list.find(r => r.id === req.params.id);
      if (!wr) return res.status(404).json({ message: "신청을 찾을 수 없습니다" });
      if (wr.status !== "pending") return res.status(400).json({ message: "취소할 수 없는 상태입니다" });
      await storage.deleteWithdrawRequest(req.params.id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ message: "취소에 실패했습니다" });
    }
  });

  // 어드민: 출금신청 전체 조회
  app.get("/api/admin/withdraw-requests", requireAdmin, async (_req, res) => {
    const list = await storage.getAllWithdrawRequests();
    res.json(list);
  });

  // 어드민: 출금신청 승인/거부
  app.patch("/api/admin/withdraw-requests/:id", requireAdmin, async (req, res) => {
    try {
      const { status, adminMemo } = req.body;
      if (!["approved", "rejected"].includes(status)) {
        return res.status(400).json({ message: "status는 approved 또는 rejected 여야 합니다" });
      }
      const wr = await storage.updateWithdrawRequestStatus(req.params.id, status, adminMemo);
      if (!wr) return res.status(404).json({ message: "신청을 찾을 수 없습니다" });
      // 승인 시 예수금 차감
      if (status === "approved") {
        await storage.addDepositBalance(wr.userId, -wr.amount);
      }
      res.json(wr);
    } catch (e) {
      res.status(500).json({ message: "처리에 실패했습니다" });
    }
  });

  // 어드민: 회원별 예수금 직접 설정
  app.patch("/api/admin/users/:id/deposit-balance", requireAdmin, async (req, res) => {
    try {
      const { amount } = req.body;
      const amt = Number(amount);
      if (isNaN(amt) || amt < 0) return res.status(400).json({ message: "금액이 올바르지 않습니다" });
      const user = await storage.setDepositBalance(req.params.id, amt);
      if (!user) return res.status(404).json({ message: "회원을 찾을 수 없습니다" });
      res.json(user);
    } catch (e) {
      res.status(500).json({ message: "처리에 실패했습니다" });
    }
  });

  // 어드민: 회원별 확정매도 허용 설정
  app.post("/api/admin/users/reset-can-sell-all", requireAdmin, async (req, res) => {
    try {
      const count = await storage.resetAllCanSell();
      res.json({ success: true, updated: count });
    } catch (e) {
      res.status(500).json({ message: "초기화에 실패했습니다" });
    }
  });

  app.patch("/api/admin/users/:id/can-sell", requireAdmin, async (req, res) => {
    try {
      const { canSell } = req.body;
      if (typeof canSell !== "boolean") return res.status(400).json({ message: "canSell은 boolean 이어야 합니다" });
      const user = await storage.updateUserCanSell(req.params.id, canSell);
      if (!user) return res.status(404).json({ message: "회원을 찾을 수 없습니다" });
      res.json(user);
    } catch (e) {
      res.status(500).json({ message: "처리에 실패했습니다" });
    }
  });

  app.delete("/api/admin/transfer-requests/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const currentRequest = await storage.getTransferRequest(id);
      if (!currentRequest) {
        return res.status(404).json({ message: "신청을 찾을 수 없습니다" });
      }
      await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${currentRequest.userId}))`);
        const [request] = await tx.select().from(transferRequests)
          .where(eq(transferRequests.id, id))
          .for("update");
        if (!request) {
          throw Object.assign(new Error("신청을 찾을 수 없습니다"), { status: 404 });
        }
        if (request.status === "approved") {
          const legacyTransferMemo = request.category ? `카테고리출고신청#${request.id}` : `출고신청#${request.id}`;
          await tx.delete(stockTransactions).where(eq(stockTransactions.transferRequestId, request.id));
          await tx.delete(stockTransactions).where(and(
            eq(stockTransactions.userId, request.userId),
            eq(stockTransactions.memo, legacyTransferMemo),
          ));
        }
        await tx.delete(transferRequests).where(eq(transferRequests.id, id));
      });
      return res.json({ success: true });
    } catch (error) {
      if (error instanceof Error && "status" in error && error.status === 404) {
        return res.status(404).json({ message: error.message });
      }
      return res.status(500).json({ message: "삭제에 실패했습니다" });
    }
  });

  app.get("/api/admin/transfer-requests", requireAdmin, async (_req, res) => {
    const requests = await storage.getAllTransferRequests();
    return res.json(requests);
  });

  app.patch("/api/admin/transfer-requests/:id/purchase-price", requireAdmin, async (req, res) => {
    try {
      const { purchasePrice } = req.body;
      if (!purchasePrice || isNaN(Number(purchasePrice))) return res.status(400).json({ message: "매입단가가 필요합니다" });
      const updated = await storage.updateTransferRequestPurchasePrice(req.params.id, Number(purchasePrice));
      if (!updated) return res.status(404).json({ message: "신청을 찾을 수 없습니다" });
      return res.json(updated);
    } catch (error) {
      return res.status(500).json({ message: "매입단가 변경에 실패했습니다" });
    }
  });

  app.patch("/api/admin/transfer-requests/:id/date", requireAdmin, async (req, res) => {
    try {
      const { createdAt } = req.body;
      if (!createdAt) return res.status(400).json({ message: "날짜가 필요합니다" });
      const nextCreatedAt = new Date(createdAt);
      if (Number.isNaN(nextCreatedAt.getTime())) {
        return res.status(400).json({ message: "날짜 형식이 올바르지 않습니다" });
      }
      const existingRequest = await storage.getTransferRequest(req.params.id);
      if (!existingRequest) return res.status(404).json({ message: "신청을 찾을 수 없습니다" });
      const updated = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${existingRequest.userId}))`);
        const [current] = await tx.select().from(transferRequests)
          .where(eq(transferRequests.id, req.params.id))
          .for("update");
        if (!current) {
          throw Object.assign(new Error("신청을 찾을 수 없습니다"), { status: 404 });
        }
        if (["pending", "출고대기중", "held"].includes(current.status)) {
          const transactions = await tx.select().from(stockTransactions)
            .where(eq(stockTransactions.userId, current.userId));
          const activeRequests = await tx.select().from(transferRequests).where(and(
            eq(transferRequests.userId, current.userId),
            inArray(transferRequests.status, ["pending", "출고대기중", "held"]),
          ));
          const reorderedRequests = activeRequests.map((request) =>
            request.id === current.id ? { ...request, createdAt: nextCreatedAt } : request
          );
          if (!areTransferReservationsFulfillable(calculateHoldingLots(transactions), reorderedRequests)) {
            throw Object.assign(new Error("날짜를 변경하면 출고 예약 수량이 보유 수량을 초과합니다"), { status: 400 });
          }
        }
        const [next] = await tx.update(transferRequests)
          .set({ createdAt: nextCreatedAt })
          .where(eq(transferRequests.id, current.id))
          .returning();
        return next;
      });
      return res.json(updated);
    } catch (error) {
      if (error instanceof Error && "status" in error && (error.status === 400 || error.status === 404)) {
        return res.status(error.status).json({ message: error.message });
      }
      return res.status(500).json({ message: "날짜 변경에 실패했습니다" });
    }
  });

  app.patch("/api/admin/transfer-requests/:id", requireAdmin, async (req, res) => {
    try {
      const { status, adminMemo } = req.body;
      if (!["pending", "approved", "rejected", "held", "출고대기중"].includes(status)) {
        return res.status(400).json({ message: "유효하지 않은 상태입니다" });
      }
      const existingRequest = await storage.getTransferRequest(req.params.id);
      if (!existingRequest) {
        return res.status(404).json({ message: "신청을 찾을 수 없습니다" });
      }
      const updated = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${existingRequest.userId}))`);
        const [current] = await tx.select().from(transferRequests)
          .where(eq(transferRequests.id, req.params.id))
          .for("update");
        if (!current) {
          throw Object.assign(new Error("신청을 찾을 수 없습니다"), { status: 404 });
        }
        const nextIsActive = ["pending", "출고대기중", "held"].includes(status);
        const currentIsActive = ["pending", "출고대기중", "held"].includes(current.status);
        if (nextIsActive && !currentIsActive) {
          const currentLegacyMemo = current.sourceLotId
            ? `입고건출고신청#${current.id}#${current.sourceLotId}`
            : current.category
              ? `카테고리출고신청#${current.id}`
              : `출고신청#${current.id}`;
          if (current.status === "approved") {
            await tx.delete(stockTransactions).where(eq(stockTransactions.transferRequestId, current.id));
            await tx.delete(stockTransactions).where(and(
              eq(stockTransactions.userId, current.userId),
              eq(stockTransactions.memo, currentLegacyMemo),
            ));
          }
          const transactions = await tx.select().from(stockTransactions)
            .where(eq(stockTransactions.userId, current.userId));
          const activeRequests = await tx.select().from(transferRequests).where(and(
            eq(transferRequests.userId, current.userId),
            inArray(transferRequests.status, ["pending", "출고대기중", "held"]),
          ));
          const requestsWithReactivated = [
            ...activeRequests.filter((request) => request.id !== current.id),
            { ...current, status },
          ];
          if (!areTransferReservationsFulfillable(calculateHoldingLots(transactions), requestsWithReactivated)) {
            throw Object.assign(new Error("이 신청을 대기 상태로 변경하면 출고 예약 수량이 보유 수량을 초과합니다"), { status: 400 });
          }
        }
        const updateData: { status: string; adminMemo?: string; approvedAt?: Date } = { status };
        if (adminMemo !== undefined) updateData.adminMemo = adminMemo;
        if (["approved", "rejected", "held", "출고대기중"].includes(status)) {
          updateData.approvedAt = new Date();
        }
        const [nextRequest] = await tx.update(transferRequests)
          .set(updateData)
          .where(eq(transferRequests.id, current.id))
          .returning();

        const legacyTransferMemo = nextRequest.sourceLotId
          ? `입고건출고신청#${nextRequest.id}#${nextRequest.sourceLotId}`
          : nextRequest.category
            ? `카테고리출고신청#${nextRequest.id}`
            : `출고신청#${nextRequest.id}`;
        if (status === "approved") {
          const [linkedOut] = await tx.select({ id: stockTransactions.id })
            .from(stockTransactions)
            .where(eq(stockTransactions.transferRequestId, nextRequest.id))
            .limit(1);
          let existingOut = linkedOut;
          if (!existingOut) {
            [existingOut] = await tx.select({ id: stockTransactions.id })
              .from(stockTransactions)
              .where(and(
                eq(stockTransactions.userId, nextRequest.userId),
                eq(stockTransactions.memo, legacyTransferMemo),
              ))
              .limit(1);
          }
          if (!existingOut) {
            const currentTransactions = await tx.select().from(stockTransactions)
              .where(eq(stockTransactions.userId, nextRequest.userId));
            const currentLots = calculateHoldingLots(currentTransactions);
            const otherPendingRequests = (await tx.select().from(transferRequests).where(and(
              eq(transferRequests.userId, nextRequest.userId),
              inArray(transferRequests.status, ["pending", "출고대기중", "held"]),
            ))).filter((request) => request.id !== nextRequest.id);
            const availableLots = calculateTransferableHoldingLots(currentLots, otherPendingRequests)
              .filter((lot) =>
                lot.name === nextRequest.stockName &&
                (!nextRequest.sourceLotId || lot.id === nextRequest.sourceLotId) &&
                (!nextRequest.category || lot.category === nextRequest.category)
              );
            const availableQuantity = availableLots.reduce((sum, lot) => sum + lot.qty, 0);
            if (nextRequest.quantity > availableQuantity) {
              throw Object.assign(new Error(
                `${nextRequest.stockName}${nextRequest.category ? ` ${nextRequest.category}` : ""} 보유 수량(${availableQuantity}주)이 부족합니다`,
              ), { status: 400 });
            }
            let remaining = nextRequest.quantity;
            const outboundValues = [];
            for (const lot of availableLots) {
              if (remaining <= 0) break;
              const allocated = Math.min(lot.qty, remaining);
              outboundValues.push({
                userId: nextRequest.userId,
                type: "out",
                category: lot.category,
                stockName: nextRequest.stockName,
                quantity: allocated,
                pricePerShare: nextRequest.currentPrice || nextRequest.purchasePrice,
                memo: `입고건출고신청#${nextRequest.id}#${lot.id}`,
                transferRequestId: nextRequest.id,
              });
              remaining -= allocated;
            }
            await tx.insert(stockTransactions).values(outboundValues);
          }
        } else if (current.status === "approved") {
          await tx.delete(stockTransactions).where(eq(stockTransactions.transferRequestId, nextRequest.id));
          await tx.delete(stockTransactions).where(and(
            eq(stockTransactions.userId, nextRequest.userId),
            eq(stockTransactions.memo, legacyTransferMemo),
          ));
        }

        return nextRequest;
      });
      const statusLabels: Record<string, string> = { approved: "승인", rejected: "반려", held: "보류", pending: "대기", "출고대기중": "출고대기중" };
      broadcastTransferUpdate(updated.userId, { action: "status_change", request: updated, statusLabel: statusLabels[status] || status });
      return res.json(updated);
    } catch (error) {
      if (error instanceof Error && "status" in error && (error.status === 400 || error.status === 404)) {
        return res.status(error.status).json({ message: error.message });
      }
      return res.status(500).json({ message: "상태 변경에 실패했습니다" });
    }
  });

  // IPO Stock Management routes
  app.get("/api/ipo-stocks", async (_req, res) => {
    const stocks = await storage.getActiveIpoStocks();
    return res.json(stocks);
  });

  app.get("/api/admin/ipo-stocks", requireAdmin, async (_req, res) => {
    const stocks = await storage.getAllIpoStocks();
    return res.json(stocks);
  });

  app.post("/api/admin/ipo-stocks", requireAdmin, async (req, res) => {
    try {
      const { stockName, startDate, endDate, brokers, priceMin, priceMax, competitionRate, status, subscriptionStatus } = req.body;
      if (!stockName || !startDate || !endDate || !brokers || priceMin == null || priceMax == null) {
        return res.status(400).json({ message: "필수 항목을 모두 입력해주세요" });
      }
      const stock = await storage.createIpoStock({
        stockName, startDate, endDate, brokers,
        priceMin: parseInt(priceMin),
        priceMax: parseInt(priceMax),
        competitionRate: competitionRate || null,
        status: status || "active",
        subscriptionStatus: subscriptionStatus || "청약예정",
      });
      return res.json(stock);
    } catch (error) {
      return res.status(500).json({ message: "종목 추가에 실패했습니다" });
    }
  });

  app.patch("/api/admin/ipo-stocks/:id", requireAdmin, async (req, res) => {
    try {
      const data = { ...req.body };
      if (data.priceMin != null) data.priceMin = parseInt(data.priceMin);
      if (data.priceMax != null) data.priceMax = parseInt(data.priceMax);
      const updated = await storage.updateIpoStock(req.params.id, data);
      if (!updated) {
        return res.status(404).json({ message: "종목을 찾을 수 없습니다" });
      }
      return res.json(updated);
    } catch (error) {
      return res.status(500).json({ message: "종목 수정에 실패했습니다" });
    }
  });

  app.delete("/api/admin/ipo-stocks/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteIpoStock(req.params.id);
      return res.json({ message: "삭제 완료" });
    } catch (error) {
      return res.status(500).json({ message: "종목 삭제에 실패했습니다" });
    }
  });

  // Admin-controlled TOP 5 IPO stocks
  app.get("/api/admin/popular-ipo-stocks", requireAdmin, async (_req, res) => {
    try {
      let stocks = await storage.getAllPopularIpoStocks();

      // Seed the table only once, when it is completely empty and Naver has
      // already supplied popular stocks.  Any subsequent row (including an
      // inactive one) means the administrator is the source of truth.
      if (stocks.length === 0 && naverIpoCache.popularStocks.length > 0) {
        const externalStocks = naverIpoCache.popularStocks
          .slice(0, 5)
          .map((stock: any, index) => {
            const displayPrice = Number(stock.currentPrice ?? stock.displayPrice ?? stock.price ?? 0);
            const normalizedDisplayPrice = Number.isFinite(displayPrice) && displayPrice >= 0
              ? Math.trunc(displayPrice)
              : 0;
            const rawChangeRate = stock.changeRate ?? stock.currentChangeRate ?? null;
            const rate = rawChangeRate == null || rawChangeRate === ""
              ? NaN
              : Number(typeof rawChangeRate === "string" ? rawChangeRate.replace(/%/g, "").trim() : rawChangeRate);
            const purchasePrice = Number.isFinite(rate) && rate !== -100
              ? Math.max(1, Math.round(normalizedDisplayPrice / (1 + rate / 100)))
              : Math.max(1, normalizedDisplayPrice);
            return {
              stockName: String(stock.stockName ?? stock.name ?? "").trim(),
              stockCode: stock.stockCode ?? stock.code ?? null,
              logoUrl: stock.logoUrl ?? null,
              displayPrice: normalizedDisplayPrice,
              purchasePrice,
              sortOrder: index + 1,
              isActive: true,
            };
          })
          .filter((stock) => stock.stockName);

        for (const stock of externalStocks) {
          await storage.createPopularIpoStock(stock);
        }
        stocks = await storage.getAllPopularIpoStocks();
      }

      return res.json(stocks);
    } catch {
      return res.status(500).json({ message: "인기 종목 조회에 실패했습니다" });
    }
  });

  app.post("/api/admin/popular-ipo-stocks", requireAdmin, async (req, res) => {
    try {
      const parsed = createPopularIpoStockRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message || "입력값이 올바르지 않습니다" });
      }

      const data = insertPopularIpoStockSchema.safeParse(parsed.data);
      if (!data.success) {
        return res.status(400).json({ message: data.error.issues[0]?.message || "입력값이 올바르지 않습니다" });
      }

      const allStocks = await storage.getAllPopularIpoStocks();
      if (data.data.isActive !== false && allStocks.filter((stock) => stock.isActive).length >= 5) {
        return res.status(400).json({ message: "활성 인기 종목은 최대 5개까지 등록할 수 있습니다" });
      }

      const stock = await storage.createPopularIpoStock({
        ...data.data,
        sortOrder: data.data.sortOrder ?? (allStocks.length + 1),
        isActive: data.data.isActive ?? true,
      });
      return res.status(201).json(stock);
    } catch {
      return res.status(500).json({ message: "인기 종목 추가에 실패했습니다" });
    }
  });

  // Keep this route before /:id so "reorder" is not interpreted as an id.
  app.patch("/api/admin/popular-ipo-stocks/reorder", requireAdmin, async (req, res) => {
    try {
      const parsed = reorderPopularIpoStocksRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message || "ids 배열이 필요합니다" });
      }
      await storage.reorderPopularIpoStocks(parsed.data.ids);
      return res.json({ message: "순서 저장 완료" });
    } catch {
      return res.status(500).json({ message: "순서 저장에 실패했습니다" });
    }
  });

  app.patch("/api/admin/popular-ipo-stocks/:id", requireAdmin, async (req, res) => {
    try {
      const parsed = updatePopularIpoStockRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message || "입력값이 올바르지 않습니다" });
      }

      const current = (await storage.getAllPopularIpoStocks()).find((stock) => stock.id === req.params.id);
      if (!current) return res.status(404).json({ message: "인기 종목을 찾을 수 없습니다" });

      if (parsed.data.isActive === true && !current.isActive) {
        const activeCount = (await storage.getActivePopularIpoStocks()).length;
        if (activeCount >= 5) {
          return res.status(400).json({ message: "활성 인기 종목은 최대 5개까지 등록할 수 있습니다" });
        }
      }

      const data = insertPopularIpoStockSchema.partial().safeParse(parsed.data);
      if (!data.success) {
        return res.status(400).json({ message: data.error.issues[0]?.message || "입력값이 올바르지 않습니다" });
      }
      const updated = await storage.updatePopularIpoStock(req.params.id, data.data);
      return res.json(updated);
    } catch {
      return res.status(500).json({ message: "인기 종목 수정에 실패했습니다" });
    }
  });

  app.delete("/api/admin/popular-ipo-stocks/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deletePopularIpoStock(req.params.id);
      return res.json({ message: "삭제 완료" });
    } catch {
      return res.status(500).json({ message: "인기 종목 삭제에 실패했습니다" });
    }
  });

  // Watchlist API routes
  app.get("/api/watchlist", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "로그인이 필요합니다" });
    try {
      const items = await storage.getWatchlist(req.session.userId);
      return res.json(items);
    } catch (error) {
      return res.status(500).json({ message: "관심종목 조회 실패" });
    }
  });

  app.post("/api/watchlist", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "로그인이 필요합니다" });
    try {
      const { stockName } = req.body;
      if (!stockName) return res.status(400).json({ message: "종목명을 입력해주세요" });
      const already = await storage.isInWatchlist(req.session.userId, stockName);
      if (already) return res.status(409).json({ message: "이미 추가된 종목입니다" });
      const item = await storage.addToWatchlist(req.session.userId, stockName);
      return res.json(item);
    } catch (error) {
      return res.status(500).json({ message: "관심종목 추가 실패" });
    }
  });

  app.delete("/api/watchlist/:stockName", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "로그인이 필요합니다" });
    try {
      await storage.removeFromWatchlist(req.session.userId, decodeURIComponent(req.params.stockName));
      return res.json({ message: "삭제 완료" });
    } catch (error) {
      return res.status(500).json({ message: "관심종목 삭제 실패" });
    }
  });

  // Chat API routes
  app.post("/api/chat/rooms", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "로그인이 필요합니다" });
    }
    const room = await storage.getOrCreateChatRoom(req.session.userId);
    return res.json(room);
  });

  app.get("/api/chat/rooms/my", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "로그인이 필요합니다" });
    }
    const rooms = await storage.getChatRoomsByUserId(req.session.userId);
    return res.json(rooms);
  });

  app.get("/api/chat/rooms", requireAdmin, async (_req, res) => {
    const rooms = await storage.getAllChatRooms();
    const allUsers = await storage.getAllUsers();
    const roomsWithUser = await Promise.all(rooms.map(async (room) => {
      const user = allUsers.find(u => u.id === room.userId);
      const unreadCount = await storage.getUnreadCountByRoom(room.id);
      return {
        ...room,
        userName: user?.fullName || "알 수 없음",
        userUsername: user?.username || "unknown",
        userManagerCode: user?.managerCode || "",
        unreadCount,
      };
    }));
    return res.json(roomsWithUser);
  });

  app.get("/api/chat/unread-count", requireAdmin, async (_req, res) => {
    const count = await storage.getTotalUnreadCountForAdmin();
    return res.json({ count });
  });

  app.post("/api/chat/rooms/:id/mark-read", requireAdmin, async (req, res) => {
    await storage.markMessagesAsReadByAdmin(req.params.id);
    return res.json({ success: true });
  });

  app.post("/api/chat/rooms/:id/mark-member-read", async (req, res) => {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ message: "로그인이 필요합니다" });
    const parsed = z.object({
      messageIds: z.array(z.string().uuid()).min(1).max(500),
    }).strict().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "읽음 처리할 메시지가 필요합니다" });
    const rooms = await storage.getChatRoomsByUserId(userId);
    if (!rooms.some((room) => room.id === req.params.id)) return res.status(403).json({ message: "접근 권한이 없습니다" });
    const messages = await storage.markMessagesAsReadByMember(req.params.id, parsed.data.messageIds);
    if (messages.length) {
      broadcastChat({ type: "messages_read", data: { roomId: req.params.id, messageIds: messages.map((m) => m.id), readerRole: "member" } }, req.params.id);
    }
    return res.json({ success: true, messages });
  });

  app.delete("/api/admin/chat/messages/:id", requireAdmin, async (req, res) => {
    const id = req.params.id;
    if (!id) return res.status(400).json({ message: "잘못된 메시지 ID입니다" });
    const message = await storage.getChatMessage(id);
    if (!message || message.senderRole !== "admin") return res.status(403).json({ message: "관리자가 보낸 메시지만 회수할 수 있습니다" });
    if (!canRecallAdminMessage(message)) return res.status(409).json({ message: "회원이 이미 읽은 메시지는 회수할 수 없습니다" });
    const deleted = await storage.recallAdminChatMessage(id);
    if (!deleted) return res.status(409).json({ message: "회원이 이미 읽은 메시지는 회수할 수 없습니다" });
    broadcastChat({ type: "message_deleted", data: { id, roomId: deleted.roomId } }, deleted.roomId);
    return res.json({ success: true });
  });

  app.get("/api/admin/chat/macros", requireAdmin, async (_req, res) => {
    return res.json(await storage.getChatMacros());
  });
  app.post("/api/admin/chat/macros", requireAdmin, async (req, res) => {
    try {
      const data = insertChatMacroSchema.parse(req.body);
      return res.status(201).json(await storage.createChatMacro(data));
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "매크로 입력값이 올바르지 않습니다", errors: error.flatten() });
      return res.status(500).json({ message: "매크로 생성 실패" });
    }
  });
  app.patch("/api/admin/chat/macros/:id", requireAdmin, async (req, res) => {
    try {
      const data = z.object({
        title: z.string().trim().min(1).max(100).optional(),
        message: z.string().trim().min(1).max(5000).optional(),
        sortOrder: z.number().int().optional(),
      }).strict().refine((value) => Object.keys(value).length > 0, { message: "수정할 값이 필요합니다" }).parse(req.body);
      const macro = await storage.updateChatMacro(req.params.id, data);
      if (!macro) return res.status(404).json({ message: "매크로를 찾을 수 없습니다" });
      return res.json(macro);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: "매크로 입력값이 올바르지 않습니다", errors: error.flatten() });
      return res.status(500).json({ message: "매크로 수정 실패" });
    }
  });
  app.delete("/api/admin/chat/macros/:id", requireAdmin, async (req, res) => {
    await storage.deleteChatMacro(req.params.id);
    return res.json({ success: true });
  });

  app.get("/api/chat/rooms/:id/messages", async (req, res) => {
    const effectiveUserId = req.session.adminUserId || req.session.userId;
    if (!effectiveUserId) {
      return res.status(401).json({ message: "로그인이 필요합니다" });
    }
    const user = await storage.getUser(effectiveUserId);
    if (!user) return res.status(404).json({ message: "사용자를 찾을 수 없습니다" });

    const rooms = user.isAdmin
      ? await storage.getAllChatRooms()
      : await storage.getChatRoomsByUserId(effectiveUserId);

    const room = rooms.find(r => r.id === req.params.id);
    if (!room) return res.status(403).json({ message: "접근 권한이 없습니다" });

    const messages = await storage.getChatMessages(req.params.id);
    return res.json(messages);
  });

  // WebSocket upgrade handler
  httpServer.on("upgrade", (request, socket, head) => {
    const requestUrl = new URL(request.url || "/", "http://localhost");
    if (requestUrl.pathname !== "/ws/chat" && requestUrl.pathname !== "/ws") {
      return;
    }
    const requestedRole = requestUrl.searchParams.get("role");

    const sessionId = getVerifiedSessionId(request.headers.cookie || "");
    if (!sessionId) {
      socket.destroy();
      return;
    }

    wssSessionStore.get(sessionId, (err: any, sessionData: any) => {
      const hasAdminSession = !!sessionData?.adminUserId;
      const hasMemberSession = !!sessionData?.userId;
      const effectiveUserId = requestedRole === "admin"
        ? sessionData?.adminUserId
        : requestedRole === "member"
          ? sessionData?.userId
          : requestedRole || (hasAdminSession && hasMemberSession)
            ? undefined
            : sessionData?.adminUserId || sessionData?.userId;
      if (err || !sessionData || !effectiveUserId) {
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        (ws as AuthenticatedWebSocket).userId = effectiveUserId;
        wss.emit("connection", ws, request, {
          ...sessionData,
          _effectiveUserId: effectiveUserId,
          _requestedRole: requestedRole,
        });
      });
    });
  });

  wss.on("connection", async (ws: AuthenticatedWebSocket, _request: any, sessionData: any) => {
    const userId = sessionData._effectiveUserId || sessionData.adminUserId || sessionData.userId;
    const user = await storage.getUser(userId);
    if (!user) {
      ws.close();
      return;
    }

    ws.userId = userId;
    ws.isAdmin = user.isAdmin;

    log(`WebSocket connected: ${user.username} (${user.isAdmin ? "admin" : "member"})`);

    ws.on("message", async (rawData) => {
      try {
        const data = JSON.parse(rawData.toString());

        if (data.type === "join") {
          const requestId = Number.isFinite(Number(data.requestId)) ? Number(data.requestId) : (ws.joinRequestId || 0) + 1;
          ws.joinRequestId = requestId;
          const room = data.roomId ? (await storage.getAllChatRooms()).find((r) => r.id === data.roomId) : undefined;
          if (!canAccessChatRoom(room, userId, !!ws.isAdmin)) {
            ws.send(JSON.stringify({ type: "error", message: "채팅방 접근 권한이 없습니다" }));
            return;
          }
          if (requestId !== ws.joinRequestId) return;
          ws.roomId = room.id;
          ws.send(JSON.stringify({ type: "joined", data: { roomId: room.id, requestId: ws.joinRequestId } }));
          return;
        }

        if (data.type === "message" && data.roomId && data.message) {
          const roomId = data.roomId;
          const room = (await storage.getAllChatRooms()).find((r) => r.id === roomId);
          if (!canSendChatMessage(room, userId, !!ws.isAdmin, ws.roomId)) {
            ws.send(JSON.stringify({ type: "error", message: "채팅방 접근 권한이 없습니다" }));
            return;
          }
          const senderRole = ws.isAdmin ? "admin" : "user";

          const msg = await storage.createChatMessage({
            roomId,
            senderId: userId,
            senderRole,
            message: data.message,
          });
          await storage.updateChatRoomLastMessage(roomId);

          const outgoing = JSON.stringify({
            type: "message",
            data: msg,
          });

          wss.clients.forEach((client) => {
            const authClient = client as AuthenticatedWebSocket;
            if (client.readyState === WebSocket.OPEN) {
              if (authClient.isAdmin || authClient.roomId === roomId) {
                client.send(outgoing);
              }
            }
          });

          if (senderRole === "user") {
            const notification = JSON.stringify({
              type: "notification",
              data: {
                messageId: msg.id,
                roomId,
                userName: user.fullName,
                userUsername: user.username,
                message: data.message,
              },
            });
            wss.clients.forEach((client) => {
              const authClient = client as AuthenticatedWebSocket;
              if (client.readyState === WebSocket.OPEN && authClient.isAdmin) {
                client.send(notification);
              }
            });
          }
        }
      } catch (e) {
        log(`WebSocket message error: ${e}`);
      }
    });

    ws.on("close", () => {
      log(`WebSocket disconnected: ${user.username}`);
    });
  });

  let logoCache: Record<string, string> = {};
  let logoCacheTime = 0;

  function buildLogoMapFromCaches(): Record<string, string> {
    const logos: Record<string, string> = { ...logoCache };
    // 랭킹 캐시에서 로고 수집
    for (const group of rankingCache) {
      for (const row of (group.rows || [])) {
        if (row.stockName && row.logoUrl && !logos[row.stockName]) logos[row.stockName] = row.logoUrl;
      }
    }
    // 네이버 IPO 캐시에서 로고 수집
    const ipoItems = [...(naverIpoCache.beingIPOList || []), ...(naverIpoCache.toBeIPOList || []), ...(naverIpoCache.readyToIpoStocks || [])];
    for (const item of ipoItems) {
      const name = (item as any).stockName || (item as any).koreanName;
      const url = (item as any).logoUrl;
      if (name && url && !logos[name]) logos[name] = url;
    }
    // DB IPO 종목 로고 수집 (richIpoList)
    for (const item of richIpoList) {
      const name = item.koreanName || item.stockName;
      const url = item.logoUrl;
      if (name && url && !logos[name]) logos[name] = url;
    }
    // 뉴스 캐시 (recentCompanyPosts) 로고 수집
    if (newsCache?.data) {
      for (const item of newsCache.data) {
        if (item.stockName && item.logoUrl && !logos[item.stockName]) {
          logos[item.stockName] = item.logoUrl;
        }
      }
    }
    return logos;
  }

  // 단일 종목 로고 검색 (모든 캐시에서)
  app.get("/api/stock-logo-search", (req, res) => {
    const name = String(req.query.name || "").trim();
    if (!name) return res.json({ logoUrl: null });
    const logos = buildLogoMapFromCaches();
    const logoUrl = logos[name] || null;
    return res.json({ logoUrl, name });
  });

  app.get("/api/stock-logos", async (req, res) => {
    const now = Date.now();
    const merged = buildLogoMapFromCaches();
    if (now - logoCacheTime < 3600000 && Object.keys(logoCache).length > 0) {
      return res.json({ logos: merged });
    }
    try {
      const response = await fetch("https://www.ustockplus.com/", {
        headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "ko-KR,ko;q=0.9" },
        signal: AbortSignal.timeout(10000),
      });
      const html = await response.text();
      const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
      if (!m) return res.json({ logos: merged });
      const data = JSON.parse(m[1]);
      const text = JSON.stringify(data);
      const matches = Array.from(text.matchAll(/"name":"([^"]+)"[^}]{0,500}?"logoUrl":"([^"]+)"/g));
      const logos: Record<string, string> = {};
      for (const [, name, url] of matches) {
        if (name && url && !logos[name]) logos[name] = url;
      }
      logoCache = logos;
      logoCacheTime = now;
      res.json({ logos: buildLogoMapFromCaches() });
    } catch (e) {
      res.json({ logos: merged });
    }
  });

  // ─── 회원 간 주식 이전 신청 ───────────────────────────────────────────────
  app.post("/api/stock-member-transfers", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "로그인이 필요합니다" });
    try {
      const { toUsername, stockName, quantity } = req.body;
      if (!toUsername || !stockName || !quantity || quantity <= 0) {
        return res.status(400).json({ message: "입력값을 확인해주세요" });
      }
      const fromUser = await storage.getUser(req.session.userId);
      if (!fromUser) return res.status(404).json({ message: "사용자를 찾을 수 없습니다" });

      const toUser = await storage.getUserByUsername(toUsername.trim());
      if (!toUser) return res.status(404).json({ message: "받는 회원 아이디를 찾을 수 없습니다" });
      if (toUser.id === req.session.userId) return res.status(400).json({ message: "자기 자신에게 이전할 수 없습니다" });

      const transactions = await storage.getTransactionsByUserId(req.session.userId);
      const holdingsMap: Record<string, number> = {};
      for (const tx of transactions) {
        const key = tx.stockName;
        if (!holdingsMap[key]) holdingsMap[key] = 0;
        if (tx.type === "in" || tx.type === "입고") holdingsMap[key] += tx.quantity;
        else if (tx.type === "out" || tx.type === "출고" || tx.type === "주식이전") holdingsMap[key] -= tx.quantity;
      }
      const available = holdingsMap[stockName] ?? 0;
      if (available <= 0) return res.status(400).json({ message: `${stockName} 보유 수량이 없습니다` });
      if (quantity > available) return res.status(400).json({ message: `${stockName} 보유 수량(${available}주)을 초과할 수 없습니다` });

      const transfer = await storage.createStockMemberTransfer({
        fromUserId: req.session.userId,
        toUserId: toUser.id,
        toUsername: toUser.username,
        stockName,
        quantity,
      });
      return res.json(transfer);
    } catch (error) {
      return res.status(500).json({ message: "이전 신청에 실패했습니다" });
    }
  });

  app.get("/api/stock-member-transfers/my", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "로그인이 필요합니다" });
    const transfers = await storage.getStockMemberTransfersByFromUserId(req.session.userId);
    return res.json(transfers);
  });

  app.get("/api/admin/stock-member-transfers", requireAdmin, async (_req, res) => {
    const transfers = await storage.getAllStockMemberTransfers();
    return res.json(transfers);
  });

  app.patch("/api/admin/stock-member-transfers/:id", requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { status, adminMemo } = req.body;
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "잘못된 상태값입니다" });
    }
    try {
      const [existingTransfer] = await db.select().from(stockMemberTransfers)
        .where(eq(stockMemberTransfers.id, id));
      if (!existingTransfer) return res.status(404).json({ message: "이전 신청을 찾을 수 없습니다" });

      const updated = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${existingTransfer.fromUserId}))`);
        const [transfer] = await tx.select().from(stockMemberTransfers)
          .where(eq(stockMemberTransfers.id, id))
          .for("update");
        if (!transfer) {
          throw Object.assign(new Error("이전 신청을 찾을 수 없습니다"), { status: 404 });
        }
        if (transfer.status !== "pending") {
          throw Object.assign(new Error("이미 처리된 신청입니다"), { status: 400 });
        }

        if (status === "approved") {
          const senderTransactions = await tx.select().from(stockTransactions)
            .where(eq(stockTransactions.userId, transfer.fromUserId));
          const holdingLots = calculateHoldingLots(senderTransactions);
          const pendingRequests = await tx.select().from(transferRequests).where(and(
            eq(transferRequests.userId, transfer.fromUserId),
            eq(transferRequests.stockName, transfer.stockName),
            inArray(transferRequests.status, ["pending", "출고대기중", "held"]),
          ));
          const stockLots = calculateTransferableHoldingLots(holdingLots, pendingRequests)
            .filter((lot) => lot.name === transfer.stockName);
          const available = stockLots.reduce((sum, lot) => sum + lot.qty, 0);
          if (transfer.quantity > available) {
            throw Object.assign(new Error(
              `보내는 회원의 ${transfer.stockName} 출고 신청 수량을 제외한 보유 수량(${available}주)이 부족합니다`,
            ), { status: 400 });
          }
          const [fromUser] = await tx.select({ username: users.username }).from(users)
            .where(eq(users.id, transfer.fromUserId));

          let remaining = transfer.quantity;
          const outgoingValues = [];
          const incomingValues = [];
          for (const lot of stockLots) {
            if (remaining <= 0) break;
            const allocated = Math.min(lot.qty, remaining);
            outgoingValues.push({
              userId: transfer.fromUserId,
              type: "출고",
              stockName: transfer.stockName,
              quantity: allocated,
              pricePerShare: lot.pricePerShare,
              category: "주식이전",
              memo: `입고건차감#${lot.id}#회원 이전 → ${transfer.toUsername}`,
            });
            incomingValues.push({
              userId: transfer.toUserId,
              type: "입고",
              stockName: transfer.stockName,
              quantity: allocated,
              pricePerShare: lot.pricePerShare,
              category: "주식이전",
              memo: `회원 이전 ← ${fromUser?.username || transfer.fromUserId}`,
            });
            remaining -= allocated;
          }
          await tx.insert(stockTransactions).values(outgoingValues);
          await tx.insert(stockTransactions).values(incomingValues);
        }

        const updateData: { status: string; processedAt: Date; adminMemo?: string } = {
          status,
          processedAt: new Date(),
        };
        if (adminMemo !== undefined) updateData.adminMemo = adminMemo;
        const [nextTransfer] = await tx.update(stockMemberTransfers)
          .set(updateData)
          .where(eq(stockMemberTransfers.id, transfer.id))
          .returning();
        return nextTransfer;
      });
      return res.json(updated);
    } catch (error) {
      if (error instanceof Error && "status" in error && (error.status === 400 || error.status === 404)) {
        return res.status(error.status).json({ message: error.message });
      }
      return res.status(500).json({ message: "이전 신청 처리에 실패했습니다" });
    }
  });

  registerDemoRoutes(app);

  app.get("/go", (_req, res) => {
    return res.status(404).send("Not found");
  });

  // DB → GitHub 백업 엔드포인트
  app.post("/api/admin/push-db-to-github", async (req, res) => {
    const { password } = req.body;
    if (password !== "qwer1234!!") {
      return res.status(401).json({ message: "비밀번호가 올바르지 않습니다" });
    }
    try {
      const { dumpDatabaseToSQL, pushSQLToGitHub } = await import("./db-export");
      const sql = await dumpDatabaseToSQL();
      await pushSQLToGitHub(sql);
      return res.json({ success: true, message: "db-seed.sql이 GitHub에 업로드되었습니다" });
    } catch (e: any) {
      console.error("DB 백업 실패:", e);
      return res.status(500).json({ message: e.message || "백업에 실패했습니다" });
    }
  });

  // SQL을 로컬 파일에 추가 (append)
  app.post("/api/admin/append-sql-to-file", async (req, res) => {
    const { password, sql } = req.body;
    if (password !== "qwer1234!!") return res.status(401).json({ message: "비밀번호 오류" });
    if (!sql || typeof sql !== "string") return res.status(400).json({ message: "sql 없음" });
    try {
      const { appendFileSync } = await import("fs");
      appendFileSync("db-seed.sql", "\n" + sql, "utf8");
      return res.json({ success: true });
    } catch (e: any) {
      return res.status(500).json({ message: e.message });
    }
  });

  // SQL을 로컬 파일로 저장
  app.post("/api/admin/save-db-locally", async (req, res) => {
    const { password } = req.body;
    if (password !== "qwer1234!!") return res.status(401).json({ message: "비밀번호 오류" });
    try {
      const { dumpDatabaseToSQL } = await import("./db-export");
      const { writeFileSync } = await import("fs");
      const sql = await dumpDatabaseToSQL();
      writeFileSync("db-seed.sql", sql, "utf8");
      return res.json({ success: true, size: sql.length });
    } catch (e: any) {
      return res.status(500).json({ message: e.message });
    }
  });

  // 외부에서 SQL 내용을 받아 GitHub에 업로드
  app.post("/api/admin/upload-sql-to-github", async (req, res) => {
    const { password, sql } = req.body;
    if (password !== "qwer1234!!") {
      return res.status(401).json({ message: "비밀번호가 올바르지 않습니다" });
    }
    if (!sql || typeof sql !== "string") {
      return res.status(400).json({ message: "sql 내용이 없습니다" });
    }
    try {
      const { pushSQLToGitHub } = await import("./db-export");
      await pushSQLToGitHub(sql);
      return res.json({ success: true, message: "db-seed.sql이 GitHub에 업로드되었습니다", size: sql.length });
    } catch (e: any) {
      console.error("GitHub 업로드 실패:", e);
      return res.status(500).json({ message: e.message || "업로드에 실패했습니다" });
    }
  });

  return httpServer;
}
