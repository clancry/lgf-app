export const Colors = {
  // Brand primaries
  darkGreen: '#1B6940',  // matché au fond du logo JPEG
  lime: '#B5D43B',
  orange: '#E8612D',

  // Neutrals
  white: '#FFFFFF',
  black: '#000000',
  background: '#F5F5F0',
  surface: '#FFFFFF',
  border: '#E8E8E0',

  // Text
  textPrimary: '#1A1A1A',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  textInverse: '#FFFFFF',

  // Semantic
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',

  // Regime badges
  masse: '#E8612D',
  seche: '#3B82F6',
  equilibre: '#10B981',

  // Macro bars
  proteines: '#E8612D',
  glucides: '#B5D43B',
  lipides: '#F59E0B',

  // Tab bar
  tabBarBackground: '#FFFFFF',
  tabBarActive: '#1B4332',
  tabBarInactive: '#9CA3AF',

  // Card
  cardBackground: '#FFFFFF',
  cardShadow: 'rgba(0,0,0,0.08)',

  // Overlays
  overlay: 'rgba(27, 67, 50, 0.6)',
  overlayLight: 'rgba(0,0,0,0.3)',
};

export type ColorKey = keyof typeof Colors;
