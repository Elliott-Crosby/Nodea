import { ClerkProvider } from "@clerk/clerk-react";
import { clientEnv } from "../config/env";

// Clerk configuration
export const clerkConfig = {
  publishableKey: clientEnv.clerkPublishableKey,
};

// Clerk provider wrapper
export function ClerkProviderWrapper({ children }: { children: React.ReactNode }) {
  const publishableKey = clientEnv.clerkPublishableKey;
  const isProduction = clientEnv.isProduction;
  const isTestKey = typeof publishableKey === "string" && publishableKey.startsWith("pk_test");
  
  // Don't throw error if key is missing, just show a setup message
  if (!publishableKey || publishableKey === "undefined" || (isProduction && isTestKey)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Setup Required</h1>
          <p className="text-gray-600 mb-4">
            Please set up your Clerk authentication keys to continue.
          </p>
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 text-left">
            <h3 className="font-medium text-yellow-800 mb-2">Steps to fix:</h3>
            <ol className="text-sm text-yellow-700 space-y-1">
              <li>1. Go to <a href="https://clerk.com" target="_blank" className="underline">clerk.com</a> and create an account</li>
              <li>2. Create a new application</li>
              <li>3. Copy your publishable key</li>
              <li>4. Create a <code className="bg-yellow-100 px-1 rounded">.env.local</code> file with:</li>
              <li className="ml-4"><code>VITE_CLERK_PUBLISHABLE_KEY=pk_live_your_key_here</code></li>
              <li className="ml-4"><code>VITE_CONVEX_URL=https://your-convex-deployment.convex.cloud</code></li>
              <li>5. Restart the development server</li>
            </ol>
          </div>
          {isProduction && isTestKey && (
            <div className="mt-4 text-xs text-red-600">
              Detected a test key (pk_test...) in production. Use a production key (pk_live...).
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      {children}
    </ClerkProvider>
  );
}
