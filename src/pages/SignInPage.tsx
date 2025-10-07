import { SignIn } from "@clerk/clerk-react";
import { Link } from "react-router-dom";

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-indigo-600 mb-4">Nodea</h1>
          <p className="text-xl text-gray-600">
            Infinite canvas for AI conversations
          </p>
        </div>
        
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <SignIn 
            appearance={{
              elements: {
                formButtonPrimary: "bg-indigo-600 hover:bg-indigo-700 text-sm normal-case",
                card: "shadow-none",
                headerTitle: "text-gray-900",
                headerSubtitle: "text-gray-600",
              },
            }}
            routing="hash"
            signUpUrl="/sign-up"
            afterSignInUrl="/"
          />
        </div>
        
        <div className="mt-6 text-center">
          <Link 
            to="/" 
            className="text-sm text-indigo-600 hover:text-indigo-500"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}


