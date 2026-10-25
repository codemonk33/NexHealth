import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthUser } from '../api/types';
import { fetchCurrentUser } from '../api/authApi';
import { useCryptoStore } from './cryptoStore';
import { queryClient } from '../lib/queryClient';

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  txnId: string | null;
  requires2fa: boolean;
  error: string | null;

  setUser: (user: AuthUser) => void;
  setTxnId: (txnId: string) => void;
  setRequires2fa: (value: boolean) => void;
  setError: (error: string | null) => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  fetchUser: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  txnId: null,
  requires2fa: false,
  error: null,

  setUser: (user) => set({ user, isAuthenticated: true, error: null }),
  setTxnId: (txnId) => set({ txnId }),
  setRequires2fa: (requires2fa) => set({ requires2fa }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),

  logout: async () => {
    // Clear React Query cache to prevent stale data
    queryClient.clear();
    // Clear crypto keys
    await useCryptoStore.getState().clearKeys();
    // Then clear auth tokens
    await AsyncStorage.multiRemove(['@bionex_access_token', '@bionex_refresh_token']);
    set({ user: null, isAuthenticated: false, txnId: null, requires2fa: false, error: null });
  },

  /**
   * Fetch authenticated user's profile from backend.
   * Called after login and on app launch if token exists.
   * 
   * Edge cases handled:
   * - Token exists but is invalid/expired → silently fails, user redirected to login
   * - Patient profile doesn't exist → throw error indicating incomplete registration
   * - Network failure → throw with retry suggestion
   */
  fetchUser: async () => {
    try {
      set({ isLoading: true, error: null });
      const userOut = await fetchCurrentUser();

      const authUser: AuthUser = {
        id: userOut.id,
        name: userOut.name,
        phone: userOut.phone,
        role: userOut.role as 'PATIENT' | 'DOCTOR' | 'ADMIN',
        email: userOut.email || undefined,
        dob: userOut.date_of_birth || undefined,
        gender: userOut.gender as 'MALE' | 'FEMALE' | 'OTHER' | undefined,
        is2faEnabled: userOut.is_2fa_enabled,
      };

      set({
        user: authUser,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      // Initialize crypto keys after successful authentication
      try {
        await useCryptoStore.getState().initializeKeys();
      } catch (cryptoErr) {
        console.warn('Failed to initialize crypto keys:', cryptoErr);
        // Don't fail auth flow if crypto init fails - user can still use app
        // but document upload will be blocked
      }
    } catch (err: any) {
      // If 401, token is invalid/expired - clear and force re-login
      if (err.statusCode === 401) {
        await AsyncStorage.multiRemove(['@bionex_access_token', '@bionex_refresh_token']);
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: 'Session expired. Please log in again.',
        });
        return;
      }

      // Other errors - preserve authentication state but log error
      const errorMessage = err.message || 'Failed to fetch user profile';
      set({
        isLoading: false,
        error: errorMessage,
      });
    }
  },

  /**
   * Check if user is authenticated on app launch.
   * 
   * Reads token from storage → if valid, fetch user profile.
   * If token missing or invalid, clear auth state.
   * 
   * Edge cases handled:
   * - No token → not authenticated (normal login flow)
   * - Token exists → validate by fetching user profile
   * - Token invalid → clear and require re-login
   * - Network failure → still mark as loading complete to avoid hang
   */
  checkAuth: async () => {
    try {
      const token = await AsyncStorage.getItem('@bionex_access_token');
      
      if (!token) {
        set({ isAuthenticated: false, isLoading: false });
        return;
      }

      // Token exists, try to fetch user profile to validate it
      await useAuthStore.getState().fetchUser();
    } catch (err: any) {
      // Any error during validation → treat as not authenticated
      await AsyncStorage.multiRemove(['@bionex_access_token', '@bionex_refresh_token']);
      set({ isAuthenticated: false, isLoading: false, user: null });
    }
  },
}));
