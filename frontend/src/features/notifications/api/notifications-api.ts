import { apiRequest } from "@/lib/api-client";

export type AppNotification = {
  id: number;
  notification_type: "trade_request" | "battle_invite" | "battle_result_request" | "battle_nudge";
  campaign_id: number;
  reference_id: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export function listNotifications() {
  return apiRequest<AppNotification[]>("/notifications/");
}

export function clearNotification(notificationId: number) {
  return apiRequest<{ ok: boolean }>(`/notifications/${notificationId}/clear/`, { method: "POST" });
}

/** Resolves what can no longer be answered (CAMP-TWEAK-10): how many went, and how many stay. */
export function clearAllNotifications() {
  return apiRequest<{ ok: boolean; cleared: number; kept: number }>("/notifications/clear-all/", {
    method: "POST",
  });
}
