"use client";

import {
  useState, useRef, useEffect, useCallback, memo
} from "react";
import { useRouter }    from "next/navigation";
import {
  Send, Ghost, Hash, X, Wifi, WifiOff, Circle
} from "lucide-react";
import { cn }           from "@/lib/utils";
import { chatApi }      from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { getSocket }    from "@/lib/socket";

// ── Types ────────────────────────────────────────────────────

interface ChatMessage {
  msg_id:        string;
  room_id:       string;
  sender_handle: string;
  content:       string;
  send_as_ghost: boolean;
  media_url?:    string | null;
  created_at:    string;
}

interface Room {
  room_id:    string;
  room_type:  "GLOBAL" | "BRANCH" | "ISSUE_ROOM" | "DM";
  name:       string;
  college_id: string;
}

// ── Single message bubble ────────────────────────────────────

const MessageBubble = memo(function MessageBubble({
  msg,
  isOwn,
  showHeader,
}: {
  msg:        ChatMessage;
  isOwn:      boolean;
  showHeader: boolean;
}) {
  const time = new Date(msg.created_at).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit",
  });

  const isGhost  = msg.send_as_ghost;
  const handle   = isGhost ? "Verified Campus Ghost" : msg.sender_handle;
  const initials = isGhost
    ? "👻"
    : handle.slice(0, 2).toUpperCase();

  return (
    <div className={cn("flex gap-3", isOwn && "flex-row-reverse")}>
      {/* Avatar — only show on first message in a group */}
      <div className={cn(
        "w-9 h-9 shrink-0 border-2 border-ink flex items-center justify-center font-mono text-xs font-bold",
        isOwn   ? "bg-acid text-ink" :
        isGhost ? "bg-ink text-acid/60 italic" :
        "bg-ink text-acid"
      )}>
        {initials}
      </div>

      <div className={cn("flex flex-col gap-1 max-w-[75%]", isOwn && "items-end")}>
        {/* Sender + time header */}
        {showHeader && (
          <div className={cn(
            "flex items-baseline gap-2",
            isOwn && "flex-row-reverse"
          )}>
            <span className={cn(
              "font-mono text-xs font-bold uppercase",
              isOwn   ? "text-ink" :
              isGhost ? "text-ink/40 italic" :
              "text-ink"
            )}>
              {isGhost && <Ghost size={10} className="inline mr-1" />}
              @{handle}
            </span>
            <span className="font-mono text-[10px] text-ink/30">{time}</span>
          </div>
        )}

        {/* Bubble */}
        <div className={cn(
          "px-4 py-2.5 border-2 border-ink font-mono text-sm leading-relaxed break-words",
          isOwn   ? "bg-acid text-ink shadow-brutal-sm" :
          isGhost ? "bg-ink/10 text-ink" :
          "bg-white text-ink shadow-brutal-sm"
        )}>
          {msg.content}
        </div>
      </div>
    </div>
  );
});

// ── Main lounge component ────────────────────────────────────

