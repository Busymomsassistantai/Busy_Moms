import { supabase } from '../supabase';
import {
  ErrorType,
  ErrorSeverity,
  ErrorContext,
  ErrorLog,
  AppError,
  NetworkError,
  ValidationError as ValidationErrorClass,
  DatabaseError,
  AuthenticationError,
  AuthorizationError,
  APIError,
  IntegrationError,
} from './types';
import {
  ERROR_MESSAGES,
  ERROR_LOG_CONFIG,
  USER_FRIENDLY_ERROR_MAP,
} from './constants';

class ErrorService {
  private errorQueue: Map<string, { count: number; timestamp: number }> = new Map();

  async logError(error: AppError | Error, context?: ErrorContext): Promise<void> {
    try {
      const appError = this.normalizeError(error, context);

      if (!appError.shouldLog) {
        return;
      }

      const errorKey = this.generateErrorKey(appError);

      if (this.shouldDeduplicate(errorKey)) {
        this.incrementErrorCount(errorKey);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();

      const errorLog: ErrorLog = {
        user_id: user?.id || context?.userId,
        error_type: appError.type,
        severity: appError.severity,
        message: appError.message,
        stack_trace: this.sanitizeStackTrace(appError.stack),
        context: this.sanitizeContext({
          ...appError.context,
          ...context,
          url: window.location.href,
          userAgent: navigator.userAgent,
        }),
        component: context?.component || appError.context?.component,
        url: window.location.href,
        user_agent: navigator.userAgent,
        resolved: false,
        count: 1,
      };

      const { error: dbError } = await supabase.from('error_logs').insert([errorLog]);

      if (dbError) {
        console.error('Failed to log error to database:', dbError);
      }

      this.recordErrorInQueue(errorKey);
    } catch (loggingError) {
      console.error('Error logging service failed:', loggingError);
    }
  }

  async logInfo(message: string, context?: ErrorContext): Promise<void> {
    const error = new Error(message) as AppError;
    error.type = ErrorType.UNKNOWN;
    error.severity = ErrorSeverity.INFO;
    error.context = context;
    error.shouldLog = true;
    await this.logError(error, context);
  }

  async logWarning(message: string, context?: ErrorContext): Promise<void> {
    const error = new Error(message) as AppError;
    error.type = ErrorType.UNKNOWN;
    error.severity = ErrorSeverity.WARNING;
    error.context = context;
    error.shouldLog = true;
    await this.logError(error, context);
  }

  normalizeError(error: Error | AppError, context?: ErrorContext): AppError {
    if (this.isAppError(error)) {
      return error;
    }

    const errorMessage = error.message.toLowerCase();

    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      return new NetworkError(
        this.getUserFriendlyMessage(error.message),
        context,
        error
      );
    }

    if (errorMessage.includes('auth') || errorMessage.includes('unauthorized')) {
      return new AuthenticationError(
        this.getUserFriendlyMessage(error.message),
        context,
        error
      );
    }

    if (errorMessage.includes('permission') || errorMessage.includes('forbidden')) {
      return new AuthorizationError(
        this.getUserFriendlyMessage(error.message),
        context,
        error
      );
    }

    if (errorMessage.includes('database') || errorMessage.includes('sql')) {
      return new DatabaseError(
        this.getUserFriendlyMessage(error.message),
        context,
        error
      );
    }

    const appError = error as AppError;
    appError.type = ErrorType.UNKNOWN;
    appError.severity = ErrorSeverity.ERROR;
    appError.context = context;
    appError.shouldLog = true;

    return appError;
  }

  getUserFriendlyMessage(message: string): string {
    const lowerMessage = message.toLowerCase();

    for (const [key, friendlyMessage] of Object.entries(USER_FRIENDLY_ERROR_MAP)) {
      if (lowerMessage.includes(key.toLowerCase())) {
        return friendlyMessage;
      }
    }

    return ERROR_MESSAGES.GENERAL.SOMETHING_WENT_WRONG;
  }

  parseSupabaseError(error: any, context?: ErrorContext): AppError {
    const message = error?.message || '';
    const code = error?.code || '';

    if (message.includes('JWT') || message.includes('session')) {
      return new AuthenticationError(
        ERROR_MESSAGES.AUTHENTICATION.SESSION_EXPIRED,
        context,
        error
      );
    }

    if (code === '23505' || message.includes('unique')) {
      return new DatabaseError(
        ERROR_MESSAGES.DATABASE.UNIQUE_CONSTRAINT,
        context,
        error,
        code
      );
    }

    if (code === '23503' || message.includes('foreign key')) {
      return new DatabaseError(
        ERROR_MESSAGES.DATABASE.FOREIGN_KEY_VIOLATION,
        context,
        error,
        code
      );
    }

    if (code === '42501' || message.includes('permission')) {
      return new AuthorizationError(
        ERROR_MESSAGES.AUTHORIZATION.PERMISSION_DENIED,
        context,
        error
      );
    }

    return new DatabaseError(
      this.getUserFriendlyMessage(message),
      context,
      error,
      code
    );
  }

