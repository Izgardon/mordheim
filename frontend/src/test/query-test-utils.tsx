import type { PropsWithChildren, ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";

/** A QueryClient for tests: no retries, and nothing is garbage-collected mid-test. */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

export function createQueryWrapper(queryClient: QueryClient = createTestQueryClient()) {
  return function QueryWrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

type RenderWithQueryClientOptions = Omit<RenderOptions, "wrapper"> & {
  queryClient?: QueryClient;
};

export function renderWithQueryClient(
  ui: ReactElement,
  { queryClient = createTestQueryClient(), ...options }: RenderWithQueryClientOptions = {}
) {
  return {
    queryClient,
    ...render(ui, { wrapper: createQueryWrapper(queryClient), ...options }),
  };
}
