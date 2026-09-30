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
npm test
npm start
```

Set `EXPO_PUBLIC_API_URL` in `.env` before starting. For Google sign-in, also set the Android, iOS, and web Google client IDs. Use `http://10.0.2.2:8080` for an Android emulator, `http://127.0.0.1:8080` for an iOS simulator, or the Windows computer's LAN IP for a physical phone. The Go backend must be running and its CORS/network configuration must allow the device to reach it.

## Implemented

- Native Expo Router bottom tabs: Home, Search, Saved, and Profile.
- Live published listing search through `GET /api/v1/listings`, with search, category, transaction filters, loading, retry, empty, and client-side result paging.
- Property details and photo gallery using listing media returned by `GET /api/v1/listings/{id}`.
- Phone OTP registration and sign-in through the existing Go API; bearer token restoration and sign-out use `expo-secure-store`.
- Google mobile sign-in through `expo-auth-session`, verified by `POST /api/v1/auth/google`, which creates or restores a real Umutungo bearer session.
- Save and remove listings through the existing favorites endpoints.
- Profile editing through `PATCH /api/v1/me` for name, email, bio, and language.
- Owner/komisiyoneri listing creation and management through the existing listing endpoints.
- Native photo-library selection followed by real multipart uploads to `POST /api/v1/listings/{id}/media`; the backend enforces owner/admin access, image type, and a 10 MB limit.
- Owner contact messaging through `POST /api/v1/messages`.
- English, French, Kinyarwanda, and Swahili labels for the core navigation and states.
- Safe-area-aware scrolling, keyboard avoidance on forms, Android/iOS-compatible navigation, and photo-library permission handling.

## Backend changes and remaining limitations

The backend changes are in `backend/internal/httpapi/server.go`, `backend/migrations/004_mobile_auth_profile.sql`, and the backend configuration files. No secrets are included in the mobile app.

1. Uploaded media is stored in the configured `MEDIA_UPLOAD_DIR` and served under `/uploads/`. Docker uses the named `umutungo_media` volume for local persistence. Production should use a persistent disk or an approved object-storage adapter; do not rely on ephemeral container storage.
2. Google verification requires `GOOGLE_CLIENT_IDS` on the backend and matching platform client IDs in the mobile environment. The backend verifies the Google access token and verified email before issuing an Umutungo session.
3. Apple sign-in and account deletion remain follow-up work because no Apple backend/provider configuration exists yet.
4. Listing search currently returns a maximum of 100 records and has no cursor/page query contract. "Load more" pages the already returned live result set on-device; server pagination requires a backend contract change.
5. No push-notification registration endpoint was found, so this release uses on-demand API loading rather than claiming push support.

## Android phone testing

Start the Go API, set the computer LAN IP in `.env`, then run:

```cmd
npm start
```

For the local backend, from `backend` copy `.env.example` to `.env`, set `GOOGLE_CLIENT_IDS` if Google sign-in is needed, and start PostgreSQL plus the API. Migrations run on API startup.

Install Expo Go for a quick browse-only check and scan the QR code. Phone OTP, SecureStore, image permissions, Google callbacks, and multipart uploads require a development build with the configured `umutungo` scheme:

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

## Android preview build

No APK, AAB, or iOS binary has been generated in this environment. EAS project initialization and signing are intentionally not fabricated.

From `mobile`, install or invoke EAS CLI and initialize the project once:

```cmd
npx eas-cli login
npx eas-cli init
```

Create the preview environment variable without committing its value:

```cmd
npx eas-cli env:create --environment preview --name EXPO_PUBLIC_API_URL --value https://YOUR-API-HOST --visibility plaintext
npx eas-cli env:create --environment preview --name EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID --value YOUR-ANDROID-CLIENT-ID.apps.googleusercontent.com --visibility plaintext
npx eas-cli env:create --environment preview --name EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID --value YOUR-WEB-CLIENT-ID.apps.googleusercontent.com --visibility plaintext
```

Then build the installable Android preview APK:

```cmd
npx eas-cli build --platform android --profile preview
```

Other configured builds:

```cmd
npx eas-cli build --platform android --profile production
npx eas-cli build --platform ios --profile ios-simulator
npx eas-cli build --platform ios --profile production
```

The profiles are configured as follows:

- `preview`: Android internal-distribution APK.
- `production`: Android AAB and iOS App Store/TestFlight distribution.
- `ios-simulator`: iOS simulator build.

EAS cloud builds can be started from Windows. iOS production/TestFlight still requires an Apple Developer account, App Store Connect access, bundle-ID registration, signing certificates, and provisioning profiles. EAS can manage credentials interactively, but no Apple team ID or signing credentials are stored here.

## Google, Apple, and backend setup

- In Google Cloud Console, create Android, iOS, and web OAuth client IDs. Register package `rw.umutungo.mobile` with the Android SHA-1 from the EAS/development build, and register bundle ID `rw.umutungo.mobile` for iOS.
- Put all accepted client IDs in backend `GOOGLE_CLIENT_IDS`; put the platform IDs in mobile `.env` or EAS environment variables.
- Configure production API TLS, CORS/network access, SMS delivery, and provider credentials outside this repository.
- Add Apple Sign in with Apple on the backend, configure the Apple Service ID/native app identifier, and implement account deletion/revocation before App Store submission.

## Verification

Run:

```cmd
npm run typecheck
npm test
npx expo export --platform android
npx expo export --platform ios
```

The Android and iOS JavaScript bundles, TypeScript, focused mobile tests, and backend Go tests were verified locally. This Windows environment has no `adb`, Xcode, or initialized EAS project, so an Android device/emulator and installable APK remain untested here. `npx expo-doctor` and automatic ESLint setup were blocked by npm registry access returning Windows `EACCES`.

## Android manual test checklist

1. Set `EXPO_PUBLIC_API_URL` to a reachable backend address and start PostgreSQL/API.
2. Open the preview APK or development build on an Android phone.
3. Browse Home, Search, property details, and gallery images.
4. Register or use an existing phone account, request OTP, verify, close/reopen the app, and confirm the session restores.
5. Save and remove a property, then confirm Saved updates.
6. Edit name/email/bio/language in Profile and confirm the values persist after refresh.
7. As a property owner/komisiyoneri, create a listing, select a JPEG/PNG/WebP image under 10 MB, submit, and confirm the image URL opens in the property gallery.
8. Confirm a non-owner cannot upload media to another owner's listing and that oversized/non-image files are rejected.
