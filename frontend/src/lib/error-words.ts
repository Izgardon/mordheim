/**
 * A refusal's field errors in a player's words: the field's own label for its path
 * ("create.0.name" is Name), and DRF's stock messages said plainly ("This field may not be
 * null." is "Name is needed."). A message the server words itself is kept as it is.
 */

/** The batch and standard-body wrappers around an entry's fields: never a field themselves. */
const CONTAINERS = new Set(["create", "update", "dismiss", "fields"]);
/** Keys that hold the refusal's own reason, not one field's. */
const GENERAL = new Set(["non_field_errors", "detail", "error"]);
/** Field names that don't read as their own words. */
const LABELS: Record<string, string> = { unit_type: "Type", xp: "XP" };

/** A field's label from its path ("create.0.name" → "Name"), or null when it names no field. */
export function fieldLabel(path: string): string | null {
  const segments = path.split(".").filter((part) => part && !/^\d+$/.test(part));
  const last = segments[segments.length - 1];
  if (!last || GENERAL.has(last) || (segments.length === 1 && CONTAINERS.has(last))) {
    return null;
  }
  if (LABELS[last]) return LABELS[last];
  const words = last
    .replace(/_ids?$/, "")
    .replace(/_/g, " ")
    .trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

type Stock = {
  pattern: RegExp;
  /** Under its field, whose label is beside it. */
  plain: (match: RegExpMatchArray) => string;
  /** In one line with the others, naming the field. */
  labelled: (label: string, match: RegExpMatchArray) => string;
};

// DRF's stock messages (rest_framework/fields.py, relations.py)
const STOCK: Stock[] = [
  {
    pattern: /^This field (?:may not be null|is required|may not be blank)\.$/,
    plain: () => "This is needed.",
    labelled: (label) => `${label} is needed.`,
  },
  {
    pattern: /^This list may not be empty\.$/,
    plain: () => "Pick at least one.",
    labelled: (label) => `${label} needs at least one.`,
  },
  {
    pattern: /^A valid integer is required\.$/,
    plain: () => "Must be a whole number.",
    labelled: (label) => `${label} must be a whole number.`,
  },
  {
    pattern: /^A valid number is required\.$/,
    plain: () => "Must be a number.",
    labelled: (label) => `${label} must be a number.`,
  },
  {
    pattern: /^Ensure this value is greater than or equal to (-?[\d.]+)\.$/,
    plain: (m) => `Must be ${m[1]} or more.`,
    labelled: (label, m) => `${label} must be ${m[1]} or more.`,
  },
  {
    pattern: /^Ensure this value is less than or equal to (-?[\d.]+)\.$/,
    plain: (m) => `Must be ${m[1]} or less.`,
    labelled: (label, m) => `${label} must be ${m[1]} or less.`,
  },
  {
    pattern: /^Ensure this field has no more than (\d+) characters\.$/,
    plain: (m) => `${m[1]} characters at most.`,
    labelled: (label, m) => `${label} can be ${m[1]} characters at most.`,
  },
  {
    pattern: /^Ensure this field has at least (\d+) characters\.$/,
    plain: (m) => `At least ${m[1]} characters.`,
    labelled: (label, m) => `${label} needs at least ${m[1]} characters.`,
  },
  {
    pattern: /^".*" is not a valid choice\.$/,
    plain: () => "Not one of the choices.",
    labelled: (label) => `${label} isn't one of the choices.`,
  },
  {
    pattern: /^Invalid pk ".*" - object does not exist\.$/,
    plain: () => "Not found.",
    labelled: (label) => `${label} wasn't found.`,
  },
];

const stockOf = (message: string) => {
  for (const stock of STOCK) {
    const match = message.match(stock.pattern);
    if (match) return { stock, match };
  }
  return null;
};

/** A message for under its field: DRF's stock ones plainly, the server's own as they are. */
export function plainFieldMessage(message: string): string {
  const found = stockOf(message);
  return found ? found.stock.plain(found.match) : message;
}

/**
 * A field's messages in one line naming it: "Name is needed.", "Gold: Not enough gold.", and a
 * refusal's own reason with no name at all.
 */
export function labelledMessages(path: string, messages: readonly string[]): string {
  const label = fieldLabel(path);
  if (!label) return messages.map(plainFieldMessage).join(" ");
  let named = false;
  return messages
    .map((message) => {
      const found = stockOf(message);
      if (found) {
        named = true;
        return found.stock.labelled(label, found.match);
      }
      const line = named ? message : `${label}: ${message}`;
      named = true;
      return line;
    })
    .join(" ");
}

const KEPT_OUT = new Set(["code", "usage", "matches"]);

/**
 * An error body's field messages by path, nested rows flattened under their index:
 * {"create": [{"name": [msg]}]} is {"create.0.name": [msg]}. `code`, `usage` and a taken name's
 * `matches` are not messages.
 */
export function flattenFieldErrors(source: Record<string, unknown>): Record<string, string[]> {
  const into: Record<string, string[]> = {};
  const walk = (value: unknown, path: string) => {
    if (typeof value === "string") {
      if (value.trim()) (into[path] ??= []).push(value.trim());
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry, index) =>
        typeof entry === "string" ? walk(entry, path) : walk(entry, `${path}.${index}`)
      );
      return;
    }
    if (value && typeof value === "object") {
      Object.entries(value).forEach(([key, entry]) => walk(entry, `${path}.${key}`));
    }
  };
  Object.entries(source).forEach(([key, value]) => {
    if (!KEPT_OUT.has(key)) walk(value, key);
  });
  return into;
}
