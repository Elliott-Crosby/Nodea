"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { toast } from "sonner";

export function SignInForm() {
  const { signIn } = useAuthActions();
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const formData = new FormData();
    formData.set("email", email);
    formData.set("password", password);
    formData.set("flow", "signIn");

    try {
      await signIn("password", formData);
      toast.success("Successfully signed in!");
    } catch (error: any) {
      console.error("Authentication error:", error);
      
      let errorMessage = "";
      if (error.message.includes("Invalid password")) {
        errorMessage = "Invalid password. Please try again.";
      } else if (error.message.includes("User not found")) {
        errorMessage = "No account found with this email. Please sign up first.";
      } else if (error.message.includes("Email already exists")) {
        errorMessage = "An account with this email already exists. Please sign in instead.";
      } else if (error.message.includes("Password too short")) {
        errorMessage = "Password must be at least 8 characters long.";
      } else if (error.message.includes("Network error") || error.message.includes("fetch")) {
        errorMessage = "Cannot connect to server. Please check your internet connection and try again.";
      } else if (error.message.includes("Failed to fetch")) {
        errorMessage = "Backend server is not running. Please contact support.";
      } else {
        errorMessage = `Could not sign in: ${error.message}. Please check your credentials.`;
      }
      
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Welcome back
        </h2>
        <p className="text-gray-600">
          Sign in to access your boards
        </p>
      </div>

      <form className="flex flex-col gap-form-field" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email address
          </label>
          <input
            id="email"
            className="auth-input-field"
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
            disabled={submitting}
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            id="password"
            className="auth-input-field"
            type="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
            minLength={8}
            disabled={submitting}
          />
        </div>

        <button 
          className="auth-button" 
          type="submit" 
          disabled={submitting || !email || !password}
        >
          {submitting ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Signing in...
            </span>
          ) : (
            "Sign in"
          )}
        </button>

        <div className="text-center text-sm text-secondary">
          <span>
            Don't have an account?{" "}
          </span>
          <span className="text-primary font-medium">
            Use the toggle above to create one
          </span>
        </div>
      </form>
    </div>
  );
}
