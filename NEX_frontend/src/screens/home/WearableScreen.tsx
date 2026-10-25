import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronLeft,
  Footprints,
  Heart,
  Moon,
  Watch,
  Bluetooth,
  Activity,
  Zap,
  TrendingUp,
  RefreshCw,
  Settings,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { useHealthData } from '../../api/vitalsApi';

// ─── Mini Bar Chart ────────────────────────────────────────────────────────────
function MiniBarChart({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1);
  return (
    <View style={barStyles.container}>
      {values.map((v, i) => (
        <View
          key={i}
          style={[
            barStyles.bar,
            {
              height: Math.max(4, (v / max) * 36),
              backgroundColor: i === values.length - 1 ? color : color + '55',
            },
          ]}
        />
      ))}
    </View>
  );
}

const barStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 40,
  },
  bar: {
    width: 10,
    borderRadius: 4,
  },
});

// ─── Health Data Row ───────────────────────────────────────────────────────────
function HealthDataRow({
  icon,
  label,
  value,
  unit,
  time,
  color,
  chartValues,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  time: string;
  color: string;
  chartValues: number[];
}) {
  return (
    <View style={rowStyles.container}>
      <View style={[rowStyles.iconBox, { backgroundColor: color + '22' }]}>
        {icon}
      </View>
      <View style={rowStyles.info}>
        <Text style={rowStyles.label}>{label}</Text>
        <View style={rowStyles.valueRow}>
          <Text style={[rowStyles.value, { color }]}>{value}</Text>
          <Text style={rowStyles.unit}> {unit}</Text>
        </View>
        <Text style={rowStyles.time}>{time}</Text>
      </View>
      <MiniBarChart values={chartValues} color={color} />
    </View>
  );
}

const rowStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
  label: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  valueRow: { flexDirection: 'row', alignItems: 'baseline' },
  value: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.extraBold,
  },
  unit: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.textMuted,
  },
  time: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textMuted,
    marginTop: 2,
  },
});

