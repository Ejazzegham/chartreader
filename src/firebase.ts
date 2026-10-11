import { initializeApp, getApps, getApp } from 'firebase/app';
import * as FA from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase console > Project settings > General > Your apps > (add a Web app) > copy these values.
// These are public identifiers, not secrets. Also enable Authentication > Sign-in method > Email/Password.
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDRDshttLnPV6pR3eB1hMejbJW2eg2Qwjc",
  authDomain: "chart-reader-45c13.firebaseapp.com",
  projectId: "chart-reader-45c13",
  appId: "1:745148948540:web:9b8dde9a83f93277dd6339",
};

const app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
const rnPersistence = (FA as any).getReactNativePersistence; // only exists in the React Native build of firebase/auth
// On the phone the login is kept in AsyncStorage so it survives app restarts.
// initializeAuth throws if it runs twice (it does after a hot reload), so fall back to the instance that already exists.
const makeAuth = (): FA.Auth => { if (!rnPersistence) return FA.getAuth(app); try { return FA.initializeAuth(app, { persistence: rnPersistence(AsyncStorage) }); } catch { return FA.getAuth(app); } };
export const auth: FA.Auth = makeAuth();
