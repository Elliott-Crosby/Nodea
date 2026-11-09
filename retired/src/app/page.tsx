import LandingContent from './_components/landing/LandingContent'

// The landing page renders for everyone, signed in or not. Logged-in users see
// an "Open canvas" button in the nav (see Nav.tsx) to jump back to /app.
export default function Home() {
  return <LandingContent />
}
