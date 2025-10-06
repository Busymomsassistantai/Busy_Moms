import React from 'react';
import { X, AlertTriangle, AlertCircle, Info } from 'lucide-react';

export type ErrorModalType = 'error' | 'warning' | 'info';

interface ErrorModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  type?: ErrorModalType;
  onClose: () => void;
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  details?: string;
  showDetails?: boolean;
}

export function ErrorModal({
  isOpen,
  title,
  message,
  type = 'error',
  onClose,
  primaryAction,
  secondaryAction,
  details,
  showDetails = false,
}: ErrorModalProps) {
  const [detailsVisible, setDetailsVisible] = React.useState(showDetails);

  if (!isOpen) return null;

  const icons = {
    error: <AlertCircle className="w-8 h-8 text-red-600" />,
    warning: <AlertTriangle className="w-8 h-8 text-yellow-600" />,
    info: <Info className="w-8 h-8 text-blue-600" />,
  };

  const bgColors = {
    error: 'bg-red-100',
    warning: 'bg-yellow-100',
    info: 'bg-blue-100',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
      onClick={onClose}
    >
      <div
        className="bg-theme-surface rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${bgColors[type]}`}>
              {icons[type]}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-theme-fg opacity-70 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <h2 className="text-xl font-bold text-theme-fg mb-2">{title}</h2>

          <p className="text-theme-fg opacity-70 mb-4">{message}</p>

          {details && (
            <div className="mb-4">
              <button
                onClick={() => setDetailsVisible(!detailsVisible)}
                className="text-sm text-theme-primary hover:text-blue-700 font-medium underline"
              >
                {detailsVisible ? 'Hide' : 'Show'} Technical Details
              </button>

              {detailsVisible && (
                <div className="mt-2 p-3 bg-theme-bg rounded-lg border border-gray-200">
                  <p className="text-xs font-mono text-theme-fg opacity-90 break-all">
                    {details}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-3">
            {secondaryAction && (
              <button
                onClick={secondaryAction.onClick}
                className="flex-1 px-4 py-2 border border-theme-border text-theme-fg opacity-90 rounded-lg hover:bg-theme-secondary transition-colors font-medium"
              >
                {secondaryAction.label}
              </button>
            )}

            {primaryAction ? (
              <button
                onClick={primaryAction.onClick}
                className="flex-1 px-4 py-2 bg-theme-primary text-white rounded-lg hover:opacity-90 transition-colors font-medium"
              >
                {primaryAction.label}
              </button>
            ) : (
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-theme-primary text-white rounded-lg hover:opacity-90 transition-colors font-medium"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
