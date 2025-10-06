import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { errorService } from '../../lib/errors/ErrorService';
import { ErrorSeverity, ErrorType } from '../../lib/errors/types';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const { onError, componentName } = this.props;

    this.setState({
      error,
      errorInfo,
    });

    errorService.logError(error, {
      component: componentName || 'ErrorBoundary',
      action: 'componentDidCatch',
      additionalInfo: {
        componentStack: errorInfo.componentStack,
      },
    });

    if (onError) {
      onError(error, errorInfo);
    }

    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleGoHome = () => {
    this.handleReset();
    window.location.href = '/';
  };

  render() {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      if (fallback) {
        return fallback;
      }

      return (
        <div className="min-h-screen bg-theme-bg flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-theme-surface rounded-2xl shadow-xl p-8">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>

              <h1 className="text-2xl font-bold text-theme-fg mb-2">
                Oops! Something went wrong
              </h1>

              <p className="text-theme-fg opacity-70 mb-6">
                We encountered an unexpected error. Don't worry, this has been reported and we'll look into it.
              </p>

              {error && (
                <div className="w-full bg-theme-bg rounded-lg p-4 mb-6 text-left">
                  <p className="text-sm font-medium text-theme-fg opacity-90 mb-1">Error Details:</p>
                  <p className="text-sm text-theme-fg opacity-70 font-mono break-all">
                    {error.message}
                  </p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <button
                  onClick={this.handleReset}
                  className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-theme-primary text-white rounded-lg hover:opacity-90 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Try Again</span>
                </button>

                <button
                  onClick={this.handleGoHome}
                  className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 border border-theme-border text-theme-fg opacity-90 rounded-lg hover:bg-theme-secondary transition-colors"
                >
                  <Home className="w-4 h-4" />
                  <span>Go Home</span>
                </button>
              </div>

              <p className="text-xs text-theme-fg opacity-60 mt-6">
                If this problem persists, please contact support.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}

export function FeatureErrorBoundary({ children, featureName }: { children: ReactNode; featureName: string }) {
  return (
    <ErrorBoundary
      componentName={featureName}
      fallback={
        <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-xl">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-yellow-900 mb-1">
                {featureName} Unavailable
              </h3>
              <p className="text-sm text-yellow-700 mb-3">
                This feature is temporarily unavailable. Please try refreshing the page.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="text-sm font-medium text-yellow-800 hover:text-yellow-900 underline"
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
