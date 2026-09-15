import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, Redirect } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { MessageSquare, Send, ArrowLeft, Loader2, ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { User, ChatRoom, ChatMessage } from "@shared/schema";
import { getVisibleUnreadAdminMessageIds, mergeChatSnapshot } from "@shared/chat-security";

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [wsConnected, setWsConnected] = useState(false);
  const [joinedRoomId, setJoinedRoomId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  function renderMessage(text: string) {
    if (text.startsWith("[img]")) {
      const url = text.slice(5);
      return (
        <img
          src={url}
          alt="이미지"
          className="max-w-full max-h-56 rounded cursor-pointer"
          onClick={() => setViewingImage(url)}
        />
      );
    }
    return <span className="whitespace-pre-wrap">{text}</span>;
  }
  const wsRef = useRef<WebSocket | null>(null);
  const joinedRoomRef = useRef<string | null>(null);
  const joinRequestRef = useRef(0);
  const syncingRef = useRef(false);
  const bufferedEventsRef = useRef<any[]>([]);
  const messagesRef = useRef<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const markMemberMessagesRead = async (id: string, messageIds: string[]) => {
    if (messageIds.length === 0) return;
    try {
      await fetch(`/api/chat/rooms/${id}/mark-member-read`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageIds }),
      });
    } catch {}
  };

  const { data: authData, isLoading: authLoading } = useQuery<{ user: User } | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const user = authData?.user;

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    async function initChat() {
      try {
        const res = await apiRequest("POST", "/api/chat/rooms");
        const room: ChatRoom = await res.json();
        if (cancelled) return;
        setRoomId(room.id);

        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const ws = new WebSocket(`${protocol}//${window.location.host}/ws/chat?role=member`);
        wsRef.current = ws;

        ws.onopen = () => {
          if (cancelled) return;
          setWsConnected(true);
          const requestId = ++joinRequestRef.current;
          ws.send(JSON.stringify({ type: "join", roomId: room.id, requestId }));
        };

        ws.onmessage = (event) => {
          if (cancelled) return;
          try {
            const parsed = JSON.parse(event.data);
            if (parsed.type === "joined" && parsed.data?.roomId === room.id) {
              if (parsed.data.requestId !== joinRequestRef.current) return;
              joinedRoomRef.current = room.id;
              setJoinedRoomId(room.id);
              syncingRef.current = true;
              bufferedEventsRef.current = [];
              fetch(`/api/chat/rooms/${room.id}/messages`, { credentials: "include" })
                .then((response) => {
                  if (!response.ok) throw new Error("채팅 내역을 불러오지 못했습니다");
                  return response.json() as Promise<ChatMessage[]>;
                })
                .then((history) => {
                  if (cancelled) return;
                  const bufferedEvents = bufferedEventsRef.current;
                  bufferedEventsRef.current = [];
                  syncingRef.current = false;
                  const nextMessages = mergeChatSnapshot(room.id, room.id, messagesRef.current, history, bufferedEvents);
                  messagesRef.current = nextMessages;
                  setMessages(nextMessages);
                  if (document.visibilityState === "visible") {
                    markMemberMessagesRead(room.id, getVisibleUnreadAdminMessageIds(room.id, nextMessages));
                  }
                }).catch(() => {
                  if (cancelled) return;
                  const bufferedEvents = bufferedEventsRef.current;
                  bufferedEventsRef.current = [];
                  syncingRef.current = false;
                  const byId = new Map(messagesRef.current.map((message) => [message.id, message]));
                  for (const event of bufferedEvents) {
                    if (event.type === "message") byId.set(event.data.id, event.data);
                    if (event.type === "message_deleted") byId.delete(event.data.id);
                  }
                  const nextMessages = Array.from(byId.values()).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                  messagesRef.current = nextMessages;
                  setMessages(nextMessages);
                  if (document.visibilityState === "visible") {
                    markMemberMessagesRead(room.id, bufferedEvents
                      .filter((event) => event.type === "message" && event.data.senderRole === "admin")
                      .map((event) => event.data.id));
                  }
                });
              return;
            }
            if (parsed.data?.roomId === room.id && syncingRef.current) {
              bufferedEventsRef.current.push(parsed);
              return;
            }
            if (parsed.type === "error") {
              toast({ title: "채팅 오류", description: parsed.message || "전송할 수 없습니다", variant: "destructive" });
              return;
            }
            if (parsed.type === "message" && parsed.data) {
              setMessages((prev) => {
                const exists = prev.some((m) => m.id === parsed.data.id);
                if (exists) return prev;
                return [...prev, parsed.data];
              });
              if (parsed.data.senderRole === "admin" && document.visibilityState === "visible") {
                markMemberMessagesRead(room.id, [parsed.data.id]);
              }
            }
            if (parsed.type === "message_deleted" && parsed.data?.roomId === room.id) {
              setMessages((prev) => prev.filter((m) => m.id !== parsed.data.id));
            }
            if (parsed.type === "messages_read" && parsed.data?.roomId === room.id && parsed.data.readerRole === "member") {
              setMessages((prev) => prev.map((m) => parsed.data.messageIds.includes(m.id) ? { ...m, isReadByMember: 1 } : m));
            }
          } catch {}
        };

        ws.onclose = () => {
          joinedRoomRef.current = null;
          setJoinedRoomId(null);
          if (!cancelled) setWsConnected(false);
        };
      } catch {}
    }

    initChat();

    return () => {
      cancelled = true;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [user]);

  useEffect(() => {
    messagesRef.current = messages;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!roomId) return;
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        markMemberMessagesRead(roomId, getVisibleUnreadAdminMessageIds(roomId, messagesRef.current));
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [roomId]);

  const handleSend = () => {
    const text = inputText.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !roomId || joinedRoomRef.current !== roomId) return;
    wsRef.current.send(JSON.stringify({ type: "message", roomId, message: text }));
    setInputText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!wsRef.current || !roomId || joinedRoomRef.current !== roomId) return;
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      wsRef.current.send(JSON.stringify({ type: "message", roomId, message: `[img]${dataUrl}` }));
    } catch {
      toast({ title: "이미지 업로드 실패", description: "다시 시도해주세요.", variant: "destructive" });
    } finally {
      setUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="space-y-4 w-full max-w-md px-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  const formatTime = (dateStr: string | Date) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  };
  const isChatReady = wsConnected && !!roomId && joinedRoomId === roomId;

  return (
    <>
    <div className="flex flex-col h-screen bg-background" data-testid="page-chat">
      <header
        className="h-14 shrink-0 flex items-center gap-3 px-4 text-white"
        style={{ backgroundColor: "#09ACFF" }}
        data-testid="chat-header"
      >
        <Link href="/dashboard">
          <Button
            size="icon"
            variant="ghost"
            className="text-white hover:bg-white/20 no-default-hover-elevate"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <MessageSquare className="w-5 h-5" />
        <h1 className="font-semibold text-base" data-testid="text-chat-title">
          1:1 고객센터 상담
        </h1>
        {!isChatReady && roomId && (
          <div className="ml-auto flex items-center gap-1.5 text-white/70 text-xs">
            <Loader2 className="w-3 h-3 animate-spin" />
            연결 중...
          </div>
        )}
      </header>

      <div
        ref={messageContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3"
        data-testid="chat-messages-container"
      >
        {!roomId ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">상담 채널 연결 중...</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-3">
              <MessageSquare className="w-10 h-10 mx-auto text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground" data-testid="text-empty-state">
                상담원에게 문의하실 내용을 입력해주세요
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.senderRole === "user";
            return (
              <div
                key={msg.id}
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                data-testid={`chat-message-${msg.id}`}
              >
                <div className={`max-w-[75%] space-y-1 ${isUser ? "items-end" : "items-start"} flex flex-col`}>
                  <span className="text-xs text-muted-foreground px-1" data-testid={`chat-sender-${msg.id}`}>
                    {isUser ? "회원" : "상담원"}
                  </span>
                  <div
                    className={`rounded-md px-3 py-2 text-sm break-words ${
                      msg.message.startsWith("[img]") ? "p-1" : ""
                    } ${
                      isUser
                        ? "bg-[#03C75A] text-white"
                        : "bg-muted text-foreground"
                    }`}
                    data-testid={`chat-bubble-${msg.id}`}
                  >
                    {renderMessage(msg.message)}
                  </div>
                  <span className="text-[11px] text-muted-foreground px-1" data-testid={`chat-time-${msg.id}`}>
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="shrink-0 border-t bg-background p-3" data-testid="chat-input-area">
        <div className="flex items-center gap-2 max-w-3xl mx-auto">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageUpload(file);
            }}
            data-testid="input-chat-image-file"
          />
          <Button
            size="icon"
            variant="ghost"
            onClick={() => imageInputRef.current?.click()}
            disabled={!isChatReady || uploading}
            className="shrink-0 text-gray-500 hover:text-[#03C75A]"
            data-testid="button-attach-image"
            title="이미지 첨부"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
          </Button>
          <Textarea
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={handleKeyDown}
            placeholder="메시지를 입력하세요... (Shift+Enter로 줄바꿈)"
            disabled={!isChatReady}
            rows={1}
            className="resize-none min-h-[40px] py-2 leading-snug"
            style={{ height: "40px", overflowY: "hidden" }}
            data-testid="input-chat-message"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!isChatReady || !inputText.trim()}
            className="bg-[#03C75A] border-[#03C75A] hover:bg-[#02b350]"
            data-testid="button-send-message"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
    {viewingImage && (
      <div
        className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
        onClick={() => setViewingImage(null)}
      >
        <img
          src={viewingImage}
          alt="이미지"
          className="max-w-full max-h-full rounded-lg shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
        <button
          className="absolute top-4 right-4 text-white bg-black/50 rounded-full w-9 h-9 flex items-center justify-center text-xl"
          onClick={() => setViewingImage(null)}
        >×</button>
      </div>
    )}
    </>
  );
}
