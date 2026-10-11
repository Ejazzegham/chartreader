import { useWindowDimensions as real } from 'react-native';
// The website shows the app in a centred column this wide (see Frame.web.tsx). Every screen sizes itself from this width.
export const MAX_W = 520;
export function useWindowDimensions() { const d = real(); return { ...d, width: Math.min(d.width, MAX_W) }; }
