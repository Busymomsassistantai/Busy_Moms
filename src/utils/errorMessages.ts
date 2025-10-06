import { ERROR_MESSAGES } from '../lib/errors/constants';

export function getNetworkErrorMessage(error: any): string {
  if (!navigator.onLine) {
    return ERROR_MESSAGES.NETWORK.OFFLINE;
  }

  if (error.message?.toLowerCase().includes('timeout')) {
    return ERROR_MESSAGES.NETWORK.TIMEOUT;
  }

  if (error.message?.toLowerCase().includes('fetch failed')) {
    return ERROR_MESSAGES.NETWORK.CONNECTION_FAILED;
  }

  return ERROR_MESSAGES.NETWORK.REQUEST_FAILED;
}

export function getAuthErrorMessage(error: any): string {
  const message = error.message?.toLowerCase() || '';

  if (message.includes('invalid login') || message.includes('invalid email or password')) {
    return ERROR_MESSAGES.AUTHENTICATION.INVALID_CREDENTIALS;
  }

  if (message.includes('jwt') || message.includes('token')) {
    return ERROR_MESSAGES.AUTHENTICATION.SESSION_EXPIRED;
  }

  if (message.includes('user already registered') || message.includes('email already')) {
    return ERROR_MESSAGES.AUTHENTICATION.EMAIL_IN_USE;
  }

  if (message.includes('email not confirmed') || message.includes('not verified')) {
    return ERROR_MESSAGES.AUTHENTICATION.EMAIL_NOT_VERIFIED;
  }

  return ERROR_MESSAGES.AUTHENTICATION.UNAUTHORIZED;
}

export function getDatabaseErrorMessage(error: any): string {
  const message = error.message?.toLowerCase() || '';
  const code = error.code || '';

  if (code === '23505' || message.includes('unique constraint')) {
    return ERROR_MESSAGES.DATABASE.UNIQUE_CONSTRAINT;
  }

  if (code === '23503' || message.includes('foreign key')) {
    return ERROR_MESSAGES.DATABASE.FOREIGN_KEY_VIOLATION;
  }

  if (code === '23502' || message.includes('not null')) {
    return ERROR_MESSAGES.VALIDATION.REQUIRED_FIELD;
  }

  if (message.includes('insert')) {
    return ERROR_MESSAGES.DATABASE.INSERT_FAILED;
  }

  if (message.includes('update')) {
    return ERROR_MESSAGES.DATABASE.UPDATE_FAILED;
  }

  if (message.includes('delete')) {
    return ERROR_MESSAGES.DATABASE.DELETE_FAILED;
  }

  return ERROR_MESSAGES.DATABASE.QUERY_FAILED;
}

export function getValidationErrorMessage(field: string, error: any): string {
  const message = error.message?.toLowerCase() || '';

  if (message.includes('required')) {
    return ERROR_MESSAGES.VALIDATION.REQUIRED_FIELD;
  }

  if (field.includes('email') && message.includes('invalid')) {
    return ERROR_MESSAGES.VALIDATION.INVALID_EMAIL;
  }

  if (field.includes('phone') && message.includes('invalid')) {
    return ERROR_MESSAGES.VALIDATION.INVALID_PHONE;
  }

  if (field.includes('date') && message.includes('invalid')) {
    return ERROR_MESSAGES.VALIDATION.INVALID_DATE;
  }

  if (field.includes('time') && message.includes('invalid')) {
    return ERROR_MESSAGES.VALIDATION.INVALID_TIME;
  }

  if (field.includes('password') && message.includes('too short')) {
    return ERROR_MESSAGES.VALIDATION.PASSWORD_TOO_SHORT;
  }

  return error.message || ERROR_MESSAGES.GENERAL.SOMETHING_WENT_WRONG;
}

export function getAPIErrorMessage(statusCode: number, defaultMessage?: string): string {
  switch (statusCode) {
    case 400:
      return ERROR_MESSAGES.API.BAD_REQUEST;
    case 401:
      return ERROR_MESSAGES.AUTHENTICATION.UNAUTHORIZED;
    case 403:
      return ERROR_MESSAGES.AUTHORIZATION.PERMISSION_DENIED;
    case 404:
      return ERROR_MESSAGES.API.NOT_FOUND;
    case 429:
      return ERROR_MESSAGES.API.RATE_LIMIT;
    case 500:
    case 502:
      return ERROR_MESSAGES.API.SERVER_ERROR;
    case 503:
      return ERROR_MESSAGES.API.SERVICE_UNAVAILABLE;
    case 504:
      return ERROR_MESSAGES.NETWORK.TIMEOUT;
    default:
      return defaultMessage || ERROR_MESSAGES.GENERAL.SOMETHING_WENT_WRONG;
  }
}

export function getIntegrationErrorMessage(service: string, error: any): string {
  const message = error.message?.toLowerCase() || '';

  switch (service.toLowerCase()) {
    case 'google':
    case 'google calendar':
      if (message.includes('auth') || message.includes('unauthorized')) {
        return ERROR_MESSAGES.INTEGRATION.GOOGLE_AUTH_FAILED;
      }
      return ERROR_MESSAGES.INTEGRATION.GOOGLE_CALENDAR_SYNC_FAILED;

    case 'openai':
    case 'ai':
      return ERROR_MESSAGES.INTEGRATION.OPENAI_UNAVAILABLE;

    case 'voice':
    case 'webrtc':
      return ERROR_MESSAGES.INTEGRATION.VOICE_CHAT_FAILED;

    case 'whatsapp':
      return ERROR_MESSAGES.INTEGRATION.WHATSAPP_PARSE_FAILED;

    default:
      return ERROR_MESSAGES.GENERAL.SOMETHING_WENT_WRONG;
  }
}

export function formatErrorForUser(error: any): string {
  if (typeof error === 'string') {
    return error;
  }

  if (error.message) {
    if (error.type) {
      switch (error.type) {
        case 'NetworkError':
          return getNetworkErrorMessage(error);
        case 'AuthenticationError':
          return getAuthErrorMessage(error);
        case 'DatabaseError':
          return getDatabaseErrorMessage(error);
        case 'IntegrationError':
          return getIntegrationErrorMessage(error.service || 'unknown', error);
        default:
          return error.message;
      }
    }
    return error.message;
  }

  return ERROR_MESSAGES.GENERAL.UNKNOWN_ERROR;
}

export function isRetryableError(error: any): boolean {
  if (error.isRetryable !== undefined) {
    return error.isRetryable;
  }

  const message = error.message?.toLowerCase() || '';

  const retryablePatterns = [
    'network',
    'timeout',
    'fetch failed',
    'connection',
    '429',
    '500',
    '502',
    '503',
    '504',
  ];

  return retryablePatterns.some((pattern) => message.includes(pattern));
}

export function shouldLogError(error: any): boolean {
  if (error.shouldLog !== undefined) {
    return error.shouldLog;
  }

  const message = error.message?.toLowerCase() || '';

  const nonLoggablePatterns = ['validation', 'required', 'invalid email', 'invalid phone'];

  return !nonLoggablePatterns.some((pattern) => message.includes(pattern));
}
