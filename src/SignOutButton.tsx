"use client";
import { useAuth, useClerk } from "@clerk/clerk-react";

export function SignOutButton() {
  const { isSignedIn, isLoaded } = useAuth();
  const { signOut } = useClerk();

  if (!isLoaded || !isSignedIn) {
    return null;
  }

  return (
    <button
      className="px-4 py-2 rounded bg-white text-secondary border border-gray-200 font-semibold hover:bg-gray-50 hover:text-secondary-hover transition-colors shadow-sm hover:shadow"
      onClick={() => void signOut()}
    >
      Sign out
    </button>
  );
}
