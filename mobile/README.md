# Umutungo mobile

Native Android and iOS app for Umutungo using one Expo SDK 57, Expo Router, React Native, and TypeScript codebase.

Absolute project path:

`C:\Users\CNS Technologies\Documents\UmutungoApp\mobile`

The mobile app calls the existing Go API. It does not contain database credentials, service-role keys, or copied browser session cookies.

## Windows CMD setup

From `C:\Users\CNS Technologies\Documents\UmutungoApp\mobile`:

```cmd
copy .env.example .env
npm install
npm run typecheck
npx expo doctor
npm start
```

Set `EXPO_PUBLIC_API_URL` in `.env` before starting. Use `http://10.0.2.2:8080` for an Android emulator, `http://127.0.0.1:8080` for an iOS simulator, or the Windows computer's LAN IP for a physical phone. The Go backend must be running and its CORS/network configuration must allow the device to reach it.

## Implemented

- Native Expo Router bottom tabs: Home, Search, Saved, and Profile.
- Live published listing search through `GET /api/v1/listings`, with search, category, transaction filters, loading, retry, empty, and client-side result paging.
- Property details and photo gallery using listing media returned by `GET /api/v1/listings/{id}`.
- Phone OTP registration and sign-in through the existing Go API; bearer token restoration and sign-out use `expo-secure-store`.
- Save and remove listings through the existing favorites endpoints.
- Owner/komisiyoneri listing creation and management through the existing listing endpoints.
- Native photo-library selection for listing photos, with an honest limitation described below for binary upload.
- Owner contact messaging through `POST /api/v1/messages`.
- English, French, Kinyarwanda, and Swahili labels for the core navigation and states.
- Safe-area-aware scrolling, keyboard avoidance on forms, Android/iOS-compatible navigation, and photo-library permission handling.

## Known backend limitations

These are limitations of the inspected existing backend, not mocked mobile behavior:

1. `GET /api/v1/me` exists, but there is no profile update endpoint. Profile details are viewable; editing is intentionally disabled until a real PATCH profile contract is added.
2. Listing creation accepts hosted media URLs in JSON but has no binary/object-storage upload endpoint. The app lets an owner select photos for review and optionally submit an already hosted image URL. It does not claim that a local photo was uploaded.
3. The current Go API exposes phone OTP, not a mobile Google or Apple OAuth exchange. Google and Apple are therefore not presented as fake-success buttons. A secure backend exchange endpoint and provider configuration are required before enabling them.
4. Listing search currently returns a maximum of 100 records and has no cursor/page query contract. "Load more" pages the already returned live result set on-device; server pagination requires a backend contract change.
5. No push-notification registration endpoint was found, so this release uses on-demand API loading rather than claiming push support.

## Android phone testing

Start the Go API, set the computer LAN IP in `.env`, then run:

```cmd
npm start
```

Install Expo Go for a quick browse-only check and scan the QR code. Phone OTP, SecureStore, image permissions, and OAuth callbacks require a development build with the configured `umutungo` scheme:

```cmd
npx expo install
npx expo run:android
```

The local Android build requires Android Studio, an Android SDK, and a USB-debuggable device or emulator. The API must be reachable from the phone; `localhost` on the phone is not the Windows machine.

## iPhone testing

For quick UI browsing, run Expo and use Expo Go. A custom scheme, SecureStore behavior, and OAuth/development-build flows require a development build. Windows cannot run `expo run:ios` because it needs macOS and Xcode. Use an EAS development build from Windows after creating an Expo/EAS project, or run locally on macOS:

```cmd
npm start
npx eas-cli build --profile development --platform ios
```

On macOS with Xcode installed:

```cmd
npx expo run:ios
```

The iOS simulator can reach a local backend using `http://127.0.0.1:8080`; a physical iPhone needs the computer's LAN IP and the backend must listen on the LAN interface.

## Builds

No APK, AAB, or iOS binary has been generated in this environment. EAS project initialization and signing are intentionally not fabricated.

After installing/configuring EAS CLI and running `eas init` once in this folder:

```cmd
npx eas-cli build --platform android --profile preview
npx eas-cli build --platform android --profile production
npx eas-cli build --platform ios --profile ios-simulator
npx eas-cli build --platform ios --profile production
```

The profiles are configured as follows:

- `preview`: Android internal-distribution APK.
- `production`: Android AAB and iOS App Store/TestFlight distribution.
- `ios-simulator`: iOS simulator build.

EAS cloud builds can be started from Windows. iOS production/TestFlight still requires an Apple Developer account, App Store Connect access, bundle-ID registration, signing certificates, and provisioning profiles. EAS can manage credentials interactively, but no Apple team ID or signing credentials are stored here.

## OAuth and backend setup still required

- Add a backend mobile OAuth exchange that accepts a verified Google authorization-code or ID-token flow, then issues the same Umutungo bearer session. Configure Google Android package/SHA-1, iOS bundle ID, and `umutungo://auth/callback` only after that endpoint exists.
- Add Apple Sign in with Apple support on the backend, configure the Apple Service ID / native app identifier, and implement the required account-deletion/revocation flow before App Store submission. Apple requires apps offering third-party account login to provide the corresponding Apple login experience and account deletion.
- Add authenticated profile update and media upload/storage endpoints if those features must be enabled natively.
- Configure production API TLS, CORS/network access, SMS delivery, and provider credentials outside this repository.

## Verification

Run:

```cmd
npm run typecheck
npx expo doctor
npm test
```

This Windows environment verified TypeScript, focused tests, Expo configuration, and Android/iOS JavaScript bundle exports. `npx expo-doctor` could not be downloaded because npm registry access was denied during this run. `npm run lint` also could not auto-configure ESLint because the same registry connection returned Windows `EACCES`. It cannot launch an iOS simulator; Android device/emulator verification requires Android SDK/device access, and cloud builds require an initialized EAS project and signing setup.
