# Nodea: Infinite Canvas AI Chat
  
This is a project built with [Chef](https://chef.convex.dev) using [Convex](https://convex.dev) as its backend.
 You can find docs about Chef with useful information like how to deploy to production [here](https://docs.convex.dev/chef).
  
This project is connected to a Convex deployment for secure backend services.
  
## Project structure
  
The frontend code is in the `app` directory and is built with [Vite](https://vitejs.dev/).
  
The backend code is in the `convex` directory.
  
## Environment modes

Convex URLs now live in dedicated Vite env files:

- `.env.development` &rightarrow; `https://polished-impala-239.convex.cloud`
- `.env.production` &rightarrow; `https://posh-setter-840.convex.cloud`

Keep `.env.local` for machine-specific overrides only (for example Clerk keys). Do **not** add Convex URLs or deployment IDs there.
Make sure the hosting environment (e.g. Vercel) defines `VITE_CLERK_PUBLISHABLE_KEY` so Clerk can initialize in production.

## Running the app

- **Local dev (talking to the dev Convex backend)**  
  `npm run dev` – starts the Vite dev server using `.env.development`. The backend calls go to `https://polished-impala-239.convex.cloud`.

- **Need a temporary Convex sandbox?**  
  `npm run dev:backend` – wraps `npx convex dev` and points it at the shared dev deployment. This will still rewrite `.env.local`, so run it only when you genuinely need the sandbox. You can pair it with `npm run dev:full` to launch both servers.

- **Production build / go-live (talking to the production Convex backend)**  
  `npm run build` (or `npm run preview`) – Vite automatically picks `.env.production`. Convex calls go to `https://posh-setter-840.convex.cloud`.

> ⚠️ Do **not** run `npx convex dev` unless you deliberately want an isolated Convex sandbox. It will provision a fresh deployment and overwrite `.env.local`.

To ship backend changes use `npx convex deploy`, which publishes to the production deployment referenced in `convex.json`.

## App authentication

This app uses [Convex Auth](https://auth.convex.dev/) with secure password-based authentication. All server functions require authenticated users.

## Developing and deploying your app

Check out the [Convex docs](https://docs.convex.dev/) for more information on how to develop with Convex.
* If you're new to Convex, the [Overview](https://docs.convex.dev/understanding/) is a good place to start
* Check out the [Hosting and Deployment](https://docs.convex.dev/production/) docs for how to deploy your app
* Read the [Best Practices](https://docs.convex.dev/understanding/best-practices/) guide for tips on how to improve you app further

## HTTP API

User-defined http routes are defined in the `convex/router.ts` file. We split these routes into a separate file from `convex/http.ts` to allow us to prevent the LLM from modifying the authentication routes.
