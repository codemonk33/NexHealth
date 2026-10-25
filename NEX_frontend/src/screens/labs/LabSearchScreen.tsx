import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  Search,
  MapPin,
  Star,
  Clock,
  Plus,
  ChevronRight,
  Zap,
  Home as HomeIcon,
  FlaskConical,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../theme';
import {
  MOCK_POPULAR_TESTS,
  MOCK_LAB_PARTNERS,
  useLabTestSearch,
} from '../../api/diagnosticsApi';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type Step = 'INTRO' | 'SEARCH' | 'RESULTS';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TOP_SEARCHED = [
  { id: 'ts-1', name: 'CBC (Complete Blood Count)', contains: 'Contains 24 tests' },
  { id: 'ts-2', name: 'CBC (Complete Blood Count)', contains: 'Contains 5 tests' },
  { id: 'ts-3', name: 'CBC (Complete Blood Count)', contains: 'Contains 83883' },
];

// ─── Step 1: Intro ──────────────────────────────────────────────────────────────
function IntroStep({ onProceed }: { onProceed: () => void }) {
  return (
    <View style={introStyles.container}>
      <ScrollView contentContainerStyle={introStyles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Illustration area */}
        <LinearGradient
          colors={[Colors.blueBg, Colors.tealBg]}
          style={introStyles.heroCard}
        >
          <View style={introStyles.heroIllustration}>
            <View style={introStyles.heroCircle}>
              <FlaskConical size={48} color={Colors.royalBlue} strokeWidth={1.5} />
            </View>
            {/* Floating cards */}
            <View style={[introStyles.floatingCard, introStyles.floatingCard1]}>
              <Text style={introStyles.floatingCardEmoji}>🔬</Text>
              <Text style={introStyles.floatingCardText}>Lab Test</Text>
            </View>
            <View style={[introStyles.floatingCard, introStyles.floatingCard2]}>
              <Text style={introStyles.floatingCardEmoji}>🏠</Text>
              <Text style={introStyles.floatingCardText}>Home Visit</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Headline */}
        <Text style={introStyles.headline}>
          Book lab tests from the comfort of your home with Bionex.
        </Text>

        {/* Features */}
        <View style={introStyles.featuresRow}>
          {[
            { emoji: '💰', label: 'Less prices\nthan ever' },
            { emoji: '🛋️', label: 'Prioritize\nyour comfort' },
            { emoji: '📄', label: 'Instant\nReports' },
          ].map((f) => (
            <View key={f.label} style={introStyles.featureItem}>
              <View style={introStyles.featureIconBox}>
                <Text style={introStyles.featureEmoji}>{f.emoji}</Text>
              </View>
              <Text style={introStyles.featureLabel}>{f.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Proceed Button */}
      <View style={introStyles.footer}>
        <TouchableOpacity
          id="btn-proceed-lab"
          onPress={onProceed}
          activeOpacity={0.88}
        >
          <LinearGradient
            colors={[Colors.royalBlue, Colors.royalBlueDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={introStyles.proceedBtn}
          >
            <Text style={introStyles.proceedBtnText}>Proceed</Text>
            <Text style={introStyles.proceedBtnPlus}>→</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const introStyles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.base, paddingBottom: 100 },
  heroCard: {
    borderRadius: BorderRadius.xl,
    marginTop: Spacing.xl,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroIllustration: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  heroCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },
  floatingCard: {
    position: 'absolute',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    alignItems: 'center',
    ...Shadows.sm,
    flexDirection: 'row',
    gap: 4,
  },
  floatingCard1: { left: 20, top: 30 },
  floatingCard2: { right: 20, bottom: 30 },
  floatingCardEmoji: { fontSize: 16 },
  floatingCardText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.semiBold,
    color: Colors.textPrimary,
  },
  headline: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
    marginTop: Spacing.xl,
    lineHeight: 32,
  },
  featuresRow: {
    flexDirection: 'row',
    gap: Spacing.base,
    marginTop: Spacing.xl,
  },
  featureItem: { flex: 1, alignItems: 'center', gap: Spacing.sm },
  featureIconBox: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.blueBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureEmoji: { fontSize: 24 },
  featureLabel: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.base,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  proceedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.base,
    borderRadius: BorderRadius.full,
  },
  proceedBtnText: {
    color: Colors.white,
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.semiBold,
  },
  proceedBtnPlus: {
    color: Colors.white,
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bold,
  },
});

