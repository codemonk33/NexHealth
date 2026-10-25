import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  MapPin,
  ChevronDown,
  Search,
  ShoppingCart,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../theme';
import { MOCK_POPULAR_TESTS } from '../../api/diagnosticsApi';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// ─── Popular Test Categories (circular avatar grid) ───────────────────────────
const POPULAR_CATEGORIES = [
  { id: 'full-body',  label: 'Full Body\nCheckups',  emoji: '🧬', bg: '#EEF3FF' },
  { id: 'fever',      label: 'Fever',                emoji: '🤒', bg: '#FFF1EC' },
  { id: 'thyroid',    label: 'Thyroid',              emoji: '🦋', bg: '#EAF8F4' },
  { id: 'diabetes',   label: 'Diabetes',             emoji: '🩸', bg: '#FEE2E2' },
  { id: 'heart',      label: 'Heart\nHealth',        emoji: '❤️', bg: '#FEE2E2' },
  { id: 'allergy',    label: 'Allergy\nTests',       emoji: '🌿', bg: '#EAF8F4' },
  { id: 'hair',       label: 'Hair &\nSkin',         emoji: '💆', bg: '#FEF3C7' },
  { id: 'women',      label: 'Women\nHealth',        emoji: '🌸', bg: '#FFF1EC' },
];

// ─── Lab Packages (horizontal scroll) ─────────────────────────────────────────
const LAB_PACKAGES = [
  { id: 'pkg-women', label: 'For Women',    emoji: '👩‍⚕️', bg: '#FFF1EC', tests: 'Ovary, fertility, thyroid' },
  { id: 'pkg-men',   label: 'For Men',      emoji: '👨‍⚕️', bg: '#EEF3FF', tests: 'Testosterone, heart health' },
  { id: 'pkg-xray',  label: 'X-Rays',       emoji: '🦴',   bg: '#F5F5F5', tests: 'Chest, bone density tests' },
  { id: 'pkg-card',  label: 'Cardiac\nTests', emoji: '💓', bg: '#FEE2E2', tests: 'Total heart assessment' },
  { id: 'pkg-adv',   label: 'Advanced\nTests', emoji: '🔬', bg: '#EAF8F4', tests: 'Allergy, genetics, etc' },
];

// ─── Combo Offers ──────────────────────────────────────────────────────────────
const COMBO_OFFERS = [
  {
    id: 'combo-1',
    title: 'Wellness Basic',
    description: 'CBC + Thyroid + Lipid Profile',
    originalPrice: 1299,
    price: 799,
    saving: '38%',
    emoji: '💊',
    color: Colors.royalBlue,
    bg: Colors.blueBg,
  },
  {
    id: 'combo-2',
    title: 'Diabetes Care Pack',
    description: 'HbA1c + FBS + Kidney Function',
    originalPrice: 999,
    price: 649,
    saving: '35%',
    emoji: '🩺',
    color: Colors.teal,
    bg: Colors.tealBg,
  },
];

