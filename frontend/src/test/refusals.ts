/**
 * The catalogue write refusals of the backend's contract, as apiRequest throws them, and the one
 * assertion every form shares: the message under its field, once, with the field invalid.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { expect } from "vitest";

import { ApiError } from "@/lib/api-client";
import type { NameMatch } from "@/lib/field-errors";

/** One of a `name_taken` refusal's matches (a book entry, live, unless overridden). */
export const nameMatch = (overrides: Partial<NameMatch> = {}): NameMatch => ({
  kind: "skills",
  id: 1,
  name: "Infiltration",
  type: null,
  source: "book",
  archived: false,
  ...overrides,
});

/**
 * 400 `name_taken` on a create or rename (backend PR C, CAT-TWEAK-02): the name is the book's or
 * the campaign's already; `matches` lists every entry it collided with.
 */
export function nameTaken(name: string, matches: NameMatch[] = []) {
  const detail = `${name} is already in the catalogue. Edit one instead.`;
  return {
    detail,
    error: new ApiError(detail, 400, {
      detail,
      code: "name_taken",
      fields: { name: [detail] },
      matches,
    }),
  };
}

/** A DRF validation 400: `{field: [msg]}`, nested rows as lists of objects. */
export const validationError = (body: Record<string, unknown>) =>
  new ApiError("Invalid input.", 400, body);

/**
 * The message shows under `input` (its field's alert), once on the page, and marks it invalid;
 * with `describedBy`, the input names the message as its description.
 */
export async function expectFieldError(
  input: HTMLElement,
  message: string,
  { describedBy = false }: { describedBy?: boolean } = {}
) {
  await waitFor(() => expect(input).toHaveAttribute("aria-invalid", "true"));
  // The field's container: the nearest ancestor holding an alert (a number input wraps its box).
  let field = input.parentElement;
  while (field && !within(field).queryByRole("alert")) field = field.parentElement;
  expect(within(field!).getByRole("alert")).toHaveTextContent(message);
  expect(screen.getAllByText(message)).toHaveLength(1);
  if (describedBy) {
    expect(input).toHaveAccessibleDescription(expect.stringContaining(message));
  }
}
