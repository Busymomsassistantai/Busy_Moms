import { errorService } from '../lib/errors/ErrorService';
import { NetworkError, APIError } from '../lib/errors/types';
import { RETRY_CONFIG, RETRYABLE_HTTP_CODES } from '../lib/errors/constants';

interface RequestOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  skipErrorLogging?: boolean;
}

interface RetryOptions {
  maxRetries: number;
  currentRetry: number;
  delay: number;
}

export class NetworkClient {
  private async executeWithRetry<T>(
    url: string,
    options: RequestOptions,
    retryOptions: RetryOptions
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      options.timeout || RETRY_CONFIG.TIMEOUT
    );

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const shouldRetry =
          RETRYABLE_HTTP_CODES.includes(response.status) &&
          retryOptions.currentRetry < retryOptions.maxRetries;

        if (shouldRetry) {
          await this.delay(retryOptions.delay);
          return this.executeWithRetry(url, options, {
            ...retryOptions,
            currentRetry: retryOptions.currentRetry + 1,
            delay: Math.min(
              retryOptions.delay * RETRY_CONFIG.BACKOFF_MULTIPLIER,
              RETRY_CONFIG.MAX_DELAY
            ),
          });
        }

        const errorText = await response.text().catch(() => 'Unknown error');
        throw errorService.parseNetworkError(
          new Error(`HTTP ${response.status}: ${errorText}`),
          response.status,
          {
            action: 'fetch',
            additionalInfo: {
              url,
              method: options.method || 'GET',
              status: response.status,
            },
          }
        );
      }

      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new NetworkError('Request timeout', {
          action: 'fetch',
          additionalInfo: { url, timeout: options.timeout },
        });
      }

      const shouldRetry =
        retryOptions.currentRetry < retryOptions.maxRetries &&
        (error instanceof NetworkError ? error.isRetryable : true);

      if (shouldRetry) {
        await this.delay(retryOptions.delay);
        return this.executeWithRetry(url, options, {
          ...retryOptions,
          currentRetry: retryOptions.currentRetry + 1,
          delay: Math.min(
            retryOptions.delay * RETRY_CONFIG.BACKOFF_MULTIPLIER,
            RETRY_CONFIG.MAX_DELAY
          ),
        });
      }

      throw error;
    }
  }

  async get<T>(url: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  async post<T>(url: string, data?: any, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(url, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  }

  async put<T>(url: string, data?: any, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(url, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  }

  async delete<T>(url: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(url, { ...options, method: 'DELETE' });
  }

  async patch<T>(url: string, data?: any, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(url, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  }

  private async request<T>(url: string, options: RequestOptions = {}): Promise<T> {
    const maxRetries = options.retries ?? RETRY_CONFIG.MAX_RETRIES;
    const retryDelay = options.retryDelay ?? RETRY_CONFIG.INITIAL_DELAY;

    try {
      const response = await this.executeWithRetry(url, options, {
        maxRetries,
        currentRetry: 0,
        delay: retryDelay,
      });

      if (response.status === 204) {
        return {} as T;
      }

      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return await response.json();
      }

      return (await response.text()) as unknown as T;
    } catch (error: any) {
      if (!options.skipErrorLogging) {
        await errorService.logError(error, {
          action: 'network_request',
          additionalInfo: {
            url,
            method: options.method || 'GET',
          },
        });
      }
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  createAbortController(): AbortController {
    return new AbortController();
  }
}

export const networkClient = new NetworkClient();
export default networkClient;
