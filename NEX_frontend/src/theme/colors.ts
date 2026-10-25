export const Colors = {
  // Brand Primaries
  teal: '#4EBAA1',
  tealLight: '#7DCFBB',
  tealDark: '#35967F',
  tealBg: '#EAF8F4',

  royalBlue: '#1E5AFF',
  royalBlueLight: '#5B85FF',
  royalBlueDark: '#0038D1',
  blueBg: '#EEF3FF',

  orange: '#FF7243',
  orangeLight: '#FF9570',
  orangeDark: '#D94F22',
  orangeBg: '#FFF1EC',

  // Neutrals
  white: '#FFFFFF',
  background: '#F5F8FF',
  cardBg: '#FFFFFF',
  surface: '#F0F4FF',

  // Text
  textPrimary: '#0D1B3E',
  textSecondary: '#4A5568',
  textMuted: '#9BA5B4',
  textLight: '#CBD5E0',

  // Status
  success: '#22C55E',
  successBg: '#DCFCE7',
  warning: '#F59E0B',
  warningBg: '#FEF3C7',
  error: '#EF4444',
  errorBg: '#FEE2E2',
  info: '#3B82F6',
  infoBg: '#DBEAFE',

  // Border
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  divider: '#EDF2F7',

  // Dark overlay
  overlay: 'rgba(13, 27, 62, 0.5)',
  overlayLight: 'rgba(13, 27, 62, 0.12)',

  // Gradients (used as array for LinearGradient)
  gradientTeal: ['#4EBAA1', '#35967F'] as const,
  gradientBlue: ['#1E5AFF', '#0038D1'] as const,
  gradientOrange: ['#FF7243', '#D94F22'] as const,
  gradientBlueTeal: ['#1E5AFF', '#4EBAA1'] as const,
  gradientLight: ['#F5F8FF', '#EEF3FF'] as const,
  gradientHero: ['#EEF3FF', '#EAF8F4'] as const,

  // Tab bar
  tabActive: '#1E5AFF',
  tabInactive: '#9BA5B4',
  tabBg: '#FFFFFF',

  // Card shadows
  shadowColor: '#1E5AFF',
  shadow: 'rgba(30, 90, 255, 0.12)',
} as const;

export type ColorKey = keyof typeof Colors;
