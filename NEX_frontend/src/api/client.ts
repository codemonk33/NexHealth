import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError } from './types';

// ─── Config ──────────────────────────────────────────────────────────────────
// Backend base URL — override via EXPO_PUBLIC_API_URL env var for different environments.
// Default points to the local FastAPI dev server on localhost:8000
// For mobile/tunnel access: set EXPO_PUBLIC_API_URL to your machine IP (e.g., http://192.168.x.x:8000/api/v1)
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

console.log('[API Client] Initialized with API_BASE_URL:', API_BASE_URL);
console.log('[API Client] Environment EXPO_PUBLIC_API_URL:', process.env.EXPO_PUBLIC_API_URL);

// Set to `true` ONLY during isolated UI development when no backend is running.
// In all integration/production environments this MUST be `false`.
export const USE_MOCK_DATA = false;

// ─── AsyncStorage token keys ─────────────────────────────────────────────────
export const TOKEN_KEYS = {
  ACCESS:  '@bionex_access_token',
  REFRESH: '@bionex_refresh_token',
} as const;

// ─── Axios instance ───────────────────────────────────────────────────────────
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // Increased from 15000ms to 30000ms for slower networks
  headers: {
    Accept: 'application/json',
    // NOTE: Do NOT set Content-Type here — let axios auto-detect
    // - For JSON requests: axios sets 'application/json'
    // - For FormData: browser/axios sets 'multipart/form-data' with boundary
  },
  withCredentials: false, // Important for CORS in web browser
});

// ─── Request Interceptor ──────────────────────────────────────────────────────
// Attach the stored Bearer token to every outgoing request.
// Special handling for FormData: explicitly set multipart/form-data.
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await AsyncStorage.getItem(TOKEN_KEYS.ACCESS);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // CRITICAL FIX: For FormData requests on React Native, explicitly set multipart/form-data
    // Axios on React Native doesn't auto-detect FormData like browsers do
    if (config.data instanceof FormData) {
      console.log('[API Client] Request Interceptor: FormData detected');
      console.log('[API Client] Setting multipart/form-data header explicitly');
      
      // On React Native, we MUST explicitly set this header
      // On web, this might include a boundary; on RN, fetch will handle it
      if (config.headers) {
        config.headers['Content-Type'] = 'multipart/form-data';
      }
      
      console.log('[API Client] FormData headers:', config.headers);
    } else if (config.data && typeof config.data === 'object' && !(config.data instanceof Blob)) {
      // For non-FormData JSON requests, ensure JSON content type
      if (config.headers && !config.headers['Content-Type']) {
        config.headers['Content-Type'] = 'application/json';
      }
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response Interceptor ─────────────────────────────────────────────────────
// Handles:
//   1. Silent token refresh on 401 — uses the stored refresh_token (snake_case,
//      matching the backend TokenRefresh schema: { refresh_token: string }).
//   2. Normalises all error responses into a typed ApiError object.

let _isRefreshing = false;
let _pendingQueue: {
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}[] = [];

/** Drain the queue of requests that were waiting on a token refresh. */
function _drainQueue(token: string | null, error: unknown) {
  _pendingQueue.forEach(({ resolve, reject }) =>
    token ? resolve(token) : reject(error)
  );
  _pendingQueue = [];
}

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error) => {
    console.log('[API Client] Full error object:', {
      message: error.message,
      code: error.code,
      statusCode: error.response?.status,
      url: error.config?.url,
      method: error.config?.method,
      baseURL: error.config?.baseURL,
      fullUrl: error.config?.baseURL + error.config?.url,
      responseData: error.response?.data,
      isNetworkError: !error.response, // No response = network error
      errno: error.errno,
      syscall: error.syscall,
    });

    const originalRequest = error.config as AxiosRequestConfig & {
      _retry?: boolean;
    };

    // ── 401: attempt silent token refresh ───────────────────────────────────
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // If a refresh is already in-flight, queue this request until it resolves.
      if (_isRefreshing) {
        return new Promise((resolve, reject) => {
          _pendingQueue.push({ resolve, reject });
        }).then((newToken) => {
          if (originalRequest.headers) {
            (originalRequest.headers as Record<string, string>).Authorization =
              `Bearer ${newToken}`;
          }
          return apiClient(originalRequest);
        });
      }

      _isRefreshing = true;

      try {
        const refreshToken = await AsyncStorage.getItem(TOKEN_KEYS.REFRESH);
        if (!refreshToken) throw new Error('No refresh token stored');

        // Backend expects: POST /auth/refresh  body: { refresh_token: string }
        // Backend returns: { access_token, refresh_token, token_type, role }
        const { data } = await axios.post<{
          access_token: string;
          refresh_token: string;
        }>(`${API_BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,          // ← snake_case as backend requires
        });

        const newAccessToken = data.access_token;
        const newRefreshToken = data.refresh_token;

        await AsyncStorage.setItem(TOKEN_KEYS.ACCESS, newAccessToken);
        await AsyncStorage.setItem(TOKEN_KEYS.REFRESH, newRefreshToken);

        // Update the original failed request and drain the waiting queue.
        if (originalRequest.headers) {
          (originalRequest.headers as Record<string, string>).Authorization =
            `Bearer ${newAccessToken}`;
        }
        _drainQueue(newAccessToken, null);
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed — clear all tokens and force the user back to login.
        await AsyncStorage.multiRemove([TOKEN_KEYS.ACCESS, TOKEN_KEYS.REFRESH]);
        _drainQueue(null, refreshError);
        // Propagate a standardised 401 error so the authStore can react.
        const apiError: ApiError = {
          code: 'SESSION_EXPIRED',
          message: 'Your session has expired. Please log in again.',
          statusCode: 401,
        };
        return Promise.reject(apiError);
      } finally {
        _isRefreshing = false;
      }
    }

    // ── All other errors — normalise into ApiError ────────────────────────────
    const responseData = error.response?.data;

    // FastAPI validation errors come as { detail: [{type, loc, msg}] }
    // Simple errors come as { detail: "string" }
    let message: string;
    if (typeof responseData?.detail === 'string') {
      message = responseData.detail;
    } else if (Array.isArray(responseData?.detail)) {
      // Pydantic validation errors — join all messages
      message = responseData.detail
        .map((e: { msg?: string }) => e.msg ?? 'Validation error')
        .join('; ');
    } else {
      message =
        responseData?.message ?? error.message ?? 'An unexpected error occurred';
    }

    const apiError: ApiError = {
      code: responseData?.code ?? 'UNKNOWN_ERROR',
      message,
      statusCode: error.response?.status ?? 0,
      details: responseData?.details,
    };

    return Promise.reject(apiError);
  }
);

export default apiClient;
