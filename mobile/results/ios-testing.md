# iOS test handoff

From `mobile/` on macOS with Xcode:

```bash
npm install
npm run typecheck
npm test
npx expo run:ios
```

For an iOS simulator build through EAS:

```bash
npx eas-cli build --platform ios --profile ios-simulator
```

Manual checks:

- Safe-area layout works on iPhone and iPad widths.
- Home, Search, Saved, Profile, property details, and gallery navigation work.
- SecureStore restores and clears the signed-in session.
- Photo-library permission and multipart image upload work.
- Google callback returns to the app when configured.
- Empty, loading, retry, and error states are readable on small screens.

For the iOS simulator, a local backend is reachable at `http://127.0.0.1:8080`. A physical iPhone must use the computer's LAN IP.
