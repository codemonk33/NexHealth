import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  User, Bluetooth, Activity, Shield, Bell, ChevronRight, LogOut, Copy, QrCode, Users,
} from 'lucide-react-native';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../theme';
import { useAuthStore } from '../../store/authStore';

const FAMILY_MEMBERS = [
  { id: 'fam-1', name: 'Priya Kumar', relation: 'Spouse', emoji: '👩' },
  { id: 'fam-2', name: 'Grandpa Joe', relation: 'Grandfather', emoji: '👴', alert: true },
  { id: 'fam-3', name: 'Ria Kumar', relation: 'Daughter', emoji: '👧' },
];

export function ProfileScreen() {
  const { user, logout } = useAuthStore();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header Card */}
        <LinearGradient
          colors={[Colors.royalBlue, Colors.teal]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.profileHeader}
        >
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{user?.name?.[0] ?? 'P'}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name ?? 'Prajesh Kumar'}</Text>
            <Text style={styles.profilePhone}>{user?.phone ?? '+91 98765 43210'}</Text>
          </View>
        </LinearGradient>

        {/* ABHA Card */}
        <View style={styles.abhaCard}>
          <View style={styles.abhaHeader}>
            <Text style={styles.abhaTitle}>🏥 ABHA ID</Text>
            <View style={styles.abhaBadge}>
              <Text style={styles.abhaBadgeText}>✓ Verified</Text>
            </View>
          </View>
          <Text style={styles.abhaId}>{user?.abhaId ?? '12-3456-7890-1234'}</Text>
          <Text style={styles.abhaAddress}>{user?.abhaAddress ?? 'prajesh.kumar@abdm'}</Text>
          <View style={styles.abhaActions}>
            <TouchableOpacity id="btn-copy-abha" style={styles.abhaActionBtn}>
              <Copy size={14} color={Colors.royalBlue} strokeWidth={2} />
              <Text style={styles.abhaActionText}>Copy</Text>
            </TouchableOpacity>
            <TouchableOpacity id="btn-qr-abha" style={styles.abhaActionBtn}>
              <QrCode size={14} color={Colors.royalBlue} strokeWidth={2} />
              <Text style={styles.abhaActionText}>QR Code</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Connected Devices */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connected Devices</Text>
          {[
            { id: 'dev-1', name: 'OnePlus Watch 2', type: 'Bluetooth', connected: true, emoji: '⌚' },
            { id: 'dev-2', name: 'Apple Health', type: 'HealthKit', connected: false, emoji: '❤️' },
            { id: 'dev-3', name: 'Google Health Connect', type: 'Android', connected: false, emoji: '🏃' },
          ].map((device) => (
            <View key={device.id} style={styles.deviceCard}>
              <Text style={styles.deviceEmoji}>{device.emoji}</Text>
              <View style={styles.deviceInfo}>
                <Text style={styles.deviceName}>{device.name}</Text>
                <Text style={styles.deviceType}>{device.type}</Text>
              </View>
              <View style={[styles.deviceStatus, device.connected ? styles.deviceConnected : styles.deviceDisconnected]}>
                <Text style={[styles.deviceStatusText, { color: device.connected ? Colors.success : Colors.textMuted }]}>
                  {device.connected ? '● Connected' : '○ Not connected'}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Family Members */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Family Members</Text>
            <TouchableOpacity id="btn-add-family">
              <Text style={styles.addText}>+ Add</Text>
            </TouchableOpacity>
          </View>
          {FAMILY_MEMBERS.map((member) => (
            <TouchableOpacity key={member.id} id={`btn-family-${member.id}`} style={styles.familyCard} activeOpacity={0.8}>
              <Text style={styles.familyEmoji}>{member.emoji}</Text>
              <View style={styles.familyInfo}>
                <Text style={styles.familyName}>{member.name}</Text>
                <Text style={styles.familyRelation}>{member.relation}</Text>
              </View>
              {member.alert && (
                <View style={styles.alertBadge}>
                  <Text style={styles.alertBadgeText}>⚠️ Alert</Text>
                </View>
              )}
              <ChevronRight size={16} color={Colors.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings & Privacy</Text>
          {[
            { id: 'notifications', label: 'Notifications', icon: Bell, toggle: true, value: true },
            { id: 'data-sharing', label: 'Health Data Sharing', icon: Shield, toggle: true, value: false },
            { id: 'data-revoke', label: 'Revoke Data Access', icon: Shield, toggle: false },
          ].map((item) => (
            <View key={item.id} style={styles.settingRow}>
              <item.icon size={18} color={Colors.textSecondary} strokeWidth={2} />
              <Text style={styles.settingLabel}>{item.label}</Text>
              {item.toggle ? (
                <Switch
                  value={item.value}
                  onValueChange={() => {}}
                  thumbColor={Colors.white}
                  trackColor={{ false: Colors.border, true: Colors.teal }}
                />
              ) : (
                <ChevronRight size={16} color={Colors.textMuted} strokeWidth={2} />
              )}
            </View>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity id="btn-logout" onPress={logout} style={styles.logoutBtn} activeOpacity={0.85}>
          <LogOut size={18} color={Colors.error} strokeWidth={2} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        {/* Version */}
        <Text style={styles.version}>Bionex v1.0.0 · ABHA Integrated · HIPAA Compliant</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: Spacing['4xl'] },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
    padding: Spacing.xl,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 3,
    borderColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: Typography.fontSize['3xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.white,
  },
  profileInfo: { flex: 1 },
  profileName: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.white,
    marginBottom: 4,
  },
  profilePhone: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.regular,
    color: 'rgba(255,255,255,0.8)',
  },
  abhaCard: {
    backgroundColor: Colors.white,
    margin: Spacing.base,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    ...Shadows.md,
    borderWidth: 1,
    borderColor: Colors.blueBg,
  },
  abhaHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  abhaTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
  },
  abhaBadge: {
    backgroundColor: Colors.successBg,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  abhaBadgeText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.success,
  },
  abhaId: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.royalBlue,
    letterSpacing: 1,
    marginBottom: 4,
  },
  abhaAddress: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  abhaActions: { flexDirection: 'row', gap: Spacing.sm },
  abhaActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.blueBg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  abhaActionText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.royalBlue,
  },
  section: { paddingHorizontal: Spacing.base, marginBottom: Spacing.xl },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  sectionTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  addText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.royalBlue,
  },
  deviceCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  deviceEmoji: { fontSize: 28 },
  deviceInfo: { flex: 1 },
  deviceName: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.textPrimary,
  },
  deviceType: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textMuted,
  },
  deviceStatus: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: BorderRadius.full },
  deviceConnected: { backgroundColor: Colors.successBg },
  deviceDisconnected: { backgroundColor: Colors.surface },
  deviceStatusText: { fontSize: Typography.fontSize.xs, fontFamily: Typography.fontFamily.medium },
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
  familyEmoji: { fontSize: 28 },
  familyInfo: { flex: 1 },
  familyName: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.textPrimary,
  },
  familyRelation: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textMuted,
  },
  alertBadge: {
    backgroundColor: Colors.warningBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  alertBadgeText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.warning,
  },
  settingRow: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  settingLabel: {
    flex: 1,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.textPrimary,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.base,
    padding: Spacing.base,
    backgroundColor: Colors.errorBg,
    borderRadius: BorderRadius.lg,
  },
  logoutText: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.error,
  },
  version: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: Spacing.base,
  },
});
