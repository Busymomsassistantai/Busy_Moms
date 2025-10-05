import { useState, useCallback } from 'react';
import { errorService } from '../lib/errors/ErrorService';
import { AppError, ErrorContext } from '../lib/errors/types';

interface UseErrorHandlerReturn {
  error: AppError | null;
  setError: (error: Error | AppError | null) => void;
  clearError: () => void;
  handleError: (error: Error | AppError, context?: ErrorContext) => void;
  isError: boolean;
}

export function useErrorHandler(componentName?: string): UseErrorHandlerReturn {
  const [error, setErrorState] = useState<AppError | null>(null);

  const setError = useCallback((error: Error | AppError | null) => {
    if (error === null) {
      setErrorState(null);
      return;
    }

    const appError = errorService.normalizeError(error, { component: componentName });
    setErrorState(appError);
  }, [componentName]);

  const clearError = useCallback(() => {
    setErrorState(null);
  }, []);

  const handleError = useCallback(
    (error: Error | AppError, context?: ErrorContext) => {
      const errorContext = {
        ...context,
        component: componentName || context?.component,
      };

      const appError = errorService.normalizeError(error, errorContext);
      setErrorState(appError);

      errorService.logError(appError, errorContext);
    },
    [componentName]
  );

  return {
    error,
    setError,
    clearError,
    handleError,
    isError: error !== null,
  };
}

interface Toast {
  id: string;
  message: string;
  type: 'error' | 'success' | 'warning' | 'info';
  duration?: number;
  actionLabel?: string;
  onAction?: () => void;
}

interface UseToastReturn {
  toasts: Toast[];
  showToast: (toast: Omit<Toast, 'id'>) => void;
  showError: (message: string, duration?: number) => void;
  showSuccess: (message: string, duration?: number) => void;
  showWarning: (message: string, duration?: number) => void;
  showInfo: (message: string, duration?: number) => void;
  removeToast: (id: string) => void;
  clearAllToasts: () => void;
}

export function useToast(): UseToastReturn {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const newToast = { ...toast, id };

    setToasts((prev) => [...prev, newToast]);

    if (toast.duration !== 0) {
      setTimeout(() => {
        removeToast(id);
      }, toast.duration || 5000);
    }
  }, []);

  const showError = useCallback(
    (message: string, duration?: number) => {
      showToast({ message, type: 'error', duration });
    },
    [showToast]
  );

  const showSuccess = useCallback(
    (message: string, duration?: number) => {
      showToast({ message, type: 'success', duration });
    },
    [showToast]
  );

  const showWarning = useCallback(
    (message: string, duration?: number) => {
      showToast({ message, type: 'warning', duration });
    },
    [showToast]
  );

  const showInfo = useCallback(
    (message: string, duration?: number) => {
      showToast({ message, type: 'info', duration });
    },
    [showToast]
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  return {
    toasts,
    showToast,
    showError,
    showSuccess,
    showWarning,
    showInfo,
    removeToast,
    clearAllToasts,
  };
}

interface UseAsyncReturn<T> {
  data: T | null;
  loading: boolean;
  error: AppError | null;
  execute: (...args: any[]) => Promise<T | null>;
  reset: () => void;
}

export function useAsync<T>(
  asyncFunction: (...args: any[]) => Promise<T>,
  immediate = false,
  context?: ErrorContext
): UseAsyncReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(immediate);
  const { error, handleError, clearError } = useErrorHandler(context?.component);

  const execute = useCallback(
    async (...args: any[]): Promise<T | null> => {
      setLoading(true);
      clearError();

      try {
        const result = await asyncFunction(...args);
        setData(result);
        return result;
      } catch (err) {
        handleError(err as Error, context);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [asyncFunction, context, handleError, clearError]
  );

  const reset = useCallback(() => {
    setData(null);
    setLoading(false);
    clearError();
  }, [clearError]);

  return { data, loading, error, execute, reset };
}
