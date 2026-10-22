import { describe, expect, it } from "vitest";

import { ApiError } from "./api-client";
import { fieldErrorsOf, formRefusal, nameMatchesOf } from "./field-errors";

const DUPLICATE = "Infiltration is already in the catalogue. Edit one instead.";
const MATCH = {
  kind: "skills",
  id: 1,
  name: "Infiltration",
  type: "Dark Elf",
  source: "book",
  archived: false,
};
const duplicate = new ApiError(DUPLICATE, 400, {
  detail: DUPLICATE,
  code: "name_taken",
  fields: { name: [DUPLICATE] },
  matches: [MATCH],
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

describe("nameMatchesOf", () => {
  it("reads a name_taken refusal's matches, and none from anything else", () => {
    expect(nameMatchesOf(duplicate)).toEqual([MATCH]);
    expect(nameMatchesOf(nested)).toEqual([]);
    expect(nameMatchesOf(new Error("offline"))).toEqual([]);
  });

  it("keeps the matches out of the field messages", () => {
    const bare = new ApiError(DUPLICATE, 400, { name: [DUPLICATE], matches: [MATCH] });
    expect(fieldErrorsOf(bare)).toEqual({ name: DUPLICATE });
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
