// components
import { AppErrorBoundary } from "../components/errors/AppErrorBoundary";

// other
import AppRouter from "./router";

export default function App() {
  return (
    <AppErrorBoundary>
      <AppRouter />
    </AppErrorBoundary>
  );
}
