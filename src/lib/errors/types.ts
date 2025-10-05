export enum ErrorType {
  NETWORK = 'NetworkError',
  VALIDATION = 'ValidationError',
  DATABASE = 'DatabaseError',
  AUTHENTICATION = 'AuthenticationError',
  AUTHORIZATION = 'AuthorizationError',
  API = 'APIError',
  INTEGRATION = 'IntegrationError',
  UNKNOWN = 'UnknownError',
}

export enum ErrorSeverity {
  CRITICAL = 'CRITICAL',
  ERROR = 'ERROR',
  WARNING = 'WARNING',
  INFO = 'INFO',
}

export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  url?: string;
  userAgent?: string;
  requestData?: Record<string, any>;
  additionalInfo?: Record<string, any>;
}

export interface ErrorLog {
  id?: string;
  user_id?: string;
  error_type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  stack_trace?: string;
  context?: ErrorContext;
  component?: string;
  url?: string;
  user_agent?: string;
  resolved?: boolean;
  resolved_at?: string;
  resolution_notes?: string;
  created_at?: string;
  count?: number;
}

export interface AppError extends Error {
  type: ErrorType;
  severity: ErrorSeverity;
  context?: ErrorContext;
  originalError?: Error;
  isRetryable?: boolean;
  retryCount?: number;
  shouldLog?: boolean;
}

export interface ErrorResponse {
  error: boolean;
  message: string;
  type: ErrorType;
  severity: ErrorSeverity;
  context?: ErrorContext;
  canRetry?: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
  type: string;
}

export interface FormErrors {
  [key: string]: string | string[];
}

export class NetworkError extends Error implements AppError {
  type: ErrorType = ErrorType.NETWORK;
  severity: ErrorSeverity = ErrorSeverity.ERROR;
  context?: ErrorContext;
  originalError?: Error;
  isRetryable: boolean = true;
  retryCount: number = 0;
  shouldLog: boolean = true;
  statusCode?: number;

  constructor(message: string, context?: ErrorContext, originalError?: Error, statusCode?: number) {
    super(message);
    this.name = 'NetworkError';
    this.context = context;
    this.originalError = originalError;
    this.statusCode = statusCode;
  }
}

export class ValidationError extends Error implements AppError {
  type: ErrorType = ErrorType.VALIDATION;
  severity: ErrorSeverity = ErrorSeverity.WARNING;
  context?: ErrorContext;
  originalError?: Error;
  isRetryable: boolean = false;
  shouldLog: boolean = false;
  errors: FormErrors;

  constructor(message: string, errors: FormErrors = {}, context?: ErrorContext) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
    this.context = context;
  }
}

export class DatabaseError extends Error implements AppError {
  type: ErrorType = ErrorType.DATABASE;
  severity: ErrorSeverity = ErrorSeverity.ERROR;
  context?: ErrorContext;
  originalError?: Error;
  isRetryable: boolean = false;
  shouldLog: boolean = true;
  code?: string;

  constructor(message: string, context?: ErrorContext, originalError?: Error, code?: string) {
    super(message);
    this.name = 'DatabaseError';
    this.context = context;
    this.originalError = originalError;
    this.code = code;
  }
}

export class AuthenticationError extends Error implements AppError {
  type: ErrorType = ErrorType.AUTHENTICATION;
  severity: ErrorSeverity = ErrorSeverity.ERROR;
  context?: ErrorContext;
  originalError?: Error;
  isRetryable: boolean = false;
  shouldLog: boolean = true;

  constructor(message: string, context?: ErrorContext, originalError?: Error) {
    super(message);
    this.name = 'AuthenticationError';
    this.context = context;
    this.originalError = originalError;
  }
}

export class AuthorizationError extends Error implements AppError {
  type: ErrorType = ErrorType.AUTHORIZATION;
  severity: ErrorSeverity = ErrorSeverity.ERROR;
  context?: ErrorContext;
  originalError?: Error;
  isRetryable: boolean = false;
  shouldLog: boolean = true;

  constructor(message: string, context?: ErrorContext, originalError?: Error) {
    super(message);
    this.name = 'AuthorizationError';
    this.context = context;
    this.originalError = originalError;
  }
}

export class APIError extends Error implements AppError {
  type: ErrorType = ErrorType.API;
  severity: ErrorSeverity = ErrorSeverity.ERROR;
  context?: ErrorContext;
  originalError?: Error;
  isRetryable: boolean = true;
  retryCount: number = 0;
  shouldLog: boolean = true;
  statusCode?: number;

  constructor(message: string, context?: ErrorContext, originalError?: Error, statusCode?: number) {
    super(message);
    this.name = 'APIError';
    this.context = context;
    this.originalError = originalError;
    this.statusCode = statusCode;
  }
}

export class IntegrationError extends Error implements AppError {
  type: ErrorType = ErrorType.INTEGRATION;
  severity: ErrorSeverity = ErrorSeverity.WARNING;
  context?: ErrorContext;
  originalError?: Error;
  isRetryable: boolean = true;
  shouldLog: boolean = true;
  service?: string;

  constructor(message: string, service?: string, context?: ErrorContext, originalError?: Error) {
    super(message);
    this.name = 'IntegrationError';
    this.service = service;
    this.context = context;
    this.originalError = originalError;
  }
}
