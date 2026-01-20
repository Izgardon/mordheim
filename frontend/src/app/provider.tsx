import type { PropsWithChildren } from "react";

import { AuthProvider } from "../features/auth/stores/auth-store";

export default function AppProvider({ children }: PropsWithChildren) {
  return <AuthProvider>{children}</AuthProvider>;
}
