import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider, ClerkLoaded, ClerkLoading, useAuth } from '@clerk/clerk-react';
import App from './App';
import './index.css';
import { ConvexProviderWithClerk, convexClient } from './lib/convex';
import { clerkPublishableKey } from './lib/clerk';

const root = createRoot(document.getElementById('root')!);

console.log('Nodea booting...');
console.log('ENV VITE_CLERK_PUBLISHABLE_KEY exists:', !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
console.log('ENV VITE_CONVEX_URL:', import.meta.env.VITE_CONVEX_URL);

if (!clerkPublishableKey) {
  root.render(
    <StrictMode>
      <div style={{ padding: 20, fontFamily: 'system-ui' }}>
        <h1>Configuration Error</h1>
        <p>The Clerk publishable key is missing or invalid.</p>
        <p>Please set VITE_CLERK_PUBLISHABLE_KEY in your environment and redeploy.</p>
      </div>
    </StrictMode>,
  );
} else {
  root.render(
    <StrictMode>
      <ClerkProvider publishableKey={clerkPublishableKey}>
        <ClerkLoading>
          <div style={{ padding: 20, fontFamily: 'system-ui' }}>
            <h1>Starting up…</h1>
            <p>Connecting to Clerk. Please wait.</p>
          </div>
        </ClerkLoading>
        <ClerkLoaded>
          <ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
            <App />
          </ConvexProviderWithClerk>
        </ClerkLoaded>
      </ClerkProvider>
    </StrictMode>,
  );
}
