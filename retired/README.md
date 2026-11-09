# Retired web app routes

These entrypoints are preserved for reference and are excluded from the Next.js
route tree and TypeScript checks. Do not import them into the live application.
Their UI helpers remain under `src/app` but have no active route entrypoints.

The live site contains the farewell page, blog/RSS, privacy/terms, feedback,
and a 410 API fallback. Retired page links redirect to the farewell page.
No retired AI, billing, authentication callback, admin, import, or tracking
route is deployed. Original blog routes and site configuration are also
preserved here. This directory is excluded from deployment uploads.
