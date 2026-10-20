import { useState } from "react";

import { ApiError } from "./api-client";
import { getRefusalMessage } from "./get-error-message";

/** One message per field path: "name", "property_ids", "availabilities.0.cost". */
export type FieldErrors = Readonly<Record<string, string>>;

const GENERAL_KEYS = new Set(["detail", "code", "error", "non_field_errors", "usage"]);

function flatten(value: unknown, path: string, into: Record<string, string>) {
  if (typeof value === "string") {
    if (value.trim() && !into[path]) into[path] = value.trim();
    return;
  }
  if (Array.isArray(value)) {
    const messages = value.filter((entry): entry is string => typeof entry === "string");
    if (messages.length > 0) {
      into[path] = messages.join(" ");
      return;
    }
    // A nested list's errors, one object per row: {"availabilities": [{"cost": [...]}, {}]}.
    value.forEach((entry, index) => flatten(entry, `${path}.${index}`, into));
    return;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, entry]) => flatten(entry, `${path}.${key}`, into));
  }
}

/**
 * The field messages of a 400: the standard body's `fields` (e.g. 400 `duplicate_entry` on
 * `name`), or DRF's own `{field: [msg]}` shape with nested rows flattened to paths.
 */
export function fieldErrorsOf(error: unknown): FieldErrors {
  if (!(error instanceof ApiError) || error.status !== 400) return {};
  const body = error.data;
  if (!body || typeof body !== "object" || Array.isArray(body)) return {};
  const record = body as Record<string, unknown>;
  const source =
    record.fields && typeof record.fields === "object"
      ? (record.fields as Record<string, unknown>)
      : Object.fromEntries(Object.entries(record).filter(([key]) => !GENERAL_KEYS.has(key)));
  const into: Record<string, string> = {};
  Object.entries(source).forEach(([key, value]) => flatten(value, key, into));
  return into;
}

const humanize = (path: string) => {
  const words = path
    .split(".")[0]
    .replace(/_ids?$/, "")
    .replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** Whether a form shows this path by a field: an exact name, or a pattern like "rows.*.cost". */
const matches = (pattern: string, path: string) =>
  new RegExp(`^${pattern.replace(/\./g, "\\.").replace(/\*/g, "\\d+")}$`).test(path);

/**
 * A refusal split between the fields a form shows (`shown`) and one line for the rest: the
 * first message no field shows, with its field's name, or the refusal's own reason when it names
 * no field at all.
 */
export function formRefusal(error: unknown, shown: readonly string[], fallback: string) {
  const all = fieldErrorsOf(error);
  const fields: Record<string, string> = {};
  let message = "";
  for (const [path, text] of Object.entries(all)) {
    if (shown.some((pattern) => matches(pattern, path))) {
      fields[path] = text;
    } else if (!message) {
      message = `${humanize(path)}: ${text}`;
    }
  }
  if (Object.keys(all).length === 0) {
    message = getRefusalMessage(error, fallback);
  }
  return { fields: fields as FieldErrors, message };
}

/**
 * A form's field errors from the server, cleared before each save and whenever `resetKey`
 * changes (e.g. the entry being edited).
 */
export function useFieldErrors(shown: readonly string[], resetKey?: unknown) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [errorsKey, setErrorsKey] = useState(resetKey);
  if (errorsKey !== resetKey) {
    setErrorsKey(resetKey);
    setErrors({});
  }
  return {
    errors,
    clear: () => setErrors({}),
    /** Puts a refusal's messages on the fields shown and returns the rest as one line. */
    take: (error: unknown, fallback: string) => {
      const refusal = formRefusal(error, shown, fallback);
      setErrors(refusal.fields);
      return refusal.message;
    },
  };
}
