import React from 'react';
import { Loader2, AlertCircle, RefreshCw, Inbox } from 'lucide-react';

interface LoadingErrorStateProps {
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
  loadingMessage?: string;
  errorMessage?: string;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  hasData?: boolean;
  children?: React.ReactNode;
}

export function LoadingErrorState({
  isLoading,
  error,
  onRetry,
  loadingMessage = 'Loading...',
  errorMessage,
  emptyMessage = 'No data available',
  emptyIcon,
  hasData = true,
  children,
}: LoadingErrorStateProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
        <p className="text-gray-600">{loadingMessage}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <AlertCircle className="w-6 h-6 text-red-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Unable to Load Data
        </h3>
        <p className="text-gray-600 text-center mb-4 max-w-md">
          {errorMessage || error.message || 'An error occurred while loading the data.'}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Try Again</span>
          </button>
        )}
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          {emptyIcon || <Inbox className="w-6 h-6 text-gray-400" />}
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          No Data Yet
        </h3>
        <p className="text-gray-600 text-center max-w-md">
          {emptyMessage}
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

interface InlineErrorProps {
  error: Error | null;
  onRetry?: () => void;
  className?: string;
}

export function InlineError({ error, onRetry, className = '' }: InlineErrorProps) {
  if (!error) return null;

  return (
    <div
      className={`flex items-start space-x-3 p-4 bg-red-50 border border-red-200 rounded-lg ${className}`}
    >
      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm text-red-800">{error.message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 text-sm font-medium text-red-700 hover:text-red-900 underline"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

interface LoadingSkeletonProps {
  count?: number;
  className?: string;
}

export function LoadingSkeleton({ count = 3, className = '' }: LoadingSkeletonProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="animate-pulse">
          <div className="bg-gray-200 rounded-lg h-20 w-full"></div>
        </div>
      ))}
    </div>
  );
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {icon && (
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 max-w-md mb-6">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
