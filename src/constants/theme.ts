// ============================================================
// POS PowerPlay — Theme Constants (Dark Mode, IDR)
// ============================================================

export const Colors = {
  // Primary brand gradient (deep blue-violet)
  primary: '#6C63FF',
  primaryDark: '#4A42CC',
  primaryLight: '#9B94FF',

  // Accent
  accent: '#FF6584',
  accentGreen: '#00D9A3',
  accentOrange: '#FF9F43',
  accentRed: '#FF6B6B',

  // Background (dark theme)
  background: '#0F0F1A',
  surface: '#1A1A2E',
  surfaceElevated: '#252542',
  card: '#1E1E35',

  // Text
  text: '#F0F0FF',
  textSecondary: '#9999BB',
  textMuted: '#5555AA',

  // Borders
  border: '#2A2A4A',
  borderLight: '#3A3A6A',

  // Status
  success: '#00D9A3',
  warning: '#FF9F43',
  error: '#FF6B6B',
  info: '#6C63FF',

  // Chart colors
  chart: ['#6C63FF', '#00D9A3', '#FF6584', '#FF9F43', '#4ECDC4'],

  // White / transparent
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0,0,0,0.6)',
  glass: 'rgba(255,255,255,0.05)',
};

export const Fonts = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
  sizes: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 17,
    lg: 20,
    xl: 24,
    xxl: 30,
    xxxl: 36,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const Radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const Shadow = {
  sm: {
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  md: {
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  lg: {
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
};
