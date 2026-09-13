import assert from "node:assert/strict";
import test from "node:test";
import {
  canAccessChatRoom,
  canRecallAdminMessage,
  canSendChatMessage,
  getVisibleUnreadAdminMessageIds,
  mergeChatSnapshot,
} from "./chat-security";

const roomA = { id: "room-a", userId: "member-a" };
const roomB = { id: "room-b", userId: "member-b" };

test("회원 A는 회원 B의 방에 입장하거나 메시지를 보낼 수 없다", () => {
  assert.equal(canAccessChatRoom(roomB, "member-a", false), false);
  assert.equal(canSendChatMessage(roomB, "member-a", false, "room-b"), false);
  assert.equal(canSendChatMessage(roomA, "member-a", false, "room-b"), false);
  assert.equal(canSendChatMessage(roomA, "member-a", false, "room-a"), true);
});

test("현재 방에 표시된 읽지 않은 관리자 메시지만 읽음 처리한다", () => {
  const ids = getVisibleUnreadAdminMessageIds("room-a", [
    { id: "visible", roomId: "room-a", senderRole: "admin", isReadByMember: 0 },
    { id: "other-room", roomId: "room-b", senderRole: "admin", isReadByMember: 0 },
    { id: "member-message", roomId: "room-a", senderRole: "user", isReadByMember: 0 },
    { id: "already-read", roomId: "room-a", senderRole: "admin", isReadByMember: 1 },
  ]);
  assert.deepEqual(ids, ["visible"]);
});

test("관리자 메시지는 읽기 전에만 회수할 수 있다", () => {
  assert.equal(canRecallAdminMessage({ id: "new", roomId: "room-a", senderRole: "admin", isReadByMember: 0 }), true);
  assert.equal(canRecallAdminMessage({ id: "read", roomId: "room-a", senderRole: "admin", isReadByMember: 1 }), false);
  assert.equal(canRecallAdminMessage({ id: "member", roomId: "room-a", senderRole: "user", isReadByMember: 0 }), false);
});

test("기록 조회 중 삭제된 메시지는 기록 응답에 있어도 다시 표시하지 않는다", () => {
  const deleted = { id: "deleted", roomId: "room-a", senderRole: "admin", isReadByMember: 0, createdAt: "2026-09-10T00:00:00Z" };
  const merged = mergeChatSnapshot("room-a", "room-a", [], [deleted], [
    { type: "message_deleted", data: { id: "deleted", roomId: "room-a" } },
  ]);
  assert.deepEqual(merged, []);
});

test("빠른 방 전환 시 늦게 도착한 이전 방 기록과 이벤트를 버린다", () => {
  const roomBMessage = { id: "b", roomId: "room-b", senderRole: "user", createdAt: "2026-09-10T00:00:01Z" };
  const merged = mergeChatSnapshot("room-b", "room-a", [roomBMessage], [
    { id: "a", roomId: "room-a", senderRole: "user", createdAt: "2026-09-10T00:00:00Z" },
  ], [
    { type: "message", data: { id: "a2", roomId: "room-a", senderRole: "admin" } },
  ]);
  assert.deepEqual(merged, [roomBMessage]);
});