export function AyeLounge() {
  const router   = useRouter();
  const { user } = useAuthStore();

  const [rooms,       setRooms]      = useState<Room[]>([]);
  const [activeRoom,  setActive]     = useState<Room | null>(null);
  const [messages,    setMessages]   = useState<ChatMessage[]>([]);
  const [input,       setInput]      = useState("");
  const [asGhost,     setGhost]      = useState(false);
  const [sidebarOpen, setSidebar]    = useState(false);
  const [loadingRooms,setLoadRooms]  = useState(true);
  const [loadingMsgs, setLoadMsgs]   = useState(false);
  const [connected,   setConnected]  = useState(false);
  const [onlineCount, setOnlineCount]= useState(0);

  const bottomRef   = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLInputElement>(null);
  const socketRef   = useRef<ReturnType<typeof getSocket> | null>(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!user) router.push("/auth");
  }, [user, router]);

  // Open sidebar by default on desktop
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    setSidebar(mq.matches);
    const h = (e: MediaQueryListEvent) => setSidebar(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  // Load rooms
  useEffect(() => {
    if (!user?.token) return;
    setLoadRooms(true);
    chatApi.rooms(user.token)
      .then((r) => {
        const data = r as { rooms: Room[] };
        setRooms(data.rooms);
        if (data.rooms.length > 0) setActive(data.rooms[0]);
      })
      .catch(() => {})
      .finally(() => setLoadRooms(false));
  }, [user?.token]);

  // Load message history when room changes
  useEffect(() => {
    if (!user?.token || !activeRoom) return;
    setMessages([]);
    setLoadMsgs(true);
    chatApi.messages(activeRoom.room_id, user.token)
      .then((r) => {
        const data = r as { messages: ChatMessage[] };
        setMessages(data.messages);
      })
      .catch(() => {})
      .finally(() => setLoadMsgs(false));
  }, [activeRoom?.room_id, user?.token]);

  // Socket.io — connect once, switch rooms as needed
  useEffect(() => {
    if (!user?.token) return;

    const socket = getSocket(user.token);
    socketRef.current = socket;

    // Connection state
    const onConnect    = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on("connect",    onConnect);
    socket.on("disconnect", onDisconnect);
    setConnected(socket.connected);

    // Incoming messages
    const onMessage = (msg: ChatMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m.msg_id === msg.msg_id)) return prev;
        return [...prev, msg];
      });
    };
    socket.on("message:new", onMessage);

    // Online users count
    const onOnline = (data: { count: number }) => setOnlineCount(data.count);
    socket.on("room:online", onOnline);

    return () => {
      socket.off("connect",    onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("message:new", onMessage);
      socket.off("room:online",  onOnline);
    };
  }, [user?.token]);

  // Join / leave rooms via socket
  useEffect(() => {
    if (!socketRef.current || !activeRoom) return;
    const socket = socketRef.current;

    socket.emit("room:join", activeRoom.room_id);

    return () => {
      socket.emit("room:leave", activeRoom.room_id);
    };
  }, [activeRoom?.room_id]);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send message
  const sendMessage = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      const text = input.trim();
      if (!text || !activeRoom || !socketRef.current) return;

      socketRef.current.emit("message:send", {
        room_id:       activeRoom.room_id,
        content:       text,
        send_as_ghost: asGhost,
      });

      setInput("");
      inputRef.current?.focus();
    },
    [input, activeRoom, asGhost]
  );

  // Send on Enter (Shift+Enter = newline not needed since single-line)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  function selectRoom(room: Room) {
    setActive(room);
    if (window.innerWidth < 640) setSidebar(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  if (!user) return null;

  const groupedRooms = (type: Room["room_type"]) =>
    rooms.filter((r) => r.room_type === type);

  // Group consecutive messages from same sender
  function shouldShowHeader(i: number): boolean {
    if (i === 0) return true;
    const prev = messages[i - 1];
    const curr = messages[i];
    if (prev.sender_handle !== curr.sender_handle) return true;
    if (prev.send_as_ghost !== curr.send_as_ghost)  return true;
    // Show header if > 3 minutes gap
    const gap = new Date(curr.created_at).getTime() - new Date(prev.created_at).getTime();
    return gap > 3 * 60 * 1000;
  }

  const roomIcon = (type: Room["room_type"]) =>
    type === "ISSUE_ROOM" ? "⚡" : "#";

  return (
    <div>
      <div className="section-label mb-4 inline-block">CAMPUS / LOUNGE</div>

      <div
        className="border-3 border-ink shadow-brutal flex overflow-hidden relative"
        style={{ height: "calc(100dvh - 180px)", minHeight: "480px" }}
      >
        {/* ── SIDEBAR ────────────────────────────────────────── */}
        {sidebarOpen && (
          <>
            {/* Mobile backdrop */}
            <div
              className="absolute inset-0 bg-ink/50 z-10 sm:hidden"
              onClick={() => setSidebar(false)}
            />

            <aside
              className={cn(
                "absolute sm:relative z-20 sm:z-auto h-full",
                "flex flex-col bg-ink text-acid",
                "w-64 border-r-3 border-ink",
                "transition-all duration-200"
              )}
            >
              {/* Sidebar header */}
              <div className="px-4 py-4 border-b-2 border-acid/20 flex items-center justify-between shrink-0">
                <div>
                  <div className="font-mono font-bold text-sm uppercase tracking-widest">
                    AYE LOUNGE
                  </div>
                  {/* Connection indicator */}
                  <div className="flex items-center gap-1.5 mt-1">
                    <Circle
                      size={6}
                      className={connected ? "text-emerald fill-emerald" : "text-danger fill-danger"}
                    />
                    <span className="font-mono text-[10px] text-acid/40 uppercase">
                      {connected ? "CONNECTED" : "CONNECTING..."}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSidebar(false)}
                  className="sm:hidden text-acid/50 hover:text-acid min-w-[36px] min-h-[36px] flex items-center justify-center"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Rooms list */}
              <div className="flex-1 overflow-y-auto py-2">
                {loadingRooms ? (
                  <div className="px-4 py-3 space-y-2">
                    {[1,2,3].map((i) => (
                      <div key={i} className="h-8 bg-acid/10 animate-pulse rounded" />
                    ))}
                  </div>
                ) : (
                  (["GLOBAL", "BRANCH", "ISSUE_ROOM"] as Room["room_type"][]).map((type) => {
                    const group = groupedRooms(type);
                    if (group.length === 0) return null;
                    return (
                      <div key={type} className="mb-4">
                        <div className="px-4 py-1 font-mono text-[10px] uppercase tracking-widest text-acid/30 font-bold">
                          {type === "ISSUE_ROOM" ? "⚡ TRENDING ISSUES" :
                           type === "BRANCH"     ? "BRANCH CHANNELS" :
                           "GENERAL"}
                        </div>
                        {group.map((r) => (
                          <button
                            key={r.room_id}
                            onClick={() => selectRoom(r)}
                            className={cn(
                              "w-full text-left px-4 py-2.5 font-mono text-xs flex items-center gap-2 transition-all duration-75 min-h-[44px]",
                              activeRoom?.room_id === r.room_id
                                ? "bg-acid text-ink font-bold"
                                : "text-acid/70 hover:bg-white/10 hover:text-acid"
                            )}
                          >
                            <span className="shrink-0 text-sm">{roomIcon(r.room_type)}</span>
                            <span className="truncate lowercase">
                              {r.name.replace(/^[#⚡]\s?/, "")}
                            </span>
                          </button>
                        ))}
                      </div>
                    );
                  })
                )}

                {!loadingRooms && rooms.length === 0 && (
                  <div className="px-4 py-6 font-mono text-[10px] text-acid/30 uppercase text-center">
                    No rooms yet.<br/>Admin creates rooms.
                  </div>
                )}
              </div>

              {/* Sidebar footer — user info */}
              <div className="px-4 py-3 border-t-2 border-acid/20 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-acid text-ink border-2 border-acid flex items-center justify-center font-mono text-xs font-bold shrink-0">
                    {user.ghost_handle.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-mono text-xs font-bold text-acid truncate">
                      @{user.ghost_handle}
                    </div>
                    <div className="font-mono text-[10px] text-acid/40 uppercase">
                      {asGhost ? "👻 Ghost mode" : "Visible"}
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </>
        )}

        {/* ── CHAT AREA ──────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 bg-paper">

          {/* Chat header */}
          <div className="flex items-center justify-between px-3 sm:px-4 py-3 border-b-2 border-ink bg-white shrink-0 gap-2">
            <div className="flex items-center gap-3 min-w-0">
              {/* Hamburger */}
              <button
                onClick={() => setSidebar((v) => !v)}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center border-2 border-ink font-mono text-base shrink-0 hover:bg-acid/20 transition-colors"
                aria-label="Toggle channels"
              >
                ☰
              </button>

              {activeRoom ? (
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm uppercase truncate">
                      {roomIcon(activeRoom.room_type)} {activeRoom.name.replace(/^[#⚡]\s?/, "").toLowerCase()}
                    </span>
                    {activeRoom.room_type === "ISSUE_ROOM" && (
                      <span className="badge badge-amber shrink-0 hidden xs:inline">TRENDING</span>
                    )}
                  </div>
                  {/* Connection + online count */}
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {connected
                      ? <Wifi size={10} className="text-emerald" />
                      : <WifiOff size={10} className="text-danger" />}
                    <span className="font-mono text-[10px] text-ink/40 uppercase">
                      {connected ? "LIVE" : "RECONNECTING..."}
                    </span>
                  </div>
                </div>
              ) : (
                <span className="font-mono text-sm text-ink/40 uppercase">
                  SELECT A ROOM
                </span>
              )}
            </div>

            {/* Ghost toggle */}
            <button
              onClick={() => setGhost((v) => !v)}
              aria-pressed={asGhost}
              className={cn(
                "flex items-center gap-1.5 px-3 border-2 border-ink font-mono text-xs font-bold uppercase transition-colors shrink-0 min-h-[40px]",
                asGhost ? "bg-ink text-acid" : "bg-paper text-ink hover:bg-acid/20"
              )}
            >
              <Ghost size={12} />
              <span className="hidden xs:inline">{asGhost ? "GHOST" : "VISIBLE"}</span>
            </button>
          </div>

          {/* ── MESSAGES ───────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {!activeRoom && (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-20">
                <div className="font-mono text-4xl mb-4">💬</div>
                <p className="font-mono text-sm text-ink/40 uppercase tracking-widest">
                  SELECT A CHANNEL TO START CHATTING
                </p>
              </div>
            )}

            {loadingMsgs && (
              <div className="flex flex-col gap-4 py-4">
                {[1,2,3,4].map((i) => (
                  <div key={i} className={cn("flex gap-3", i % 2 === 0 && "flex-row-reverse")}>
                    <div className="w-9 h-9 bg-ink/10 animate-pulse shrink-0" />
                    <div className="flex flex-col gap-1.5 max-w-[60%]">
                      <div className="h-3 w-24 bg-ink/10 animate-pulse" />
                      <div className="h-10 bg-ink/10 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loadingMsgs && activeRoom && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="font-mono text-3xl mb-3">🗣</div>
                <p className="font-mono text-sm text-ink/40 uppercase tracking-widest mb-1">
                  NO MESSAGES YET
                </p>
                <p className="font-mono text-xs text-ink/30 uppercase">
                  BE THE FIRST TO SPEAK UP
                </p>
              </div>
            )}

            {!loadingMsgs && messages.map((msg, i) => (
              <MessageBubble
                key={msg.msg_id}
                msg={msg}
                isOwn={!msg.send_as_ghost && msg.sender_handle === user.ghost_handle}
                showHeader={shouldShowHeader(i)}
              />
            ))}

            <div ref={bottomRef} />
          </div>

          {/* ── INPUT BAR ──────────────────────────────────── */}
          <div className="border-t-2 border-ink bg-white shrink-0">
            {/* Ghost mode banner */}
            {asGhost && (
              <div className="px-4 py-1.5 bg-ink flex items-center gap-2">
                <Ghost size={12} className="text-acid" />
                <span className="font-mono text-[10px] text-acid uppercase tracking-wider">
                  SENDING AS VERIFIED CAMPUS GHOST — IDENTITY HIDDEN
                </span>
              </div>
            )}

            <form
              onSubmit={sendMessage}
              className="flex items-end gap-0"
            >
              <input
                ref={inputRef}
                className="flex-1 px-4 py-4 font-mono bg-white border-0 outline-none placeholder:text-ink/30 min-h-[56px]"
                style={{ fontSize: "max(16px, 0.875rem)" }}
                placeholder={
                  !activeRoom        ? "Select a room first..." :
                  asGhost            ? "Typing as ghost..." :
                  `Message #${activeRoom.name.replace(/^[#⚡]\s?/, "").toLowerCase()}...`
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={!activeRoom || !connected}
                inputMode="text"
                autoComplete="off"
                autoCorrect="on"
                spellCheck
              />

              {/* Send button */}
              <button
                type="submit"
                disabled={!input.trim() || !activeRoom || !connected}
                className={cn(
                  "h-full px-5 min-w-[56px] min-h-[56px] flex items-center justify-center",
                  "border-l-2 border-ink font-mono font-bold",
                  "transition-all duration-75",
                  input.trim() && connected
                    ? "bg-acid text-ink hover:translate-x-[2px] hover:translate-y-[2px]"
                    : "bg-ink/10 text-ink/30 cursor-not-allowed"
                )}
                aria-label="Send message"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
