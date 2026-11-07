import { Platform } from 'react-native';
import type { Theme } from './theme';

// Frosted-glass helpers for the website (they do nothing on the phone apps).
export const glassWeb: any = Platform.OS === 'web' ? { backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)' } : {};
// The frosted sheet every page sits on, over the animated backdrop: headings and text on the page keep the content colour and stay readable.
export const sheet = (th: Theme): any => (Platform.OS !== 'web' ? {} : {
  margin: 10, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: th.line,
  backgroundColor: th.dark ? 'rgba(14,18,44,0.82)' : 'rgba(255,255,255,0.84)',
  boxShadow: '0 24px 48px -24px rgba(0,0,0,0.5)', ...glassWeb,
});
