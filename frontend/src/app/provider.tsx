import type { PropsWithChildren } from "react";
import { useEffect } from "react";

// stores
import { AuthProvider } from "../features/auth/stores/auth-store";
import { AppStoreProvider } from "../stores/app-store";

export default function AppProvider({ children }: PropsWithChildren) {
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
    <AuthProvider>
      <AppStoreProvider>{children}</AppStoreProvider>
    </AuthProvider>
  );
}




