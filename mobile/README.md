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

- Native Expo Router bottom tabs: Home, Search, Saved, role-based Dashboard/Join, and Profile.
- Live published listing search through `GET /api/v1/listings`, with search, category, transaction filters, loading, retry, empty, and client-side result paging.
- Offline browsing uses the last successfully loaded listing and detail responses; category and search filters work against cached listings. Saved-property changes are stored locally and synchronized when connectivity returns.
- Existing signed-in sessions are restored from secure local storage while offline. SMS/Google sign-in and new listing uploads still require a connection.
- Property details and photo gallery using listing media returned by `GET /api/v1/listings/{id}`.
- Phone OTP registration, in-app code verification, and sign-in through the existing Go API; bearer token restoration and sign-out use `expo-secure-store`.
- Google mobile sign-in through `expo-auth-session`, verified by `POST /api/v1/auth/google`, which creates or restores a real Umutungo bearer session.
- Development email/password sign-in through the backend's development-only demo accounts; live accounts must use Google or phone verification.
- Save and remove listings through the existing favorites endpoints.
- Profile editing through `PATCH /api/v1/me` for name, email, bio, and language.
- Owner/komisiyoneri listing creation and management through the existing listing endpoints.
- Native photo-library selection followed by real multipart uploads to `POST /api/v1/listings/{id}/media`; the backend enforces owner/admin access, image type, and a 10 MB limit.
- Rental applications through `POST /api/v1/listings/{id}/applications`, application history, and owner accept/decline/request-information actions.
- Tenant/client dashboards show current rental agreements, application decisions, and payment history; owner/Komisiyoneri dashboards show owner listings, key counts, and incoming applications; admin dashboards show live activity and permit moderation report status changes.
- Owner/property posting, image uploads, management and MTN MoMo owner-plan checkout are reachable from the home and dashboard flows.
- Conversational property assistant calls the website's `/api/chat` route, which uses the site's Groq configuration and live public listing/directory context. Set `EXPO_PUBLIC_CHAT_API_URL` in the EAS profile to the actual deployed website URL.
- Owner contact messaging, inbox conversations, and notifications through the existing API.
- Hospitality booking requests and server-validated reviews for users who have viewed or rented a property.
- Opens a real 3D tour link when a listing supplies one; it does not fabricate a tour or floor plan for listings without those assets.
- English, French, Kinyarwanda, and Swahili labels for the core navigation and states.
- Safe-area-aware scrolling, keyboard avoidance on forms, Android/iOS-compatible navigation, and photo-library permission handling.

## Backend changes and remaining limitations

The backend changes are in `backend/internal/httpapi/server.go`, `backend/migrations/004_mobile_auth_profile.sql`, and the backend configuration files. No secrets are included in the mobile app.

1. Uploaded media is stored in the configured `MEDIA_UPLOAD_DIR` and served under `/uploads/`. Docker uses the named `umutungo_media` volume for local persistence. Production should use a persistent disk or an approved object-storage adapter; do not rely on ephemeral container storage.
2. Google verification requires `GOOGLE_CLIENT_IDS` on the backend and matching platform client IDs in the mobile environment. The backend verifies the Google access token and verified email before issuing an Umutungo session.
3. Public sign-up/sign-in uses phone OTP. Configure a production SMS provider in the API before live OTP delivery; development codes are not a production SMS service. The email/password demo flow works only against a development API.
4. Configure a platform-specific Google Android OAuth client for package `rw.umutungo.mobile` and the EAS signing certificate SHA-1; configure the iOS client ID before promising native Google sign-in on those platforms. The web client ID alone may not satisfy Google native callback restrictions.
5. The AI route needs the deployed website host and a valid `GROQ_API_KEY` in that website's hosting environment. This repository's local key is never bundled into the APK.
6. MTN MoMo credentials must be configured in the deployed backend secret store with the correct MTN target environment; local credentials are not used by the live API. Confirm merchant settlement terms before accepting customer property payments.
7. Apple sign-in and account deletion remain follow-up work because no Apple backend/provider configuration exists yet.
8. Listing search currently returns a maximum of 100 records and has no cursor/page query contract. "Load more" pages the already returned live result set on-device; server pagination requires a backend contract change.
9. No push-notification registration endpoint was found, so this release uses on-demand API loading rather than claiming push support.

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

The EAS project is configured and the preview profile increments Android's remote version code. The current update APK is in `results/mobile-builds/Umutungo-android-preview.apk` (version 1.3.0, version code 9). The repository's local Android release configuration uses the local debug keystore; the EAS cloud signing key is different. Re-sign EAS preview APKs with the local key before distributing them as updates to existing local preview installs. Do not use the debug key for a Play Store release.

Start a replacement build from `mobile`:

```cmd
npx eas-cli build --platform android --profile preview --wait
```

Download the completed APK from EAS, then re-sign it with `android/app/debug.keystore` (alias `androiddebugkey`, default Android debug-key password `android`) before replacing the file in `results/mobile-builds/`. EAS's `build:download` command prints the downloaded APK path. From the Android SDK build-tools directory, run:

```cmd
apksigner sign --ks mobile\android\app\debug.keystore --ks-key-alias androiddebugkey --ks-pass pass:android --key-pass pass:android --out mobile\results\mobile-builds\Umutungo-android-preview.apk <downloaded-eas-apk>
```

Other configured builds:

```cmd
npx eas-cli build --platform android --profile production
npx eas-cli build --platform ios --profile ios-simulator
npx eas-cli build --platform ios --profile production
```

The profiles are configured as follows:

- `preview`: Android internal-distribution APK, with an automatically incrementing version code.
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

TypeScript and the focused mobile Jest suite pass. EAS built the Android preview APK; it was re-signed with the local key and verified as package `rw.umutungo.mobile`, version code 9. The configured key matches the repository's local Android release signing setup. This Windows environment has no connected Android device or configured emulator, so a device install and end-to-end live API check still need to be completed. iOS production distribution requires Apple signing and App Store Connect setup.

## Android manual test checklist

1. Set `EXPO_PUBLIC_API_URL` to a reachable backend address and start PostgreSQL/API.
2. Open the preview APK or development build on an Android phone.
3. Browse Home, Search, property details, and gallery images.
4. Register or use an existing phone account, request OTP, verify, close/reopen the app, and confirm the session restores.
5. Save and remove a property, then confirm Saved updates.
6. Edit name/email/bio/language in Profile and confirm the values persist after refresh.
7. As a property owner/komisiyoneri, create a listing, select a JPEG/PNG/WebP image under 10 MB, submit, and confirm the image URL opens in the property gallery.
8. Confirm a non-owner cannot upload media to another owner's listing and that oversized/non-image files are rejected.
