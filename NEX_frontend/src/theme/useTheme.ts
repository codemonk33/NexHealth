/**
 * useTheme — Centralized Theme Hook
 * 
 * Provides:
 * - Color palette (primary, error, success, etc.)
 * - Typography/fonts (regular, medium, bold, etc.)
 * - Spacing values (xs, sm, md, base, etc.)
 * - Border radius values
 * 
 * Usage:
 * ```tsx
 * const { colors, fonts, spacing } = useTheme();
 * <View style={{ backgroundColor: colors.primary }} />
 * <Text style={{ fontFamily: fonts.bold }} />
 * ```
 */

import { Colors } from './colors';
import { Typography, Spacing, BorderRadius } from './typography';

export interface ThemeValues {
  colors: {
    // Brand
    primary: string;
    secondary: string;
    
    // Status
    success: string;
    warning: string;
    error: string;
    info: string;
    
    // UI
    background: string;
    surface: string;
    border: string;
    divider: string;
    
    // Text
    text: string;
    textSecondary: string;
    textMuted: string;
    
    // Special
    overlay: string;
    overlayLight: string;
    disabled: string;
  };
  
  fonts: {
    regular: string;
    medium: string;
    semiBold: string;
    bold: string;
    extraBold: string;
  };
  
  spacing: typeof Spacing;
  borderRadius: typeof BorderRadius;
}

export function useTheme(): ThemeValues {
  return {
    colors: {
      primary: Colors.teal,
      secondary: Colors.royalBlue,
      success: Colors.success,
      warning: Colors.warning,
      error: Colors.error,
      info: Colors.info,
      background: Colors.background,
      surface: Colors.surface,
      border: Colors.border,
      divider: Colors.divider,
      text: Colors.textPrimary,
      textSecondary: Colors.textSecondary,
      textMuted: Colors.textMuted,
      overlay: Colors.overlay,
      overlayLight: Colors.overlayLight,
      disabled: Colors.textMuted,
    },
    fonts: {
      regular: Typography.fontFamily.regular,
      medium: Typography.fontFamily.medium,
      semiBold: Typography.fontFamily.semiBold,
      bold: Typography.fontFamily.bold,
      extraBold: Typography.fontFamily.extraBold,
    },
    spacing: Spacing,
    borderRadius: BorderRadius,
  };
}
