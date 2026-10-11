import { Platform } from 'react-native';
import { getServer } from './license';

export const IS_WEB = Platform.OS === 'web';
// Browsers block most third-party sites (CORS). On the website those requests (Yahoo backup prices, news, headlines) go through the app's own
// server (/proxy, see server/proxy.js), which is allowed to read them. On the phone nothing changes: the request goes straight out.
export function xfetch(url: string, init: RequestInit = {}): Promise<Response> {
  if (!IS_WEB) return fetch(url, init);
  const { headers: _drop, ...rest } = init; // a browser may not set User-Agent, and extra headers would force a pre-check
  return fetch(`${getServer()}/proxy?u=${encodeURIComponent(url)}`, { ...rest, headers: { 'ngrok-skip-browser-warning': '1' } });
}
