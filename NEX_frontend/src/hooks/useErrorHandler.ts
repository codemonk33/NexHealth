/**
 * useErrorHandler — Standardized Error Management Hook
 * 
 * Provides:
 * - Error state tracking (message, context)
 * - Auto-dismiss with configurable delay
 * - Fallback messages for network errors
 * - Context-aware error logging
 * - Type-safe error handling
 * 
 * Usage:
 * ```tsx
 * const { handleError, errorMessage, clearError, isError } = useErrorHandler();
 * 
 * try {
 *   await apiCall();
 * } catch (err) {
 *   handleError(err, {
 *     fallbackMessage: 'Failed to load data',
 *     context: 'DataLoading'
 *   });
 * }
 * ```
 */

import { useCallback, useState } from 'react';
import { ApiError } from '@/api/types';

export interface ErrorHandlerOptions {
  fallbackMessage?: string;
  context?: string;
  autoDismissMs?: number; // 0 = no auto dismiss, default = 5000ms
}

export interface UseErrorHandlerReturn {
  errorMessage: string | null;
  isError: boolean;
  handleError: (error: unknown, options?: ErrorHandlerOptions) => void;
  clearError: () => void;
  setErrorMessage: (message: string | null) => void;
}

/**
 * Global error timeout tracker to prevent duplicate timers
 */
let _errorTimeoutId: NodeJS.Timeout | null = null;

export function useErrorHandler(): UseErrorHandlerReturn {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /**
   * Handle error by extracting message and setting it with optional auto-dismiss
   */
  const handleError = useCallback(
    (error: unknown, options?: ErrorHandlerOptions) => {
      // Cancel any pending auto-dismiss
      if (_errorTimeoutId) {
        clearTimeout(_errorTimeoutId);
        _errorTimeoutId = null;
      }

      let message = options?.fallbackMessage ?? 'An error occurred';

      // Extract message from ApiError
      if (isApiError(error)) {
        message = error.message || message;
      }
      // Extract message from Error
      else if (error instanceof Error) {
        message = error.message || message;
      }
      // For unexpected types, use fallback
      else if (typeof error === 'string') {
        message = error;
      }

      // Set error message
      setErrorMessage(message);

      // Log error for debugging (in production, send to error tracking service)
      if (options?.context) {
        console.warn(`[${options.context}] Error:`, message, error);
      } else {
        console.warn('Error:', message, error);
      }

      // Auto-dismiss after delay
      const dismissDelay = options?.autoDismissMs ?? 5000;
      if (dismissDelay > 0) {
        _errorTimeoutId = setTimeout(() => {
          setErrorMessage(null);
          _errorTimeoutId = null;
        }, dismissDelay);
      }
    },
    []
  );

  /**
   * Clear error message and cancel auto-dismiss
   */
  const clearError = useCallback(() => {
    if (_errorTimeoutId) {
      clearTimeout(_errorTimeoutId);
      _errorTimeoutId = null;
    }
    setErrorMessage(null);
  }, []);

  return {
    errorMessage,
    isError: errorMessage !== null,
    handleError,
    clearError,
    setErrorMessage,
  };
}

/**
 * Type guard for ApiError
 */
function isApiError(err: unknown): err is ApiError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    'message' in err &&
    'statusCode' in err
  );
}