export function LabTestsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [search, setSearch] = useState('');

  const handleSearchFocus = (testId?: string, testName?: string) => {
    navigation.navigate('LabSearch', testId ? { testId, testName } : undefined);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.locationRow} id="btn-location-lab">
            <MapPin size={14} color={Colors.royalBlue} strokeWidth={2.5} />
            <Text style={styles.locationText}>Goregaon</Text>
            <ChevronDown size={14} color={Colors.royalBlue} strokeWidth={2.5} />
          </TouchableOpacity>
          <TouchableOpacity id="btn-lab-cart" style={styles.cartBtn}>
            <ShoppingCart size={20} color={Colors.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Hero doctor illustration area */}
        <View style={styles.heroRow}>
          <View style={styles.heroAvatars}>
            <View style={[styles.heroAvatar, styles.heroAvatarLeft]}>
              <Text style={styles.heroAvatarEmoji}>👨‍⚕️</Text>
            </View>
            <View style={[styles.heroAvatar, styles.heroAvatarRight]}>
              <Text style={styles.heroAvatarEmoji}>👩‍⚕️</Text>
            </View>
          </View>
        </View>

        {/* Search Bar */}
        <TouchableOpacity
          id="btn-lab-search-bar"
          style={styles.searchBar}
          onPress={handleSearchFocus}
          activeOpacity={0.8}
        >
          <Search size={16} color={Colors.textMuted} strokeWidth={2} />
          <Text style={styles.searchPlaceholder}>Search for "X-Ray"</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* ── Popular Tests 4×2 Grid ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Popular Tests</Text>
          <View style={styles.popularGrid}>
            {POPULAR_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                id={`btn-popular-${cat.id}`}
                style={styles.popularItem}
                onPress={() => navigation.navigate('LabSearch', { testName: cat.label.replace('\n', ' ') })}
                activeOpacity={0.8}
              >
                <View style={[styles.popularCircle, { backgroundColor: cat.bg }]}>
                  <Text style={styles.popularEmoji}>{cat.emoji}</Text>
                </View>
                <Text style={styles.popularLabel}>{cat.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Delivery at Your Doorstep Banner ── */}
        <View style={styles.deliveryBannerWrap}>
          <LinearGradient
            colors={['#1E5AFF', '#4A7CFF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.deliveryBanner}
          >
            <View style={styles.deliveryLeft}>
              <Text style={styles.deliveryTitle}>Delivery at{'\n'}your doorstep,{'\n'}best prices overall</Text>
              <View style={styles.deliveryBadges}>
                <View style={styles.deliveryBadge}>
                  <CheckCircle2 size={12} color={Colors.white} strokeWidth={2.5} />
                  <Text style={styles.deliveryBadgeText}>Best Prices</Text>
                </View>
                <View style={styles.deliveryBadge}>
                  <CheckCircle2 size={12} color={Colors.white} strokeWidth={2.5} />
                  <Text style={styles.deliveryBadgeText}>On-time Delivery</Text>
                </View>
              </View>
            </View>
            <View style={styles.deliveryRight}>
              <Text style={styles.deliveryIllustrationEmoji}>🚐</Text>
              <View style={styles.deliveryHeartRing}>
                <Text style={styles.deliveryHeartEmoji}>❤️</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* ── Lab Tests & Packages ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Lab tests & Packages</Text>
            <TouchableOpacity id="btn-view-all-packages">
              <Text style={styles.viewAll}>View All →</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.sectionSub}>Accurate results. Reliable care</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.packagesScroll}
          >
            {LAB_PACKAGES.map((pkg) => (
              <TouchableOpacity
                key={pkg.id}
                id={`btn-package-${pkg.id}`}
                style={styles.packageCard}
                onPress={() => navigation.navigate('LabSearch', { testName: pkg.label.replace('\n', ' ') })}
                activeOpacity={0.85}
              >
                <View style={[styles.packageIconBox, { backgroundColor: pkg.bg }]}>
                  <Text style={styles.packageEmoji}>{pkg.emoji}</Text>
                </View>
                <Text style={styles.packageLabel}>{pkg.label}</Text>
                <Text style={styles.packageTests}>{pkg.tests}</Text>
                <View style={styles.packageArrow}>
                  <ChevronRight size={12} color={Colors.royalBlue} strokeWidth={2.5} />
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ── Popular Lab Test Cards ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Top Tests</Text>
            <TouchableOpacity id="btn-view-all-tests">
              <Text style={styles.viewAll}>View All →</Text>
            </TouchableOpacity>
          </View>
          {MOCK_POPULAR_TESTS.slice(0, 4).map((test) => (
            <TouchableOpacity
              key={test.id}
              id={`btn-test-${test.id}`}
              style={styles.testCard}
              onPress={() => navigation.navigate('LabSearch', { testId: test.id, testName: test.name })}
              activeOpacity={0.88}
            >
              <View style={styles.testCardIconBox}>
                <Text style={styles.testCardEmoji}>🔬</Text>
              </View>
              <View style={styles.testCardInfo}>
                <View style={styles.testCardTopRow}>
                  <Text style={styles.testCardName}>{test.name}</Text>
                  {test.aiPowered && (
                    <View style={styles.aiChip}>
                      <Text style={styles.aiChipText}>🤖 AI</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.testCardIncludes} numberOfLines={1}>
                  {test.includes?.slice(0, 3).join(' · ')}
                  {(test.includes?.length ?? 0) > 3 ? ` +${test.includes!.length - 3}` : ''}
                </Text>
                <View style={styles.testCardMeta}>
                  <View style={[styles.metaTag, test.fasting ? styles.metaTagWarn : styles.metaTagOk]}>
                    <Text style={styles.metaTagText}>{test.fasting ? '⚠️ Fasting' : '✅ No Fasting'}</Text>
                  </View>
                  <View style={styles.metaTag}>
                    <Text style={styles.metaTagText}>🩸 {test.sampleType}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.testCardRight}>
                {test.discountedPrice && (
                  <Text style={styles.originalPrice}>₹{test.price}</Text>
                )}
                <Text style={styles.price}>₹{test.discountedPrice ?? test.price}</Text>
                <TouchableOpacity
                  id={`btn-book-${test.id}`}
                  style={styles.bookBtn}
                  onPress={() => navigation.navigate('LabSearch', { testId: test.id, testName: test.name })}
                >
                  <Text style={styles.bookBtnText}>Book</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Combo Offers ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Combo Offers</Text>
          {COMBO_OFFERS.map((combo) => (
            <TouchableOpacity
              key={combo.id}
              id={`btn-combo-${combo.id}`}
              style={styles.comboCard}
              activeOpacity={0.88}
            >
              <View style={[styles.comboIconBox, { backgroundColor: combo.bg }]}>
                <Text style={styles.comboEmoji}>{combo.emoji}</Text>
              </View>
              <View style={styles.comboInfo}>
                <Text style={styles.comboTitle}>{combo.title}</Text>
                <Text style={styles.comboDesc}>{combo.description}</Text>
                <View style={styles.comboPriceRow}>
                  <Text style={styles.comboPrice}>₹{combo.price}</Text>
                  <Text style={styles.comboOriginal}>₹{combo.originalPrice}</Text>
                  <View style={[styles.savingBadge, { backgroundColor: combo.bg }]}>
                    <Text style={[styles.savingText, { color: combo.color }]}>Save {combo.saving}</Text>
                  </View>
                </View>
              </View>
              <ChevronRight size={18} color={Colors.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Accessible & Affordable Section ── */}
        <View style={styles.accessibleSection}>
          <LinearGradient
            colors={[Colors.blueBg, '#F0FFF4']}
            style={styles.accessibleGradient}
          >
            {/* Text side */}
            <View style={styles.accessibleLeft}>
              <Text style={styles.accessibleTitle}>Accessible &{'\n'}Affordable</Text>
              <View style={styles.accessibleFeatures}>
                <View style={styles.accessibleFeature}>
                  <View style={styles.accessibleFeatureIcon}>
                    <CheckCircle2 size={14} color={Colors.royalBlue} strokeWidth={2.5} />
                  </View>
                  <Text style={styles.accessibleFeatureText}>NABL Accredited labs</Text>
                </View>
                <View style={styles.accessibleFeature}>
                  <View style={styles.accessibleFeatureIcon}>
                    <CheckCircle2 size={14} color={Colors.teal} strokeWidth={2.5} />
                  </View>
                  <Text style={styles.accessibleFeatureText}>Seamless collection</Text>
                </View>
                <View style={styles.accessibleFeature}>
                  <View style={styles.accessibleFeatureIcon}>
                    <CheckCircle2 size={14} color={Colors.teal} strokeWidth={2.5} />
                  </View>
                  <Text style={styles.accessibleFeatureText}>On-time reports</Text>
                </View>
              </View>
            </View>
            {/* Illustration side */}
            <View style={styles.accessibleRight}>
              <Text style={styles.accessibleIllustration}>👩‍⚕️</Text>
              <Text style={styles.accessibleIllustration2}>👨</Text>
              {/* Medical items */}
              <View style={styles.medicalItems}>
                <Text style={styles.medicalItem}>💊</Text>
                <Text style={styles.medicalItem}>🩺</Text>
                <Text style={styles.medicalItem}>🔬</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // ── Header ──
  header: {
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
  },
  cartBtn: { padding: 4 },
  heroRow: {
    alignItems: 'center',
    marginBottom: Spacing.sm,
    height: 56,
    justifyContent: 'center',
  },
  heroAvatars: { flexDirection: 'row', gap: Spacing.sm },
  heroAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.blueBg,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  heroAvatarLeft: { backgroundColor: Colors.blueBg },
  heroAvatarRight: { backgroundColor: Colors.tealBg },
  heroAvatarEmoji: { fontSize: 28 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textMuted,
  },

  scrollContent: { paddingBottom: 40 },
  section: { paddingHorizontal: Spacing.base, marginTop: Spacing.xl },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  sectionSub: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textMuted,
    marginBottom: Spacing.md,
  },
  viewAll: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.royalBlue,
  },

  // ── Popular Grid (4×2) ──
  popularGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  popularItem: {
    width: '23%',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  popularCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  popularEmoji: { fontSize: 28 },
  popularLabel: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 14,
  },

  // ── Delivery Banner ──
  deliveryBannerWrap: {
    marginHorizontal: Spacing.base,
    marginTop: Spacing.lg,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.md,
  },
  deliveryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.xl,
    minHeight: 130,
  },
  deliveryLeft: { flex: 1 },
  deliveryTitle: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.white,
    lineHeight: 26,
    marginBottom: Spacing.md,
  },
  deliveryBadges: { gap: 6 },
  deliveryBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  deliveryBadgeText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.medium,
    color: 'rgba(255,255,255,0.9)',
  },
  deliveryRight: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  deliveryIllustrationEmoji: { fontSize: 50 },
  deliveryHeartRing: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliveryHeartEmoji: { fontSize: 14 },

  // ── Lab Packages Horizontal Scroll ──
  packagesScroll: { gap: Spacing.sm, paddingBottom: 4 },
  packageCard: {
    width: 120,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    gap: 6,
    ...Shadows.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  packageIconBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  packageEmoji: { fontSize: 24 },
  packageLabel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  packageTests: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textMuted,
    lineHeight: 15,
  },
  packageArrow: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.blueBg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Test Cards ──
  testCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  testCardIconBox: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.blueBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testCardEmoji: { fontSize: 22 },
  testCardInfo: { flex: 1 },
  testCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  testCardName: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
    flex: 1,
  },
  aiChip: {
    backgroundColor: Colors.blueBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  aiChipText: { fontSize: 9, fontFamily: Typography.fontFamily.semiBold, color: Colors.royalBlue },
  testCardIncludes: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  testCardMeta: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  metaTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: Colors.surface,
    borderRadius: 4,
  },
  metaTagWarn: { backgroundColor: Colors.warningBg },
  metaTagOk: { backgroundColor: Colors.successBg },
  metaTagText: { fontSize: 9, fontFamily: Typography.fontFamily.medium, color: Colors.textSecondary },
  testCardRight: { alignItems: 'flex-end', gap: Spacing.xs },
  originalPrice: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
  },
  price: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
  },
  bookBtn: {
    backgroundColor: Colors.royalBlue,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  bookBtnText: { color: Colors.white, fontSize: Typography.fontSize.xs, fontFamily: Typography.fontFamily.semiBold },

  // ── Combo Offers ──
  comboCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  comboIconBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comboEmoji: { fontSize: 26 },
  comboInfo: { flex: 1 },
  comboTitle: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  comboDesc: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  comboPriceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  comboPrice: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
  },
  comboOriginal: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
  },
  savingBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  savingText: { fontSize: 9, fontFamily: Typography.fontFamily.bold, letterSpacing: 0.5 },

  // ── Accessible & Affordable ──
  accessibleSection: {
    marginHorizontal: Spacing.base,
    marginTop: Spacing.xl,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.md,
  },
  accessibleGradient: {
    flexDirection: 'row',
    padding: Spacing.xl,
    minHeight: 200,
  },
  accessibleLeft: { flex: 1, justifyContent: 'center' },
  accessibleTitle: {
    fontSize: Typography.fontSize['3xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
    lineHeight: 38,
    marginBottom: Spacing.lg,
  },
  accessibleFeatures: { gap: Spacing.sm },
  accessibleFeature: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  accessibleFeatureIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  accessibleFeatureText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.textSecondary,
  },
  accessibleRight: {
    width: 110,
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  accessibleIllustration: { fontSize: 60, position: 'absolute', bottom: 10, right: 0 },
  accessibleIllustration2: { fontSize: 40, position: 'absolute', bottom: 5, right: 55 },
  medicalItems: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    flexDirection: 'row',
    gap: 4,
  },
  medicalItem: { fontSize: 18 },

  // Privacy Footer
  privacySection: {
    padding: Spacing.xl,
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing['2xl'],
  },
  privacyMain: { fontSize: Typography.fontSize['2xl'], fontFamily: Typography.fontFamily.regular, color: Colors.textSecondary },
  privacyDevanagari: { fontSize: Typography.fontSize['3xl'], fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, lineHeight: 40 },
  privacyWith: { fontSize: Typography.fontSize['2xl'], fontFamily: Typography.fontFamily.medium, color: Colors.teal },
});
