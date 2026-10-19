# Umutungo Go Backend

This folder contains the standalone Go API and PostgreSQL data layer for Umutungo. The frontend can continue to evolve independently and call this API at `http://localhost:8080`.

## Run with Docker

From this folder:

```powershell
docker compose up --build
```

The API is available at `http://localhost:8080` and PostgreSQL at port `5432`. The API runs all SQL migrations in the `migrations` directory automatically on startup.

## Run locally

1. Start PostgreSQL and create a database named `umutungo`.
2. Copy `.env.example` to `.env.local` (or `.env.local.txt`) and fill in local values. These files are ignored by Git; never commit payment credentials.
3. Run:

```powershell
go mod tidy
go run ./cmd/server
```

The default development OTP is `111111`. It is returned only in development mode; production must connect an SMS provider before enabling real OTP delivery.

The development API also supports the frontend demo accounts through `POST /api/v1/auth/dev-login`. Available credentials are `owner@umutungo.test` / `Owner123!`, `landlord@umutungo.test` / `Landlord123!`, and `commissioner@umutungo.test` / `Commissioner123!`. This route creates database-backed sessions and is disabled outside development.

## Main endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/healthz` | Liveness check |
| GET | `/health` | Liveness check (friendly health URL) |
| GET | `/` | API identity and health URL |
| GET | `/readyz` | PostgreSQL readiness check |
| POST | `/api/v1/auth/register` | Register a client, tenant, broker, or owner |
| POST | `/api/v1/auth/dev-login` | Create a development session for a demo account (development only) |
| POST | `/api/v1/auth/request-otp` | Request phone OTP |
| POST | `/api/v1/auth/verify-otp` | Verify OTP and receive bearer token |
| POST | `/api/v1/auth/google` | Verify a Google access token and receive a bearer token |
| GET/PATCH | `/api/v1/me` | Read or update the authenticated profile |
| GET | `/api/v1/listings` | Public listing search |
| GET | `/api/v1/directory` | Public landlord and commissioner directory search |
| POST | `/api/v1/listings` | Create a listing as broker/owner |
| GET/PATCH/DELETE | `/api/v1/listings/{id}` | View or manage a listing |
| POST | `/api/v1/listings/{id}/media` | Upload an owned listing image (JPEG, PNG, or WebP; max 10 MB) |
| POST | `/api/v1/listings/{id}/applications` | Apply to rent a listing |
| GET | `/api/v1/applications` | View submitted/received applications |
| POST | `/api/v1/applications/{id}/decision` | Accept, reject, or request information |
| POST | `/api/v1/applications/{id}/viewed` | Record that the tenant has seen the house |
| POST/GET | `/api/v1/payments`, `/api/v1/payments/{id}` | Start and check an MTN MoMo collection request |
| POST | `/api/v1/payments/{id}/confirm` | Check the payment status directly with MTN |
| GET/POST | `/api/v1/owner/upgrades` | Read configured Owner plan prices and purchases, or create an idempotent one-time payment request |
| POST | `/api/v1/owner/upgrades/{id}/verify` | Admin-only provider verification and entitlement activation |
| POST/GET | `/api/v1/messages` | Contact a landlord and load the tenant conversation |
| POST | `/api/v1/reviews` | Submit a review after a recorded property viewing |
| GET | `/api/v1/listings/{id}/reviews` | Read listing reviews |
| POST | `/api/v1/bookings` | Create a hospitality booking request |
| POST | `/api/v1/reports` | Report a listing or account |
| GET | `/api/v1/admin/reports` | Admin-only report queue and summary |
| PATCH | `/api/v1/admin/reports/{id}` | Admin-only report status update |
| GET | `/api/v1/notifications` | Notification center |
| GET | `/api/v1/owner/dashboard` | Owner/broker dashboard summary |
| GET | `/api/v1/tenant/dashboard` | Tenant rental summary |
| POST | `/api/v1/maintenance` | Submit a maintenance request |

Use `Authorization: Bearer <access_token>` for protected routes.

Uploaded listing images are written to `MEDIA_UPLOAD_DIR` and served from `/uploads/`. Set `MEDIA_PUBLIC_BASE_URL` to the public API origin in production. Set `GOOGLE_CLIENT_IDS` to a comma-separated allowlist of Google Android, iOS, and web client IDs before enabling mobile Google sign-in. The backend never receives a Google client secret.

The admin About-video upload is stored in the Render PostgreSQL database (`about_videos`) and streamed from `/api/v1/about-video/media` with byte-range support. The website reads the active video URL from `/api/v1/about-video`; the video binary is not part of the website's GitHub assets. Keep video uploads reasonably compressed because database storage and delivery are billed with the database plan.

## Production follow-up

For Render deployment, set the backend service's `DATABASE_URL` from the PostgreSQL database's **Internal Database URL** (or link the database and map that value into the service environment). Do not use `localhost` for a hosted database. The backend intentionally has no production localhost fallback and exits with a configuration error if `DATABASE_URL` is missing.

MTN MoMo Collection request-to-pay and provider status checks are implemented. The API defaults to sandbox (`MTN_TARGET_ENVIRONMENT=sandbox`, `MTN_BASE_URL=https://sandbox.momodeveloper.mtn.com`). Production requires MTN Rwanda onboarding and production credentials; set `MTN_TARGET_ENVIRONMENT=mtnrwanda` and `MTN_BASE_URL=https://momoapi.mtn.com` in the backend hosting environment. The service polls MTN for results and never trusts a client confirmation.

Phone verification uses MTN SMS v3, which has a separate app credential set from MoMo Collection. Configure `MTN_SMS_CLIENT_ID`, `MTN_SMS_CLIENT_SECRET`, and the MTN-approved Rwanda `MTN_SMS_SERVICE_CODE` on the backend. A MoMo `MTN_API_KEY` alone cannot send SMS. Development mode continues to return the fixed verification code unless SMS v3 credentials are configured. Production will return a clear error instead of claiming an SMS was sent when SMS credentials are missing or MTN rejects delivery.

MTN payments are collected into the merchant wallet. Seller settlement, escrow, and refunds are not implemented, so define who receives property-sale and rent payments before enabling those checkout flows for customers. Other remaining production integrations include SMS delivery, Airtel Money, card PSP, object storage/CDN, maps, push notifications, CAPTCHA, and AI. Keep secrets in the hosting secret manager, add rate limiting, and place the API behind TLS and an API gateway.
