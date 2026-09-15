import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import test from "node:test";
import bcrypt from "bcrypt";
import pg from "pg";
import { WebSocket } from "ws";

const databaseUrl = process.env.DATABASE_URL;
const sessionSecret = process.env.SESSION_SECRET;

if (!databaseUrl) throw new Error("DATABASE_URL is required for chat integration tests");
if (!sessionSecret) throw new Error("SESSION_SECRET is required for chat integration tests");

const pool = new pg.Pool({ connectionString: databaseUrl });
const runId = `chat_it_${process.pid}_${Date.now()}`;
const password = "integration-password";
const chatUploadDir = path.join(process.cwd(), "uploads", "chat");
const userIds: string[] = [];
const roomIds: string[] = [];
const uploadedFiles: string[] = [];
let serverProcess: ChildProcess | undefined;
let baseUrl = "";

type SessionClient = {
  cookie: string;
  request(path: string, init?: RequestInit): Promise<Response>;
};

async function getFreePort(): Promise<number> {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Failed to allocate a test port");
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

async function waitForServer(url: string): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (serverProcess?.exitCode != null) {
      throw new Error(`Test server exited early with code ${serverProcess.exitCode}`);
    }
    try {
      const response = await fetch(`${url}/api/maintenance`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Timed out waiting for the test server");
}

async function createUser(username: string, isAdmin: boolean): Promise<string> {
  const hash = await bcrypt.hash(password, 4);
  const result = await pool.query<{ id: string }>(
    `INSERT INTO users
      (username, password, plain_password, full_name, account_number, account_holder, bank, is_admin, is_approved)
     VALUES ($1, $2, '', $3, 'test-account', 'test-holder', 'test-bank', $4, true)
     RETURNING id`,
    [username, hash, username, isAdmin],
  );
  userIds.push(result.rows[0].id);
  return result.rows[0].id;
}

async function login(username: string, admin = false): Promise<SessionClient> {
  const response = await fetch(`${baseUrl}/api/auth/${admin ? "admin-login" : "login"}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  assert.equal(response.status, 200, await response.text());
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie, `Login for ${username} did not set a session cookie`);
  return {
    cookie,
    request(path, init = {}) {
      const headers = new Headers(init.headers);
      headers.set("cookie", cookie);
      if (init.body && !(init.body instanceof FormData) && !headers.has("content-type")) {
        headers.set("content-type", "application/json");
      }
      return fetch(`${baseUrl}${path}`, { ...init, headers });
    },
  };
}

async function openSocket(client: SessionClient, role?: "member" | "admin"): Promise<WebSocket> {
  const roleQuery = role ? `?role=${role}` : "";
  const socket = new WebSocket(baseUrl.replace(/^http/, "ws") + `/ws/chat${roleQuery}`, {
    headers: { cookie: client.cookie },
  });
  await once(socket, "open");
  return socket;
}

function nextSocketMessage(socket: WebSocket): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timed out waiting for WebSocket message")), 5_000);
    socket.once("message", (data) => {
      clearTimeout(timer);
      resolve(JSON.parse(data.toString()));
    });
  });
}

function sessionIdFromCookie(cookie: string): string {
  const value = decodeURIComponent(cookie.slice(cookie.indexOf("=") + 1));
  const match = value.match(/^s:([^.]+)\./);
  assert.ok(match, "Expected a signed session cookie");
  return match[1];
}

async function assertSocketRejected(cookie?: string, socketPath = "/ws/chat"): Promise<void> {
  const socket = new WebSocket(baseUrl.replace(/^http/, "ws") + socketPath, {
    headers: cookie ? { cookie } : undefined,
  });
  let opened = false;
  socket.once("open", () => {
    opened = true;
    socket.send(JSON.stringify({ type: "join", roomId: roomIds[0], requestId: 1 }));
    socket.send(JSON.stringify({
      type: "message",
      roomId: roomIds[0],
      message: "unauthenticated-message-must-not-persist",
    }));
  });
  socket.on("error", () => {});
  await Promise.race([
    new Promise<void>((resolve) => socket.once("close", () => resolve())),
    new Promise((_, reject) => setTimeout(() => reject(new Error("Timed out waiting for rejected WebSocket")), 5_000)),
  ]);
  assert.equal(opened, false, "인증되지 않은 WebSocket은 연결이 열리면 안 된다");
  assert.equal(socket.readyState, WebSocket.CLOSED);
}

async function sendAndReceive(socket: WebSocket, payload: unknown): Promise<any> {
  const message = nextSocketMessage(socket);
  socket.send(JSON.stringify(payload));
  return message;
}

const pngBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==",
  "base64",
);

function imageForm(filename = "untrusted-name.exe"): FormData {
  const form = new FormData();
  form.set("image", new Blob([pngBytes], { type: "image/png" }), filename);
  return form;
}

async function uploadImage(request: SessionClient["request"]): Promise<Response> {
  return request("/api/chat/upload", {
    method: "POST",
    body: imageForm(),
  });
}

test.before(async () => {
  const memberAId = await createUser(`${runId}_a`, false);
  const memberBId = await createUser(`${runId}_b`, false);
  await createUser(`${runId}_admin`, true);

  for (const userId of [memberAId, memberBId]) {
    const result = await pool.query<{ id: string }>(
      "INSERT INTO chat_rooms (user_id) VALUES ($1) RETURNING id",
      [userId],
    );
    roomIds.push(result.rows[0].id);
  }

  const port = await getFreePort();
  baseUrl = `http://127.0.0.1:${port}`;
  serverProcess = spawn(process.execPath, ["node_modules/tsx/dist/cli.mjs", "server/index.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: "test", PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let serverOutput = "";
  serverProcess.stdout?.on("data", (chunk) => { serverOutput += chunk.toString(); });
  serverProcess.stderr?.on("data", (chunk) => { serverOutput += chunk.toString(); });
  try {
    await waitForServer(baseUrl);
  } catch (error) {
    throw new Error(`${String(error)}\n${serverOutput}`);
  }
});

test.after(async () => {
  if (serverProcess && serverProcess.exitCode == null) {
    serverProcess.kill("SIGTERM");
    await Promise.race([
      once(serverProcess, "exit"),
      new Promise((resolve) => setTimeout(resolve, 5_000)),
    ]);
  }
  if (roomIds.length) {
    await pool.query("DELETE FROM chat_messages WHERE room_id = ANY($1::varchar[])", [roomIds]);
    await pool.query("DELETE FROM chat_rooms WHERE id = ANY($1::varchar[])", [roomIds]);
  }
  if (userIds.length) {
    await pool.query("DELETE FROM login_logs WHERE user_id = ANY($1::varchar[])", [userIds]);
    await pool.query(
      `DELETE FROM session
       WHERE ${userIds.map((_, index) => `sess::text LIKE $${index + 1}`).join(" OR ")}`,
      userIds.map((id) => `%${id}%`),
    );
    await pool.query("DELETE FROM users WHERE id = ANY($1::varchar[])", [userIds]);
  }
  await Promise.all(uploadedFiles.map((file) => fs.rm(file, { force: true })));
  await pool.end();
});

test("상담 이미지 업로드는 익명 요청을 저장 전에 거절하고 회원과 관리자는 허용한다", async () => {
  await fs.mkdir(chatUploadDir, { recursive: true });
  const filesBeforeAnonymousRequest = new Set(await fs.readdir(chatUploadDir));
  const anonymousResponse = await fetch(`${baseUrl}/api/chat/upload`, {
    method: "POST",
    body: imageForm(),
  });

  assert.equal(anonymousResponse.status, 401);
  assert.deepEqual(
    new Set(await fs.readdir(chatUploadDir)),
    filesBeforeAnonymousRequest,
    "익명 요청의 파일은 업로드 디렉터리에 저장되면 안 된다",
  );

  const member = await login(`${runId}_a`);
  const admin = await login(`${runId}_admin`, true);
  for (const client of [member, admin]) {
    const response = await uploadImage(client.request);
    const responseBody = await response.text();
    assert.equal(response.status, 200, responseBody);
    const result = JSON.parse(responseBody) as { url: string };
    assert.match(result.url, /^\/uploads\/chat\/[^/]+\.png$/);
    const uploadedFile = path.join(process.cwd(), result.url.slice(1));
    uploadedFiles.push(uploadedFile);
    await fs.access(uploadedFile);
  }
});

test("MIME 타입과 시그니처를 위장한 상담 파일은 저장하지 않고 거절한다", async () => {
  await fs.mkdir(chatUploadDir, { recursive: true });
  const filesBeforeUpload = new Set(await fs.readdir(chatUploadDir));
  const member = await login(`${runId}_a`);
  const disguisedImages = [
    {
      filename: "mime-only.png",
      mimeType: "image/png",
      content: Buffer.from("this is not an image"),
    },
    {
      filename: "fake-signature.jpg",
      mimeType: "image/jpeg",
      content: Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x00, 0x00]),
    },
    {
      filename: "fake-signature.png",
      mimeType: "image/png",
      content: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    },
    {
      filename: "fake-signature.gif",
      mimeType: "image/gif",
      content: Buffer.from("GIF89a"),
    },
    {
      filename: "fake-signature.webp",
      mimeType: "image/webp",
      content: Buffer.from("RIFF\x04\x00\x00\x00WEBP"),
    },
  ];

  for (const disguisedImage of disguisedImages) {
    const form = new FormData();
    form.set(
      "image",
      new Blob([disguisedImage.content], { type: disguisedImage.mimeType }),
      disguisedImage.filename,
    );
    const response = await member.request("/api/chat/upload", {
      method: "POST",
      body: form,
    });

    assert.equal(response.status, 400, disguisedImage.filename);
    assert.match(await response.text(), /지원되지 않는 이미지 형식/);
  }

  assert.deepEqual(
    new Set(await fs.readdir(chatUploadDir)),
    filesBeforeUpload,
    "위장된 파일은 업로드 디렉터리에 저장되면 안 된다",
  );
});

test("상담 이미지는 첨부된 상담방의 회원과 관리자만 조회할 수 있다", async () => {
  const memberA = await login(`${runId}_a`);
  const memberB = await login(`${runId}_b`);
  const admin = await login(`${runId}_admin`, true);

  const uploadResponse = await uploadImage(memberA.request);
  const uploadBody = await uploadResponse.text();
  assert.equal(uploadResponse.status, 200, uploadBody);
  const { url } = JSON.parse(uploadBody) as { url: string };
  const uploadedFile = path.join(process.cwd(), url.slice(1));
  uploadedFiles.push(uploadedFile);

  await pool.query(
    `INSERT INTO chat_messages (room_id, sender_id, sender_role, message)
     VALUES ($1, $2, 'user', $3)`,
    [roomIds[0], userIds[0], `[img]${url}`],
  );
  await pool.query(
    `INSERT INTO chat_messages (room_id, sender_id, sender_role, message)
     VALUES ($1, $2, 'user', $3)`,
    [roomIds[1], userIds[1], `[img]${url}`],
  );

  const anonymousResponse = await fetch(`${baseUrl}${url}`);
  assert.equal(anonymousResponse.status, 401);

  const otherMemberResponse = await memberB.request(url);
  assert.equal(otherMemberResponse.status, 403, "다른 회원이 링크를 본인 상담에 붙여도 이미지를 열 수 없어야 한다");

  const ownerResponse = await memberA.request(url);
  assert.equal(ownerResponse.status, 200);
  assert.deepEqual(Buffer.from(await ownerResponse.arrayBuffer()), pngBytes);
  assert.match(ownerResponse.headers.get("cache-control") || "", /private, no-store/);

  const adminResponse = await admin.request(url);
  assert.equal(adminResponse.status, 200);
  assert.deepEqual(Buffer.from(await adminResponse.arrayBuffer()), pngBytes);

  await pool.query("DELETE FROM chat_messages WHERE message = $1", [`[img]${url}`]);
});

test("관리자가 보낸 상담 이미지는 해당 회원이 조회할 수 있다", async () => {
  const memberA = await login(`${runId}_a`);
  const memberB = await login(`${runId}_b`);
  const admin = await login(`${runId}_admin`, true);

  const uploadResponse = await uploadImage(admin.request);
  const uploadBody = await uploadResponse.text();
  assert.equal(uploadResponse.status, 200, uploadBody);
  const { url } = JSON.parse(uploadBody) as { url: string };
  uploadedFiles.push(path.join(process.cwd(), url.slice(1)));

  await pool.query(
    `INSERT INTO chat_messages (room_id, sender_id, sender_role, message)
     VALUES ($1, $2, 'admin', $3)`,
    [roomIds[0], userIds[2], `[img]${url}`],
  );

  const memberResponse = await memberA.request(url);
  assert.equal(memberResponse.status, 200);
  assert.deepEqual(Buffer.from(await memberResponse.arrayBuffer()), pngBytes);

  const otherMemberResponse = await memberB.request(url);
  assert.equal(otherMemberResponse.status, 403);

  await pool.query("DELETE FROM chat_messages WHERE message = $1", [`[img]${url}`]);
});

test("쿠키가 없거나 위조·만료된 세션의 WebSocket 연결을 거절한다", async () => {
  const member = await login(`${runId}_a`);
  const sessionId = sessionIdFromCookie(member.cookie);
  const forgedCookie = member.cookie.replace(/\.[^.;]+$/, ".forged-signature");

  await assertSocketRejected();
  await assertSocketRejected(forgedCookie);

  await pool.query("UPDATE session SET expire = NOW() - INTERVAL '1 minute' WHERE sid = $1", [sessionId]);
  await assertSocketRejected(member.cookie);

  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
       FROM chat_messages
      WHERE room_id = $1 AND message = 'unauthenticated-message-must-not-persist'`,
    [roomIds[0]],
  );
  assert.equal(result.rows[0].count, "0", "거절된 연결의 메시지는 저장되면 안 된다");
});

test("같은 세션의 회원·관리자 WebSocket은 요청한 역할로 분리되고 회원 메시지는 관리자에게 알림된다", async (t) => {
  const member = await login(`${runId}_a`);
  const sessionId = sessionIdFromCookie(member.cookie);
  await pool.query(
    `UPDATE session
        SET sess = (sess::jsonb || jsonb_build_object('adminUserId', $2::text))::json
      WHERE sid = $1`,
    [sessionId, userIds[2]],
  );

  await assertSocketRejected(member.cookie);
  await assertSocketRejected(member.cookie, "/ws/chat?role=unknown");

  const memberSocket = await openSocket(member, "member");
  const adminSocket = await openSocket(member, "admin");
  t.after(() => {
    memberSocket.close();
    adminSocket.close();
  });

  const roomId = roomIds[0];
  const memberJoined = await sendAndReceive(memberSocket, { type: "join", roomId, requestId: 1 });
  assert.equal(memberJoined.type, "joined");
  const adminJoined = await sendAndReceive(adminSocket, { type: "join", roomId, requestId: 1 });
  assert.equal(adminJoined.type, "joined");

  const adminFrames = new Promise<any[]>((resolve, reject) => {
    const frames: any[] = [];
    const timer = setTimeout(() => {
      adminSocket.off("message", onMessage);
      reject(new Error("Timed out waiting for member message and admin notification"));
    }, 5_000);
    const onMessage = (data: WebSocket.RawData) => {
      frames.push(JSON.parse(data.toString()));
      if (frames.length === 2) {
        clearTimeout(timer);
        adminSocket.off("message", onMessage);
        resolve(frames);
      }
    };
    adminSocket.on("message", onMessage);
  });

  const messageText = `dual-role-member-${Date.now()}`;
  memberSocket.send(JSON.stringify({ type: "message", roomId, message: messageText }));
  const frames = await adminFrames;
  const deliveredMessage = frames.find((frame) => frame.type === "message");
  const notification = frames.find((frame) => frame.type === "notification");

  assert.equal(deliveredMessage?.data?.senderRole, "user");
  assert.equal(deliveredMessage?.data?.senderId, userIds[0]);
  assert.equal(deliveredMessage?.data?.message, messageText);
  assert.equal(notification?.data?.roomId, roomId);
  assert.equal(notification?.data?.message, messageText);

  const persisted = await pool.query<{ sender_id: string; sender_role: string }>(
    `SELECT sender_id, sender_role
       FROM chat_messages
      WHERE room_id = $1 AND message = $2`,
    [roomId, messageText],
  );
  assert.equal(persisted.rowCount, 1);
  assert.deepEqual(persisted.rows[0], { sender_id: userIds[0], sender_role: "user" });
});

test("실제 세션의 HTTP 및 WebSocket 연결에서 상담방이 회원별로 격리된다", async (t) => {
  const memberA = await login(`${runId}_a`);
  const memberB = await login(`${runId}_b`);
  const admin = await login(`${runId}_admin`, true);
  const [roomAId, roomBId] = roomIds;

  const ownHistory = await memberA.request(`/api/chat/rooms/${roomAId}/messages`);
  assert.equal(ownHistory.status, 200);
  const otherHistory = await memberA.request(`/api/chat/rooms/${roomBId}/messages`);
  assert.equal(otherHistory.status, 403);
  const memberReadOtherRoom = await memberA.request(`/api/chat/rooms/${roomBId}/mark-member-read`, {
    method: "POST",
    body: JSON.stringify({ messageIds: ["00000000-0000-0000-0000-000000000000"] }),
  });
  assert.equal(memberReadOtherRoom.status, 403);

  const socketA = await openSocket(memberA);
  const socketB = await openSocket(memberB);
  const adminSocket = await openSocket(admin);
  t.after(() => {
    socketA.close();
    socketB.close();
    adminSocket.close();
  });

  const deniedJoin = await sendAndReceive(socketA, { type: "join", roomId: roomBId, requestId: 1 });
  assert.equal(deniedJoin.type, "error");
  const deniedSend = await sendAndReceive(socketA, { type: "message", roomId: roomBId, message: "blocked" });
  assert.equal(deniedSend.type, "error");

  const joinedA = await sendAndReceive(socketA, { type: "join", roomId: roomAId, requestId: 2 });
  assert.equal(joinedA.type, "joined");
  const joinedB = await sendAndReceive(socketB, { type: "join", roomId: roomBId, requestId: 1 });
  assert.equal(joinedB.type, "joined");
  const adminJoined = await sendAndReceive(adminSocket, { type: "join", roomId: roomAId, requestId: 1 });
  assert.equal(adminJoined.type, "joined");

  const adminDelivery = nextSocketMessage(socketA);
  const memberBDelivery = nextSocketMessage(socketB);
  adminSocket.send(JSON.stringify({ type: "message", roomId: roomAId, message: "admin-only-a" }));
  const delivered = await adminDelivery;
  assert.equal(delivered.type, "message");
  assert.equal(delivered.data.roomId, roomAId);

  socketB.send(JSON.stringify({ type: "message", roomId: roomBId, message: "member-b-only" }));
  const deliveredToB = await memberBDelivery;
  assert.equal(deliveredToB.type, "message");
  assert.equal(deliveredToB.data.roomId, roomBId, "회원 B에게 방 A의 실시간 메시지가 전달되면 안 된다");

  const roomBMessages = await memberB.request(`/api/chat/rooms/${roomBId}/messages`);
  assert.equal(roomBMessages.status, 200);
  const persistedRoomBMessages = await roomBMessages.json() as Array<{ roomId: string; message: string }>;
  assert.deepEqual(
    persistedRoomBMessages.map(({ roomId, message }) => ({ roomId, message })),
    [{ roomId: roomBId, message: "member-b-only" }],
  );
});

test("회원 읽음과 관리자 회수가 동시에 실행되어도 DB 상태가 일관된다", async () => {
  const memberA = await login(`${runId}_a`);
  const admin = await login(`${runId}_admin`, true);
  const roomAId = roomIds[0];

  for (let iteration = 0; iteration < 6; iteration += 1) {
    const inserted = await pool.query<{ id: string }>(
      `INSERT INTO chat_messages
        (room_id, sender_id, sender_role, message, is_read_by_member)
       VALUES ($1, $2, 'admin', $3, 0)
       RETURNING id`,
      [roomAId, userIds[2], `race-${iteration}`],
    );
    const messageId = inserted.rows[0].id;

    const [readResponse, recallResponse] = await Promise.all([
      memberA.request(`/api/chat/rooms/${roomAId}/mark-member-read`, {
        method: "POST",
        body: JSON.stringify({ messageIds: [messageId] }),
      }),
      admin.request(`/api/admin/chat/messages/${messageId}`, { method: "DELETE" }),
    ]);

    assert.equal(readResponse.status, 200);
    assert.ok([200, 409].includes(recallResponse.status));
    const finalRow = await pool.query<{ is_read_by_member: number }>(
      "SELECT is_read_by_member FROM chat_messages WHERE id = $1",
      [messageId],
    );
    if (recallResponse.status === 200) {
      assert.equal(finalRow.rowCount, 0, "회수 성공 메시지는 DB에서 삭제되어야 한다");
    } else {
      assert.equal(finalRow.rows[0]?.is_read_by_member, 1, "회수 실패 메시지는 읽음 상태여야 한다");
    }
  }
});