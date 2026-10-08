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
2. Copy `.env.example` to `.env` and export the values in your shell.
3. Run:

```powershell
go mod tidy
go run ./cmd/server
```

The default development OTP is `111111`. It is returned only in development mode; production must connect an SMS provider before enabling real OTP delivery.

## Main endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/healthz` | Liveness check |
| GET | `/health` | Liveness check (friendly health URL) |
| GET | `/` | API identity and health URL |
| GET | `/readyz` | PostgreSQL readiness check |
| POST | `/api/v1/auth/register` | Register a client, tenant, broker, or owner |
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
| POST/GET | `/api/v1/payments`, `/api/v1/payments/{id}` | Start and check an MTN MoMo, Airtel Money, card, or manual payment |
| POST | `/api/v1/payments/{id}/confirm` | Confirm a pending provider payment after provider approval |
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

The schema and API are the backend foundation. Before production, add the selected SMS, MTN MoMo, Airtel Money, PSP, object storage/CDN, maps, push notification, CAPTCHA, and AI provider adapters. Move OTP/session secrets to a managed secret store, add rate limiting, and place the API behind TLS and an API gateway.
