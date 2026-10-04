# Umutungo mobile build results

These are real EAS artifacts generated from `mobile/`. No dummy files or source archives are being used as app packages.

## Completed builds

| Platform | Profile | Status | Build ID | Build page | Artifact URL | Local artifact |
| --- | --- | --- | --- | --- | --- | --- |
| Android | `android-apk` | FINISHED | `91b9fe8b-cab4-4413-9e0d-d18581411668` | [EAS build](https://expo.dev/accounts/friendrest7/projects/umutungo-mobile/builds/91b9fe8b-cab4-4413-9e0d-d18581411668) | [APK](https://expo.dev/artifacts/eas/4HkDIIo1nfGJ1HpNrta8clK80DcG4FPPl3l_rS-ljRo.apk) | `results/mobile-builds/Umutungo-android-apk.apk` |
| iOS Simulator | `ios-simulator` | FINISHED | `013b6050-7336-4550-b762-067d21337c71` | [EAS build](https://expo.dev/accounts/friendrest7/projects/umutungo-mobile/builds/013b6050-7336-4550-b762-067d21337c71) | [Simulator archive](https://expo.dev/artifacts/eas/2aKgo-1vOUj5lPYXhy3gFxuBQdYUILHbnk76L0aBN9s.tar.gz) | `results/mobile-builds/Umutungo-ios-simulator.tar.gz` and `results/mobile-builds/Umutungo-ios-simulator.app/` |

The simulator build was created with `ios.simulator=true`. It is not an iPhone IPA and cannot be installed on a physical iPhone.

## Artifact verification

| File | Type | Size | SHA-256 | Verification |
| --- | --- | ---: | --- | --- |
| `results/mobile-builds/Umutungo-android-apk.apk` | Android installable APK; ZIP/APK magic `80 75 3 4` | 102,312,807 bytes | `2FEC3CA9671B3E535A547F8BD540F99FB58CA45E10B1158677BD5BC46DA03217` | Non-empty and verified |
| `results/mobile-builds/Umutungo-ios-simulator.tar.gz` | iOS Simulator archive containing `Umutungo.app` | 25,409,140 bytes | `4EE6F6A5EE9547DE0CE6BC348AEA0177FE03D7A07C8883CB4446624AFDFC4388` | Non-empty; extracted app has 111 files / 93,227,452 bytes |

An earlier Android production AAB is also retained from the previously completed EAS build:

- Build ID: `455fec5d-29e2-42be-9469-2e92f001793b`
- [EAS build](https://expo.dev/accounts/friendrest7/projects/umutungo-mobile/builds/455fec5d-29e2-42be-9469-2e92f001793b)
- [AAB artifact](https://expo.dev/artifacts/eas/781dFqAPIxm5SNQT6-FAYNi6bZEmERY1jeY18YYb-Gk.aab)
- Local path: `results/mobile-builds/Umutungo-android-production.aab`
- Size: 71,954,384 bytes
- SHA-256: `CC11730859936A622D4612F5CB5B3C5C0BDD9232BDE632A16BE6DF0BC71EA696`

## Exact commands used

From `C:\Users\CNS Technologies\Documents\UmutungoApp\mobile`:

```powershell
npm install
npm run typecheck
npm test -- --watch=false
npx expo export --platform android
npx expo export --platform ios
npx eas-cli@latest build --platform android --profile android-apk --wait
npx eas-cli@latest build --platform ios --profile ios-simulator --wait
```

The production iOS command was intentionally not run:

```powershell
# Run only after Apple Developer membership and signing credentials are available.
npx eas-cli@latest build --platform ios --profile ios-production --wait
```

## Validation completed

- `npm install`: completed.
- `npm run typecheck`: passed.
- `npm test -- --watch=false`: passed; 1 suite and 2 tests.
- `npx expo export --platform android`: passed.
- `npx expo export --platform ios`: passed.
- `npx expo start --no-dev --minify`: Metro started successfully on port 8081. A local Windows DevTools temp-directory warning was non-blocking.
- Backend connectivity: `https://umutungoappbackend1.onrender.com/api/v1/listings` returned HTTP 200 with `{"count":0,"items":[]}`.
- EAS preview environment: `EXPO_PUBLIC_API_URL=https://umutungoappbackend1.onrender.com`.
- Android package and iOS bundle identifier: `rw.umutungo.mobile`.

## Mobile features checked

- Expo Router navigation for home, search, saved properties, profile, authentication, property details, listing creation, and listing management.
- OTP authentication and Google sign-in request paths use the real Go API; access tokens are stored in Expo SecureStore.
- Listing, favorites, profile, media upload, owner listing, application, messaging, and notification API clients use the configured backend URL.
- Light/dark theme persistence and system theme support.
- English, French, Kinyarwanda, and Swahili selector with persisted language and profile-language synchronization.
- Loading, empty, API failure, invalid form input, upload, and authentication error states.
- App icon, splash screen, photo-library permission, and Android media/audio permissions are configured without storing secrets in the repository.

## Install and run

### Android phone

Copy `results/mobile-builds/Umutungo-android-apk.apk` to the Android phone, open it, and allow installation from that source when Android asks. With Android Debug Bridge:

```powershell
adb install -r .\results\mobile-builds\Umutungo-android-apk.apk
```

The installed app uses the EAS preview API URL and connects to the real Umutungo backend.

### iOS Simulator

On macOS with Xcode and an available booted simulator:

```bash
tar -xzf results/mobile-builds/Umutungo-ios-simulator.tar.gz -C /tmp
xcrun simctl install booted /tmp/Umutungo.app
xcrun simctl launch booted rw.umutungo.mobile
```

The extracted `.app` bundle is also available at `results/mobile-builds/Umutungo-ios-simulator.app/` for transfer to a Mac.

## iPhone/TestFlight status

No real iPhone IPA was created. A physical-iPhone/TestFlight build requires Apple Developer membership, App Store Connect access, a registered bundle identifier, and Apple distribution signing credentials. The `ios-production` EAS profile remains configured with `distribution: store` and bundle identifier `rw.umutungo.mobile` for later use after those requirements are met.
