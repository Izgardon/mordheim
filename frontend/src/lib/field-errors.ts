import { useCallback, useState } from "react";

import { ApiError } from "./api-client";
import { flattenFieldErrors, labelledMessages, plainFieldMessage } from "./error-words";
import { getRefusalMessage } from "./get-error-message";

/** One message per field path: "name", "property_ids", "availabilities.0.cost". */
export type FieldErrors = Readonly<Record<string, string>>;

/**
 * An entry whose name a create or rename collided with (400 `name_taken`, backend PR C): the list
 * it lives in, whether it is the book's or the campaign's, and whether it is archived (or a book
 * entry removed for the campaign).
 */
export type NameMatch = {
  kind: string;
  id: number;
  name: string;
  type: string | null;
  source: "book" | "campaign";
  archived: boolean;
  /** "Edit this instead" may show (never a book entry in a workshop, nor an archived one). */
  editable: boolean;
  /** Restore may show: archived, and not in a workshop, which keeps no archive. */
  restorable: boolean;
};

/** A `name_taken` refusal's matches (none for any other error). */
export function nameMatchesOf(error: unknown): NameMatch[] {
  if (!(error instanceof ApiError) || error.status !== 400) return [];
  const body = error.data as { code?: unknown; matches?: unknown } | null;
  return body && body.code === "name_taken" && Array.isArray(body.matches)
    ? (body.matches as NameMatch[])
    : [];
}

const GENERAL_KEYS = new Set(["detail", "code", "error", "non_field_errors", "usage", "matches"]);

/** A 400's messages by field path, nested rows under their index: "availabilities.0.cost". */
function messagesOf(error: unknown): Record<string, string[]> {
  if (!(error instanceof ApiError) || error.status !== 400) return {};
  const body = error.data;
  if (!body || typeof body !== "object" || Array.isArray(body)) return {};
  const record = body as Record<string, unknown>;
  const source =
    record.fields && typeof record.fields === "object"
      ? (record.fields as Record<string, unknown>)
      : Object.fromEntries(Object.entries(record).filter(([key]) => !GENERAL_KEYS.has(key)));
  return flattenFieldErrors(source);
}

/**
 * The field messages of a 400, for under their fields: the standard body's `fields` (e.g. 400
 * `name_taken` on `name`), or DRF's own `{field: [msg]}` shape with nested rows flattened to
 * paths, DRF's stock messages in plain words ("This is needed.").
 */
export function fieldErrorsOf(error: unknown): FieldErrors {
  return Object.fromEntries(
    Object.entries(messagesOf(error)).map(([path, messages]) => [
      path,
      messages.map(plainFieldMessage).join(" "),
    ])
  );
}

/** Whether a form shows this path by a field: an exact name, or a pattern like "rows.*.cost". */
const matches = (pattern: string, path: string) =>
  new RegExp(`^${pattern.replace(/\./g, "\\.").replace(/\*/g, "\\d+")}$`).test(path);

/**
 * A refusal split between the fields a form shows (`shown`) and one line for the rest: the
 * first message no field shows, with its field's name, or the refusal's own reason when it names
 * no field at all.
 */
export function formRefusal(error: unknown, shown: readonly string[], fallback: string) {
  const all = messagesOf(error);
  const fields: Record<string, string> = {};
  let message = "";
  for (const [path, messages] of Object.entries(all)) {
    if (shown.some((pattern) => matches(pattern, path))) {
      fields[path] = messages.map(plainFieldMessage).join(" ");
    } else if (!message) {
      message = labelledMessages(path, messages);
    }
  }
  if (Object.keys(all).length === 0) {
    message = getRefusalMessage(error, fallback);
  }
  return { fields: fields as FieldErrors, message };
}

const NO_MATCHES: NameMatch[] = [];

/**
 * A form's field errors from the server, cleared before each save and whenever `resetKey`
 * changes (e.g. the entry being edited), with a taken name's matches.
 */
export function useFieldErrors(shown: readonly string[], resetKey?: unknown) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [matches, setMatches] = useState<NameMatch[]>(NO_MATCHES);
  const [errorsKey, setErrorsKey] = useState(resetKey);
  const clear = useCallback(() => {
    setErrors({});
    setMatches(NO_MATCHES);
  }, []);
  if (errorsKey !== resetKey) {
    setErrorsKey(resetKey);
    setErrors({});
    setMatches(NO_MATCHES);
  }
  return {
    errors,
    /** The entries a taken name collided with (400 `name_taken`). */
    matches,
    /** Stable, so a form's reset can depend on it. */
    clear,
    /** Puts a refusal's messages on the fields shown and returns the rest as one line. */
    take: (error: unknown, fallback: string) => {
      const refusal = formRefusal(error, shown, fallback);
      setErrors(refusal.fields);
      setMatches(nameMatchesOf(error));
      return refusal.message;
    },
    /** The form's own checks before sending, shown as the server's would be. */
    show: (fields: FieldErrors) => {
      setErrors(fields);
      setMatches(NO_MATCHES);
    },
    /** A match restored from the list: it is in the catalogue again, so it can be edited. */
    markRestored: (id: number) =>
      setMatches((current) =>
        current.map((match) =>
          match.id === id ? { ...match, archived: false, restorable: false, editable: true } : match
        )
      ),
  };
}

export type FieldErrorsState = ReturnType<typeof useFieldErrors>;
