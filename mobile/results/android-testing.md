# Android test handoff

From `mobile/`:

```cmd
copy .env.example .env
npm install
npm run typecheck
npm test
npm start
```

The current installable preview APK is in `results/mobile-builds/Umutungo-android-preview.apk`. To build a replacement (the profile increments Android versionCode automatically):

```cmd
npx eas-cli build --platform android --profile preview --wait
```

Manual checks:

- Home, Search, Saved, Profile, and property details open.
- Phone OTP sign-in restores after reopening the app.
- Google sign-in returns to the mobile app when configured.
- Save/remove a property updates the Saved tab.
- Komisiyoneri or Property Owner can create a listing and upload a valid image.
- Tenants can submit rental applications, and owners can accept, decline, or request more information.
- Messages, inbox conversations, and notifications load from the account APIs.
- Non-owners and oversized/non-image uploads are rejected.

For an Android emulator, use `EXPO_PUBLIC_API_URL=http://10.0.2.2:8080`. A physical phone must use the Windows computer's LAN IP.
