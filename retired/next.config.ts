import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Nothing on the site is meant to be embedded in other origins'
          // frames (clickjacking guard for /app, /admin, /login).
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Force HTTPS for two years. Vercel terminates TLS for all prod
          // traffic, so this is safe to set unconditionally. No "preload" —
          // that's a hard-to-reverse commitment we shouldn't opt into here.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          // The app uses none of these powerful features — deny them so a
          // future injection / third-party script can't reach device sensors.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=(), payment=(), usb=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
