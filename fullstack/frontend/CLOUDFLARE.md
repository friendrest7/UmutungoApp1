# Cloudflare deployment

This app is configured as a full-stack Cloudflare Worker with vinext. The Worker build includes the Next.js pages and API route handlers, Cloudflare Images optimization, and a self-contained response cache for the location API's revalidated fetch.

## Deploy

Use Node.js 24.22 or newer in the Node 24 line (the installed `cf` CLI currently requires it), then from this directory:

```sh
npm ci
npx cf auth login
npm run deploy:vinext
```

The first deploy needs an authenticated Cloudflare account with Workers, R2, Durable Objects, and Images enabled. The generated worker uses an R2 bucket named `umutungoapp1-response-cache` for cached response bodies.

## Runtime configuration

- Set `GROQ_API_KEY` as a Worker secret to enable the Groq backed chat and property search routes. `GROQ_MODEL` is optional.
- Set `AI_GATEWAY_API_KEY` only if using an external AI Gateway key; `VERCEL_OIDC_TOKEN` is Vercel-specific and is not available on Cloudflare.
- Provide `NEXT_PUBLIC_GOOGLE_CLIENT_ID` at build time if Google sign-in is enabled. Add the Cloudflare Worker origin to the OAuth client's authorized origins and redirect configuration as needed.
- `BACKEND_API_URL` and `NEXT_PUBLIC_API_URL` can override the backend origin. Without them, the app uses its configured Umutungo backend default.

The Worker can be deployed on its `workers.dev` address while Vercel remains live. Pointing `umutungodeals.com` at Cloudflare would change where that domain routes; keep the current Vercel domain assignment until a Cloudflare domain cutover is intended.
