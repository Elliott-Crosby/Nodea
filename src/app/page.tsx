import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default async function Home() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/app')
  } else {
    redirect('/login')
  }
}