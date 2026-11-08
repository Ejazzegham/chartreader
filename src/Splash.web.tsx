import React from 'react';
import { useRealWindow } from './win';
import SplashPhone from './SplashPhone';
import SplashGif from './SplashGif';

// The website's start screen. A wide browser window gets the animated one made from the Chart Reader splash GIF (SplashGif.web.tsx:
// dotted world map, light streak, glowing logo, candlesticks, progress bar); a narrow window (a phone) keeps the phone's own start screen.
export default function AnimatedSplash(props: { done: boolean; onGone: () => void; duration?: number }) {
  const { width } = useRealWindow();
  return width >= 760 ? <SplashGif done={props.done} onGone={props.onGone} duration={props.duration ?? 3400} /> : <SplashPhone {...props} />;
}
