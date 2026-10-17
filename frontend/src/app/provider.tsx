import type { PropsWithChildren } from "react";
import { lazy, Suspense, useEffect, useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";

// components
import { DiceProvider } from "../components/dice/DiceProvider";

// stores
import { AuthProvider } from "../features/auth/stores/auth-store";
import { AppStoreProvider } from "../stores/app-store";

// other
import { createQueryClient } from "../lib/query-client";

// Dev-only, loaded on demand so it never reaches the production bundle.
const ReactQueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import("@tanstack/react-query-devtools").then((module) => ({
        default: module.ReactQueryDevtools,
      }))
    )
  : null;

export default function AppProvider({ children }: PropsWithChildren) {
  const [queryClient] = useState(createQueryClient);

  useEffect(() => {
    const handleSubmit = (event: Event) => {
      if (event.defaultPrevented) {
        return;
      }
      event.preventDefault();
    };

    document.addEventListener("submit", handleSubmit, true);
    return () => {
      document.removeEventListener("submit", handleSubmit, true);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppStoreProvider>
          <DiceProvider>{children}</DiceProvider>
        </AppStoreProvider>
      </AuthProvider>
      {ReactQueryDevtools ? (
        <Suspense fallback={null}>
          <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
        </Suspense>
      ) : null}
    </QueryClientProvider>
  );
}
