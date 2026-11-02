import type { ReactNode } from "react";

import { Send } from "lucide-react";
import { Slot } from "@radix-ui/react-slot";

import { SidePanel } from "@/components/ui/side-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { useAppStore } from "@/stores/app-store";
import { useChatWindow } from "../hooks/useChatWindow";

import { useCampaignCapabilities } from "@/features/campaigns/capabilities";
import ChatMessageItem from "./ChatMessageItem";

type Props = {
  campaignId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The button that opens it, given the unread count (the shell owns the open state). */
  trigger?: (unread: number) => ReactNode;
};

export default function CampaignChatMenu({ campaignId, open, onOpenChange, trigger }: Props) {
  const { user: currentUser } = useAppStore();
  const chat = useChatWindow(campaignId, open);
  // Owners and admins remove posts (decision 8); read from the campaign the layout loaded.
  const canRemove = useCampaignCapabilities(campaignId, { read: false }).remove_posts;
  const { messages, isLoading, loadError, unread } = chat;
  const handleOpenChange = (next: boolean) => {
    if (next) {
      chat.resetHistory();
    }
    onOpenChange(next);
  };

  return (
    <>
      {trigger ? <Slot onClick={() => handleOpenChange(true)}>{trigger(unread)}</Slot> : null}
      <SidePanel
        open={open}
        onOpenChange={handleOpenChange}
        kicker="Campaign"
        title="Chat"
        description="Messages to everyone in this campaign."
        footer={
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <label htmlFor="campaign-chat-message" className="sr-only">
                Message the campaign
              </label>
              <input
                id="campaign-chat-message"
                type="text"
                className="h-11 min-w-0 flex-1 border border-strong bg-page px-3 text-base text-ink outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:text-sm"
                placeholder="Message"
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
                className="flex h-11 w-11 shrink-0 items-center justify-center border border-primary bg-primary text-on-accent transition-colors hover:border-accent-hi hover:bg-accent-hi disabled:opacity-40"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            {chat.sendError ? (
              <p role="alert" className="text-xs text-danger">
                {chat.sendError}
              </p>
            ) : null}
          </div>
        }
      >
        {/* Messages list */}
        <div
          ref={chat.listRef}
          className="min-h-0 flex-1 space-y-3 overflow-y-auto py-1"
          onScroll={chat.handleScroll}
        >
          {isLoading && messages.length > 0 ? (
            <p className="py-1 text-center text-xs text-muted-foreground">
              Loading older messages...
            </p>
          ) : null}
          {loadError && messages.length > 0 ? (
            <p role="alert" className="py-1 text-center text-xs text-danger">
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
            <EmptyState>No messages yet.</EmptyState>
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
      </SidePanel>
    </>
  );
}
