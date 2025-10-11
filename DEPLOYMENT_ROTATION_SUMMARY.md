# Deployment Configuration Summary

Nodea now operates exclusively against the production Convex deployment:

- **Deployment name:** `posh-setter-840`
- **Dashboard:** https://dashboard.convex.dev/d/posh-setter-840
- **Public URL:** https://posh-setter-840.convex.cloud

All previous references to preview or development deployments were removed from the codebase and documentation. Environment variables, build scripts, and deployment tooling now assume the production deployment only.

## Operational Checklist

- `convex.json` targets `posh-setter-840`.
- `.env.production` contains the production Convex URL and Clerk issuer.
- Scripts avoid `convex dev`; deployments go through `npx convex deploy`.
- The frontend logs the production URL at runtime (`? Connected to Convex Production: https://posh-setter-840.convex.cloud`).
