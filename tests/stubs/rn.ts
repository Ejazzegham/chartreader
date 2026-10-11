export const Alert = { alert() {} }; export const Vibration = { vibrate() {} };
export const Platform = { OS: 'ios', select: (o: any) => o.ios ?? o.default };
export const Share = { share: async () => ({}) };
export const useWindowDimensions = () => ({ width: 390, height: 844, scale: 2, fontScale: 1 });
export default {};