  parseNetworkError(error: any, statusCode?: number, context?: ErrorContext): AppError {
    if (statusCode) {
      const statusKey = statusCode.toString();
      if (USER_FRIENDLY_ERROR_MAP[statusKey]) {
        return new NetworkError(
          USER_FRIENDLY_ERROR_MAP[statusKey],
          context,
          error,
          statusCode
        );
      }
    }

    if (error.message.includes('timeout')) {
      return new NetworkError(
        ERROR_MESSAGES.NETWORK.TIMEOUT,
        context,
        error,
        statusCode
      );
    }

    if (error.message.includes('fetch failed') || !navigator.onLine) {
      return new NetworkError(
        ERROR_MESSAGES.NETWORK.OFFLINE,
        context,
        error,
        statusCode
      );
    }

    return new NetworkError(
      ERROR_MESSAGES.NETWORK.REQUEST_FAILED,
      context,
      error,
      statusCode
    );
  }

  async getErrorLogs(filters?: {
    errorType?: ErrorType;
    severity?: ErrorSeverity;
    resolved?: boolean;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<ErrorLog[]> {
    try {
      let query = supabase.from('error_logs').select('*');

      if (filters?.errorType) {
        query = query.eq('error_type', filters.errorType);
      }

      if (filters?.severity) {
        query = query.eq('severity', filters.severity);
      }

      if (filters?.resolved !== undefined) {
        query = query.eq('resolved', filters.resolved);
      }

      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate);
      }

      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate);
      }

      query = query.order('created_at', { ascending: false });

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Failed to fetch error logs:', error);
      return [];
    }
  }

  async markErrorResolved(errorId: string, resolutionNotes?: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('error_logs')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolution_notes: resolutionNotes,
        })
        .eq('id', errorId);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Failed to mark error as resolved:', error);
      throw error;
    }
  }

  async getErrorStats(): Promise<{
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    unresolved: number;
  }> {
    try {
      const { data: errors, error } = await supabase
        .from('error_logs')
        .select('error_type, severity, resolved');

      if (error || !errors) {
        return {
          total: 0,
          byType: {},
          bySeverity: {},
          unresolved: 0,
        };
      }

      const stats = {
        total: errors.length,
        byType: {} as Record<string, number>,
        bySeverity: {} as Record<string, number>,
        unresolved: 0,
      };

      errors.forEach((err) => {
        stats.byType[err.error_type] = (stats.byType[err.error_type] || 0) + 1;
        stats.bySeverity[err.severity] = (stats.bySeverity[err.severity] || 0) + 1;
        if (!err.resolved) {
          stats.unresolved++;
        }
      });

      return stats;
    } catch (error) {
      console.error('Failed to fetch error stats:', error);
      return {
        total: 0,
        byType: {},
        bySeverity: {},
        unresolved: 0,
      };
    }
  }

  private isAppError(error: any): error is AppError {
    return (
      error &&
      typeof error.type === 'string' &&
      typeof error.severity === 'string'
    );
  }

  private generateErrorKey(error: AppError): string {
    return `${error.type}:${error.message}:${error.context?.component || 'unknown'}`;
  }

  private shouldDeduplicate(errorKey: string): boolean {
    const cached = this.errorQueue.get(errorKey);
    if (!cached) return false;

    const timeSinceLastError = Date.now() - cached.timestamp;
    return timeSinceLastError < ERROR_LOG_CONFIG.DEDUPE_WINDOW_MS;
  }

  private incrementErrorCount(errorKey: string): void {
    const cached = this.errorQueue.get(errorKey);
    if (cached) {
      cached.count++;
    }
  }

  private recordErrorInQueue(errorKey: string): void {
    this.errorQueue.set(errorKey, {
      count: 1,
      timestamp: Date.now(),
    });

    setTimeout(() => {
      this.errorQueue.delete(errorKey);
    }, ERROR_LOG_CONFIG.DEDUPE_WINDOW_MS);
  }

  private sanitizeStackTrace(stack?: string): string | undefined {
    if (!stack) return undefined;
    return stack.substring(0, ERROR_LOG_CONFIG.MAX_STACK_TRACE_LENGTH);
  }

  private sanitizeContext(context?: ErrorContext): ErrorContext | undefined {
    if (!context) return undefined;

    const sanitized = { ...context };
    const contextString = JSON.stringify(sanitized);

    if (contextString.length > ERROR_LOG_CONFIG.MAX_CONTEXT_SIZE) {
      return {
        component: context.component,
        action: context.action,
        note: 'Context truncated due to size',
      };
    }

    return sanitized;
  }
}

export const errorService = new ErrorService();
export default errorService;
