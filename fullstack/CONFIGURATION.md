# Runtime configuration

Configure secrets in the named hosting service, not in a committed file. `.env.example` files contain examples/placeholders only. `NEXT_PUBLIC_*` and `EXPO_PUBLIC_*` values are public and are embedded in client bundles.

## Web application

| Variable | Provider | Purpose | Secret? | Configure in |
|---|---|---|---|---|
| `BACKEND_API_URL` | Umutungo Go API | Server-side API origin for Next route handlers | No | Vercel server environment |
| `NEXT_PUBLIC_API_URL` | Umutungo Go API | Browser API origin; also server fallback | No | Vercel server environment |
| `GROQ_API_KEY` | Groq | Optional server-side key for chat/search/reply routes | Yes | Vercel server environment |
| `GROQ_MODEL` | Groq | Optional model override for Groq routes | No | Vercel server environment |
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway | Optional server-side Gateway key | Yes | Vercel server environment |
| `AI_GATEWAY_MODEL` | Vercel AI Gateway | Optional model override for Gateway chat | No | Vercel server environment |
| `VERCEL_OIDC_TOKEN` | Vercel | Automatic OIDC credential fallback for Gateway chat; do not create or ship a static value | Yes | Vercel server environment (platform supplied) |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth | Public web OAuth client ID | No | Vercel server environment |
| `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google OAuth | Legacy fallback alias for the public web client ID | No | Vercel server environment |
| `NODE_ENV` | Next.js/Node.js | Development-only demo payments and framework mode | No | Runtime supplied; do not set manually in Vercel |

`GROQ_API_KEY` is referenced only in Next.js route handlers. Do not prefix it with `NEXT_PUBLIC_`. `NEXT_PUBLIC_PAYMENT_DEMO_MODE` is no longer read; simulated payments are available only in local development.

## Go backend (Render)

| Variable | Provider | Purpose | Secret? | Configure in |
|---|---|---|---|---|
| `APP_ENV` | Umutungo | `development` or `production`. Missing or unrecognised values run as **production** (fail closed), so development-only features stay off. Set `production` on Render; set `development` only on local machines | No | Render backend |
| `TEST_LOGIN_ENABLED` | Umutungo | Development only: test-account logins (`/api/v1/auth/dev-login`, `/auth/dev-admin`). On by default when `APP_ENV=development`, `false` switches them off. Ignored in production: the routes are not registered | No | Local `.env.local` only |
| `DEMO_PAYMENTS_ENABLED` | Umutungo | Development only: no-charge demo checkouts. On by default when `APP_ENV=development`, `false` switches them off. Ignored in production: real plans and listings activate only after Flutterwave/MTN verification | No | Local `.env.local` only |
| `PORT` | Render | HTTP listen port (Render normally injects it) | No | Render backend |
| `DATABASE_URL` | PostgreSQL | Application database connection | Yes | Render backend |
| `CORS_ORIGINS` | Umutungo | Comma-separated allowed web origins | No | Render backend |
| `MIGRATIONS_PATH` | Umutungo | SQL migration directory | No | Render backend |
| `MEDIA_UPLOAD_DIR` | Render disk/filesystem | Listing and About media storage path | No | Render backend |
| `MEDIA_PUBLIC_BASE_URL` | Umutungo | Public API origin used to build media URLs | No | Render backend |
| `GOOGLE_CLIENT_IDS` | Google OAuth | Comma-separated allowlist of web/Android/iOS OAuth client IDs | No | Render backend |
| `OWNER_SILVER_PRICE_RWF` | Umutungo | Silver owner plan price in RWF (defaults to 10,000) | No | Render backend |
| `OWNER_GOLD_PRICE_RWF` | Umutungo | Gold owner plan price in RWF (defaults to 20,000) | No | Render backend |
| `OWNER_PLATINUM_PRICE_RWF` | Umutungo | Platinum owner plan price in RWF (defaults to 30,000) | No | Render backend |
| `MTN_TARGET_ENVIRONMENT` | MTN MoMo Rwanda | Must be `sandbox` or approved production `mtnrwanda` | No | Render backend |
| `MTN_BASE_URL` | MTN MoMo Rwanda | Sandbox or production Collection API host; must match target environment | No | Render backend |
| `MTN_API_USER` | MTN MoMo Rwanda | Country-specific API User for OAuth token requests | Yes | Render backend |
| `MTN_API_KEY` | MTN MoMo Rwanda | API User key used with API User for OAuth token requests | Yes | Render backend |
| `MTN_SUBSCRIPTION_KEY_PRIMARY` | MTN MoMo Rwanda | Collection product subscription key sent to MTN | Yes | Render backend |
| `MTN_SMS_CLIENT_ID` | MTN SMS v3 | OAuth client ID for the separate SMS v3 product | Yes | Render backend |
| `MTN_SMS_CLIENT_SECRET` | MTN SMS v3 | OAuth client secret for SMS v3 | Yes | Render backend |
| `MTN_SMS_SERVICE_CODE` | MTN Rwanda SMS v3 | Approved short/service code required in outbound SMS requests | No | Render backend |
| `MTN_SMS_BASE_URL` | MTN SMS v3 | SMS endpoint base URL | No | Render backend |
| `MTN_SMS_TOKEN_URL` | MTN SMS v3 | OAuth client-credentials token endpoint | No | Render backend |
| `TWILIO_ACCOUNT_SID` | Twilio | Account SID for fallback SMS | Yes | Render backend |
| `TWILIO_AUTH_TOKEN` | Twilio | Account authentication token for fallback SMS | Yes | Render backend |
| `TWILIO_FROM_NUMBER` | Twilio | Sender number approved for destination countries | No | Render backend |
| `OTP_HMAC_SECRET` | Umutungo | Key for hashing verification codes; 32+ random characters (`openssl rand -hex 32`). Codes can't be sent without it | Yes | Render backend |
| `TRUSTED_PROXY_HOPS` | Umutungo | Proxies in front of the API, for per-IP rate limits. Vercel → Render = `2` | No | Render backend |
| `AFRICASTALKING_USERNAME` | Africa's Talking | App username (`sandbox` for the sandbox) | No | Render backend |
| `AFRICASTALKING_API_KEY` | Africa's Talking | API key for that app | Yes | Render backend |
| `AFRICASTALKING_SENDER_ID` | Africa's Talking | Optional approved sender ID | No | Render backend |
| `AFRICASTALKING_ENV` | Africa's Talking | `sandbox` (default) or `live` | No | Render backend |
| `SMTP_HOST` / `SMTP_PORT` | Email provider | SMTP server for verification emails (587 STARTTLS or 465 TLS) | No | Render backend |
| `SMTP_USERNAME` / `SMTP_PASSWORD` | Email provider | SMTP login | Yes | Render backend |
| `EMAIL_FROM` | Email provider | Sender, on a domain verified with the provider, e.g. `Umutungo <no-reply@yourdomain.com>` | No | Render backend |
| `TEST_DATABASE_URL` | PostgreSQL | Dedicated database used only by Go integration tests | Yes | Local test environment; never production runtime |

MTN MoMo sandbox and production values must be provisioned separately and set as a matched pair. Do not use production API User/key/subscription credentials with the sandbox host or vice versa. MTN SMS v3 is a separate product with separate OAuth credentials; its configured `serviceCode` must be approved by the Rwanda operating company. The integration currently sends `receiverAddress`, `message`, `serviceCode`, and a generated `clientCorrelatorId`; it does not configure an optional sender address or delivery receipts. Twilio is attempted only when MTN SMS fails and all three Twilio values are present; its configured sender must be authorized for the destination.

## Expo / EAS mobile

| Variable | Provider | Purpose | Secret? | Configure in |
|---|---|---|---|---|
| `EXPO_PUBLIC_API_URL` | Umutungo Go API | Native app API origin | No | EAS profile environment |
| `EXPO_PUBLIC_CHAT_API_URL` | Umutungo Next.js site | Chat route URL | No | EAS profile environment |
| `EXPO_PUBLIC_PROPERTY_SEARCH_API_URL` | Umutungo Next.js site | Property-search route URL | No | EAS profile environment |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | Google OAuth | Android public OAuth client ID | No | EAS profile environment |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Google OAuth | iOS public OAuth client ID | No | EAS profile environment |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google OAuth | Web public OAuth client ID used by mobile auth flow | No | EAS profile environment |

All EAS build profiles declare the API, chat, and property-search URLs. At present preview/development and production EAS profiles point at the same Render API and website hosts; provision separate preview services before using preview builds with pilot data. Mobile source reads no Groq, MTN MoMo, MTN SMS, Twilio, or database credentials. OAuth client IDs and API URLs are public identifiers/endpoints, not provider secrets.

The iOS client ID is read by mobile sign-in but is not hard-coded into EAS profiles. Add the approved `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` to the EAS preview/production environments if iOS Google sign-in is part of the pilot.

## Booking quote policy

The backend uses the listing's stored whole-number `price` as the selected rate. Daily bookings bill one unit per night. Monthly bookings bill one unit for each 30-day block, rounding any partial block up. The current schema has one listing price and does not store separate daily and monthly rates, so that amount is interpreted in the unit selected by the renter. No service or commission fee is configured: the backend stores a zero fee and total equals base amount. The mobile quote uses the same rules; the backend recalculates and persists the authoritative quote.

## OTP policy

Codes are 6 digits from a cryptographically secure generator, stored only as an HMAC (keyed with `OTP_HMAC_SECRET`), expire after 10 minutes, and are deleted on first successful use or after five wrong attempts. Sending is limited to one per 60 seconds and five per rolling hour, both per phone/email and per client IP. A new code replaces any earlier one. Send replies are identical whether or not the phone/email is registered. Codes, phone numbers and credentials are not logged. There is no development/test code. Without a configured provider, sending returns HTTP 503.

SMS goes to Africa's Talking first, then MTN SMS v3 (Rwanda numbers only), then Twilio. Email uses SMTP. Phone numbers from any country are accepted and stored in E.164 (`+250788123456`). Numbers without a country code are read as Rwanda numbers.

Endpoints: `POST /api/v1/verification/send`, `/resend` and `/verify` with `{"purpose": "login" | "change_phone" | "verify_email", "destination", "code"}`. `change_phone` and `verify_email` require a signed-in user. `/auth/request-otp`, `/auth/verify-otp`, `/auth/register` and `/me/phone` keep working and use the same rules.

## Provider verification notes

The backend uses the official MTN Rwanda Collection API token and RequestToPay status flow. The current public guide doesn't publish production host and target-environment values; those must be confirmed from the credentials/onboarding material issued by MTN before production activation. The official guide says RequestToPay is asynchronous, returns `202 Accepted`, and status can be validated with an authenticated `GET` using the original reference. The official callback guidance describes host registration, HTTP method/transport requirements and one-shot delivery, but does not specify a callback signature/authentication mechanism. This service therefore does not expose or trust a payment callback; it uses an authenticated status `GET`, matching the server-stored reference, amount, currency and payment record before applying final status. [MTN Rwanda RequestToPay/status guide](https://momodeveloper.mtn.co.rw/content/html_widgets/aqnil.html), [MTN Rwanda authentication and callback FAQ](https://momodeveloper.mtn.co.rw/content/html_widgets/macul.html), [API User and Key guidance](https://momodeveloper.mtn.co.rw/content/html_widgets/y6m1i.html), [Go-live onboarding](https://momodeveloper.mtn.co.rw/go-live).

The MTN developer portal currently lists SMS v3 as available in Rwanda. Its published Swagger specifies OAuth client credentials, the `SEND-SMS` permission, `receiverAddress`, `message`, `serviceCode`, and `clientCorrelatorId`. `serviceCode` must be an approved code from the Rwanda operating company. [MTN SMS v3 product page](https://developers.mtn.com/products/sms-v3-api), [MTN SMS v3 Swagger](https://developers.mtn.com/products/sms-v3-api/download/swagger).
