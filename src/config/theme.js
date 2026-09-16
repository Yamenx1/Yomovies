// ---------------------------------------------------------------------------
// THEME — Two full palettes matching the YO Movies brand.
// The accent color (coral #FF6B4A) stays the same in both modes.
// ---------------------------------------------------------------------------

import logoDark from '../../yo-movies-logo-uploaded-dark.png';
import logoLight from '../../yo-movies-logo-uploaded-light.png';

const THEMES = {
  dark: {
    dark: true,
    bg: '#151A24',
    surface: '#1F2534',
    border: '#2C3244',
    text: '#F2EFE6',
    muted: '#9BA0B5',
    accent: '#FF6B4A',
    logo: logoDark,
  },
  light: {
    dark: false,
    bg: '#F5F3EE',
    surface: '#FFFFFF',
    border: '#DDD8CC',
    text: '#151A24',
    muted: '#6B6F80',
    accent: '#FF6B4A',
    logo: logoLight,
  },
};

export default THEMES;
