import { ErrorType, ErrorSeverity } from './types';

export const ERROR_MESSAGES = {
  NETWORK: {
    OFFLINE: 'You appear to be offline. Please check your internet connection.',
    TIMEOUT: 'The request took too long to complete. Please try again.',
    SERVER_ERROR: 'Our servers are experiencing issues. Please try again later.',
    CONNECTION_FAILED: 'Failed to connect to the server. Please check your connection.',
    REQUEST_FAILED: 'The request failed. Please try again.',
  },
  VALIDATION: {
    REQUIRED_FIELD: 'This field is required.',
    INVALID_EMAIL: 'Please enter a valid email address.',
    INVALID_PHONE: 'Please enter a valid phone number.',
    INVALID_DATE: 'Please enter a valid date.',
    INVALID_TIME: 'Please enter a valid time.',
    PASSWORD_TOO_SHORT: 'Password must be at least 6 characters.',
    PASSWORDS_DONT_MATCH: 'Passwords do not match.',
    INVALID_FILE_TYPE: 'This file type is not supported.',
    FILE_TOO_LARGE: 'File size exceeds the maximum limit.',
  },
  DATABASE: {
    QUERY_FAILED: 'Failed to load data. Please try again.',
    INSERT_FAILED: 'Failed to save your changes. Please try again.',
    UPDATE_FAILED: 'Failed to update. Please try again.',
    DELETE_FAILED: 'Failed to delete. Please try again.',
    UNIQUE_CONSTRAINT: 'This value already exists. Please use a different one.',
    FOREIGN_KEY_VIOLATION: 'Cannot complete this action due to related data.',
    CONNECTION_ERROR: 'Database connection error. Please try again.',
  },
  AUTHENTICATION: {
    INVALID_CREDENTIALS: 'Invalid email or password.',
    SESSION_EXPIRED: 'Your session has expired. Please sign in again.',
    UNAUTHORIZED: 'You must be signed in to perform this action.',
    EMAIL_NOT_VERIFIED: 'Please verify your email address.',
    ACCOUNT_DISABLED: 'Your account has been disabled.',
    USER_NOT_FOUND: 'No account found with this email.',
    EMAIL_IN_USE: 'An account with this email already exists.',
    WEAK_PASSWORD: 'Please choose a stronger password.',
  },
  AUTHORIZATION: {
    PERMISSION_DENIED: 'You do not have permission to perform this action.',
    ACCESS_DENIED: 'Access denied.',
    INSUFFICIENT_PERMISSIONS: 'Insufficient permissions.',
  },
  API: {
    RATE_LIMIT: 'Too many requests. Please wait a moment and try again.',
    BAD_REQUEST: 'Invalid request. Please check your input.',
    NOT_FOUND: 'The requested resource was not found.',
    SERVER_ERROR: 'Server error. Please try again later.',
    SERVICE_UNAVAILABLE: 'Service temporarily unavailable. Please try again later.',
  },
  INTEGRATION: {
    GOOGLE_CALENDAR_SYNC_FAILED: 'Failed to sync with Google Calendar. Please try reconnecting.',
    GOOGLE_AUTH_FAILED: 'Google sign-in failed. Please try again.',
    OPENAI_UNAVAILABLE: 'AI assistant is temporarily unavailable.',
    VOICE_CHAT_FAILED: 'Voice chat connection failed. Please try again.',
    WHATSAPP_PARSE_FAILED: 'Could not parse WhatsApp message. Please enter details manually.',
  },
  GENERAL: {
    UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
    SOMETHING_WENT_WRONG: 'Something went wrong. Please try again.',
    TRY_AGAIN_LATER: 'Please try again later.',
  },
};

export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  INITIAL_DELAY: 1000,
  MAX_DELAY: 8000,
  BACKOFF_MULTIPLIER: 2,
  TIMEOUT: 30000,
};

export const ERROR_LOG_CONFIG = {
  MAX_STACK_TRACE_LENGTH: 5000,
  DEDUPE_WINDOW_MS: 60000,
  MAX_CONTEXT_SIZE: 10000,
};

export const SEVERITY_COLORS = {
  [ErrorSeverity.CRITICAL]: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    border: 'border-red-300',
  },
  [ErrorSeverity.ERROR]: {
    bg: 'bg-orange-100',
    text: 'text-orange-800',
    border: 'border-orange-300',
  },
  [ErrorSeverity.WARNING]: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    border: 'border-yellow-300',
  },
  [ErrorSeverity.INFO]: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    border: 'border-blue-300',
  },
};

export const ERROR_TYPE_ICONS = {
  [ErrorType.NETWORK]: '📡',
  [ErrorType.VALIDATION]: '✏️',
  [ErrorType.DATABASE]: '💾',
  [ErrorType.AUTHENTICATION]: '🔐',
  [ErrorType.AUTHORIZATION]: '🚫',
  [ErrorType.API]: '🔌',
  [ErrorType.INTEGRATION]: '🔗',
  [ErrorType.UNKNOWN]: '❓',
};

export const RETRYABLE_HTTP_CODES = [408, 429, 500, 502, 503, 504];

export const USER_FRIENDLY_ERROR_MAP: Record<string, string> = {
  'fetch failed': ERROR_MESSAGES.NETWORK.CONNECTION_FAILED,
  'networkerror': ERROR_MESSAGES.NETWORK.CONNECTION_FAILED,
  'timeout': ERROR_MESSAGES.NETWORK.TIMEOUT,
  'aborted': 'Request was cancelled.',
  '400': ERROR_MESSAGES.API.BAD_REQUEST,
  '401': ERROR_MESSAGES.AUTHENTICATION.UNAUTHORIZED,
  '403': ERROR_MESSAGES.AUTHORIZATION.PERMISSION_DENIED,
  '404': ERROR_MESSAGES.API.NOT_FOUND,
  '429': ERROR_MESSAGES.API.RATE_LIMIT,
  '500': ERROR_MESSAGES.API.SERVER_ERROR,
  '502': ERROR_MESSAGES.API.SERVER_ERROR,
  '503': ERROR_MESSAGES.API.SERVICE_UNAVAILABLE,
  '504': ERROR_MESSAGES.NETWORK.TIMEOUT,
  'unique constraint': ERROR_MESSAGES.DATABASE.UNIQUE_CONSTRAINT,
  'foreign key': ERROR_MESSAGES.DATABASE.FOREIGN_KEY_VIOLATION,
  'not null violation': ERROR_MESSAGES.VALIDATION.REQUIRED_FIELD,
  'invalid email': ERROR_MESSAGES.VALIDATION.INVALID_EMAIL,
  'user already registered': ERROR_MESSAGES.AUTHENTICATION.EMAIL_IN_USE,
  'invalid login credentials': ERROR_MESSAGES.AUTHENTICATION.INVALID_CREDENTIALS,
  'jwt expired': ERROR_MESSAGES.AUTHENTICATION.SESSION_EXPIRED,
  'refresh_token_not_found': ERROR_MESSAGES.AUTHENTICATION.SESSION_EXPIRED,
};
