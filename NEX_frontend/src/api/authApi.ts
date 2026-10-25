import apiClient, { USE_MOCK_DATA , TOKEN_KEYS } from './client';
import type {
  RequestAbhaOtpPayload,
  VerifyAbhaOtpPayload,
  LoginWithPhonePayload,
  VerifyPhoneOtpPayload,
  AuthResponse,
  OtpResponse,
  LoginRequest,
  RegisterRequest,
  TokenResponseBackend,
  UserOut,
  AuthUser,
} from './types';
import { useMutation } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Mock Helpers ──────────────────────────────────────────────────────────────
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

const MOCK_OTP_RESPONSE: OtpResponse = {
  txnId: 'mock-txn-' + Date.now(),
  message: 'OTP sent successfully',
  expiresIn: 300,
};

const MOCK_AUTH_RESPONSE: AuthResponse = {
  user: {
    id: 'user-001',
    name: 'Prajesh Kumar',
    phone: '+919876543210',
    role: 'PATIENT',
    abhaId: '12-3456-7890-1234',
    abhaAddress: 'prajesh.kumar@abdm',
    dob: '1992-05-15',
    gender: 'MALE',
  },
  accessToken: 'mock-access-token-bionex',
  refreshToken: 'mock-refresh-token-bionex',
  role: 'PATIENT',
  requires2fa: false,
};

// ─── Helper: Transform backend TokenResponse to frontend AuthResponse ────────
/**
 * Maps backend TokenResponseBackend to frontend AuthResponse.
 * Stores tokens immediately; full user profile is fetched separately by authStore.
 */
async function transformTokenResponse(
  backendResponse: TokenResponseBackend
): Promise<AuthResponse> {
  // Store tokens immediately so subsequent requests are authenticated
  await AsyncStorage.setItem(TOKEN_KEYS.ACCESS, backendResponse.access_token);
  if (backendResponse.refresh_token) {
    await AsyncStorage.setItem(TOKEN_KEYS.REFRESH, backendResponse.refresh_token);
  }

  // Return minimal AuthResponse with role from token
  // Full user profile will be fetched by authStore.fetchUser() after login
  const authUser: AuthUser = {
    id: '',  // Placeholder - will be populated by fetchUser()
    name: '', // Placeholder - will be populated by fetchUser()
    phone: '',  // Placeholder - will be populated by fetchUser()
    role: backendResponse.role as 'PATIENT' | 'DOCTOR' | 'ADMIN',
  };

  return {
    user: authUser,
    accessToken: backendResponse.access_token,
    refreshToken: backendResponse.refresh_token || '',
    role: backendResponse.role as 'PATIENT' | 'DOCTOR' | 'ADMIN',
    requires2fa: backendResponse.requires_2fa ?? false,
  };
}

// ─── API Functions – Password-based Authentication ───────────────────────────

/**
 * Login with phone number and password (password-based auth).
 * Backend enforces:
 *   - Phone in E.164 format: +[1-9]\d{6,14}
 *   - Password: 8+ chars, uppercase, lowercase, digit, special char
 */
export async function login(payload: LoginRequest): Promise<AuthResponse> {
  if (USE_MOCK_DATA) {
    await delay(1500);
    if (payload.password !== 'Bionex@123') {
      throw {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid phone or password.',
        statusCode: 401,
      };
    }
    return MOCK_AUTH_RESPONSE;
  }

  try {
    console.log('[AuthAPI] login: starting with payload:', { phone: payload.phone });
    const { data } = await apiClient.post<TokenResponseBackend>(
      '/auth/login',
      {
        phone: payload.phone,
        password: payload.password,
      }
    );
    console.log('[AuthAPI] login: success');
    const response = await transformTokenResponse(data);
    
    // Fetch full user profile asynchronously (authStore will handle this)
    // Don't block login on profile fetch
    console.log('[AuthAPI] login: tokens stored, will fetch user profile via authStore');
    
    return response;
  } catch (error: any) {
    console.error('[AuthAPI] login: error caught:', error);
    // Handle specific backend errors
    if (error.statusCode === 429) {
      throw {
        code: 'ACCOUNT_LOCKED',
        message: error.message || 'Account locked due to too many failed attempts.',
        statusCode: 429,
      };
    }
    throw error;
  }
}

/**
 * Register a new user account.
 * Backend enforces:
 *   - Phone in E.164 format: +[1-9]\d{6,14}
 *   - Password: 8+ chars, uppercase, lowercase, digit, special char
 */
