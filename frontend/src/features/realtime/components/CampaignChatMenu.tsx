import { useCallback, useEffect, useRef, useState } from "react";

import { MessageSquare, Send } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import { listCampaignMessages, sendCampaignMessage } from "@/features/campaigns/api/campaigns-api";
import { createCampaignChatSocket } from "@/lib/realtime";

import type { CampaignMessage } from "@/features/campaigns/types/campaign-types";
import type { ChatMessage } from "@/lib/realtime";

type Props = {
  campaignId: number;
  className?: string;
};

export default function CampaignChatMenu({ campaignId, className }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<CampaignMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [unread, setUnread] = useState(0);

  const listRef = useRef<HTMLDivElement>(null);
  const isLoadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const messagesRef = useRef<CampaignMessage[]>([]);
  const isOpenRef = useRef(false);
  isOpenRef.current = isOpen;

  const { user: currentUser } = useAppStore();

  // Keep messagesRef in sync with state
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const loadMessages = useCallback(async (before?: number) => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setIsLoading(true);
    try {
      const data = await listCampaignMessages(campaignId, before);
      // API returns newest-first; reverse for chronological display
      const reversed = [...data].reverse();
      const newHasMore = data.length === 50;
      hasMoreRef.current = newHasMore;
      setHasMore(newHasMore);

      if (before) {
        const list = listRef.current;
        const prevHeight = list?.scrollHeight ?? 0;
        setMessages((prev) => [...reversed, ...prev]);
        requestAnimationFrame(() => {
          if (list) {
            list.scrollTop = list.scrollHeight - prevHeight;
          }
        });
      } else {
        setMessages(reversed);
        requestAnimationFrame(() => {
          if (listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
          }
        });
      }
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, [campaignId]);

  // Persistent Pusher socket (mounted for the lifetime of this component)
  useEffect(() => {
    const sock = createCampaignChatSocket(campaignId, (msg: ChatMessage) => {
      if (isOpenRef.current) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        requestAnimationFrame(() => {
          const list = listRef.current;
          if (list) {
            const isNearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 120;
            if (isNearBottom) {
              list.scrollTop = list.scrollHeight;
            }
          }
        });
      } else {
        setUnread((prev) => prev + 1);
      }
    });
    return () => sock.close();
  }, [campaignId]);

  // Load messages when dialog opens
  useEffect(() => {
    if (!isOpen) return;
    setMessages([]);
    messagesRef.current = [];
    hasMoreRef.current = true;
    setHasMore(true);
    setUnread(0);
    loadMessages();
  }, [isOpen, loadMessages]);

  const handleScroll = useCallback(() => {
    const list = listRef.current;
    if (!list || isLoadingRef.current || !hasMoreRef.current) return;
    if (list.scrollTop <= 0) {
      const oldest = messagesRef.current[0];
      if (oldest) {
        loadMessages(oldest.id);
      }
    }
  }, [loadMessages]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || isSending) return;
    setDraft("");
    setIsSending(true);
    try {
      const msg = await sendCampaignMessage(campaignId, body);
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      requestAnimationFrame(() => {
        if (listRef.current) {
          listRef.current.scrollTop = listRef.current.scrollHeight;
        }
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "icon-button relative flex h-9 w-9 items-center justify-center border-none bg-transparent p-0",
            className
          )}
          aria-label="Campaign chat"
        >
          <MessageSquare className="theme-heading-soft h-5 w-5" aria-hidden="true" />
          {unread > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 text-[0.55rem] font-semibold text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[28rem]">
        <DialogHeader>
          <DialogTitle>Campaign Chat</DialogTitle>
        </DialogHeader>

        {/* Messages list */}
        <div
          ref={listRef}
          className="max-h-[380px] min-h-[200px] overflow-y-auto space-y-3 py-1"
          onScroll={handleScroll}
        >
          {isLoading && messages.length > 0 ? (
            <p className="py-1 text-center text-xs text-muted-foreground">Loading older messages...</p>
          ) : null}
          {isLoading && messages.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">Loading messages...</p>
          ) : null}
          {!isLoading && messages.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">No messages yet. Say something!</p>
          ) : null}
          {messages.map((msg) => {
            const isOwn = currentUser?.id === msg.user_id;
            return (
              <div
                key={msg.id}
                className={cn("flex flex-col gap-0.5", isOwn ? "items-end" : "items-start")}
              >
                <span className="px-1 text-[0.65rem] text-muted-foreground">{msg.username}</span>
                <div
                  className={cn(
                    "max-w-[75%] break-words rounded-2xl px-3 py-2 text-sm",
                    isOwn
                      ? "bg-primary/20 text-primary-foreground"
                      : "surface-inline text-foreground"
                  )}
                >
                  {msg.body}
                </div>
              </div>
            );
          })}
        </div>

        {/* Input bar */}
        <div className="flex items-center gap-2 border-t border-border/40 pt-3">
          <input
            type="text"
            className="field-surface flex-1 rounded-xl px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/60"
            placeholder="Send a message..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            maxLength={2000}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!draft.trim() || isSending}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
