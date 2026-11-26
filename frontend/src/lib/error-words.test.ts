import { describe, expect, it } from "vitest";

import { fieldLabel, flattenFieldErrors, labelledMessages, plainFieldMessage } from "./error-words";

describe("fieldLabel", () => {
  it("reads a path as its field's label, without indexes or the batch's wrappers", () => {
    expect(fieldLabel("create.0.name")).toBe("Name");
    expect(fieldLabel("availabilities.2.cost_note")).toBe("Cost note");
    expect(fieldLabel("update.1.unit_type")).toBe("Type");
    expect(fieldLabel("skill_ids")).toBe("Skill");
    expect(fieldLabel("xp")).toBe("XP");
  });

  it("names no field for an entry's or the refusal's own reason", () => {
    expect(fieldLabel("create.0")).toBeNull();
    expect(fieldLabel("dismiss.3")).toBeNull();
    expect(fieldLabel("non_field_errors")).toBeNull();
    expect(fieldLabel("update.0.non_field_errors")).toBeNull();
  });
});

describe("DRF's stock messages", () => {
  it("are plain under their field", () => {
    expect(plainFieldMessage("This field may not be null.")).toBe("This is needed.");
    expect(plainFieldMessage("This field is required.")).toBe("This is needed.");
    expect(plainFieldMessage("This field may not be blank.")).toBe("This is needed.");
    expect(plainFieldMessage("A valid integer is required.")).toBe("Must be a whole number.");
    expect(plainFieldMessage("Ensure this field has no more than 40 characters.")).toBe(
      "40 characters at most."
    );
    expect(plainFieldMessage('"giant" is not a valid choice.')).toBe("Not one of the choices.");
  });

  it("name their field in one line", () => {
    expect(labelledMessages("create.0.name", ["This field may not be null."])).toBe(
      "Name is needed."
    );
    expect(labelledMessages("price", ["Ensure this value is greater than or equal to 0."])).toBe(
      "Price must be 0 or more."
    );
    expect(labelledMessages("warband_id", ['Invalid pk "4" - object does not exist.'])).toBe(
      "Warband wasn't found."
    );
  });

  it("leave the server's own words as they are", () => {
    expect(plainFieldMessage("Not enough gold.")).toBe("Not enough gold.");
    expect(labelledMessages("gold", ["Not enough gold."])).toBe("Gold: Not enough gold.");
    expect(labelledMessages("create.0", ["The warband already has 6 heroes."])).toBe(
      "The warband already has 6 heroes."
    );
  });
});

describe("flattenFieldErrors", () => {
  it("puts nested rows under their index and leaves out what isn't a message", () => {
    expect(
      flattenFieldErrors({
        create: [{ name: ["This field may not be null."] }, {}],
        "update.0.xp": ["A valid number is required."],
        code: "invalid",
        matches: [{ id: 1 }],
      })
    ).toEqual({
      "create.0.name": ["This field may not be null."],
      "update.0.xp": ["A valid number is required."],
    });
  });
});
