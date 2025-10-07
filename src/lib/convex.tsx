import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { useAuth } from "@clerk/clerk-react";

const convexUrl = import.meta.env.VITE_CONVEX_URL;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

export function ConvexProviderWithClerkWrapper({ children }: { children: React.ReactNode }) {
  if (!convex) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Convex Setup Required</h1>
          <p className="text-gray-600 mb-4">
            Please set up your Convex deployment URL to continue.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 text-left">
            <h3 className="font-medium text-blue-800 mb-2">Steps to fix:</h3>
            <ol className="text-sm text-blue-700 space-y-1">
              <li>1. Run <code className="bg-blue-100 px-1 rounded">npx convex dev</code></li>
              <li>2. Copy the deployment URL from the output</li>
              <li>3. Add <code className="bg-blue-100 px-1 rounded">VITE_CONVEX_URL=your_url_here</code> to <code className="bg-blue-100 px-1 rounded">.env.local</code></li>
              <li>4. Restart the development server</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}