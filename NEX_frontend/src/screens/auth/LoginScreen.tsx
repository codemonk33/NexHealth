import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, Lock } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../theme';
import { useLogin } from '../../api/authApi';
import { useAuthStore } from '../../store/authStore';
import type { AuthStackParamList } from '../../navigation/AuthStack';

type NavigationProp = NativeStackNavigationProp<AuthStackParamList>;

// ─── Password Validation ─────────────────────────────────────────────────────
interface PasswordStrength {
  score: number; // 0-4
  hasLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasDigit: boolean;
  hasSpecial: boolean;
}

function validatePassword(password: string): PasswordStrength {
  const strength: PasswordStrength = {
    score: 0,
    hasLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasDigit: /\d/.test(password),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  };

  strength.score = [
    strength.hasLength,
    strength.hasUppercase,
    strength.hasLowercase,
    strength.hasDigit,
    strength.hasSpecial,
  ].filter(Boolean).length;

  return strength;
}

// ─── Phone Validation ────────────────────────────────────────────────────────
function validatePhone(phone: string): boolean {
  // E.164 format: +91XXXXXXXXXX (10 digits after +91)
  // We accept 10-digit input and auto-prefix with +91
  return /^\d{10}$/.test(phone);
}

export function LoginScreen() {
  const navigation = useNavigation<NavigationProp>();
  const authStore = useAuthStore();
  const { setUser, setRequires2fa } = authStore;
  const login = useLogin();

  const [phoneValue, setPhoneValue] = useState('');
  const [passwordValue, setPasswordValue] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const passwordStrength = validatePassword(passwordValue);
  const isPhoneValid = phoneValue.length === 0 || validatePhone(phoneValue);
  const isPasswordValid = passwordValue.length >= 8 && passwordStrength.score >= 4;
  const canSubmit = validatePhone(phoneValue) && isPasswordValid && !login.isPending;

  const handleLogin = async () => {
    setError('');

    // Validate inputs
    if (!validatePhone(phoneValue)) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (!isPasswordValid) {
      setError('Password must meet all requirements.');
      return;
    }

    try {
      const result = await login.mutateAsync({
        phone: `+91${phoneValue}`,
        password: passwordValue,
      });

      // Store basic user data from token
      setUser(result.user);

      // Handle 2FA if required
      if (result.requires2fa) {
        setRequires2fa(true);
        // TODO: Navigate to 2FA screen when available
        Alert.alert('2FA Required', 'Two-factor authentication setup required.');
        return;
      }

      // Fetch full user profile asynchronously after login
      // This populates the auth store with complete user data
      setTimeout(() => {
        authStore.fetchUser().catch((err) => {
          console.error('Failed to fetch user profile after login:', err);
          // Don't block the login flow if profile fetch fails
        });
      }, 0);

      // Success - user will be navigated by auth state change in App.tsx
    } catch (err: any) {
      if (err.code === 'ACCOUNT_LOCKED') {
        setError('Account locked due to too many failed attempts. Try again later.');
      } else if (err.statusCode === 429) {
        setError('Too many login attempts. Please try again later.');
      } else {
        setError(err.message || 'Login failed. Please check your credentials.');
      }
    }
  };

  const handleRegisterPress = () => {
    navigation.navigate('Register');
  };

  const isLoading = login.isPending;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header Gradient */}
          <LinearGradient
            colors={[Colors.tealBg, Colors.blueBg]}
            style={styles.headerGradient}
          >
            <View style={styles.logoRow}>
              <Text style={styles.logoEmoji}>🩺</Text>
              <Text style={styles.brandName}>Bionex</Text>
            </View>
            <Text style={styles.tagline}>Your complete health ecosystem</Text>
          </LinearGradient>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Welcome Back</Text>
            <Text style={styles.cardSubtitle}>Sign in to access your health records</Text>

            {/* Phone Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Mobile Number</Text>
              <View style={styles.phoneRow}>
                <View style={styles.countryCode}>
                  <Text style={styles.countryCodeText}>🇮🇳 +91</Text>
                </View>
                <TextInput
                  id="input-phone"
                  style={styles.phoneInput}
                  placeholder="Enter 10-digit number"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={phoneValue}
                  onChangeText={setPhoneValue}
                  editable={!isLoading}
                />
              </View>
              {!isPhoneValid && phoneValue.length > 0 && (
                <Text style={styles.fieldError}>Invalid phone number</Text>
              )}
            </View>

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <View style={styles.passwordLabelRow}>
                <Text style={styles.inputLabel}>Password</Text>
                {passwordValue.length > 0 && (
                  <Text style={styles.strengthLabel}>
                    Strength: <Text style={_getStrengthColor(passwordStrength.score)}>{_getStrengthLabel(passwordStrength.score)}</Text>
                  </Text>
                )}
              </View>
              <View style={styles.passwordInputRow}>
                <TextInput
                  id="input-password"
                  style={styles.passwordInput}
                  placeholder="Enter password"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={!showPassword}
                  value={passwordValue}
                  onChangeText={setPasswordValue}
                  editable={!isLoading}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.passwordToggle}
                  disabled={isLoading}
                >
                  <Text style={styles.passwordToggleText}>
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Password Requirements */}
              {passwordValue.length > 0 && (
                <View style={styles.requirementsList}>
                  <RequirementItem
                    met={passwordStrength.hasLength}
                    label="At least 8 characters"
                  />
                  <RequirementItem
                    met={passwordStrength.hasUppercase}
                    label="One uppercase letter"
                  />
                  <RequirementItem
                    met={passwordStrength.hasLowercase}
                    label="One lowercase letter"
                  />
                  <RequirementItem
                    met={passwordStrength.hasDigit}
                    label="One number"
                  />
                  <RequirementItem
                    met={passwordStrength.hasSpecial}
                    label="One special character (!@#$...)"
                  />
                </View>
              )}
            </View>

            {/* Error Banner */}
            {!!error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              id="btn-login"
              onPress={handleLogin}
              disabled={!canSubmit}
              activeOpacity={0.85}
              style={styles.submitBtn}
            >
              <LinearGradient
                colors={
                  canSubmit
                    ? [Colors.royalBlue, Colors.royalBlueDark]
                    : [Colors.textMuted, Colors.textMuted]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitGradient}
              >
                {isLoading ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <>
                    <Text style={styles.submitText}>Sign In</Text>
                    <ArrowRight color={Colors.white} size={18} strokeWidth={2.5} />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Register Link */}
            <View style={styles.registerRow}>
              <Text style={styles.registerText}>Don't have an account? </Text>
              <TouchableOpacity onPress={handleRegisterPress} disabled={isLoading}>
                <Text style={styles.registerLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>

            {/* Terms */}
            <Text style={styles.terms}>
              By continuing, you agree to Bionex's{' '}
              <Text style={styles.termsLink}>Terms & Privacy Policy</Text>
            </Text>

            {/* Security Badge */}
            <View style={styles.securityBadge}>
              <Lock size={14} color={Colors.tealDark} strokeWidth={2} />
              <Text style={styles.securityBadgeText}>
                🔒 HIPAA Compliant · 🛡️ End-to-End Encrypted
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Helper Components ──────────────────────────────────────────────────────

function RequirementItem({ met, label }: { met: boolean; label: string }) {
  return (
    <View style={styles.requirementItem}>
      <Text style={styles.requirementIcon}>{met ? '✅' : '⭕'}</Text>
      <Text style={[styles.requirementLabel, !met && styles.requirementLabelUnmet]}>
        {label}
      </Text>
    </View>
  );
}

function _getStrengthLabel(score: number): string {
  if (score < 2) return 'Weak';
  if (score < 4) return 'Fair';
  if (score < 5) return 'Good';
  return 'Strong';
}

function _getStrengthColor(score: number) {
  if (score < 2) return styles.strengthWeak;
  if (score < 4) return styles.strengthFair;
  if (score < 5) return styles.strengthGood;
  return styles.strengthStrong;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { flexGrow: 1 },
  headerGradient: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing['2xl'],
    paddingBottom: Spacing['3xl'],
    alignItems: 'center',
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  logoEmoji: { fontSize: 28 },
  brandName: {
    fontSize: Typography.fontSize['3xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.teal,
  },
  tagline: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  card: {
    margin: Spacing.base,
    marginTop: -Spacing['2xl'],
    backgroundColor: Colors.white,
    borderRadius: BorderRadius['2xl'],
    padding: Spacing.xl,
    ...Shadows.lg,
  },
  cardTitle: {
    fontSize: Typography.fontSize['3xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
  },
  inputGroup: { marginBottom: Spacing.lg },
  inputLabel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  passwordLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  strengthLabel: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.textMuted,
  },
  strengthWeak: { color: Colors.error },
  strengthFair: { color: '#F59E0B' },
  strengthGood: { color: '#10B981' },
  strengthStrong: { color: Colors.success },
  phoneRow: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  countryCode: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countryCodeText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.textPrimary,
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.textPrimary,
  },
  fieldError: {
    fontSize: Typography.fontSize.xs,
    color: Colors.error,
    marginTop: 4,
    fontFamily: Typography.fontFamily.medium,
  },
  passwordInputRow: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.textPrimary,
  },
  passwordToggle: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  passwordToggleText: {
    fontSize: 18,
  },
  requirementsList: {
    marginTop: Spacing.sm,
    paddingLeft: Spacing.sm,
    gap: 4,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requirementIcon: {
    fontSize: Typography.fontSize.sm,
  },
  requirementLabel: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.success,
  },
  requirementLabelUnmet: {
    color: Colors.textMuted,
  },
  errorBanner: {
    backgroundColor: Colors.errorBg,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
  },
  errorText: {
    color: Colors.error,
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
  },
  submitBtn: { marginBottom: Spacing.base, borderRadius: BorderRadius.full, overflow: 'hidden' },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md + 2,
  },
  submitText: {
    color: Colors.white,
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.semiBold,
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: Spacing.base,
  },
  registerText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textSecondary,
  },
  registerLink: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.royalBlue,
  },
  terms: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: Spacing.base,
  },
  termsLink: { color: Colors.royalBlue, fontFamily: Typography.fontFamily.medium },
  securityBadge: {
    backgroundColor: Colors.tealBg,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  securityBadgeText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.tealDark,
    textAlign: 'center',
  },
});
