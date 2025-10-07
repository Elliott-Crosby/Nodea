import React from 'react';
import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-6 mb-4 md:mb-0">
            <Link to="/" className="text-xl font-semibold text-indigo-600">
              Nodea
            </Link>
            <p className="text-sm text-gray-500">
              Infinite canvas for AI conversations
            </p>
          </div>
          
          <div className="flex items-center space-x-6">
            <Link
              to="/terms"
              className="text-sm text-gray-600 hover:text-indigo-600 transition-colors"
            >
              Terms of Service
            </Link>
            <Link
              to="/privacy"
              className="text-sm text-gray-600 hover:text-indigo-600 transition-colors"
            >
              Privacy Policy
            </Link>
            <p className="text-sm text-gray-500">
              © {new Date().getFullYear()} Nodea. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

