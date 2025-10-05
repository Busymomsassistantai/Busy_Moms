import React, { useEffect, useState } from 'react';
import { X, AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react';

export type ToastType = 'error' | 'success' | 'warning' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose?: () => void;
  actionLabel?: string;
  onAction?: () => void;
}

export function ErrorToast({
  message,
  type = 'error',
  duration = 5000,
  onClose,
  actionLabel,
  onAction,
}: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      onClose?.();
    }, 300);
  };

  if (!isVisible) return null;

  const icons = {
    error: <AlertCircle className="w-5 h-5" />,
    success: <CheckCircle className="w-5 h-5" />,
    warning: <AlertTriangle className="w-5 h-5" />,
    info: <Info className="w-5 h-5" />,
  };

  const styles = {
    error: 'bg-red-50 border-red-200 text-red-800',
    success: 'bg-green-50 border-green-200 text-green-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };

  const iconColors = {
    error: 'text-red-500',
    success: 'text-green-500',
    warning: 'text-yellow-500',
    info: 'text-blue-500',
  };

  const buttonColors = {
    error: 'text-red-700 hover:text-red-900',
    success: 'text-green-700 hover:text-green-900',
    warning: 'text-yellow-700 hover:text-yellow-900',
    info: 'text-blue-700 hover:text-blue-900',
  };

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 max-w-md w-full sm:w-auto transition-all duration-300 ${
        isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'
      }`}
    >
      <div
        className={`flex items-start space-x-3 p-4 rounded-xl border-2 shadow-lg ${styles[type]}`}
        role="alert"
      >
        <div className={`flex-shrink-0 ${iconColors[type]}`}>
          {icons[type]}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{message}</p>
          {actionLabel && onAction && (
            <button
              onClick={onAction}
              className={`mt-2 text-sm font-medium underline ${buttonColors[type]}`}
            >
              {actionLabel}
            </button>
          )}
        </div>

        <button
          onClick={handleClose}
          className={`flex-shrink-0 ${buttonColors[type]} transition-colors`}
          aria-label="Close notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

interface ToastContainerProps {
  toasts: Array<{
    id: string;
    message: string;
    type?: ToastType;
    duration?: number;
    actionLabel?: string;
    onAction?: () => void;
  }>;
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 pointer-events-none">
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          className="pointer-events-auto"
          style={{
            transform: `translateY(-${index * 4}px)`,
          }}
        >
          <ErrorToast
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            onClose={() => onRemove(toast.id)}
            actionLabel={toast.actionLabel}
            onAction={toast.onAction}
          />
        </div>
      ))}
    </div>
  );
}
