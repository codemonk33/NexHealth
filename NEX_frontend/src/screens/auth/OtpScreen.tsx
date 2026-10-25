import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Check } from 'lucide-react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../theme';
import { useVerifyAbhaOtp, useVerifyPhoneOtp } from '../../api/authApi';
import { useAuthStore } from '../../store/authStore';
import type { AuthStackParamList } from '../../navigation/AuthStack';

type OtpRouteProp = RouteProp<AuthStackParamList, 'Otp'>;

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

export function OtpScreen() {
  const navigation = useNavigation();
  const route = useRoute<OtpRouteProp>();
  const { phone, abhaId, txnId, mode } = route.params;

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const [error, setError] = useState('');
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const verifyAbhaOtp = useVerifyAbhaOtp();
  const verifyPhoneOtp = useVerifyPhoneOtp();
  const setUser = useAuthStore((s) => s.setUser);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleOtpChange = (value: string, index: number) => {
    const digit = value.replace(/[^0-9]/g, '').slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    setError('');

    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
    if (!digit && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const otpString = otp.join('');
    if (otpString.length !== OTP_LENGTH) {
      setError('Please enter the complete 6-digit OTP.');
      return;
    }
    setError('');
    try {
      let result;
      if (mode === 'abha' && abhaId) {
        result = await verifyAbhaOtp.mutateAsync({ abhaId, otp: otpString, txnId });
      } else if (phone) {
        result = await verifyPhoneOtp.mutateAsync({ phone, otp: otpString, txnId });
      }
      if (result) setUser(result.user);
    } catch (e: any) {
      setError(e.message ?? 'Invalid OTP. Please try again.');
      setOtp(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    }
  };

  const handleResend = () => {
    if (countdown > 0) return;
    setCountdown(RESEND_SECONDS);
    setOtp(Array(OTP_LENGTH).fill(''));
    inputRefs.current[0]?.focus();
  };

  const isLoading = verifyAbhaOtp.isPending || verifyPhoneOtp.isPending;
  const displayTarget = mode === 'phone' ? phone : abhaId;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            id="btn-back-otp"
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            <ArrowLeft color={Colors.textPrimary} size={22} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* Title */}
          <View style={styles.titleArea}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconEmoji}>📱</Text>
            </View>
            <Text style={styles.title}>Verify OTP</Text>
            <Text style={styles.subtitle}>
              We've sent a 6-digit OTP to{'\n'}
              <Text style={styles.targetText}>{displayTarget}</Text>
            </Text>
          </View>

          {/* OTP Inputs */}
          <View style={styles.otpRow}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                id={`otp-input-${index}`}
                ref={(ref) => { inputRefs.current[index] = ref; }}
                style={[
                  styles.otpBox,
                  digit ? styles.otpBoxFilled : {},
                  error ? styles.otpBoxError : {},
                ]}
                value={digit}
                onChangeText={(v) => handleOtpChange(v, index)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                keyboardType="number-pad"
                maxLength={1}
                textAlign="center"
                autoFocus={index === 0}
                selectTextOnFocus
              />
            ))}
          </View>

          {/* Error */}
          {!!error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Hint for mock */}
          <View style={styles.hintBanner}>
            <Text style={styles.hintText}>💡 Demo: Use OTP <Text style={styles.hintOtp}>123456</Text></Text>
          </View>

          {/* Verify Button */}
          <TouchableOpacity
            id="btn-verify-otp"
            onPress={handleVerify}
            disabled={isLoading || otp.join('').length !== OTP_LENGTH}
            activeOpacity={0.85}
            style={[styles.verifyBtn, otp.join('').length !== OTP_LENGTH && styles.verifyBtnDisabled]}
          >
            <LinearGradient
              colors={[Colors.teal, Colors.tealDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.verifyGradient}
            >
              {isLoading ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <>
                  <Check color={Colors.white} size={18} strokeWidth={2.5} />
                  <Text style={styles.verifyText}>Verify & Continue</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Resend */}
          <View style={styles.resendRow}>
            <Text style={styles.resendLabel}>Didn't receive the OTP? </Text>
            <TouchableOpacity id="btn-resend-otp" onPress={handleResend} disabled={countdown > 0}>
              <Text style={[styles.resendBtn, countdown > 0 && styles.resendBtnDisabled]}>
                {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: { paddingHorizontal: Spacing.base, paddingTop: Spacing.sm },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
  },
  titleArea: { alignItems: 'center', marginBottom: Spacing['2xl'] },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.tealBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.base,
  },
  iconEmoji: { fontSize: 32 },
  title: {
    fontSize: Typography.fontSize['4xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: Typography.fontSize.base * 1.6,
  },
  targetText: {
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.textPrimary,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.base,
  },
  otpBox: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
  },
  otpBoxFilled: {
    borderColor: Colors.teal,
    backgroundColor: Colors.tealBg,
  },
  otpBoxError: { borderColor: Colors.error },
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
    textAlign: 'center',
  },
  hintBanner: {
    backgroundColor: Colors.blueBg,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.xl,
    alignItems: 'center',
  },
  hintText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.royalBlue,
  },
  hintOtp: { fontFamily: Typography.fontFamily.bold },
  verifyBtn: { borderRadius: BorderRadius.full, overflow: 'hidden', marginBottom: Spacing.xl },
  verifyBtnDisabled: { opacity: 0.6 },
  verifyGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md + 2,
  },
  verifyText: {
    color: Colors.white,
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.semiBold,
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resendLabel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textMuted,
  },
  resendBtn: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.royalBlue,
  },
  resendBtnDisabled: { color: Colors.textMuted },
});
