import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  RefreshCw,
  Filter,
  Search,
  X,
  Calendar,
  User,
  Code,
} from 'lucide-react';
import { errorService } from '../../lib/errors/ErrorService';
import { ErrorLog, ErrorType, ErrorSeverity } from '../../lib/errors/types';
import { ERROR_TYPE_ICONS, SEVERITY_COLORS } from '../../lib/errors/constants';
import { LoadingErrorState } from './LoadingErrorState';

export function ErrorDashboard() {
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [selectedError, setSelectedError] = useState<ErrorLog | null>(null);
  const [filters, setFilters] = useState({
    errorType: '' as ErrorType | '',
    severity: '' as ErrorSeverity | '',
    resolved: 'false',
    searchQuery: '',
  });

  useEffect(() => {
    loadErrors();
    loadStats();
  }, [filters.errorType, filters.severity, filters.resolved]);

  const loadErrors = async () => {
    setLoading(true);
    setError(null);

    try {
      const filterOptions: any = {
        limit: 100,
      };

      if (filters.errorType) filterOptions.errorType = filters.errorType;
      if (filters.severity) filterOptions.severity = filters.severity;
      if (filters.resolved !== '') filterOptions.resolved = filters.resolved === 'true';

      const data = await errorService.getErrorLogs(filterOptions);

      let filteredData = data;
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        filteredData = data.filter(
          (err) =>
            err.message.toLowerCase().includes(query) ||
            err.component?.toLowerCase().includes(query) ||
            err.error_type.toLowerCase().includes(query)
        );
      }

      setErrors(filteredData);
    } catch (err) {
      setError(err as Error);
      console.error('Failed to load errors:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const statsData = await errorService.getErrorStats();
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load error stats:', err);
    }
  };

  const handleResolveError = async (errorId: string, notes?: string) => {
    try {
      await errorService.markErrorResolved(errorId, notes);
      await loadErrors();
      await loadStats();
      setSelectedError(null);
    } catch (err) {
      console.error('Failed to resolve error:', err);
      alert('Failed to mark error as resolved. Please try again.');
    }
  };

  const filteredErrorCount = errors.length;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Error Dashboard</h1>
            <p className="text-gray-600">Monitor and resolve application errors</p>
          </div>
          <button
            onClick={() => {
              loadErrors();
              loadStats();
            }}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Errors</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
                </div>
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-gray-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Unresolved</p>
                  <p className="text-3xl font-bold text-red-600">{stats.unresolved}</p>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Critical</p>
                  <p className="text-3xl font-bold text-red-600">
                    {stats.bySeverity[ErrorSeverity.CRITICAL] || 0}
                  </p>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Resolved</p>
                  <p className="text-3xl font-bold text-green-600">
                    {stats.total - stats.unresolved}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search errors..."
                  value={filters.searchQuery}
                  onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <select
              value={filters.errorType}
              onChange={(e) => setFilters({ ...filters, errorType: e.target.value as ErrorType | '' })}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Types</option>
              {Object.values(ErrorType).map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            <select
              value={filters.severity}
              onChange={(e) => setFilters({ ...filters, severity: e.target.value as ErrorSeverity | '' })}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Severities</option>
              {Object.values(ErrorSeverity).map((severity) => (
                <option key={severity} value={severity}>
                  {severity}
                </option>
              ))}
            </select>

            <select
              value={filters.resolved}
              onChange={(e) => setFilters({ ...filters, resolved: e.target.value })}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Status</option>
              <option value="false">Unresolved</option>
              <option value="true">Resolved</option>
            </select>
          </div>
        </div>

        <LoadingErrorState
          isLoading={loading}
          error={error}
          onRetry={loadErrors}
          hasData={errors.length > 0}
          emptyMessage="No errors found matching your filters"
        >
          <div className="space-y-3">
            {errors.map((err) => (
              <div
                key={err.id}
                onClick={() => setSelectedError(err)}
                className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 hover:border-blue-300 cursor-pointer transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className="text-2xl">{ERROR_TYPE_ICONS[err.error_type]}</span>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          SEVERITY_COLORS[err.severity as ErrorSeverity]?.bg
                        } ${SEVERITY_COLORS[err.severity as ErrorSeverity]?.text}`}
                      >
                        {err.severity}
                      </span>
                      <span className="text-sm text-gray-500">{err.error_type}</span>
                      {err.resolved && (
                        <span className="flex items-center space-x-1 text-sm text-green-600">
                          <CheckCircle className="w-4 h-4" />
                          <span>Resolved</span>
                        </span>
                      )}
                    </div>

                    <p className="text-gray-900 font-medium mb-2">{err.message}</p>

                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                      {err.component && (
                        <span className="flex items-center space-x-1">
                          <Code className="w-4 h-4" />
                          <span>{err.component}</span>
                        </span>
                      )}
                      <span className="flex items-center space-x-1">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(err.created_at!).toLocaleString()}</span>
                      </span>
                      {err.count && err.count > 1 && (
                        <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                          {err.count}x
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </LoadingErrorState>

        {selectedError && (
          <ErrorDetailModal
            error={selectedError}
            onClose={() => setSelectedError(null)}
            onResolve={handleResolveError}
          />
        )}
      </div>
    </div>
  );
}

interface ErrorDetailModalProps {
  error: ErrorLog;
  onClose: () => void;
  onResolve: (errorId: string, notes?: string) => void;
}

function ErrorDetailModal({ error, onClose, onResolve }: ErrorDetailModalProps) {
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [showStackTrace, setShowStackTrace] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Error Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <div className="flex items-center space-x-3 mb-3">
              <span className="text-3xl">{ERROR_TYPE_ICONS[error.error_type]}</span>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  SEVERITY_COLORS[error.severity as ErrorSeverity]?.bg
                } ${SEVERITY_COLORS[error.severity as ErrorSeverity]?.text}`}
              >
                {error.severity}
              </span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{error.message}</h3>
          </div>

          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm text-gray-600 mb-1">Error Type</p>
              <p className="font-medium text-gray-900">{error.error_type}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Component</p>
              <p className="font-medium text-gray-900">{error.component || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Created At</p>
              <p className="font-medium text-gray-900">
                {new Date(error.created_at!).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Occurrences</p>
              <p className="font-medium text-gray-900">{error.count || 1}</p>
            </div>
          </div>

          {error.url && (
            <div>
              <p className="text-sm text-gray-600 mb-1">URL</p>
              <p className="text-sm font-mono text-gray-900 break-all bg-gray-50 p-2 rounded">
                {error.url}
              </p>
            </div>
          )}

          {error.stack_trace && (
            <div>
              <button
                onClick={() => setShowStackTrace(!showStackTrace)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium underline mb-2"
              >
                {showStackTrace ? 'Hide' : 'Show'} Stack Trace
              </button>
              {showStackTrace && (
                <pre className="text-xs font-mono text-gray-900 opacity-90 bg-gray-50 p-4 rounded-lg overflow-x-auto border border-gray-200">
                  {error.stack_trace}
                </pre>
              )}
            </div>
          )}

          {error.context && (
            <div>
              <p className="text-sm text-gray-600 mb-2">Context</p>
              <pre className="text-xs font-mono text-gray-900 opacity-90 bg-gray-50 p-4 rounded-lg overflow-x-auto border border-gray-200">
                {JSON.stringify(error.context, null, 2)}
              </pre>
            </div>
          )}

          {!error.resolved && (
            <div>
              <label className="block text-sm font-medium text-gray-900 opacity-90 mb-2">
                Resolution Notes (Optional)
              </label>
              <textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Describe how this error was resolved..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
              />
            </div>
          )}

          {error.resolved && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <p className="font-medium text-green-900">This error has been resolved</p>
              </div>
              {error.resolution_notes && (
                <p className="text-sm text-green-700 mt-2">{error.resolution_notes}</p>
              )}
              {error.resolved_at && (
                <p className="text-sm text-green-600 mt-2">
                  Resolved on {new Date(error.resolved_at).toLocaleString()}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 text-gray-900 opacity-90 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Close
          </button>
          {!error.resolved && (
            <button
              onClick={() => onResolve(error.id!, resolutionNotes || undefined)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Mark as Resolved
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
