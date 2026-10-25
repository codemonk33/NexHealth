import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronLeft,
  Bell,
  Clock,
  MapPin,
  AlertCircle,
  Zap,
  Settings,
  Plus,
  Watch,
  RefreshCw,
  Phone,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../theme';

// ─── Types ─────────────────────────────────────────────────────────────────────
type ReminderPriority = 'HIGH' | 'LOW' | 'ROUTINE';
type ReminderStatus = 'UPCOMING' | 'DONE' | 'MISSED';

interface Reminder {
  id: string;
  medicine: string;
  dosage: string;
  time: string;
  status: ReminderStatus;
  priority: ReminderPriority;
  refillLeft?: number;
  location?: string;
  isRoutine?: boolean;
}

// ─── Reminder Card ─────────────────────────────────────────────────────────────
function ReminderCard({ reminder }: { reminder: Reminder }) {
  const isHigh = reminder.priority === 'HIGH';
  const isRoutine = reminder.isRoutine;
  const statusColor = isHigh ? Colors.error : Colors.royalBlue;
  const statusBg = isHigh ? Colors.errorBg : Colors.blueBg;
  const statusLabel = isHigh ? 'HIGH PRIORITY' : 'ROUTINE';

  return (
    <View style={cardStyles.container}>
      {/* Left accent bar */}
      <View style={[cardStyles.accentBar, { backgroundColor: statusColor }]} />

      <View style={cardStyles.iconWrap}>
        <View style={[cardStyles.iconBox, { backgroundColor: statusBg }]}>
          {isRoutine ? (
            <Bell size={18} color={Colors.royalBlue} strokeWidth={2} />
          ) : (
            <Zap size={18} color={statusColor} strokeWidth={2} />
          )}
        </View>
      </View>

      <View style={cardStyles.content}>
        <View style={cardStyles.topRow}>
          <Text style={cardStyles.medicineName}>{reminder.medicine}</Text>
          <View style={[cardStyles.priorityBadge, { backgroundColor: statusBg }]}>
            <Text style={[cardStyles.priorityText, { color: statusColor }]}>
              {statusLabel}
            </Text>
          </View>
        </View>
        <Text style={cardStyles.dosage}>{reminder.dosage}</Text>

        {reminder.isRoutine && (
          <Text style={[cardStyles.typeLabel, { color: Colors.textMuted }]}>
            APPOINTMENT
          </Text>
        )}

        <View style={cardStyles.timeRow}>
          <Clock size={12} color={Colors.textMuted} strokeWidth={2} />
          <Text style={cardStyles.time}>{reminder.time}</Text>
          <View style={[cardStyles.statusPill, { backgroundColor: Colors.blueBg }]}>
            <Text style={[cardStyles.statusText, { color: Colors.royalBlue }]}>
              Upcoming
            </Text>
          </View>
        </View>

        {reminder.location && (
          <View style={cardStyles.locationRow}>
            <MapPin size={12} color={Colors.textMuted} strokeWidth={2} />
            <Text style={cardStyles.locationText}>{reminder.location}</Text>
          </View>
        )}

        {reminder.refillLeft !== undefined && (
          <View style={cardStyles.refillRow}>
            <View style={cardStyles.refillBadge}>
              <Text style={cardStyles.refillText}>
                REFILL NEEDED ({reminder.refillLeft} LEFT)
              </Text>
            </View>
            <TouchableOpacity
              id={`btn-order-now-${reminder.id}`}
              style={cardStyles.orderBtn}
            >
              <Text style={cardStyles.orderBtnText}>Order Now →</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  accentBar: { width: 4 },
  iconWrap: { padding: Spacing.base, paddingRight: 0, justifyContent: 'flex-start' },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1, padding: Spacing.base },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  medicineName: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
    flex: 1,
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: Spacing.sm,
  },
  priorityText: { fontSize: 9, fontFamily: Typography.fontFamily.bold, letterSpacing: 0.5 },
  dosage: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  typeLabel: {
    fontSize: 9,
    fontFamily: Typography.fontFamily.bold,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  time: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.textPrimary,
    flex: 1,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  statusText: { fontSize: Typography.fontSize.xs, fontFamily: Typography.fontFamily.semiBold },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textMuted,
  },
  refillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 6,
  },
  refillBadge: {
    backgroundColor: Colors.errorBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  refillText: {
    fontSize: 9,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.error,
    letterSpacing: 0.5,
  },
  orderBtn: {
    backgroundColor: Colors.tealBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  orderBtnText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.teal,
  },
});