// ─── Main Screen ───────────────────────────────────────────────────────────────
export function WearableScreen() {
  const navigation = useNavigation();
  const user = useAuthStore((s) => s.user);
  const { data: healthData, isLoading, refetch } = useHealthData(user?.id ?? '');
  const [period, setPeriod] = useState<'7d' | '30d' | '3m'>('7d');

  const PERIODS = [
    { key: '7d' as const, label: 'Past 7 days' },
    { key: '30d' as const, label: '30 days' },
    { key: '3m' as const, label: '3 months' },
  ];

  const stepsValues = [3200, 4800, 5200, 4100, 6300, 5800, healthData?.steps.value ?? 5000];
  const heartValues = [72, 85, 78, 90, 82, 88, healthData?.heartRate.value ?? 89];
  const sleepValues = [6, 7, 8, 7.5, 6.5, 9, healthData?.sleep.value ?? 9];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          id="btn-back-wearable"
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <ChevronLeft size={22} color={Colors.textPrimary} strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Wearable Health</Text>
        <TouchableOpacity id="btn-wearable-settings" style={styles.backBtn}>
          <Settings size={20} color={Colors.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
      >
        {/* ── Connected Device Banner ── */}
        <LinearGradient
          colors={[Colors.royalBlue, '#4A7CFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.deviceBanner}
        >
          <View style={styles.deviceLeft}>
            <View style={styles.deviceIconRing}>
              <Watch size={22} color={Colors.royalBlue} strokeWidth={2} />
            </View>
            <View>
              <Text style={styles.deviceName}>OnePlus Watch 2</Text>
              <View style={styles.deviceStatus}>
                <Bluetooth size={12} color={Colors.tealLight} strokeWidth={2.5} />
                <Text style={styles.deviceStatusText}>Connected · Syncing</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity id="btn-resync-device" style={styles.resyncBtn}>
            <RefreshCw size={16} color={Colors.white} strokeWidth={2.5} />
          </TouchableOpacity>
        </LinearGradient>

        {/* ── Health Score Ring ── */}
        <View style={styles.scoreSection}>
          <Text style={styles.sectionLabel}>Synced with your OnePlus watch</Text>
          <View style={styles.scoreCard}>
            <View style={styles.scoreRingOuter}>
              {/* Dot ring decoration */}
              {Array.from({ length: 24 }).map((_, i) => {
                const angle = (i * 15 * Math.PI) / 180;
                const radius = 72;
                const x = 80 + radius * Math.sin(angle) - 4;
                const y = 80 - radius * Math.cos(angle) - 4;
                return (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      {
                        left: x,
                        top: y,
                        backgroundColor: i < 19 ? Colors.teal : Colors.border,
                      },
                    ]}
                  />
                );
              })}
              <View style={styles.scoreRingInner}>
                {isLoading ? (
                  <ActivityIndicator color={Colors.royalBlue} />
                ) : (
                  <>
                    <Text style={styles.scoreNumber}>
                      {healthData?.score.score ?? 79}
                    </Text>
                    <Text style={styles.scoreMax}>out of 100</Text>
                  </>
                )}
              </View>
            </View>

            {/* Metric Pills */}
            <View style={styles.metricRow}>
              <View style={[styles.metricPill, { backgroundColor: Colors.tealBg }]}>
                <Footprints size={18} color={Colors.teal} strokeWidth={2} />
                <Text style={[styles.metricValue, { color: Colors.tealDark }]}>
                  {(healthData?.steps.value ?? 5000).toLocaleString()}
                </Text>
                <Text style={styles.metricUnit}>Steps</Text>
              </View>
              <View style={[styles.metricPill, { backgroundColor: '#FFF0F0' }]}>
                <Heart size={18} color={Colors.error} strokeWidth={2} />
                <Text style={[styles.metricValue, { color: Colors.error }]}>
                  {healthData?.heartRate.value ?? 89}
                </Text>
                <Text style={styles.metricUnit}>BPM</Text>
              </View>
              <View style={[styles.metricPill, { backgroundColor: Colors.blueBg }]}>
                <Moon size={18} color={Colors.royalBlue} strokeWidth={2} />
                <Text style={[styles.metricValue, { color: Colors.royalBlue }]}>
                  {healthData?.sleep.value ?? 9}hr
                </Text>
                <Text style={styles.metricUnit}>Sleep</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Period Selector ── */}
        <View style={styles.periodSection}>
          <View style={styles.periodHeader}>
            <Text style={styles.sectionTitle}>Health Data</Text>
            <View style={styles.periodSelector}>
              {PERIODS.map((p) => (
                <TouchableOpacity
                  key={p.key}
                  id={`btn-period-${p.key}`}
                  onPress={() => setPeriod(p.key)}
                  style={[
                    styles.periodBtn,
                    period === p.key && styles.periodBtnActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.periodBtnText,
                      period === p.key && styles.periodBtnTextActive,
                    ]}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* ── Health Data Rows ── */}
        <View style={styles.dataSection}>
          <HealthDataRow
            icon={<Footprints size={20} color={Colors.teal} strokeWidth={2} />}
            label="Steps"
            value={(healthData?.steps.value ?? 5000).toLocaleString()}
            unit="steps"
            time="10:15 AM ›"
            color={Colors.teal}
            chartValues={stepsValues}
          />
          <HealthDataRow
            icon={<Heart size={20} color={Colors.error} strokeWidth={2} />}
            label="Heart Rate"
            value={String(healthData?.heartRate.value ?? 89)}
            unit="BPM"
            time="12:10 AM ›"
            color={Colors.error}
            chartValues={heartValues}
          />
          <HealthDataRow
            icon={<Moon size={20} color={Colors.royalBlue} strokeWidth={2} />}
            label="Sleep"
            value={String(healthData?.sleep.value ?? 9)}
            unit="hrs"
            time="10:15 AM ›"
            color={Colors.royalBlue}
            chartValues={sleepValues}
          />
          <HealthDataRow
            icon={<Activity size={20} color={Colors.orange} strokeWidth={2} />}
            label="Calories"
            value="1,840"
            unit="kcal"
            time="Updated now ›"
            color={Colors.orange}
            chartValues={[1200, 1500, 1800, 1650, 1900, 1750, 1840]}
          />
          <HealthDataRow
            icon={<Zap size={20} color="#8B5CF6" strokeWidth={2} />}
            label="Blood Oxygen"
            value="98"
            unit="%"
            time="13:10 AM ›"
            color="#8B5CF6"
            chartValues={[96, 97, 98, 97, 98, 97, 98]}
          />
          <HealthDataRow
            icon={<TrendingUp size={20} color={Colors.tealDark} strokeWidth={2} />}
            label="Active Energy"
            value="420"
            unit="kcal"
            time="Updated now ›"
            color={Colors.tealDark}
            chartValues={[180, 260, 380, 290, 450, 400, 420]}
          />
        </View>

        {/* ── Privacy Badge ── */}
        <View style={styles.privacySection}>
          <Text style={styles.privacyMain}>Your Data Is</Text>
          <Text style={styles.privacyDevanagari}>सुरक्षित & Private</Text>
          <Text style={styles.privacyWith}>with Bionex.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
  },
  scrollContent: { paddingBottom: 40 },
  deviceBanner: {
    margin: Spacing.base,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deviceLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  deviceIconRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceName: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.white,
  },
  deviceStatus: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  deviceStatusText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.medium,
    color: 'rgba(255,255,255,0.8)',
  },
  resyncBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreSection: { paddingHorizontal: Spacing.base },
  sectionLabel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
  },
  scoreCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    ...Shadows.md,
  },
  scoreRingOuter: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.base,
    position: 'relative',
  },
  dot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  scoreRingInner: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: Colors.tealBg,
    borderWidth: 10,
    borderColor: Colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNumber: {
    fontSize: 38,
    fontFamily: Typography.fontFamily.extraBold,
    color: Colors.textPrimary,
    lineHeight: 42,
  },
  scoreMax: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.textMuted,
  },
  metricRow: { flexDirection: 'row', gap: Spacing.sm, width: '100%' },
  metricPill: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  metricValue: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bold,
  },
  metricUnit: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.textMuted,
  },
  periodSection: {
    paddingHorizontal: Spacing.base,
    marginTop: Spacing.xl,
  },
  periodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    padding: 3,
    gap: 2,
  },
  periodBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  periodBtnActive: { backgroundColor: Colors.white, ...Shadows.sm },
  periodBtnText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.textMuted,
  },
  periodBtnTextActive: {
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.textPrimary,
  },
  dataSection: {
    paddingHorizontal: Spacing.base,
    marginTop: Spacing.md,
  },
  privacySection: {
    padding: Spacing.xl,
    marginTop: Spacing.xl,
    alignItems: 'flex-start',
    paddingHorizontal: Spacing['2xl'],
  },
  privacyMain: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textSecondary,
  },
  privacyDevanagari: {
    fontSize: Typography.fontSize['3xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
    lineHeight: 40,
  },
  privacyWith: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.medium,
    color: Colors.teal,
  },
});
