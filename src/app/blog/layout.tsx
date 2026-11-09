import { connection } from 'next/server'

export default async function BlogLayout({ children }: { children: React.ReactNode }) {
  await connection()
  return children
}
