export type ChatRoomIdentity = {
  id: string;
  userId: string;
};

export type ChatMessageIdentity = {
  id: string;
  roomId: string;
  senderRole: string;
  isReadByMember?: number | null;
  createdAt?: Date | string | null;
};

export type ChatSyncEvent<T extends ChatMessageIdentity> = {
  type: "message" | "message_deleted" | "messages_read";
  data: any;
};

export function canAccessChatRoom(
  room: ChatRoomIdentity | undefined,
  userId: string,
  isAdmin: boolean,
): room is ChatRoomIdentity {
  return !!room && (isAdmin || room.userId === userId);
}

export function canSendChatMessage(
  room: ChatRoomIdentity | undefined,
  userId: string,
  isAdmin: boolean,
  joinedRoomId: string | undefined,
): room is ChatRoomIdentity {
  return canAccessChatRoom(room, userId, isAdmin) && joinedRoomId === room.id;
}

export function canRecallAdminMessage(message: ChatMessageIdentity | undefined): boolean {
  return !!message && message.senderRole === "admin" && message.isReadByMember !== 1;
}

export function getVisibleUnreadAdminMessageIds<T extends ChatMessageIdentity>(
  roomId: string,
  messages: T[],
): string[] {
  return messages
    .filter((message) =>
      message.roomId === roomId &&
      message.senderRole === "admin" &&
      message.isReadByMember !== 1
    )
    .map((message) => message.id);
}

export function mergeChatSnapshot<T extends ChatMessageIdentity>(
  activeRoomId: string,
  snapshotRoomId: string,
  current: T[],
  history: T[],
  events: ChatSyncEvent<T>[],
): T[] {
  if (activeRoomId !== snapshotRoomId) {
    return current.filter((message) => message.roomId === activeRoomId);
  }

  const byId = new Map<string, T>();
  for (const message of history) {
    if (message.roomId === activeRoomId) byId.set(message.id, message);
  }

  for (const event of events) {
    if (event.data?.roomId !== activeRoomId) continue;
    if (event.type === "message" && event.data?.id) {
      byId.set(event.data.id, event.data as T);
    } else if (event.type === "message_deleted" && event.data?.id) {
      byId.delete(event.data.id);
    } else if (event.type === "messages_read") {
      for (const id of event.data?.messageIds || []) {
        const message = byId.get(id);
        if (message) byId.set(id, { ...message, isReadByMember: 1 });
      }
    }
  }

  return Array.from(byId.values()).sort((a, b) =>
    new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
  );
}