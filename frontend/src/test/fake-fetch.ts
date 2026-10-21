/**
 * A fake server behind the global `fetch`, for tests that run the real `apiRequest`: its token
 * refresh, retries, headers and error messages. (`fake-api.ts` replaces `apiRequest` instead.)
 *
 *   beforeEach(() => fakeFetch.install());
 *   afterEach(() => fakeFetch.uninstall());
 *
 * Answer with `fakeFetch.on("POST /auth/refresh/", json(200, { access: "new" }))`, or with a
 * function of the request. Every request is recorded with its headers. A request with no route
 * answers 404, so nothing hangs on the client's 20-second timeout.
 */
import { vi } from "vitest";

import { API_BASE_URL } from "@/config/env";

export type FetchedRequest = {
  method: string;
  path: string;
  /** Header names lower-cased, as `Headers` gives them. */
  headers: Record<string, string>;
  body?: unknown;
};

type Responder = (request: FetchedRequest) => Response | Promise<Response>;

/** A JSON response, as DRF sends one. */
export function json(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

const sent: FetchedRequest[] = [];
const routes = new Map<string, Responder>();

const routeOf = (method: string, path: string) => `${method} ${path}`;

function record(input: Parameters<typeof fetch>[0], init?: RequestInit): FetchedRequest {
  const url = String(input);
  const path = url.startsWith(API_BASE_URL) ? url.slice(API_BASE_URL.length) : url;
  const headers: Record<string, string> = {};
  new Headers(init?.headers).forEach((value, name) => {
    headers[name] = value;
  });
  const request: FetchedRequest = { method: (init?.method ?? "GET").toUpperCase(), path, headers };
  if (typeof init?.body === "string") {
    request.body = JSON.parse(init.body) as unknown;
  }
  sent.push(request);
  return request;
}

const fetchStub = vi.fn(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
  const request = record(input, init);
  const responder = routes.get(routeOf(request.method, request.path));
  return responder ? responder(request) : json(404, { detail: "Not found." });
});

export const fakeFetch = {
  install() {
    sent.length = 0;
    routes.clear();
    vi.stubGlobal("fetch", fetchStub);
  },

  uninstall() {
    vi.unstubAllGlobals();
  },

  /** Answers `"METHOD /path/"` with a copy of `response`, or with `respond(request)`. */
  on(route: string, respond: Response | Responder) {
    routes.set(route, typeof respond === "function" ? respond : () => respond.clone());
  },

  /** Every request so far as `"METHOD /path/"`, in the order it was sent. */
  calls: () => sent.map((request) => routeOf(request.method, request.path)),

  /** Every request so far, with its headers and body. */
  requests: (): FetchedRequest[] => sent.map((request) => ({ ...request })),

  /** How many requests went to `"METHOD /path/"`. */
  countOf: (route: string) =>
    sent.filter((request) => routeOf(request.method, request.path) === route).length,
};
