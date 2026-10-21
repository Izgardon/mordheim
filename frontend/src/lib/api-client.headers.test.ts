/**
 * Pass 6 characterisation: the headers the real `apiRequest` puts on the wire, through a fake
 * `fetch`: the bearer token, `Content-Type`, and the socket id writes carry (ECON-PERF-02).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { socketIdHeaders } from "@/lib/realtime/socket-headers";
import { accessToken, RAIDER } from "@/test/auth-fixtures";
import { fakeFetch, json } from "@/test/fake-fetch";
import { setRefreshToken, setToken } from "@/utils/storage";
import { apiRequest } from "./api-client";

const socket = vi.hoisted(() => ({ id: null as string | null }));

vi.mock("@/lib/realtime/client", () => ({ realtimeSocketId: () => socket.id }));

const STORED = accessToken(RAIDER.id, "stored");
const NEW_ACCESS = accessToken(RAIDER.id, "new");

const lastRequest = () => fakeFetch.requests()[fakeFetch.requests().length - 1];

beforeEach(() => {
  localStorage.clear();
  setToken(STORED);
  setRefreshToken("refresh-1");
  socket.id = null;
  fakeFetch.install();
});

afterEach(() => {
  fakeFetch.uninstall();
});

describe("apiRequest headers", () => {
  it("sends Content-Type: application/json on a GET with no body, beside the stored token (PERF-05, pinned; parked)", async () => {
    // Characterises current behaviour (PERF-05, pinned; parked with the same-origin API)
    fakeFetch.on("GET /campaigns/", json(200, []));

    await apiRequest("/campaigns/");

    expect(lastRequest()).toEqual({
      method: "GET",
      path: "/campaigns/",
      headers: { "content-type": "application/json", authorization: `Bearer ${STORED}` },
    });
  });

  it("sends no Authorization for token: null, though a session is stored", async () => {
    fakeFetch.on("POST /auth/password-reset/", json(200, { detail: "sent" }));

    await apiRequest("/auth/password-reset/", {
      method: "POST",
      body: { email: RAIDER.email },
      token: null,
    });

    expect(lastRequest().headers).toEqual({ "content-type": "application/json" });
    expect(lastRequest().body).toEqual({ email: RAIDER.email });
  });

  it("sends an explicit token in place of the stored one, as the boot /auth/me does", async () => {
    fakeFetch.on("GET /auth/me/", json(200, RAIDER));

    await apiRequest("/auth/me/", { token: "explicit" });

    expect(lastRequest().headers.authorization).toBe("Bearer explicit");
  });
});

describe("the X-Pusher-Socket-Id header", () => {
  it("goes on the wire from socketIdHeaders(), and again on the retry after a refresh, with the new token", async () => {
    socket.id = "123.456";
    fakeFetch.on("POST /auth/refresh/", json(200, { access: NEW_ACCESS }));
    fakeFetch.on("POST /campaigns/1/messages/", ({ headers }) =>
      headers.authorization === `Bearer ${NEW_ACCESS}`
        ? json(201, { id: 9 })
        : json(401, { detail: "Given token not valid for any token type" })
    );

    await apiRequest("/campaigns/1/messages/", {
      method: "POST",
      body: { body: "Hold the bridge" },
      headers: socketIdHeaders(),
    });

    const writes = fakeFetch
      .requests()
      .filter((request) => request.path === "/campaigns/1/messages/");
    expect(writes).toHaveLength(2);
    expect(writes.map((request) => request.headers["x-pusher-socket-id"])).toEqual([
      "123.456",
      "123.456",
    ]);
    expect(writes[1].headers.authorization).toBe(`Bearer ${NEW_ACCESS}`);
    expect(writes[1].body).toEqual({ body: "Hold the bridge" });
    expect(writes[1].method).toBe("POST");
  });

  it("is left out while the socket has no id", async () => {
    fakeFetch.on("POST /campaigns/1/messages/", json(201, { id: 9 }));

    await apiRequest("/campaigns/1/messages/", {
      method: "POST",
      body: { body: "Hold the bridge" },
      headers: socketIdHeaders(),
    });

    expect(socketIdHeaders()).toBeUndefined();
    expect(lastRequest().headers).not.toHaveProperty("x-pusher-socket-id");
  });
});