export async function register(payload: RegisterRequest): Promise<AuthResponse> {
  if (USE_MOCK_DATA) {
    await delay(1500);
    return MOCK_AUTH_RESPONSE;
  }

  try {
    const { data } = await apiClient.post<UserOut>(
      '/auth/register',
      {
        name: payload.name,
        phone: payload.phone,
        password: payload.password,
        email: payload.email || null,
        role: payload.role || 'PATIENT',
      }
    );

    // After registration, automatically log in
    // Note: Backend doesn't return tokens from register, user must login after
    // So we'll return a response indicating registration success
    const authUser: AuthUser = {
      id: data.id,
      name: data.name,
      phone: data.phone,
      role: data.role as 'PATIENT' | 'DOCTOR' | 'ADMIN',
      email: data.email || undefined,
      is2faEnabled: data.is_2fa_enabled,
    };

    return {
      user: authUser,
      accessToken: '',
      refreshToken: '',
      role: data.role as 'PATIENT' | 'DOCTOR' | 'ADMIN',
      requires2fa: false,
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Fetch current authenticated user's profile.
 * Merged endpoint: returns UserOut + PatientOut
 */
export async function fetchCurrentUser(): Promise<UserOut> {
  const { data } = await apiClient.get<UserOut>('/patients/me');
  return data;
}

/**
 * Logout: clear tokens from storage and mark session as expired.
 */
export async function logout(): Promise<void> {
  await AsyncStorage.multiRemove([TOKEN_KEYS.ACCESS, TOKEN_KEYS.REFRESH]);
}

// ─── OTP-based Authentication (Legacy/Phase 2) ──────────────────────────────

export async function requestAbhaOtp(
  payload: RequestAbhaOtpPayload
): Promise<OtpResponse> {
  if (USE_MOCK_DATA) {
    await delay(1200);
    return { ...MOCK_OTP_RESPONSE, txnId: 'mock-txn-abha-' + Date.now() };
  }
  // Backend endpoint TBD in Phase 3
  const { data } = await apiClient.post('/auth/abha/request-otp', payload);
  return data.data;
}

export async function verifyAbhaOtp(
  payload: VerifyAbhaOtpPayload
): Promise<AuthResponse> {
  if (USE_MOCK_DATA) {
    await delay(1500);
    if (payload.otp !== '123456') {
      throw { code: 'INVALID_OTP', message: 'Invalid OTP. Please try again.', statusCode: 400 };
    }
    await AsyncStorage.setItem('@bionex_access_token', MOCK_AUTH_RESPONSE.accessToken);
    await AsyncStorage.setItem('@bionex_refresh_token', MOCK_AUTH_RESPONSE.refreshToken);
    return MOCK_AUTH_RESPONSE;
  }
  // Backend endpoint TBD in Phase 3
  const { data } = await apiClient.post('/auth/abha/verify-otp', payload);
  return data.data;
}

export async function requestPhoneOtp(
  payload: LoginWithPhonePayload
): Promise<OtpResponse> {
  if (USE_MOCK_DATA) {
    await delay(1000);
    return { ...MOCK_OTP_RESPONSE, txnId: 'mock-txn-phone-' + Date.now() };
  }
  // Backend endpoint TBD in Phase 2
  const { data } = await apiClient.post('/auth/phone/request-otp', payload);
  return data.data;
}

export async function verifyPhoneOtp(
  payload: VerifyPhoneOtpPayload
): Promise<AuthResponse> {
  if (USE_MOCK_DATA) {
    await delay(1500);
    if (payload.otp !== '123456') {
      throw { code: 'INVALID_OTP', message: 'Invalid OTP. Please try again.', statusCode: 400 };
    }
    await AsyncStorage.setItem('@bionex_access_token', MOCK_AUTH_RESPONSE.accessToken);
    await AsyncStorage.setItem('@bionex_refresh_token', MOCK_AUTH_RESPONSE.refreshToken);
    return MOCK_AUTH_RESPONSE;
  }
  // Backend endpoint TBD in Phase 2
  const { data } = await apiClient.post('/auth/phone/verify-otp', payload);
  return data.data;
}

// ─── React Query Hooks ─────────────────────────────────────────────────────────

export function useLogin() {
  return useMutation({ mutationFn: login });
}

export function useRegister() {
  return useMutation({ mutationFn: register });
}

export function useFetchCurrentUser() {
  return useMutation({ mutationFn: fetchCurrentUser });
}

export function useRequestAbhaOtp() {
  return useMutation({ mutationFn: requestAbhaOtp });
}

export function useVerifyAbhaOtp() {
  return useMutation({ mutationFn: verifyAbhaOtp });
}

export function useRequestPhoneOtp() {
  return useMutation({ mutationFn: requestPhoneOtp });
}

export function useVerifyPhoneOtp() {
  return useMutation({ mutationFn: verifyPhoneOtp });
}
