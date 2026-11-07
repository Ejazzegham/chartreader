import { Platform } from 'react-native';
import type { Theme } from './theme';

// Frosted-glass helpers for the website (they do nothing on the phone apps).
export const glassWeb: any = Platform.OS === 'web' ? { backdropFilter: 'blur(14px) saturate(170%)', WebkitBackdropFilter: 'blur(14px) saturate(170%)' } : {};
// No page-wide sheet any more: pages sit directly on the animated backdrop and only the boxes (panels) are glass.
export const sheet = (_th: Theme): any => ({});
