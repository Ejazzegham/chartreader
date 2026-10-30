// Native app: no website footer. (The website version is SiteFooter.web.tsx.)
export const Footer = (_: { w: number; go: (t: number, market?: string) => void }) => null;
export const PageFooter = () => null;
export function useGo() { return (_t: number, _extra?: string) => {}; }
