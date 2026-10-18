import { ApiError } from "@/lib/api-client";

/**
 * A refused batch Save's messages, sorted onto the forms they are about (UX-05). The server
 * keys them by their place in the request: `create.1.name`, `update.0.xp`, `dismiss.0`,
 * `purchases.1.price`, `stash_takes.0.quantity`.
 */
export type BatchErrors<F> = {
  byForm: Map<F, string[]>;
  /** Messages about no particular form (a dismissal, a malformed body). */
  general: string[];
  /** The server's summary line, e.g. "Some of the changes are invalid; nothing was saved." */
  detail: string;
};

const toMessages = (value: unknown): string[] =>
  typeof value === "string"
    ? [value]
    : Array.isArray(value)
      ? value.flatMap(toMessages)
      : value && typeof value === "object"
        ? Object.values(value).flatMap(toMessages)
        : [];

/** "weapon_skill" → "Weapon skill", "henchmen.1.cost" → "Henchmen 2 cost". */
const humanizePath = (path: string[]) => {
  const words = path
    .map((part) => (/^\d+$/.test(part) ? String(Number(part) + 1) : part.replace(/_/g, " ")))
    .join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** Fields the message reads well without (`update.0.updated_at`: "...reload it"). */
const UNNAMED_FIELDS = new Set(["id", "updated_at"]);

export function sortBatchErrors<F>(
  error: unknown,
  createForms: readonly F[],
  updateForms: readonly F[],
  /** Each line's form in the other sections (`purchases`, `stash_takes`). */
  lineForms: Record<string, readonly (F | undefined)[]> = {}
): BatchErrors<F> | null {
  if (!(error instanceof ApiError) || !error.data || typeof error.data !== "object") {
    return null;
  }
  const body = error.data as { detail?: unknown; fields?: unknown };
  if (!body.fields || typeof body.fields !== "object") {
    return null;
  }
  const byForm = new Map<F, string[]>();
  const general: string[] = [];
  for (const [key, value] of Object.entries(body.fields as Record<string, unknown>)) {
    const [section, index, ...rest] = key.split(".");
    const forms =
      section === "create" ? createForms : section === "update" ? updateForms : lineForms[section];
    const form = index !== undefined ? forms?.[Number(index)] : undefined;
    const prefix = rest.length > 0 && !UNNAMED_FIELDS.has(rest[0]) ? `${humanizePath(rest)}: ` : "";
    const messages = toMessages(value).map((message) => `${prefix}${message}`);
    if (form !== undefined) {
      byForm.set(form, [...(byForm.get(form) ?? []), ...messages]);
    } else {
      general.push(...messages);
    }
  }
  const detail = typeof body.detail === "string" && body.detail ? body.detail : error.message || "";
  return { byForm, general, detail };
}
