import { useState } from "react";

import { MessageSquare, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import { useChatWindow } from "../hooks/useChatWindow";

import { useCampaignCapabilities } from "@/features/campaigns/capabilities";
import ChatMessageItem from "./ChatMessageItem";

type Props = {
  campaignId: number;
  className?: string;
};

export default function CampaignChatMenu({ campaignId, className }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const { user: currentUser } = useAppStore();
  const chat = useChatWindow(campaignId, isOpen);
  // Owners and admins remove posts (decision 8); read from the campaign the layout loaded.
  const canRemove = useCampaignCapabilities(campaignId, { read: false }).remove_posts;
  const { messages, isLoading, loadError, unread } = chat;
  const handleOpenChange = (open: boolean) => {
    if (open) {
      chat.resetHistory();
    }
    setIsOpen(open);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
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
          <DialogDescription>Messages to everyone in this campaign.</DialogDescription>
        </DialogHeader>

        {/* Messages list */}
        <div
          ref={chat.listRef}
          className="max-h-[380px] min-h-[200px] overflow-y-auto space-y-3 py-1"
          onScroll={chat.handleScroll}
        >
          {isLoading && messages.length > 0 ? (
            <p className="py-1 text-center text-xs text-muted-foreground">
              Loading older messages...
            </p>
          ) : null}
          {loadError && messages.length > 0 ? (
            <p role="alert" className="py-1 text-center text-xs text-red-400">
              {loadError}{" "}
              <button type="button" className="underline" onClick={chat.retryLoad}>
                Retry
              </button>
            </p>
          ) : null}
          {isLoading && messages.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">Loading messages...</p>
          ) : null}
          {!isLoading && loadError && messages.length === 0 ? (
            <ErrorState message={loadError} onRetry={chat.retryLoad} />
          ) : null}
          {!isLoading && !loadError && messages.length === 0 ? (
            <EmptyState>No messages yet. Say something!</EmptyState>
          ) : null}
          {messages.map((message) => (
            <ChatMessageItem
              key={message.id}
              message={message}
              isOwn={currentUser?.id === message.user_id}
              canRemove={canRemove}
              onRemove={chat.removeMessage}
            />
          ))}
        </div>

        {/* Input bar */}
        <div className="space-y-2 border-t border-border/40 pt-3">
          <div className="flex items-center gap-2">
            <label htmlFor="campaign-chat-message" className="sr-only">
              Message the campaign
            </label>
            <input
              id="campaign-chat-message"
              type="text"
              className="field-surface flex-1 rounded-xl px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/60"
              placeholder="Send a message..."
              value={chat.draft}
              onChange={(e) => chat.updateDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void chat.handleSend();
                }
              }}
              maxLength={2000}
            />
            <button
              type="button"
              onClick={() => void chat.handleSend()}
              disabled={!chat.draft.trim() || chat.isSending}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          {chat.sendError ? (
            <p role="alert" className="text-xs text-red-400">
              {chat.sendError}
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
