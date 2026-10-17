import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

import { ErrorState } from "@/components/ui/error-state";
import { reloadApp } from "@/lib/reload-app";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

/** Last line of defence above the router: an error outside any route still shows a way out. */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled app error", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
        <ErrorState
          title="Something went wrong"
          message="The app hit an unexpected error."
          retryLabel="Reload"
          onRetry={reloadApp}
        />
      </div>
    );
  }
}
