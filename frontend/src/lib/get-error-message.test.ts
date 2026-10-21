import { describe, expect, it } from "vitest";

import { ApiError, REQUEST_TIMEOUT_MESSAGE, SERVER_UNAVAILABLE_MESSAGE } from "./api-client";
import {
  DEFAULT_ERROR_MESSAGE,
  SERVER_ERROR_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  getErrorMessage,
  getRefusalMessage,
} from "./get-error-message";

const apiError = (status: number, data: unknown) => new ApiError("raw", status, data);

describe("getErrorMessage", () => {
  it("uses the API's detail or error message", () => {
    expect(getErrorMessage(apiError(400, { detail: "Battle is not active" }))).toBe(
      "Battle is not active"
    );
    expect(getErrorMessage(apiError(409, { error: "Trade already closed" }))).toBe(
      "Trade already closed"
    );
  });

  it("joins field errors per field, with general errors unprefixed", () => {
    const data = {
      non_field_errors: ["Campaign is full."],
      max_players: ["Ensure this value is less than or equal to 16."],
      name: ["This field is required.", "Too short."],
    };
    expect(getErrorMessage(apiError(400, data))).toBe(
      "Campaign is full. Max players: Ensure this value is less than or equal to 16. Name: This field is required. Too short."
    );
  });

  it("reads the standard { detail, code, fields } shape, preferring the field messages", () => {
    const data = {
      detail: "Invalid input.",
      code: "invalid",
      fields: { gold: ["Not enough gold."] },
    };
    expect(getErrorMessage(apiError(400, data))).toBe("Gold: Not enough gold.");
  });

  it("turns network failures and timeouts into the server-unavailable message", () => {
    expect(getErrorMessage(new TypeError("Failed to fetch"))).toBe(SERVER_UNAVAILABLE_MESSAGE);
    expect(getErrorMessage(new TypeError("Load failed"))).toBe(SERVER_UNAVAILABLE_MESSAGE);
    expect(getErrorMessage(new ApiError(REQUEST_TIMEOUT_MESSAGE, 0, null))).toBe(
      SERVER_UNAVAILABLE_MESSAGE
    );
    expect(getErrorMessage(apiError(503, "<html>Service Unavailable</html>"))).toBe(
      SERVER_UNAVAILABLE_MESSAGE
    );
  });

  it("shows the server's own detail for a 503 it sent on purpose, and the outage text for a bare one", () => {
    const emailOff =
      "Password reset by email isn't switched on yet. Ask the app's admin to reset your password.";
    expect(getErrorMessage(apiError(503, { detail: emailOff, code: "email_unavailable" }))).toBe(
      emailOff
    );
    expect(
      getErrorMessage(apiError(503, { detail: "Unable to send feedback report right now." }))
    ).toBe("Unable to send feedback report right now.");
    expect(getErrorMessage(apiError(503, null))).toBe(SERVER_UNAVAILABLE_MESSAGE);
    expect(getErrorMessage(apiError(503, { detail: "  " }))).toBe(SERVER_UNAVAILABLE_MESSAGE);
    expect(getErrorMessage(apiError(502, { detail: "Bad gateway" }))).toBe(
      SERVER_UNAVAILABLE_MESSAGE
    );
  });

  it("hides internal server errors behind a generic message", () => {
    expect(getErrorMessage(apiError(500, { detail: "IntegrityError at /api/..." }))).toBe(
      SERVER_ERROR_MESSAGE
    );
  });

  it("explains throttling in minutes or seconds", () => {
    const throttled = (seconds: number) =>
      apiError(429, { detail: `Request was throttled. Expected available in ${seconds} seconds.` });
    expect(getErrorMessage(throttled(3540))).toBe("Too many attempts. Try again in 59 minutes.");
    expect(getErrorMessage(throttled(5))).toBe("Too many attempts. Try again in 5 seconds.");
    expect(getErrorMessage(apiError(429, null))).toBe(
      "Too many attempts. Please wait a moment and try again."
    );
  });

  it("says the session expired for a rejected token, but keeps other 401 messages", () => {
    const expired = { detail: "Given token not valid for any token type", code: "token_not_valid" };
    expect(getErrorMessage(apiError(401, expired))).toBe(SESSION_EXPIRED_MESSAGE);
    expect(
      getErrorMessage(
        apiError(401, { detail: "No active account found with the given credentials" })
      )
    ).toBe("No active account found with the given credentials");
  });

  it("falls back for bodies without a message and for programming errors", () => {
    expect(
      getErrorMessage(apiError(404, "<!doctype html><p>Not found</p>"), "Battle not found.")
    ).toBe("Battle not found.");
    expect(getErrorMessage(new TypeError("Cannot read properties of undefined"))).toBe(
      DEFAULT_ERROR_MESSAGE
    );
    expect(getErrorMessage("boom")).toBe(DEFAULT_ERROR_MESSAGE);
    expect(getErrorMessage(new Error("Roll failed"))).toBe("Roll failed");
  });
});

describe("getRefusalMessage", () => {
  it("reads a coded refusal's own detail, not its field errors with the field's name", () => {
    const error = apiError(400, {
      detail: "Type the campaign's name to delete it for good.",
      code: "name_mismatch",
      fields: { name: ["Type the campaign's name to delete it for good."] },
    });

    expect(getRefusalMessage(error)).toBe("Type the campaign's name to delete it for good.");
    expect(getErrorMessage(error)).toBe("Name: Type the campaign's name to delete it for good.");
  });

  it("reads anything else as getErrorMessage does", () => {
    expect(getRefusalMessage(apiError(400, { name: ["Required."] }))).toBe("Name: Required.");
    expect(getRefusalMessage(apiError(500, { detail: "x", code: "boom" }))).toBe(
      SERVER_ERROR_MESSAGE
    );
    expect(getRefusalMessage(new Error("Nope"))).toBe("Nope");
  });
});
