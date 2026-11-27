import React from 'react';
import { useApp } from './store';

// The website backdrop: a plain flat page colour that follows the theme (Light = soft grey-white, Dark = deep navy-black; see STYLES in src/theme.ts).
// No animation, no colour glows, no grain.
export default function LiveBackdrop() {
  const { th } = useApp();
  return React.createElement('div', { 'aria-hidden': true, style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, pointerEvents: 'none', backgroundColor: th.back } });
}