// ─── Step 2: Search ─────────────────────────────────────────────────────────────
function SearchStep({
  onBack,
  onSearch,
}: {
  onBack: () => void;
  onSearch: (query: string, location: string) => void;
}) {
  const [testName, setTestName] = useState('');
  const [location, setLocation] = useState('');

  return (
    <View style={searchStyles.container}>
      <ScrollView contentContainerStyle={searchStyles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={searchStyles.headline}>
          Book lab tests from the comfort of your home with Bionex.
        </Text>

        {/* Test Name Input */}
        <View style={searchStyles.inputGroup}>
          <View style={searchStyles.inputBox}>
            <Search size={16} color={Colors.textMuted} strokeWidth={2} />
            <TextInput
              id="input-test-name"
              style={searchStyles.input}
              placeholder="Test name"
              placeholderTextColor={Colors.textMuted}
              value={testName}
              onChangeText={setTestName}
            />
          </View>

          {/* Location Input */}
          <View style={searchStyles.inputBox}>
            <MapPin size={16} color={Colors.textMuted} strokeWidth={2} />
            <TextInput
              id="input-test-location"
              style={searchStyles.input}
              placeholder="Location"
              placeholderTextColor={Colors.textMuted}
              value={location}
              onChangeText={setLocation}
            />
          </View>
        </View>

        {/* Find Labs Button */}
        <TouchableOpacity
          id="btn-find-labs"
          style={searchStyles.findLabsBtn}
          onPress={() => onSearch(testName, location)}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[Colors.royalBlue, Colors.royalBlueDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={searchStyles.findLabsGradient}
          >
            <Text style={searchStyles.findLabsText}>Find Labs</Text>
            <Plus size={16} color={Colors.white} strokeWidth={2.5} />
          </LinearGradient>
        </TouchableOpacity>

        {/* Top Searched */}
        <Text style={searchStyles.sectionTitle}>Top searched Lab tests</Text>
        <View style={searchStyles.topSearchedRow}>
          {MOCK_POPULAR_TESTS.slice(0, 3).map((test) => (
            <TouchableOpacity
              key={test.id}
              id={`btn-top-search-${test.id}`}
              style={searchStyles.topSearchChip}
              onPress={() => {
                setTestName(test.name);
                onSearch(test.name, location);
              }}
              activeOpacity={0.8}
            >
              <FlaskConical size={14} color={Colors.royalBlue} strokeWidth={2} />
              <Text style={searchStyles.topSearchText}>{test.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const searchStyles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.base, paddingBottom: 40 },
  headline: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
    marginTop: Spacing.base,
    marginBottom: Spacing.xl,
    lineHeight: 28,
  },
  inputGroup: { gap: Spacing.sm, marginBottom: Spacing.base },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  input: {
    flex: 1,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textPrimary,
  },
  findLabsBtn: { borderRadius: BorderRadius.full, overflow: 'hidden', marginBottom: Spacing.xl },
  findLabsGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.base,
  },
  findLabsText: { color: Colors.white, fontSize: Typography.fontSize.base, fontFamily: Typography.fontFamily.semiBold },
  sectionTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  topSearchedRow: { gap: Spacing.sm },
  topSearchChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  topSearchText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.textPrimary,
    flex: 1,
  },
});

// ─── Step 3: Results ────────────────────────────────────────────────────────────
function ResultsStep({
  query,
  location,
  onSelectTest,
}: {
  query: string;
  location: string;
  onSelectTest: (testId: string) => void;
}) {
  const { data: results, isLoading } = useLabTestSearch(query || 'CBC', location || 'Goregaon');

  const displayResults = results?.length ? results : MOCK_POPULAR_TESTS.slice(0, 3).map(t => ({ test: t, labs: MOCK_LAB_PARTNERS }));

  return (
    <ScrollView style={resultsStyles.container} contentContainerStyle={resultsStyles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* Search display */}
      <View style={resultsStyles.searchRow}>
        <View style={resultsStyles.searchTag}>
          <Search size={14} color={Colors.royalBlue} strokeWidth={2} />
          <Text style={resultsStyles.searchTagText}>{query || 'CBC'}</Text>
        </View>
        <View style={resultsStyles.searchTag}>
          <MapPin size={14} color={Colors.royalBlue} strokeWidth={2} />
          <Text style={resultsStyles.searchTagText}>{location || 'Goregaon'}</Text>
        </View>
      </View>

      <Text style={resultsStyles.sectionTitle}>Our Top Trusted Labs</Text>

      {isLoading ? (
        <ActivityIndicator color={Colors.royalBlue} style={{ marginTop: 24 }} />
      ) : (
        displayResults.map(({ test, labs }) =>
          labs.map((lab) => (
            <TouchableOpacity
              key={`${test.id}-${lab.id}`}
              id={`btn-result-${test.id}-${lab.id}`}
              style={resultsStyles.resultCard}
              onPress={() => onSelectTest(test.id)}
              activeOpacity={0.88}
            >
              {/* Lab Logo */}
              <View style={resultsStyles.labLogoBox}>
                <Text style={resultsStyles.labLogoText}>{lab.name.charAt(0)}</Text>
              </View>
              <View style={resultsStyles.resultInfo}>
                <Text style={resultsStyles.labName}>{lab.name}</Text>
                <Text style={resultsStyles.labAddress}>{lab.address}</Text>
                <Text style={resultsStyles.labTimings}>{lab.timings}</Text>
                <Text style={resultsStyles.testDesc} numberOfLines={2}>{test.description}</Text>
              </View>
              <View style={resultsStyles.resultRight}>
                <View style={resultsStyles.ratingRow}>
                  <Star size={11} color={Colors.warning} fill={Colors.warning} strokeWidth={0} />
                  <Text style={resultsStyles.rating}>{lab.rating}</Text>
                </View>
                <Text style={resultsStyles.price}>₹{lab.discountedPrice ?? lab.price}</Text>
                {lab.discountedPrice && (
                  <Text style={resultsStyles.originalPrice}>₹{lab.price}</Text>
                )}
              </View>
            </TouchableOpacity>
          ))
        )
      )}
    </ScrollView>
  );
}

const resultsStyles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.base, paddingBottom: 40 },
  searchRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg, marginTop: Spacing.sm },
  searchTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.blueBg,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  searchTagText: { fontSize: Typography.fontSize.sm, fontFamily: Typography.fontFamily.semiBold, color: Colors.royalBlue },
  sectionTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  resultCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  labLogoBox: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.blueBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labLogoText: { fontSize: Typography.fontSize.lg, fontFamily: Typography.fontFamily.bold, color: Colors.royalBlue },
  resultInfo: { flex: 1 },
  labName: { fontSize: Typography.fontSize.sm, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary, marginBottom: 2 },
  labAddress: { fontSize: Typography.fontSize.xs, fontFamily: Typography.fontFamily.regular, color: Colors.textSecondary },
  labTimings: { fontSize: Typography.fontSize.xs, fontFamily: Typography.fontFamily.regular, color: Colors.textMuted, marginBottom: 4 },
  testDesc: { fontSize: Typography.fontSize.xs, fontFamily: Typography.fontFamily.regular, color: Colors.textSecondary, lineHeight: 16 },
  resultRight: { alignItems: 'flex-end', gap: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  rating: { fontSize: Typography.fontSize.xs, fontFamily: Typography.fontFamily.semiBold, color: Colors.textPrimary },
  price: { fontSize: Typography.fontSize.xl, fontFamily: Typography.fontFamily.bold, color: Colors.textPrimary },
  originalPrice: { fontSize: Typography.fontSize.xs, fontFamily: Typography.fontFamily.regular, color: Colors.textMuted, textDecorationLine: 'line-through' },
});

