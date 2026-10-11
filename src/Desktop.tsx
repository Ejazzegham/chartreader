import React from 'react';
// Phone: no desktop shell. The website version (Desktop.web.tsx) adds the sidebar and the market-watch panel.
export const useDesktop = () => false;
export function DesktopShell({ children }: { children: React.ReactNode }) { return <>{children}</>; }
