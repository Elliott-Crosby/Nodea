"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { toast } from "sonner";

export function SignUpForm() {
  const { signIn } = useAuthActions();
  const createUserProfile = useMutation(api.userProfiles.createUserProfile);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    agreeToTerms: false,
    marketingOptIn: false,
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const validateForm = () => {
    if (!formData.firstName.trim()) {
      toast.error("First name is required");
      return false;
    }
    if (!formData.lastName.trim()) {
      toast.error("Last name is required");
      return false;
    }
    if (!formData.email.trim()) {
      toast.error("Email is required");
      return false;
    }
    if (!formData.email.includes("@")) {
      toast.error("Please enter a valid email address");
      return false;
    }
    if (formData.password.length < 8) {
      toast.error("Password must be at least 8 characters long");
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return false;
    }
    if (!formData.agreeToTerms) {
      toast.error("You must agree to the Terms of Service to continue");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    const signUpFormData = new FormData();
    signUpFormData.set("email", formData.email);
    signUpFormData.set("password", formData.password);
    signUpFormData.set("flow", "signUp");

    try {
      // First, create the account
      await signIn("password", signUpFormData);
      
      // Then create the user profile
      await createUserProfile({
        firstName: formData.firstName,
        lastName: formData.lastName,
        displayName: `${formData.firstName} ${formData.lastName}`,
        marketingOptIn: formData.marketingOptIn,
      });
      
      toast.success("Account created successfully! Welcome to Nodea!");
    } catch (error: any) {
      console.error("Sign up error:", error);
      
      let errorMessage = "";
      if (error.message.includes("Email already exists")) {
        errorMessage = "An account with this email already exists. Please sign in instead.";
      } else if (error.message.includes("Password too short")) {
        errorMessage = "Password must be at least 8 characters long.";
      } else if (error.message.includes("Invalid email")) {
        errorMessage = "Please enter a valid email address.";
      } else if (error.message.includes("Network error") || error.message.includes("fetch")) {
        errorMessage = "Cannot connect to server. Please check your internet connection and try again.";
      } else if (error.message.includes("Failed to fetch")) {
        errorMessage = "Backend server is not running. Please contact support.";
      } else if (error.message.includes("User profile already exists")) {
        errorMessage = "Account created but profile already exists. Please sign in.";
      } else {
        errorMessage = `Failed to create account: ${error.message}. Please try again.`;
      }
      
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Your Account</h1>
        <p className="text-gray-600">
          Join Nodea and start building your AI-powered conversations
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        {/* Name Fields */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
              First Name *
            </label>
            <input
              id="firstName"
              name="firstName"
              type="text"
              value={formData.firstName}
              onChange={handleInputChange}
              className="auth-input-field"
              placeholder="John"
              required
              disabled={submitting}
            />
          </div>
          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
              Last Name *
            </label>
            <input
              id="lastName"
              name="lastName"
              type="text"
              value={formData.lastName}
              onChange={handleInputChange}
              className="auth-input-field"
              placeholder="Doe"
              required
              disabled={submitting}
            />
          </div>
        </div>

        {/* Email Field */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email Address *
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleInputChange}
            className="auth-input-field"
            placeholder="john.doe@example.com"
            required
            disabled={submitting}
          />
        </div>

        {/* Password Fields */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Password *
          </label>
          <input
            id="password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleInputChange}
            className="auth-input-field"
            placeholder="Create a strong password (8+ characters)"
            required
            minLength={8}
            disabled={submitting}
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
            Confirm Password *
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            value={formData.confirmPassword}
            onChange={handleInputChange}
            className="auth-input-field"
            placeholder="Confirm your password"
            required
            disabled={submitting}
          />
        </div>

        {/* Terms and Conditions */}
        <div className="space-y-4">
          <div className="flex items-start">
            <input
              id="agreeToTerms"
              name="agreeToTerms"
              type="checkbox"
              checked={formData.agreeToTerms}
              onChange={handleInputChange}
              className="mt-1 h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
              required
              disabled={submitting}
            />
            <label htmlFor="agreeToTerms" className="ml-2 text-sm text-gray-700">
              I agree to the{" "}
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary-hover underline"
              >
                Terms of Service
              </a>{" "}
              and{" "}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary-hover underline"
              >
                Privacy Policy
              </a>{" "}
              *
            </label>
          </div>

          <div className="flex items-start">
            <input
              id="marketingOptIn"
              name="marketingOptIn"
              type="checkbox"
              checked={formData.marketingOptIn}
              onChange={handleInputChange}
              className="mt-1 h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
              disabled={submitting}
            />
            <label htmlFor="marketingOptIn" className="ml-2 text-sm text-gray-700">
              I would like to receive marketing emails about new features, updates, and tips
              <span className="text-gray-500"> (optional)</span>
            </label>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="auth-button w-full"
          disabled={submitting || !formData.agreeToTerms}
        >
          {submitting ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Creating Account...
            </span>
          ) : (
            "Create Account"
          )}
        </button>

        {/* Sign In Link */}
        <div className="text-center text-sm text-gray-600">
          Already have an account?{" "}
          <span className="text-primary font-medium">
            Use the toggle above to sign in
          </span>
        </div>
      </form>
    </div>
  );
}
