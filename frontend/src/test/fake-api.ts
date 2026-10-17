/**
 * A fake server behind `apiRequest`, for tests that pin the requests a screen sends (method,
 * path and body) rather than which api function sends them, so a refactor that moves calls
 * between api modules keeps the test. Mock the client in the test file with:
 *
 *   vi.mock("@/lib/api-client", async (importOriginal) => ({
 *     ...(await importOriginal<typeof import("@/lib/api-client")>()),
 *     apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
 *   }));
 *
 * Answer requests with `fakeApi.on("POST /warbands/9/trades/", (body) => ...)` (or a plain
 * value). Every request is recorded; one with no route never answers, like a hung server.
 */

type Handler = (body: unknown, path: string) => unknown;

export type SentRequest = { method: string; path: string; body?: unknown };

const sent: SentRequest[] = [];
const routes = new Map<string, Handler>();

const routeOf = (method: string, path: string) => `${method} ${path}`;

export const fakeApi = {
  apiRequest: async (path: string, options: { method?: string; body?: unknown } = {}) => {
    const method = (options.method ?? "GET").toUpperCase();
    sent.push(options.body === undefined ? { method, path } : { method, path, body: options.body });
    const handler = routes.get(routeOf(method, path));
    if (!handler) {
      return new Promise<never>(() => undefined);
    }
    return handler(options.body, path);
  },

  /** Answers `"METHOD /path/"` with `respond(body)`, or with `respond` itself when not a function. */
  on(route: string, respond: unknown) {
    routes.set(
      route,
      typeof respond === "function" ? (respond as Handler) : () => structuredClone(respond)
    );
  },

  /** Answers `"METHOD /path/"` with a rejection. */
  fail(route: string, error: unknown = new Error("Server error")) {
    routes.set(route, () => Promise.reject(error));
  },

  /** Forgets every route and every recorded request. */
  reset() {
    sent.length = 0;
    routes.clear();
  },

  /** Clears the recorded requests, keeping the routes (e.g. after a screen's initial loads). */
  clearRequests() {
    sent.length = 0;
  },

  /** Every request so far as `"METHOD /path/"`, in the order it was sent. */
  calls: () => sent.map((request) => routeOf(request.method, request.path)),

  /** Every request so far, with its body. */
  requests: (): SentRequest[] => sent.map((request) => ({ ...request })),

  /** The body of the last request to `"METHOD /path/"` (undefined if none was sent). */
  bodyOf(route: string) {
    const matches = sent.filter((request) => routeOf(request.method, request.path) === route);
    return matches[matches.length - 1]?.body;
  },

  /** How many requests went to `"METHOD /path/"`. */
  countOf: (route: string) =>
    sent.filter((request) => routeOf(request.method, request.path) === route).length,
};
