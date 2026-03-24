import { apiRequest } from "@/lib/api-client";

export type AppNotification = {
  id: number;
  notification_type: "trade_request" | "battle_invite" | "battle_result_request";
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

export function clearAllNotifications() {
  return apiRequest<{ ok: boolean }>("/notifications/clear-all/", { method: "POST" });
}
