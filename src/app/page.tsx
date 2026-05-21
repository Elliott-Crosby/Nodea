import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Nav from './_components/landing/Nav'
import Hero from './_components/landing/Hero'
import Contrast from './_components/landing/Contrast'
import Features from './_components/landing/Features'
import HowItWorks from './_components/landing/HowItWorks'
import Blog from './_components/landing/Blog'
import CtaSection from './_components/landing/CtaSection'
import Footer from './_components/landing/Footer'
import './_components/landing/landing.css'

export default async function Home() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/app')
  }

  return (
    <div className="ln-root">
      <Nav />
      <main>
        <Hero />
        <Contrast />
        <Features />
        <HowItWorks />
        <Blog />
        <CtaSection />
      </main>
      <Footer />
    </div>
  )
}
