import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { contentArrived } from "./content-arrived";

const stale = (client: QueryClient, key: readonly unknown[]) =>
  client.getQueryState(key)?.isInvalidated ?? false;

function seeded() {
  const client = new QueryClient();
  client.setQueryData(["campaign", 4, "catalogue", "items"], []);
  client.setQueryData(["campaign", 4, "catalogue", "skills"], []);
  client.setQueryData(["campaign", 4, "warband", 9, "sheet"], {});
  client.setQueryData(["campaign", 5, "catalogue", "items"], []);
  return client;
}

describe("contentArrived", () => {
  it("reads the campaign's catalogue again, every kind, when a copy brought custom content", () => {
    const client = seeded();
    contentArrived(client, 4, [
      { code: "custom_content_archived", message: "", names: ["Axe (2)"] },
    ]);
    expect(stale(client, ["campaign", 4, "catalogue", "items"])).toBe(true);
    expect(stale(client, ["campaign", 4, "catalogue", "skills"])).toBe(true);
    expect(stale(client, ["campaign", 4, "warband", 9, "sheet"])).toBe(false);
    expect(stale(client, ["campaign", 5, "catalogue", "items"])).toBe(false);
  });

  it("reads nothing again when none came", () => {
    const client = seeded();
    contentArrived(client, 4, [{ code: "not_in_play", message: "" }]);
    expect(stale(client, ["campaign", 4, "catalogue", "items"])).toBe(false);
  });
});
