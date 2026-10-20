import { ApiError, SERVER_UNAVAILABLE_MESSAGE } from "./api-client";

export const DEFAULT_ERROR_MESSAGE = "Something went wrong. Please try again.";
export const SERVER_ERROR_MESSAGE = "The server ran into a problem. Please try again.";
export const SESSION_EXPIRED_MESSAGE = "Your session has expired. Please sign in again.";

/** What fetch rejects with when the request never reached the server (Chrome, Firefox, Safari). */
const NETWORK_ERROR_PATTERN = /failed to fetch|networkerror|load failed|network request failed/i;

const humanizeField = (field: string) => {
  const words = field.replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const toMessages = (value: unknown): string[] => {
  if (typeof value === "string") {
    return value.trim() ? [value.trim()] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(toMessages);
  }
  return [];
};

/** "name: [msg]" maps (DRF validation errors, or the `fields` of the standard error shape). */
const fieldMessages = (fields: Record<string, unknown>) =>
  Object.entries(fields).flatMap(([field, value]) => {
    const messages = toMessages(value);
    if (messages.length === 0) {
      return [];
    }
    const isGeneral = field === "non_field_errors" || field === "detail" || field === "error";
    return isGeneral ? messages : [`${humanizeField(field)}: ${messages.join(" ")}`];
  });

/** The readable message in an API error body, whichever of the backend's shapes it uses. */
function messageFromBody(data: unknown): string | null {
  if (typeof data === "string") {
    // An HTML error page from a proxy is not a message.
    return data.trim() && !data.trimStart().startsWith("<") ? data.trim() : null;
  }
  if (Array.isArray(data)) {
    return toMessages(data).join(" ") || null;
  }
  if (!data || typeof data !== "object") {
    return null;
  }
  const body = data as Record<string, unknown>;
  const fields = body.fields && typeof body.fields === "object" ? body.fields : null;
  if (fields) {
    const messages = fieldMessages(fields as Record<string, unknown>);
    if (messages.length > 0) {
      return messages.join(" ");
    }
  }
  for (const key of ["error", "detail"]) {
    const messages = toMessages(body[key]);
    if (messages.length > 0) {
      return messages.join(" ");
    }
  }
  return fieldMessages(body).join(" ") || null;
}

/** The stable `code` of an API error body (e.g. "hero_cap_reached"), if it has one. */
export function apiErrorCode(error: unknown): string | null {
  if (!(error instanceof ApiError) || !error.data || typeof error.data !== "object") {
    return null;
  }
  const code = (error.data as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

/** DRF's throttle detail: "Request was throttled. Expected available in 42 seconds." */
function throttledMessage(data: unknown) {
  const detail = toMessages((data as { detail?: unknown } | null)?.detail).join(" ");
  const seconds = Number(detail.match(/available in (\d+)/i)?.[1]);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (seconds < 60) {
    return `Too many attempts. Try again in ${seconds} second${seconds === 1 ? "" : "s"}.`;
  }
  const minutes = Math.ceil(seconds / 60);
  return `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

/**
 * The one way to turn a caught error into text for the user (IMP-10): the API's own message,
 * field errors joined per field, and plain words for outages, timeouts and throttling instead of
 * "Failed to fetch" or a raw status code.
 */
export function getErrorMessage(error: unknown, fallback = DEFAULT_ERROR_MESSAGE): string {
  if (error instanceof ApiError) {
    if (
      error.status === 0 ||
      error.status === 502 ||
      error.status === 503 ||
      error.status === 504
    ) {
      return SERVER_UNAVAILABLE_MESSAGE; // network failure, timeout, or the server is waking up
    }
    if (error.status >= 500) {
      return SERVER_ERROR_MESSAGE;
    }
    if (error.status === 429) {
      return throttledMessage(error.data);
    }
    if (
      error.status === 401 &&
      (error.data as { code?: unknown } | null)?.code === "token_not_valid"
    ) {
      return SESSION_EXPIRED_MESSAGE; // not "Given token not valid for any token type"
    }
    return messageFromBody(error.data) ?? fallback;
  }
  if (error instanceof TypeError && NETWORK_ERROR_PATTERN.test(error.message)) {
    return SERVER_UNAVAILABLE_MESSAGE;
  }
  if (error instanceof Error && error.message && !(error instanceof TypeError)) {
    return error.message;
  }
  return fallback;
}

/**
 * A refusal in the standard body (`{detail, code, fields}`) is summed up by its own `detail`
 * ("Type the campaign's name to delete it for good."), better than its field errors restated
 * with the field's name; anything else reads through getErrorMessage.
 */
export function getRefusalMessage(error: unknown, fallback = DEFAULT_ERROR_MESSAGE): string {
  if (apiErrorCode(error) && error instanceof ApiError && error.status < 500) {
    const detail = toMessages((error.data as { detail?: unknown }).detail).join(" ");
    if (detail) {
      return detail;
    }
  }
  return getErrorMessage(error, fallback);
}
