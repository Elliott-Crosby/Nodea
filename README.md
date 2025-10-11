# Nodea: Infinite Canvas AI Chat
  
This is a project built with [Chef](https://chef.convex.dev) using [Convex](https://convex.dev) as its backend.
 You can find docs about Chef with useful information like how to deploy to production [here](https://docs.convex.dev/chef).
  
This project is connected to a Convex deployment for secure backend services.
  
## Project structure
  
The frontend code is in the `app` directory and is built with [Vite](https://vitejs.dev/).
  
The backend code is in the `convex` directory.
  
## Environment configuration

Nodea runs exclusively against the production Convex deployment (`posh-setter-840`).  
Use the provided `.env.production` file:

```
VITE_CONVEX_URL=https://posh-setter-840.convex.cloud
CLERK_JWT_ISSUER_DOMAIN=https://clerk.nodea.ai
```

Set `VITE_CLERK_PUBLISHABLE_KEY` in your hosting environment (e.g. Vercel) so Clerk can initialize.

## Running the app

- `npm run dev` &rightarrow; launches the Vite dev server pointed at production.
- `npm run build` &rightarrow; builds for production (uses `.env.production`).
- `npm run preview` &rightarrow; serves the built app locally.
- `npm run deploy` &rightarrow; publishes Convex functions to production.

> Nodea now runs exclusively on the production deployment (`posh-setter-840`). Do **not** run `npx convex dev`. Always run `npx convex deploy` before building.

## App authentication

This app uses [Convex Auth](https://auth.convex.dev/) with secure password-based authentication. All server functions require authenticated users.

## Developing and deploying your app

Check out the [Convex docs](https://docs.convex.dev/) for more information on how to develop with Convex.
* If you're new to Convex, the [Overview](https://docs.convex.dev/understanding/) is a good place to start
* Check out the [Hosting and Deployment](https://docs.convex.dev/production/) docs for how to deploy your app
* Read the [Best Practices](https://docs.convex.dev/understanding/best-practices/) guide for tips on how to improve you app further

## HTTP API

User-defined http routes are defined in the `convex/router.ts` file. We split these routes into a separate file from `convex/http.ts` to allow us to prevent the LLM from modifying the authentication routes.
