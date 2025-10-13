import React from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { clientEnv } from '../config/env';

export function AuthDebug() {
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const convexUrl = clientEnv.convexUrl;

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-300 rounded-lg p-4 shadow-lg max-w-sm text-xs">
      <h3 className="font-semibold mb-2">Auth Debug Info</h3>
      <div className="space-y-1">
        <div>
          <strong>Convex URL:</strong> {convexUrl ? "Set" : "Missing"}
        </div>
        <div>
          <strong>User Status:</strong> {loggedInUser === undefined ? "Loading..." : loggedInUser ? "Logged in" : "Not logged in"}
        </div>
        {loggedInUser && (
          <div>
            <strong>User ID:</strong> {loggedInUser._id}
          </div>
        )}
        {loggedInUser && (
          <div>
            <strong>Email:</strong> {loggedInUser.email || "N/A"}
          </div>
        )}
        <div>
          <strong>Backend Status:</strong> {convexUrl ? "Checking..." : "No URL"}
        </div>
      </div>
    </div>
  );
}


