import type { PropsWithChildren } from "react";
import { lazy, Suspense, useEffect, useState } from "react";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";

// components
import { AppToaster } from "../components/ui/toaster";

// stores
import { AuthProvider } from "../features/auth/stores/auth-store";
import { AppStoreProvider } from "../stores/app-store";

// other
import { flushWhenHidden, offlinePersistOptions } from "../lib/offline/persist-options";
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
  // The reads kept for the table come back from the phone before any query runs (lib/offline/).
  const [persistOptions] = useState(() => offlinePersistOptions(queryClient));

  useEffect(flushWhenHidden, []);

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
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <AuthProvider>
        <AppStoreProvider>{children}</AppStoreProvider>
      </AuthProvider>
      <AppToaster />
      {ReactQueryDevtools ? (
        <Suspense fallback={null}>
          <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
        </Suspense>
      ) : null}
    </PersistQueryClientProvider>
  );
}
