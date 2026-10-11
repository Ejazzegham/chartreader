import React from 'react';
// Phone: nothing around the app. The website version (Frame.web.tsx) puts it in a centred column.
export default function Frame({ children }: { children: React.ReactNode }) { return <>{children}</>; }
export const useFrameHost = (): any => null;