// ─── Main LabSearchScreen ───────────────────────────────────────────────────────
export function LabSearchScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [step, setStep] = useState<Step>('INTRO');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLocation, setSearchLocation] = useState('');

  const handleSearch = (query: string, location: string) => {
    setSearchQuery(query);
    setSearchLocation(location);
    setStep('RESULTS');
  };

  const getTitle = () => {
    if (step === 'SEARCH') return 'Find Lab Tests';
    if (step === 'RESULTS') return '← Results';
    return 'Lab Tests';
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        {step !== 'INTRO' ? (
          <TouchableOpacity
            id="btn-back-lab-search"
            onPress={() => setStep(step === 'RESULTS' ? 'SEARCH' : 'INTRO')}
            style={styles.backBtn}
          >
            <ArrowLeft size={22} color={Colors.textPrimary} strokeWidth={2} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            id="btn-close-lab-search"
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            <ArrowLeft size={22} color={Colors.textPrimary} strokeWidth={2} />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>{getTitle()}</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Step Indicator */}
      <View style={styles.stepIndicator}>
        {(['INTRO', 'SEARCH', 'RESULTS'] as Step[]).map((s, i) => (
          <View
            key={s}
            style={[
              styles.stepDot,
              step === s && styles.stepDotActive,
              ['SEARCH', 'RESULTS'].includes(step) && s === 'INTRO' && styles.stepDotDone,
              step === 'RESULTS' && s === 'SEARCH' && styles.stepDotDone,
            ]}
          />
        ))}
      </View>

      {/* Steps */}
      {step === 'INTRO' && <IntroStep onProceed={() => setStep('SEARCH')} />}
      {step === 'SEARCH' && (
        <SearchStep
          onBack={() => setStep('INTRO')}
          onSearch={handleSearch}
        />
      )}
      {step === 'RESULTS' && (
        <ResultsStep
          query={searchQuery}
          location={searchLocation}
          onSelectTest={(testId) => navigation.navigate('LabTestDetail', { testId })}
        />
      )}
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bold,
    color: Colors.textPrimary,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  stepDotActive: { backgroundColor: Colors.royalBlue, width: 24 },
  stepDotDone: { backgroundColor: Colors.teal },
});
