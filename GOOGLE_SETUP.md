# Continue with Google: what must be set up (the code is already in the app)

The app code (src/google.ts, store.tsx googleLogin, AuthFlow button) is complete. Google sign-in fails ("Google sign-in is not set up for this build") when Firebase does not know the app's signing key.
Your google-services.json has only the Web client (client_type 3) and NO Android client (client_type 1). That means no SHA-1 is registered yet.

## 1. Enable Google in Firebase
Firebase console > Authentication > Sign-in method > Google > Enable > choose a support email > Save.

## 2. Add the SHA-1 of EVERY build you install
Firebase console > Project settings > General > Your apps > Android app com.chartreader.app > Add fingerprint.

- EAS build (apk or aab): in the project folder run
    eas credentials -p android
  choose the build profile (preview / production) > Keystore > the SHA-1 is printed. Add it.
- Installed from Google Play: Play Console > your app > Test and release > App integrity > App signing > copy the "App signing key certificate" SHA-1 and add it too.
- Debug / local build: keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android

## 3. Download the new google-services.json
Firebase console > Project settings > Your apps > Download google-services.json. It must now contain a client with "client_type": 1. Replace the file in the project root.

## 4. Make a NEW build (an eas update is not enough: the file and the native module are part of the build)
    npm install
    eas build -p android --profile preview

## 5. Test
Install the new build > Continue with Google > pick an account. A new account goes on to set its PIN; an existing one logs straight in.
The admin phone gets a "New signup" push (server must be running).

## Error meanings
- errGoogleSetup (DEVELOPER_ERROR / code 10): the SHA-1 of this build is not in Firebase, or google-services.json is the old file.
- errGoogleBuild: the installed app is an old build without the Google module. Install the new build.
- errGoogle: Google or Firebase refused the sign-in. Check step 1 and that the Web client ID in src/google.ts is the one in google-services.json (client_type 3).