// ─── Main Screen ───────────────────────────────────────────────────────────────
export function SmartRemindersScreen() {
  const navigation = useNavigation();
  const [synced] = useState(true);

  const REMINDERS: Reminder[] = [
    {
      id: 'rem-1',
      medicine: 'Pan-40',
      dosage: '40mg · After Meal',
      time: '9:00 AM Today',
      status: 'UPCOMING',
      refillLeft: 3,
      priority: 'HIGH',
    },
    {
      id: 'rem-2',
      medicine: 'Blood Test',
      dosage: 'City Lab · Fasting',
      time: '8:00 AM · Tomorrow, 13 Jun',
      status: 'UPCOMING',
      location: '42 Health St, Medical District',
      priority: 'LOW',
      isRoutine: true,
    },
    {
      id: 'rem-3',
      medicine: 'Vitamin D3',
      dosage: '60K IU · After Breakfast',
      time: '9:30 AM Today',
      status: 'UPCOMING',
      priority: 'ROUTINE',
      isRoutine: true,
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          id="btn-back-reminders"
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <ChevronLeft size={22} color={Colors.textPrimary} strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Smart Reminders</Text>
        <TouchableOpacity id="btn-reminder-settings" style={styles.backBtn}>
          <Settings size={20} color={Colors.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Sync Status ── */}
        <View style={styles.syncRow}>
          <View style={styles.syncLeft}>
            <Watch size={14} color={Colors.teal} strokeWidth={2.5} />
            <Text style={styles.syncText}>Synced with sleep & wearables</Text>
          </View>
          <TouchableOpacity id="btn-sync-reminders" style={styles.syncIcon}>
            <RefreshCw size={14} color={Colors.textMuted} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* ── AI Optimization Banner ── */}
        <LinearGradient
          colors={[Colors.royalBlue, Colors.royalBlueDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.aiBanner}
        >
          <View style={styles.aiHeader}>
            <View style={styles.aiLabelRow}>
              <Zap size={12} color={Colors.orange} fill={Colors.orange} strokeWidth={0} />
              <Text style={styles.aiLabelText}>AI OPTIMIZATION</Text>
            </View>
            <Text style={styles.aiTitle}>Adaptive Logic Active</Text>
            <TouchableOpacity id="btn-ai-settings" style={styles.aiSettingsBtn}>
              <Settings size={16} color="rgba(255,255,255,0.7)" strokeWidth={2} />
            </TouchableOpacity>
          </View>
          <Text style={styles.aiBody}>
            Based on your 10 AM dose yesterday, we've shifted today's reminder to 9:30 AM.
          </Text>
          <View style={styles.aiTag}>
            <Text style={styles.aiTagText}>↑ Optimized Absorption</Text>
          </View>
        </LinearGradient>

        {/* ── Active Reminders ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Reminders</Text>
            <TouchableOpacity id="btn-view-all-reminders">
              <Text style={styles.viewAllText}>View All ›</Text>
            </TouchableOpacity>
          </View>
          {REMINDERS.map((reminder) => (
            <ReminderCard key={reminder.id} reminder={reminder} />
          ))}
        </View>

        {/* ── Family Monitoring ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Family Monitoring</Text>
            <TouchableOpacity id="btn-family-settings">
              <Settings size={18} color={Colors.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          </View>
          <View style={styles.familyCard}>
            <View style={styles.familyAvatar}>
              <Text style={styles.familyAvatarEmoji}>👴</Text>
            </View>
            <View style={styles.familyInfo}>
              <Text style={styles.familyName}>Grandpa Joe</Text>
              <Text style={styles.familyAlert}>MISSED MORNING MEDICINES</Text>
            </View>
            <View style={styles.escalationBadge}>
              <AlertCircle size={12} color={Colors.error} strokeWidth={2} />
              <Text style={styles.escalationText}>ESCALATION{'\n'}ACTIVE</Text>
            </View>
          </View>
          <TouchableOpacity id="btn-notify-caregiver-reminders" activeOpacity={0.85}>
            <LinearGradient
              colors={[Colors.error, '#C0392B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.caregiverBtn}
            >
              <Phone size={16} color={Colors.white} strokeWidth={2} />
              <Text style={styles.caregiverText}>Notify Caregiver</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ── Add Reminder ── */}
        <TouchableOpacity
          id="btn-add-reminder"
          style={styles.addBtn}
          onPress={() => Alert.alert('Add Reminder', 'Coming soon!')}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[Colors.teal, Colors.tealDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.addBtnGradient}
          >
            <Plus size={20} color={Colors.white} strokeWidth={2.5} />
            <Text style={styles.addBtnText}>Add New Reminder</Text>
          </LinearGradient>
        </TouchableOpacity>

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
  // Sync
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: Spacing.base,
    marginTop: Spacing.base,
    backgroundColor: Colors.tealBg,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  syncLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  syncText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.teal,
  },
  syncIcon: { padding: 4 },
  // AI Banner
  aiBanner: {
    margin: Spacing.base,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    gap: Spacing.sm,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  aiLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  aiLabelText: {
    fontSize: 9,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.orange,
    letterSpacing: 1,
  },
  aiTitle: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.white,
    position: 'absolute',
    left: 0,
    top: 18,
  },
  aiSettingsBtn: { padding: 4 },
  aiBody: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 20,
    marginTop: Spacing.xl,
  },
  aiTag: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  aiTagText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.white,
  },
  // Sections
  section: { paddingHorizontal: Spacing.base, marginTop: Spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
  },
  viewAllText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.royalBlue,
  },
  // Family
  familyCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  familyAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.orangeBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  familyAvatarEmoji: { fontSize: 22 },
  familyInfo: { flex: 1 },
  familyName: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.textPrimary,
  },
  familyAlert: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  escalationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.errorBg,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 8,
  },
  escalationText: {
    fontSize: 9,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.error,
    letterSpacing: 0.5,
    lineHeight: 12,
  },
  caregiverBtn: {
    borderRadius: BorderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  caregiverText: {
    color: Colors.white,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.semiBold,
  },
  // Add Button
  addBtn: {
    marginHorizontal: Spacing.base,
    marginTop: Spacing.xl,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  addBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.base,
  },
  addBtnText: {
    color: Colors.white,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.semiBold,
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
