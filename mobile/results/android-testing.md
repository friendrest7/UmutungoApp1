# Android test handoff

From `mobile/`:

```cmd
copy .env.example .env
npm install
npm run typecheck
npm test
npm start
```

For an installable preview APK after EAS is initialized:

```cmd
npx eas-cli build --platform android --profile preview
```

Manual checks:

- Home, Search, Saved, Profile, and property details open.
- Phone OTP sign-in restores after reopening the app.
- Google sign-in returns to the mobile app when configured.
- Save/remove a property updates the Saved tab.
- Komisiyoneri or Property Owner can create a listing and upload a valid image.
- Non-owners and oversized/non-image uploads are rejected.

For an Android emulator, use `EXPO_PUBLIC_API_URL=http://10.0.2.2:8080`. A physical phone must use the Windows computer's LAN IP.
