import { describe, expect, it } from "vitest";

import { ApiError } from "./api-client";
import { fieldErrorsOf, formRefusal } from "./field-errors";

const DUPLICATE = "This campaign already has a skill with this name and type.";
const duplicate = new ApiError(DUPLICATE, 400, {
  detail: DUPLICATE,
  code: "duplicate_entry",
  fields: { name: [DUPLICATE] },
});
const nested = new ApiError("Invalid", 400, {
  availabilities: [{ cost: ["Ensure this value is greater than or equal to 0."] }, {}],
  property_ids: ['Invalid pk "12" - object does not exist.'],
});

describe("fieldErrorsOf", () => {
  it("reads the standard body's fields", () => {
    expect(fieldErrorsOf(duplicate)).toEqual({ name: DUPLICATE });
  });

  it("reads DRF's shape, with a nested row's errors under its index", () => {
    expect(fieldErrorsOf(nested)).toEqual({
      "availabilities.0.cost": "Ensure this value is greater than or equal to 0.",
      property_ids: 'Invalid pk "12" - object does not exist.',
    });
  });

  it("reads nothing from a refusal that isn't a 400", () => {
    expect(fieldErrorsOf(new ApiError("Forbidden", 403, { detail: "Forbidden" }))).toEqual({});
    expect(fieldErrorsOf(new Error("offline"))).toEqual({});
  });
});

describe("formRefusal", () => {
  it("puts the messages on the fields a form shows, rows matched by pattern", () => {
    expect(formRefusal(nested, ["availabilities.*.cost", "property_ids"], "x")).toEqual({
      fields: {
        "availabilities.0.cost": "Ensure this value is greater than or equal to 0.",
        property_ids: 'Invalid pk "12" - object does not exist.',
      },
      message: "",
    });
  });

  it("names the first field the form doesn't show in the line under the form", () => {
    expect(formRefusal(nested, ["name"], "x")).toEqual({
      fields: {},
      message: "Availabilities: Ensure this value is greater than or equal to 0.",
    });
  });

  it("gives a refusal with no field its own reason", () => {
    expect(
      formRefusal(new ApiError("Forbidden", 403, { detail: "Forbidden" }), ["name"], "x")
    ).toEqual({ fields: {}, message: "Forbidden" });
  });
});
