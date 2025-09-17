import React from "react";

type State = { hasError: boolean; message?: string };

export class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false };
  
  static getDerivedStateFromError(err: unknown) {
    return { hasError: true, message: (err as any)?.message || "Unexpected error" };
  }
  
  componentDidCatch(error: any, info: any) {
    console.error("[ErrorBoundary]", error, info);
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full">
            <h1 className="text-xl font-semibold text-gray-900 mb-3">Something went wrong</h1>
            <p className="text-sm text-gray-600 mb-4">
              The application encountered an unexpected error. Please refresh the page to try again.
            </p>
            <pre className="text-xs text-red-700 bg-red-50 p-3 rounded-lg overflow-auto">
              {this.state.message}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 w-full px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}