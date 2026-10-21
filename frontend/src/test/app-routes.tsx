/**
 * The whole app as `main.tsx` mounts it: AppProvider's providers (with TestDiceProvider for the
 * dice and no devtools), AppErrorBoundary, and the app's own `routes` in a memory router, on the
 * app's query client. For route guards, redirects and the requests of a cold start.
 * Mock in the test file: `@/lib/api-client` (fake-api), `@/lib/realtime/client`
 * (fake-realtime) and `@/lib/use-media-query`. Call `cleanupApps()` in `afterEach`.
 */
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { vi, type MockInstance } from "vitest";

import { routes } from "@/app/routes/routes";
import { AppErrorBoundary } from "@/components/errors/AppErrorBoundary";
import { AppToaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/features/auth/stores/auth-store";
import { createQueryClient } from "@/lib/query-client";
import { AppStoreProvider } from "@/stores/app-store";
import { TestDiceProvider } from "./dice";

// The routes load these on demand; importing them here first lets each lazy() resolve at once.
import "@/app/routes/ProtectedLayout";
import "@/features/auth/routes/Landing";
import "@/features/auth/routes/ResetPassword";
import "@/features/campaigns/routes/Campaigns";

const clients: QueryClient[] = [];
const scrollSpies: MockInstance[] = [];

export function renderApp(path: string) {
  const queryClient = createQueryClient();
  clients.push(queryClient);
  // ScrollToTop runs on every page; jsdom has no window.scrollTo.
  scrollSpies.push(vi.spyOn(window, "scrollTo").mockImplementation(() => undefined));
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppStoreProvider>
          <TestDiceProvider>
            <AppErrorBoundary>
              <RouterProvider router={router} />
            </AppErrorBoundary>
          </TestDiceProvider>
        </AppStoreProvider>
      </AuthProvider>
      <AppToaster />
    </QueryClientProvider>
  );
  return {
    ...view,
    router,
    queryClient,
    /** Where the app is now: pathname, search and the history state. */
    location: () => router.state.location,
  };
}

/** Unmounts, then empties each app's cache, so no 5-minute gc timer outlives the test. */
export function cleanupApps() {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  scrollSpies.splice(0).forEach((spy) => spy.mockRestore());
}
