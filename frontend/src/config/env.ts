export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

// Realtime (Pusher in production; soketi, a Pusher-compatible server, in local docker-compose).
export const PUSHER_KEY = (import.meta.env.VITE_PUSHER_KEY as string | undefined) || "";
export const PUSHER_CLUSTER = (import.meta.env.VITE_PUSHER_CLUSTER as string | undefined) || "";
export const PUSHER_AUTH_ENDPOINT =
  (import.meta.env.VITE_PUSHER_AUTH_ENDPOINT as string | undefined) ||
  `${API_BASE_URL}/realtime/pusher/auth/`;
export const PUSHER_HOST = (import.meta.env.VITE_PUSHER_HOST as string | undefined) || "";
export const PUSHER_PORT = Number(import.meta.env.VITE_PUSHER_PORT || 6001);
export const PUSHER_FORCE_TLS = import.meta.env.VITE_PUSHER_FORCE_TLS !== "0";
