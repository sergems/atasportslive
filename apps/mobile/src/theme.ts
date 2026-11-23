/** Single source of visual truth for the app. Screens import components; components import tokens. */
export const colors = {
  background: '#0B1220',
  surface: '#111C2E',
  surfaceAlt: '#16233A',
  border: '#1E2C42',
  text: '#E2E8F0',
  muted: '#94A3B8',
  primary: '#14B8A6',
  primaryDark: '#0D9488',
  onPrimary: '#042F2E',
  accent: '#F59E0B',
  cash: '#4ADE80',
  bonus: '#FACC15',
  danger: '#EF4444',
  white: '#FFFFFF',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
export const fontSize = { xs: 11, sm: 13, md: 15, lg: 18, xl: 24, hero: 32 } as const;
