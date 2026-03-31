/**
 * Magical Kingdom color palette — vibrant, layered, festive.
 * All foreground/background pairs meet WCAG AA contrast.
 */

export const COLORS = {
  bird: {
    // Warm golden-orange body with depth
    body: '#FFB347',
    bodyMid: '#FF9520',
    bodyDark: '#E07B10',
    belly: '#FFF0C0',
    bellyInner: '#FFE08A',
    // Wing: amber shading
    wing: '#E8A020',
    wingLight: '#FFD060',
    wingDark: '#B86A00',
    // Accents
    beak: '#FF6B35',
    beakDark: '#CC4A15',
    eye: '#1A0A00',
    eyeRing: '#3D1800',
    eyeHighlight: '#FFFFFF',
    eyeShine: 'rgba(255,255,255,0.6)',
    cheek: '#FF9999',
    // Crown / magical accent
    crown: '#FFD700',
    crownGem: '#FF4DD2',
  },

  pipe: {
    // Enchanted stone-green columns
    body: '#4CAF82',
    bodyLight: '#6DDBA0',
    bodyDark: '#2E7A57',
    bodyShadow: '#1B5C3E',
    cap: '#3D9970',
    capLight: '#5DC98E',
    capDark: '#256B4F',
    highlight: '#A8FFD4',
    stone: '#5D7A5A',
    rune: 'rgba(180, 255, 200, 0.55)',
  },

  sky: {
    topDefault: '#5B8DEF',
    bottomDefault: '#F7C5A0',
    midDefault: '#9BB8F7',
  },

  ground: {
    surface: '#C8935A',
    surfaceMid: '#B07840',
    surfaceDark: '#8B5E2A',
    grass: '#4ADE80',
    grassLight: '#86EFAC',
    grassDark: '#16A34A',
    cobble: 'rgba(100,75,40,0.25)',
  },

  ui: {
    accent: '#7C3AED',
    accentLight: '#A78BFA',
    accentGlow: 'rgba(124,58,237,0.45)',
    background: 'rgba(30, 20, 60, 0.88)',
    text: '#FEFEFE',
    textDark: '#1E0A30',
    shadow: 'rgba(0, 0, 0, 0.35)',
    gold: '#FFD700',
    goldDark: '#E8A800',
  },

  reward: {
    multiplier: '#FFD700',
    multiplierGlow: 'rgba(255,215,0,0.5)',
    shield: '#60B8FF',
    shieldGlow: 'rgba(96,184,255,0.5)',
    slowmo: '#C084FC',
    slowmoGlow: 'rgba(192,132,252,0.5)',
    shrink: '#34D399',
    shrinkGlow: 'rgba(52,211,153,0.5)',
  },

  particles: {
    flap: ['#FFF0C0', '#FFB347', '#FFFFFF', '#FFE08A'],
    death: ['#FF6B35', '#FF3860', '#FFD700', '#FFFFFF'],
    reward: ['#FFD700', '#60B8FF', '#C084FC', '#34D399', '#FFFFFF'],
    magic: ['#E879F9', '#818CF8', '#38BDF8', '#F0ABFC'],
  },

  cloud: '#FFFFFF',
  cloudShadow: 'rgba(100, 140, 255, 0.22)',
  cloudGlow: 'rgba(200, 220, 255, 0.35)',

  magic: {
    sparkle: '#F0ABFC',
    sparkleGlow: 'rgba(240,171,252,0.6)',
    star: '#FDE68A',
    starGlow: 'rgba(253,230,138,0.5)',
    aurora1: 'rgba(167,139,250,0.18)',
    aurora2: 'rgba(96,165,250,0.15)',
    aurora3: 'rgba(52,211,153,0.12)',
  },
} as const;

/** Story mode sky gradients per level (1–20) — richer, more magical */
export const LEVEL_SKY_COLORS: Array<{ top: string; bottom: string }> = [
  { top: '#5B8DEF', bottom: '#F7C5A0' },  // Morning glow
  { top: '#60AFFF', bottom: '#FFEAB0' },  // Golden morning
  { top: '#50C8A0', bottom: '#C8F7E0' },  // Spring mint
  { top: '#4E9AF1', bottom: '#D4ECFF' },  // Clear azure
  { top: '#8B6FE8', bottom: '#FFCBA8' },  // Lavender afternoon
  { top: '#F472B6', bottom: '#FFF0C0' },  // Pink blush
  { top: '#F97316', bottom: '#FDE68A' },  // Golden hour
  { top: '#9333EA', bottom: '#F9A8D4' },  // Purple dusk
  { top: '#1E3A5F', bottom: '#5B3A8E' },  // Twilight
  { top: '#0F172A', bottom: '#1E3A5F' },  // Night
  { top: '#0A0F2E', bottom: '#2A1A5E' },  // Deep night
  { top: '#1A0A3E', bottom: '#5B21B6' },  // Midnight purple
  { top: '#4C1D95', bottom: '#7C3AED' },  // Magic hour
  { top: '#C2410C', bottom: '#FDE68A' },  // Sunrise fire
  { top: '#065F46', bottom: '#34D399' },  // Emerald forest
  { top: '#92400E', bottom: '#FCD34D' },  // Amber dusk
  { top: '#BE185D', bottom: '#FCA5A5' },  // Rose garden
  { top: '#374151', bottom: '#9CA3AF' },  // Storm clouds
  { top: '#1C0505', bottom: '#991B1B' },  // Volcanic
  { top: '#030712', bottom: '#7C3AED' },  // Final: cosmic
];

