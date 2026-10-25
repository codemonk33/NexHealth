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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, ArrowLeft, Check } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../theme';
import { useRegister } from '../../api/authApi';
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
  return /^\d{10}$/.test(phone);
}

// ─── Name Validation ────────────────────────────────────────────────────────
function validateName(name: string): boolean {
  return name.trim().length >= 2 && name.trim().length <= 100;
}

export function RegisterScreen() {
  const navigation = useNavigation<NavigationProp>();
  const register = useRegister();

  const [step, setStep] = useState<'details' | 'security' | 'review'>(
    'details'
  );

  // Form state
  const [nameValue, setNameValue] = useState('');
  const [phoneValue, setPhoneValue] = useState('');
  const [emailValue, setEmailValue] = useState('');
  const [passwordValue, setPasswordValue] = useState('');
  const [confirmPasswordValue, setConfirmPasswordValue] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Validation
  const isNameValid = validateName(nameValue);
  const isPhoneValid = validatePhone(phoneValue);
  const passwordStrength = validatePassword(passwordValue);
  const isPasswordValid = passwordValue.length >= 8 && passwordStrength.score >= 4;
  const passwordsMatch =
    confirmPasswordValue.length > 0 && passwordValue === confirmPasswordValue;
  const isEmailValid =
    emailValue.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue);

  const canProceedDetails = isNameValid && isPhoneValid;
  const canProceedSecurity =
    isPasswordValid && passwordsMatch && isEmailValid;
  const canSubmit = canProceedDetails && canProceedSecurity && termsAccepted;

  const handleNext = () => {
    setError('');
    if (step === 'details') {
      if (!canProceedDetails) {
        setError('Please fill in all required details correctly.');
        return;
      }
      setStep('security');
    } else if (step === 'security') {
      if (!canProceedSecurity) {
        setError('Please fill in all security details correctly.');
        return;
      }
      setStep('review');
    }
  };

  const handleBack = () => {
    setError('');
    if (step === 'details') {
      navigation.goBack();
    } else if (step === 'security') {
      setStep('details');
    } else {
      setStep('security');
    }
  };

  const handleRegister = async () => {
    setError('');

    if (!canSubmit) {
      setError('Please complete all required fields.');
      return;
    }

    try {
      await register.mutateAsync({
        name: nameValue.trim(),
        phone: `+91${phoneValue}`,
        password: passwordValue,
        email: emailValue.trim() || undefined,
        role: 'PATIENT',
      });

      // Success - navigate to login or ask to log in
      // In real app, you might auto-login here
      navigation.navigate('Login');
    } catch (err: any) {
      if (err.statusCode === 409) {
        setError('Phone number or email already registered.');
      } else {
        setError(err.message || 'Registration failed. Please try again.');
      }
    }
  };

  const isLoading = register.isPending;

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
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={handleBack}
              disabled={isLoading}
              style={styles.backBtn}
            >
              <ArrowLeft color={Colors.textPrimary} size={24} strokeWidth={2} />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>Create Account</Text>
              <Text style={styles.headerSubtitle}>
                Step {step === 'details' ? '1' : step === 'security' ? '2' : '3'} of 3
              </Text>
            </View>
          </View>

          {/* Progress Indicator */}
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width:
                    step === 'details'
                      ? '33%'
                      : step === 'security'
                        ? '66%'
                        : '100%',
                },
              ]}
            />
          </View>

          {/* Card */}
          <View style={styles.card}>
            {/* Step 1: Personal Details */}
            {step === 'details' && (
              <>
                <Text style={styles.stepTitle}>Personal Details</Text>

                {/* Name Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Full Name</Text>
                  <TextInput
                    id="input-name"
                    style={styles.textInput}
                    placeholder="Enter your full name"
                    placeholderTextColor={Colors.textMuted}
                    value={nameValue}
                    onChangeText={setNameValue}
                    editable={!isLoading}
                  />
                  {nameValue.length > 0 && !isNameValid && (
                    <Text style={styles.fieldError}>
                      Name must be 2-100 characters
                    </Text>
                  )}
                </View>

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
                  {phoneValue.length > 0 && !isPhoneValid && (
                    <Text style={styles.fieldError}>
                      Phone must be 10 digits
                    </Text>
                  )}
                </View>

                {/* Email Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email (Optional)</Text>
                  <TextInput
                    id="input-email"
                    style={styles.textInput}
                    placeholder="Enter your email"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={emailValue}
                    onChangeText={setEmailValue}
                    editable={!isLoading}
                  />
                  {emailValue.length > 0 && !isEmailValid && (
                    <Text style={styles.fieldError}>Invalid email address</Text>
                  )}
                </View>
              </>
            )}

            {/* Step 2: Security Details */}
            {step === 'security' && (
              <>
                <Text style={styles.stepTitle}>Set Password</Text>

                {/* Password Input */}
                <View style={styles.inputGroup}>
                  <View style={styles.passwordLabelRow}>
                    <Text style={styles.inputLabel}>Password</Text>
                    {passwordValue.length > 0 && (
                      <Text style={styles.strengthLabel}>
                        Strength:{' '}
                        <Text style={_getStrengthColor(passwordStrength.score)}>
                          {_getStrengthLabel(passwordStrength.score)}
                        </Text>
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
                        label="One special character"
                      />
                    </View>
                  )}
                </View>

                {/* Confirm Password Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Confirm Password</Text>
                  <View style={styles.passwordInputRow}>
                    <TextInput
                      id="input-confirm-password"
                      style={styles.passwordInput}
                      placeholder="Confirm password"
                      placeholderTextColor={Colors.textMuted}
                      secureTextEntry={!showConfirmPassword}
                      value={confirmPasswordValue}
                      onChangeText={setConfirmPasswordValue}
                      editable={!isLoading}
                    />
                    <TouchableOpacity
                      onPress={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      style={styles.passwordToggle}
                      disabled={isLoading}
                    >
                      <Text style={styles.passwordToggleText}>
                        {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {confirmPasswordValue.length > 0 && !passwordsMatch && (
                    <Text style={styles.fieldError}>Passwords do not match</Text>
                  )}
                  {confirmPasswordValue.length > 0 && passwordsMatch && (
                    <View style={styles.successItem}>
                      <Check
                        size={16}
                        color={Colors.success}
                        strokeWidth={3}
                      />
                      <Text style={styles.successText}>Passwords match</Text>
                    </View>
                  )}
                </View>
              </>
            )}

            {/* Step 3: Review & Accept */}
            {step === 'review' && (
              <>
                <Text style={styles.stepTitle}>Review Your Details</Text>

                {/* Review Item */}
                <View style={styles.reviewItem}>
                  <Text style={styles.reviewLabel}>Full Name</Text>
                  <Text style={styles.reviewValue}>{nameValue}</Text>
                </View>

                <View style={styles.reviewItem}>
                  <Text style={styles.reviewLabel}>Mobile Number</Text>
                  <Text style={styles.reviewValue}>+91{phoneValue}</Text>
                </View>

                {emailValue && (
                  <View style={styles.reviewItem}>
                    <Text style={styles.reviewLabel}>Email</Text>
                    <Text style={styles.reviewValue}>{emailValue}</Text>
                  </View>
                )}

                {/* Terms & Conditions */}
                <TouchableOpacity
                  style={styles.termsCheckbox}
                  onPress={() => setTermsAccepted(!termsAccepted)}
                  disabled={isLoading}
                >
                  <View style={styles.checkbox}>
                    {termsAccepted && (
                      <Check
                        size={16}
                        color={Colors.white}
                        strokeWidth={3}
                      />
                    )}
                  </View>
                  <Text style={styles.termsText}>
                    I agree to Bionex's{' '}
                    <Text style={styles.termsLink}>Terms & Privacy Policy</Text>
                  </Text>
                </TouchableOpacity>

                {!termsAccepted && (
                  <Text style={styles.fieldError}>
                    Please accept terms to continue
                  </Text>
                )}
              </>
            )}

            {/* Error Banner */}
            {!!error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                onPress={handleBack}
                disabled={isLoading}
                style={styles.secondaryBtn}
              >
                <Text style={styles.secondaryBtnText}>
                  {step === 'details' ? 'Back' : 'Previous'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={
                  step === 'review' ? handleRegister : handleNext
                }
                disabled={
                  (step === 'details' && !canProceedDetails) ||
                  (step === 'security' && !canProceedSecurity) ||
                  (step === 'review' && !canSubmit) ||
                  isLoading
                }
                activeOpacity={0.85}
                style={styles.primaryBtn}
              >
                <LinearGradient
                  colors={
                    step === 'review' && canSubmit
                      ? [Colors.success, Colors.success]
                      : (step === 'details' && canProceedDetails) ||
                          (step === 'security' && canProceedSecurity) ||
                          (step === 'review' && canSubmit)
                        ? [Colors.royalBlue, Colors.royalBlueDark]
                        : [Colors.textMuted, Colors.textMuted]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryBtnGradient}
                >
                  {isLoading ? (
                    <ActivityIndicator color={Colors.white} size="small" />
                  ) : (
                    <>
                      <Text style={styles.primaryBtnText}>
                        {step === 'review' ? 'Create Account' : 'Next'}
                      </Text>
                      {step !== 'review' && (
                        <ArrowRight
                          color={Colors.white}
                          size={18}
                          strokeWidth={2.5}
                        />
                      )}
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Login Link */}
            <View style={styles.loginRow}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Login')}
                disabled={isLoading}
              >
                <Text style={styles.loginLink}>Sign In</Text>
              </TouchableOpacity>
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
      <Text
        style={[
          styles.requirementLabel,
          !met && styles.requirementLabelUnmet,
        ]}
      >
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    padding: Spacing.sm,
    marginRight: Spacing.md,
  },
  headerContent: { flex: 1 },
  headerTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textMuted,
    marginTop: 2,
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.border,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.royalBlue,
  },
  card: {
    margin: Spacing.base,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  stepTitle: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
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
  textInput: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.textPrimary,
  },
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
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.textPrimary,
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
  fieldError: {
    fontSize: Typography.fontSize.xs,
    color: Colors.error,
    marginTop: 4,
    fontFamily: Typography.fontFamily.medium,
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
  successItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.sm,
  },
  successText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.success,
  },
  reviewItem: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  reviewLabel: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reviewValue: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.textPrimary,
  },
  termsCheckbox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: Colors.royalBlue,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.royalBlue,
    marginTop: 2,
  },
  termsText: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textSecondary,
  },
  termsLink: {
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.royalBlue,
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
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: Spacing.md + 2,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.semiBold,
  },
  primaryBtn: {
    flex: 1,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  primaryBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md + 2,
  },
  primaryBtnText: {
    color: Colors.white,
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.semiBold,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  loginText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textSecondary,
  },
  loginLink: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.royalBlue,
  },
});
