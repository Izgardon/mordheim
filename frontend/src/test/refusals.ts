/**
 * The catalogue write refusals of the backend's PR A contract, as apiRequest throws them, and the
 * one assertion every form shares: the message under its field, once, with the field invalid.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { expect } from "vitest";

import { ApiError } from "@/lib/api-client";

/** 400 `duplicate_entry` on create or rename: `what` as the contract words it per kind. */
export function duplicateEntry(what: string) {
  const detail = `This campaign already has ${what}.`;
  return {
    detail,
    error: new ApiError(detail, 400, {
      detail,
      code: "duplicate_entry",
      fields: { name: [detail] },
    }),
  };
}

/** A DRF validation 400: `{field: [msg]}`, nested rows as lists of objects. */
export const validationError = (body: Record<string, unknown>) =>
  new ApiError("Invalid input.", 400, body);

/** The message shows under `input` (its field's alert), once on the page, and marks it invalid. */
export async function expectFieldError(input: HTMLElement, message: string) {
  await waitFor(() => expect(input).toHaveAttribute("aria-invalid", "true"));
  expect(within(input.parentElement!).getByRole("alert")).toHaveTextContent(message);
  expect(screen.getAllByText(message)).toHaveLength(1);
}
