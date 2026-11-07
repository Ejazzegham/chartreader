import { Platform } from 'react-native';
import type { Theme } from './theme';

// Frosted-glass helpers for the website (they do nothing on the phone apps).
export const glassWeb: any = Platform.OS === 'web' ? { backdropFilter: 'blur(14px) saturate(170%)', WebkitBackdropFilter: 'blur(14px) saturate(170%)' } : {};
// The frosted sheet every page sits on, over the animated backdrop: headings and text on the page keep the content colour and stay readable.
export const sheet = (th: Theme): any => (Platform.OS !== 'web' ? {} : {
  margin: 14, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: th.dark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.7)',
  backgroundColor: th.dark ? 'rgba(14,18,44,0.55)' : 'rgba(244,247,255,0.58)', // see-through: the animated backdrop shows through the page
  boxShadow: '0 24px 48px -24px rgba(0,0,0,0.5)', ...glassWeb,
});
