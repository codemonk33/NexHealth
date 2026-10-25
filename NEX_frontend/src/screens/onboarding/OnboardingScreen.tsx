import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  Image,
  ListRenderItem,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';
import type { RootStackParamList } from '../../navigation/RootNavigator';

const { width, height } = Dimensions.get('window');

interface Slide {
  id: string;
  title: string;
  subtitle: string;
  accent: string;
  gradient: readonly [string, string];
  emoji: string;
}

const SLIDES: Slide[] = [
  {
    id: '1',
    title: 'Never Lose a\nMedical Record Again.',
    subtitle: 'Your complete health history, securely stored and accessible anytime, anywhere.',
    accent: Colors.teal,
    gradient: ['#EAF8F4', '#F5F8FF'] as const,
    emoji: '🏥',
  },
  {
    id: '2',
    title: 'Access Your Medical\nHistory Anytime.',
    subtitle: 'ABHA-integrated digital health locker — your records always in your pocket.',
    accent: Colors.royalBlue,
    gradient: ['#EEF3FF', '#F5F8FF'] as const,
    emoji: '📋',
  },
  {
    id: '3',
    title: 'Understand Your\nReports in Seconds.',
    subtitle: 'AI-powered analysis explains complex lab reports in simple language.',
    accent: Colors.teal,
    gradient: ['#EAF8F4', '#EEF3FF'] as const,
    emoji: '🤖',
  },
  {
    id: '4',
    title: 'Book Lab Tests at\nHome in Minutes.',
    subtitle: 'Quality diagnostics from NABL-accredited labs delivered at your doorstep.',
    accent: Colors.orange,
    gradient: ['#FFF1EC', '#F5F8FF'] as const,
    emoji: '🔬',
  },
];

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function OnboardingScreen() {
  const navigation = useNavigation<NavigationProp>();
  const flatListRef = useRef<FlatList>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleNext = () => {
    if (activeIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    } else {
      navigation.replace('Auth');
    }
  };

  const handleSkip = () => navigation.replace('Auth');

  const renderSlide: ListRenderItem<Slide> = ({ item }) => (
    <LinearGradient colors={item.gradient} style={styles.slide}>
      {/* Logo area */}
      <View style={styles.logoArea}>
        <View style={[styles.logoCircle, { borderColor: item.accent }]}>
          <Text style={styles.logoEmoji}>🩺</Text>
        </View>
        <Text style={[styles.brandName, { color: item.accent }]}>Bionex</Text>
      </View>

      {/* Illustration */}
      <View style={styles.illustrationArea}>
        <Text style={styles.illustrationEmoji}>{item.emoji}</Text>
        {/* Decorative circles */}
        <View style={[styles.decorCircle1, { borderColor: item.accent + '30' }]} />
        <View style={[styles.decorCircle2, { borderColor: item.accent + '20' }]} />
      </View>

      {/* Text */}
      <View style={styles.textArea}>
        <Text style={styles.slideTitle}>{item.title}</Text>
        <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
      </View>
    </LinearGradient>
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / width);
          setActiveIndex(idx);
        }}
      />

      {/* Bottom Controls */}
      <View style={styles.bottomControls}>
        {/* Dots */}
        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === activeIndex ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>

        {/* Buttons */}
        <View style={styles.buttonsRow}>
          <TouchableOpacity id="btn-skip-onboarding" onPress={handleSkip} style={styles.skipBtn}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>

          <TouchableOpacity
            id="btn-next-onboarding"
            onPress={handleNext}
            activeOpacity={0.85}
            style={styles.nextBtn}
          >
            <LinearGradient
              colors={[Colors.teal, Colors.tealDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.nextBtnGradient}
            >
              <Text style={styles.nextBtnText}>
                {activeIndex === SLIDES.length - 1 ? 'Get Started' : 'Next'}
              </Text>
              <ArrowRight color={Colors.white} size={18} strokeWidth={2.5} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  slide: {
    width,
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing['2xl'],
  },
  logoArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing['2xl'],
  },
  logoCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  logoEmoji: { fontSize: 20 },
  brandName: {
    fontSize: Typography.fontSize['3xl'],
    fontFamily: Typography.fontFamily.bold,
    letterSpacing: -0.5,
  },
  illustrationArea: {
    height: height * 0.35,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  illustrationEmoji: { fontSize: 100 },
  decorCircle1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1.5,
  },
  decorCircle2: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 1,
  },
  textArea: { marginTop: Spacing.xl },
  slideTitle: {
    fontSize: Typography.fontSize['4xl'],
    fontFamily: Typography.fontFamily.extraBold,
    color: Colors.textPrimary,
    lineHeight: Typography.fontSize['4xl'] * 1.25,
    marginBottom: Spacing.md,
  },
  slideSubtitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textSecondary,
    lineHeight: Typography.fontSize.lg * 1.6,
  },
  bottomControls: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: Spacing.base,
  },
  dot: { height: 6, borderRadius: 3 },
  dotActive: { width: 24, backgroundColor: Colors.teal },
  dotInactive: { width: 8, backgroundColor: Colors.textLight },
  buttonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skipBtn: { padding: Spacing.sm },
  skipText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.medium,
    color: Colors.textMuted,
  },
  nextBtn: { flex: 1, maxWidth: 200, marginLeft: Spacing.base },
  nextBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  nextBtnText: {
    color: Colors.white,
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.semiBold,
  },
});
