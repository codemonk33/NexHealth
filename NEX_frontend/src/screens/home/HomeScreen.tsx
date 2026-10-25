import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Bell,
  MapPin,
  ChevronDown,
  ShoppingCart,
  Footprints,
  Heart,
  Moon,
  Upload,
  Watch,
  Bluetooth,
  Zap,
  ChevronRight,
  Plus,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { useCartStore } from '../../store/cartStore';
import { useHealthData } from '../../api/vitalsApi';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const user = useAuthStore((s) => s.user);
  const cartTotal = useCartStore((s) => s.items.reduce((sum, i) => sum + i.quantity, 0));
  const { data: healthData, isLoading: healthLoading, refetch } = useHealthData(user?.id ?? '');

  const firstName = user?.name?.split(' ')[0] ?? 'User';

  const REMINDER_PREVIEW = [
    {
      id: 'rem-1',
      medicine: 'Pan-40',
      dosage: '40mg · After Meal',
      time: '9:00 AM Today',
      priority: 'HIGH' as const,
    },
    {
      id: 'rem-2',
      medicine: 'Blood Test',
      dosage: 'City Lab · Fasting',
      time: '8:00 AM · Tomorrow',
      priority: 'LOW' as const,
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── Header ── */}
      <LinearGradient
        colors={[Colors.white, Colors.background]}
        style={styles.header}
      >
        <View style={styles.headerLeft}>
          <View style={styles.headerTopRow}>
            <View style={styles.locationRow}>
              <MapPin size={14} color={Colors.royalBlue} strokeWidth={2.5} />
              <Text style={styles.locationText}>Goregaon</Text>
              <ChevronDown size={14} color={Colors.royalBlue} strokeWidth={2.5} />
            </View>
          </View>
          <Text style={styles.greetingLine}>
            Welcome <Text style={styles.greetingName}>{firstName}</Text> 👋
          </Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity id="btn-notifications" style={styles.iconBtn}>
            <Bell size={20} color={Colors.textSecondary} strokeWidth={2} />
            <View style={styles.notifDot} />
          </TouchableOpacity>
          <TouchableOpacity
            id="btn-cart"
            style={styles.iconBtn}
            onPress={() => navigation.navigate('Cart')}
          >
            <ShoppingCart size={20} color={Colors.textSecondary} strokeWidth={2} />
            {cartTotal > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartTotal}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={healthLoading} onRefresh={refetch} />}
      >
        {/* ── Wearable Connection Card ── */}
        <TouchableOpacity
          id="btn-wearable-card"
          activeOpacity={0.88}
          style={styles.wearableCard}
          onPress={() => navigation.navigate('Wearable')}
        >
          <LinearGradient
            colors={[Colors.royalBlue, '#4A7CFF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.wearableCardGradient}
          >
            {/* Left content */}
            <View style={styles.wearableCardLeft}>
              <View style={styles.wearableCardSync}>
                <Bluetooth size={12} color={Colors.tealLight} strokeWidth={2.5} />
                <Text style={styles.wearableCardSyncText}>Connected · Syncing</Text>
              </View>
              <Text style={styles.wearableCardTitle}>
                Connect your wearables and View all health data in one place.
              </Text>
              <View style={styles.wearableCardMetrics}>
                <View style={styles.wearableMetric}>
                  <Footprints size={12} color="rgba(255,255,255,0.8)" strokeWidth={2} />
                  <Text style={styles.wearableMetricText}>
                    {(healthData?.steps.value ?? 5000).toLocaleString()}
                  </Text>
                </View>
                <View style={styles.wearableMetric}>
                  <Heart size={12} color="rgba(255,255,255,0.8)" strokeWidth={2} />
                  <Text style={styles.wearableMetricText}>
                    {healthData?.heartRate.value ?? 89} BPM
                  </Text>
                </View>
                <View style={styles.wearableMetric}>
                  <Moon size={12} color="rgba(255,255,255,0.8)" strokeWidth={2} />
                  <Text style={styles.wearableMetricText}>
                    {healthData?.sleep.value ?? 9}hr
                  </Text>
                </View>
              </View>
              <View style={styles.wearableCardBtn}>
                <Text style={styles.wearableCardBtnText}>View Health Data</Text>
                <ChevronRight size={14} color={Colors.royalBlue} strokeWidth={2.5} />
              </View>
            </View>
            {/* Watch icon right */}
            <View style={styles.wearableCardRight}>
              <View style={styles.wearableWatchRing}>
                <Watch size={36} color={Colors.royalBlue} strokeWidth={1.5} />
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* ── Action Banners ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What you can do with Bionex.</Text>
          <View style={styles.bannerRow}>
            {/* Upload Banner */}
            <TouchableOpacity
              id="btn-upload-today"
              activeOpacity={0.88}
              style={styles.uploadBanner}
              onPress={() => navigation.navigate('Upload')}
            >
              <LinearGradient
                colors={[Colors.white, Colors.tealBg]}
                style={styles.bannerGradient}
              >
                <Text style={styles.bannerEmoji}>📋</Text>
                <Text style={styles.bannerTitle}>Store, manage, and analyze all your medical reports in one place.</Text>
                <View style={styles.bannerCta}>
                  <Text style={styles.bannerCtaText}>Upload Today</Text>
                  <Upload size={12} color={Colors.teal} strokeWidth={2.5} />
                </View>
              </LinearGradient>
            </TouchableOpacity>

            {/* Lab Banner */}
            <TouchableOpacity id="btn-book-lab" activeOpacity={0.88} style={styles.labBanner}>
              <LinearGradient
                colors={[Colors.white, Colors.blueBg]}
                style={styles.bannerGradient}
              >
                <Text style={styles.bannerEmoji}>🔬</Text>
                <Text style={styles.bannerTitle}>Book a lab test at home in minutes.</Text>
                <View style={[styles.bannerCta, { opacity: 0.6 }]}>
                  <Text style={[styles.bannerCtaText, { color: Colors.royalBlue }]}>Coming Soon</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Book Lab Tests Orange Card ── */}
        <TouchableOpacity id="btn-book-lab-main" activeOpacity={0.88} style={styles.orangeCard}>
          <LinearGradient
            colors={[Colors.orange, Colors.orangeDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.orangeCardGradient}
          >
            <View style={styles.orangeCardLeft}>
              <Text style={styles.orangeCardLabel}>Coming Soon</Text>
              <Text style={styles.orangeCardTitle}>Book Lab Tests near you.</Text>
              <Text style={styles.orangeCardSub}>100+ labs available near you</Text>
              <View style={styles.orangeCardCta}>
                <Text style={styles.orangeCardCtaText}>+</Text>
              </View>
            </View>
            <Text style={styles.orangeCardEmoji}>🏥</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* ── Dark Coming Soon Card ── */}
        <TouchableOpacity id="btn-global-labs" activeOpacity={0.88} style={styles.darkCard}>
          <LinearGradient
            colors={['#0D1B3E', '#1E2D5A']}
            style={styles.darkCardGradient}
          >
            <View>
              <Text style={styles.darkCardLabel}>Coming Soon</Text>
              <Text style={styles.darkCardTitle}>Book Lab Tests near you.</Text>
              <Text style={styles.darkCardSub}>100+ labs available near you</Text>
            </View>
            <Text style={styles.darkCardEmoji}>🌍</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* ── Smart Reminders Card ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Smart Reminders</Text>
            <TouchableOpacity
              id="btn-view-all-reminders"
              onPress={() => navigation.navigate('SmartReminders')}
            >
              <Text style={styles.viewAllText}>View All →</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            id="btn-reminders-card"
            activeOpacity={0.88}
            style={styles.remindersCard}
            onPress={() => navigation.navigate('SmartReminders')}
          >
            {/* AI banner row */}
            <LinearGradient
              colors={[Colors.royalBlue, '#4A7CFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.reminderAiBanner}
            >
              <Zap size={12} color={Colors.orange} strokeWidth={2} />
              <Text style={styles.reminderAiText}>AI Optimization Active · Reminders adjusted</Text>
            </LinearGradient>

            {/* Preview items */}
            {REMINDER_PREVIEW.map((item, idx) => (
              <View
                key={item.id}
                style={[
                  styles.reminderPreviewRow,
                  idx < REMINDER_PREVIEW.length - 1 && styles.reminderPreviewDivider,
                ]}
              >
                <View
                  style={[
                    styles.reminderDot,
                    { backgroundColor: item.priority === 'HIGH' ? Colors.error : Colors.royalBlue },
                  ]}
                />
                <View style={styles.reminderPreviewInfo}>
                  <Text style={styles.reminderPreviewMed}>{item.medicine}</Text>
                  <Text style={styles.reminderPreviewDose}>{item.dosage}</Text>
                </View>
                <View style={styles.reminderPreviewRight}>
                  <View
                    style={[
                      styles.reminderPriorityBadge,
                      {
                        backgroundColor:
                          item.priority === 'HIGH' ? Colors.errorBg : Colors.blueBg,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.reminderPriorityText,
                        {
                          color:
                            item.priority === 'HIGH' ? Colors.error : Colors.royalBlue,
                        },
                      ]}
                    >
                      {item.priority === 'HIGH' ? 'HIGH' : 'ROUTINE'}
                    </Text>
                  </View>
                  <Text style={styles.reminderPreviewTime}>{item.time}</Text>
                </View>
              </View>
            ))}

            {/* Manage button */}
            <TouchableOpacity
              id="btn-manage-reminders"
              style={styles.manageRemindersBtn}
              onPress={() => navigation.navigate('SmartReminders')}
            >
              <Plus size={14} color={Colors.teal} strokeWidth={2.5} />
              <Text style={styles.manageRemindersBtnText}>Manage & Add Reminders</Text>
              <ChevronRight size={14} color={Colors.teal} strokeWidth={2.5} />
            </TouchableOpacity>
          </TouchableOpacity>
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
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerLeft: { flex: 1 },
  headerTopRow: { marginBottom: 2 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.royalBlue,
  },
  greetingLine: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.textSecondary,
  },
  greetingName: {
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
  },
  headerRight: { flexDirection: 'row', gap: Spacing.sm },
  iconBtn: { position: 'relative', padding: 4 },
  notifDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.orange,
  },
  cartBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: Colors.orange,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  cartBadgeText: {
    color: Colors.white,
    fontSize: 9,
    fontFamily: Typography.fontFamily.bold,
  },
  scrollContent: { paddingBottom: Spacing['4xl'] },
  section: { paddingHorizontal: Spacing.base, marginTop: Spacing.xl },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  sectionLabel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.textMuted,
    paddingHorizontal: Spacing.base,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  viewAllText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.royalBlue,
  },
  // Wearable Card
  wearableCard: {
    marginHorizontal: Spacing.base,
    marginTop: Spacing.xl,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.md,
  },
  wearableCardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.xl,
    minHeight: 180,
  },
  wearableCardLeft: { flex: 1, gap: Spacing.sm },
  wearableCardSync: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  wearableCardSyncText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.medium,
    color: 'rgba(255,255,255,0.9)',
  },
  wearableCardTitle: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.white,
    lineHeight: 22,
    marginVertical: Spacing.xs,
  },
  wearableCardMetrics: {
    flexDirection: 'row',
    gap: Spacing.md,
    flexWrap: 'wrap',
  },
  wearableMetric: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  wearableMetricText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.semiBold,
    color: 'rgba(255,255,255,0.85)',
  },
  wearableCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
    marginTop: Spacing.xs,
  },
  wearableCardBtnText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.royalBlue,
  },
  wearableCardRight: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: Spacing.md,
  },
  wearableWatchRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Action Banners
  bannerRow: { flexDirection: 'row', gap: Spacing.sm },
  uploadBanner: { flex: 1 },
  labBanner: { flex: 1 },
  bannerGradient: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
    minHeight: 150,
    justifyContent: 'space-between',
  },
  bannerEmoji: { fontSize: 28, marginBottom: 4 },
  bannerTitle: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.textPrimary,
    lineHeight: Typography.fontSize.sm * 1.5,
    marginBottom: Spacing.sm,
  },
  bannerCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.tealBg,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  bannerCtaText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.teal,
  },
  // Orange Card
  orangeCard: { marginHorizontal: Spacing.base, marginTop: Spacing.md, borderRadius: BorderRadius.xl, overflow: 'hidden' },
  orangeCardGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.xl },
  orangeCardLeft: { flex: 1 },
  orangeCardLabel: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.orangeLight,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  orangeCardTitle: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.white,
    marginBottom: 4,
  },
  orangeCardSub: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.regular,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: Spacing.md,
  },
  orangeCardCta: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orangeCardCtaText: { fontSize: 20, color: Colors.white, fontFamily: Typography.fontFamily.bold },
  orangeCardEmoji: { fontSize: 60 },
  // Dark Card
  darkCard: { marginHorizontal: Spacing.base, marginTop: Spacing.sm, borderRadius: BorderRadius.xl, overflow: 'hidden' },
  darkCardGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.xl },
  darkCardLabel: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.tealLight,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  darkCardTitle: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.white,
    marginBottom: 4,
  },
  darkCardSub: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.regular,
    color: 'rgba(255,255,255,0.6)',
  },
  darkCardEmoji: { fontSize: 60 },
  // Reminder preview card
  remindersCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.md,
  },
  reminderAiBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.base,
    paddingVertical: 8,
  },
  reminderAiText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.semiBold,
    color: 'rgba(255,255,255,0.9)',
  },
  reminderPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  reminderPreviewDivider: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  reminderDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  reminderPreviewInfo: { flex: 1 },
  reminderPreviewMed: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
  },
  reminderPreviewDose: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textSecondary,
  },
  reminderPreviewRight: { alignItems: 'flex-end', gap: 3 },
  reminderPriorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  reminderPriorityText: {
    fontSize: 9,
    fontFamily: Typography.fontFamily.bold,
    letterSpacing: 0.5,
  },
  reminderPreviewTime: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.textMuted,
  },
  manageRemindersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    marginTop: Spacing.xs,
  },
  manageRemindersBtnText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.teal,
  },
  // Privacy
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
