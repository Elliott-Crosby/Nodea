# Clerk + Convex Authentication Setup Guide

## Environment Variables Required

Create a `.env.local` file in your project root with the following variables:

```bash
# Clerk Configuration
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_publishable_key_here

# Convex Configuration  
VITE_CONVEX_URL=https://your-convex-deployment.convex.cloud

# Optional: Clerk Secret Key (for server-side operations)
CLERK_SECRET_KEY=sk_test_your_clerk_secret_key_here
```

## Setup Steps

### 1. Create Clerk Account
1. Go to https://clerk.com
2. Sign up for a free account
3. Create a new application
4. Copy your publishable key from the dashboard

### 2. Configure Clerk
1. In Clerk dashboard, go to "JWT Templates"
2. Create a new JWT template for Convex
3. Set the issuer to your Convex deployment URL
4. Add any custom claims you need

### 3. Update Environment Variables
1. Set `VITE_CLERK_PUBLISHABLE_KEY` to your Clerk publishable key
2. Set `VITE_CONVEX_URL` to your Convex deployment URL
3. Set `CLERK_SECRET_KEY` to your Clerk secret key (optional)

### 4. Deploy Convex
```bash
npx convex deploy
```

## What Changed

### ✅ Removed
- PKCS#8 JWT authentication
- `@convex-dev/auth` Password provider
- JWT_PRIVATE_KEY environment variable
- Complex authentication setup

### ✅ Added
- Clerk authentication integration
- `@clerk/clerk-react` for frontend
- `@clerk/nextjs` for additional utilities
- Clean sign-in/sign-up pages
- `ctx.auth.getUserIdentity()` for server functions

### ✅ Benefits
- No more PKCS#8 errors
- Professional authentication UI
- Built-in user management
- Social login options
- Better security
- Easier maintenance

## Testing

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Go to http://localhost:5173
3. Click "Create Account" or "Sign In"
4. Complete the authentication flow
5. Verify you can create boards and access your profile

## Troubleshooting

- **"Missing VITE_CLERK_PUBLISHABLE_KEY"**: Make sure you've set the environment variable
- **"Missing VITE_CONVEX_URL"**: Make sure your Convex deployment is running
- **Authentication errors**: Check that your Clerk keys are correct
- **CORS errors**: Ensure your Convex deployment allows your domain


